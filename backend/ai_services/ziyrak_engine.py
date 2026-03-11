"""
Farg'ona JSTI Ziyrak AI Engine
========================
Ikki rejim:
  1. ConsultationMonitor  - passiv tinglash, auto-diagnosis
  2. ZiyrakChat           - interaktiv suhbat, kontekst xotirasi

O'zini tanishtirish:
  "Men Farg'ona JSTI platformasining raqamli yordamchisi - Ziyrakman."

Context management:
  - Har bir sessiya uchun suhbat tarixi (rolling window: 20 xabar)
  - Bemor ma'lumotlari, transkript, doktor so'rovlari - birgalikda kontekst
  - AnatomyGuard - har bir ovozli so'rovda ham ishlaydi

GPT-4o (FJSTI-gpt4o) - barcha Ziyrak so'rovlari uchun
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Iterator

from django.core.cache import cache
from django.utils import timezone

from .azure_utils import call_model, Deployments, gpt4o_client, parse_json
from .uzbekistan_knowledge_base import get_uz_context
from .anatomy_guard import AnatomyGuard

logger = logging.getLogger(__name__)

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Ziyrak system prompt
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_ZIYRAK_INTRO = (
    "Men Farg'ona JSTI platformasining raqamli yordamchisi - Ziyrakman. "
    "Sizga tibbiy masalalarda yordam beraman."
)

_ZIYRAK_SYSTEM = """\
Siz "Farg'ona JSTI Ziyrak" вЂ” Farg'ona JSTI platformasining raqamli tibbiy yordamchisi siz.
O'zingizni shu tarzda tanishtirasiz: "Men Farg'ona JSTI platformasining raqamli yordamchisi - Ziyrakman."

Siz shifokorning ishonchli yordamchisi siz, SHIFOKORGA yordam berasiz.

VAZIFALARINGIZ:
1. Shifokor savol bersa вЂ” aniq, qisqa, klinik jihatdan to'g'ri javob bering.
2. Suhbatni kuzatib boring va yangi klinik belgilar chiqqanda shifokorni ogohlantirib turing.
3. O'zbekiston SSV protokollariga mos tavsiya bering.
4. Faqat O'zbekistonda ro'yxatdan o'tgan dori-darmonlar tavsiya qiling.
5. Shoshilinch belgi aniqlansa вЂ” DARHOL shifokorni ogohlantirib, 103 ga murojaat tavsiya qiling.

OVOZLI MULOQOT QOIDALARI:
- Javoblar QISQA va ANIQ bo'lsin (max 2-3 gap).
- Matnli rejim uchun biroz batafsil bo'lishi mumkin.
- Suhbat kontekstini doim eslab qoling.
- Bemor nomini tilga olmang вЂ” maxfiylik.

TIL: {language_hint}
"""

_LANG_HINTS = {
    "uz-L": "Barcha javoblar O'zbek tilida (Lotin grafikasida) bo'lsin.",
    "uz-C": "Barcha javoblar O'zbek tilida (Kirill grafikasida) bo'lsin.",
    "ru":   "Vse otvety na Russkom yazyke.",
    "en":   "All responses in English.",
    "kaa":  "Barcha javoblar Qoraqolpoq tilida bo'lsin.",
}

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Session context
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@dataclass
class ZiyrakSession:
    session_id:   str
    doctor_id:    str
    language:     str               = "uz-L"
    patient_data: dict              = field(default_factory=dict)
    mode:         str               = "standard"   # standard | surgery
    messages:     deque             = field(default_factory=lambda: deque(maxlen=20))
    transcript:   list[dict]        = field(default_factory=list)
    created_at:   str               = field(default_factory=lambda: timezone.now().isoformat())
    last_active:  float             = field(default_factory=time.time)

    def add_message(self, role: str, content: str) -> None:
        self.messages.append({"role": role, "content": content})
        self.last_active = time.time()

    def add_transcript_chunk(self, speaker: str, text: str) -> None:
        self.transcript.append({
            "t": round(time.time(), 2),
            "speaker": speaker,
            "text": text.strip(),
        })

    def get_full_transcript(self) -> str:
        lines = []
        for r in self.transcript:
            speaker = r.get("speaker", "?").upper()
            text    = r.get("text", "")
            if text:
                lines.append(f"[{speaker}]: {text}")
        return "\n".join(lines)

    def to_cache_dict(self) -> dict:
        return {
            "session_id":   self.session_id,
            "doctor_id":    self.doctor_id,
            "language":     self.language,
            "patient_data": self.patient_data,
            "mode":         self.mode,
            "messages":     list(self.messages),
            "transcript":   self.transcript,
            "created_at":   self.created_at,
            "last_active":  self.last_active,
        }

    @classmethod
    def from_cache_dict(cls, d: dict) -> "ZiyrakSession":
        s = cls(
            session_id   = d["session_id"],
            doctor_id    = d["doctor_id"],
            language     = d.get("language", "uz-L"),
            patient_data = d.get("patient_data", {}),
            mode         = d.get("mode", "standard"),
            created_at   = d.get("created_at", ""),
            last_active  = d.get("last_active", time.time()),
        )
        s.transcript = d.get("transcript", [])
        for msg in d.get("messages", []):
            s.messages.append(msg)
        return s


_CACHE_TTL = 3600  # 1 soat


def _cache_key(session_id: str) -> str:
    return f"ziyrak_session_{session_id}"


def get_session(session_id: str) -> ZiyrakSession | None:
    data = cache.get(_cache_key(session_id))
    return ZiyrakSession.from_cache_dict(data) if data else None


def save_session(session: ZiyrakSession) -> None:
    cache.set(_cache_key(session.session_id), session.to_cache_dict(), timeout=_CACHE_TTL)


def create_session(
    doctor_id:    str,
    language:     str  = "uz-L",
    patient_data: dict | None = None,
    mode:         str  = "standard",
) -> ZiyrakSession:
    session = ZiyrakSession(
        session_id   = f"ziyrak_{uuid.uuid4().hex[:12]}",
        doctor_id    = doctor_id,
        language     = language,
        patient_data = patient_data or {},
        mode         = mode,
    )
    save_session(session)
    logger.info("Ziyrak session created: %s mode=%s", session.session_id, mode)
    return session


def end_session(session_id: str) -> bool:
    key = _cache_key(session_id)
    if cache.get(key):
        cache.delete(key)
        return True
    return False


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# GPT-4o messages builder
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def _build_messages(session: ZiyrakSession, new_user_msg: str,
                    extra_system: str = "") -> list[dict]:
    lang_hint  = _LANG_HINTS.get(session.language, _LANG_HINTS["uz-L"])
    kb_ctx     = get_uz_context(
        complaints_text   = session.patient_data.get("complaints", ""),
        include_protocols = True,
    )
    system_content = _ZIYRAK_SYSTEM.format(language_hint=lang_hint) + "\n\n" + kb_ctx

    if extra_system:
        system_content += "\n\n" + extra_system

    pd = session.patient_data
    if pd.get("complaints"):
        system_content += (
            f"\n\nBEMOR MA'LUMOTLARI (kontekst):\n"
            f"Shikoyatlar: {pd.get('complaints','')}\n"
            f"Yoshi: {pd.get('age','')}, Jinsi: {pd.get('gender','')}\n"
            f"Allergiya: {pd.get('allergies','')}\n"
            f"Dorilar: {pd.get('currentMedications','')}\n"
        )

    transcript = session.get_full_transcript()
    if transcript:
        system_content += f"\n\nSUHBAT TRANSKRIPTI:\n{transcript[-2000:]}\n"

    messages: list[dict] = [{"role": "system", "content": system_content}]
    for msg in session.messages:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": new_user_msg})
    return messages


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Ziyrak Chat (sync)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def ziyrak_chat(
    session_id:   str,
    user_message: str,
    voice_mode:   bool = True,
) -> dict:
    """
    Shifokor в†’ Ziyrak so'rov.

    Returns:
        {
          "text":             "Ziyrak javobi",
          "session_id":       "...",
          "is_critical":      false,
          "critical_message": "",
        }
    """
    session = get_session(session_id)
    if not session:
        raise ValueError(f"Ziyrak sessiyasi topilmadi: {session_id}")

    guard = AnatomyGuard.check(user_message, use_ai=False)
    if not guard.passed:
        save_session(session)
        return {
            "text":           guard.message,
            "session_id":     session_id,
            "is_critical":    False,
            "guard_blocked":  True,
            "filter_level":   guard.level,
        }

    prompt = user_message
    if voice_mode:
        prompt += "\n\n[REJIM: Ovozli вЂ” QISQA va aniq javob, max 2-3 gap]"

    messages = _build_messages(session, prompt)

    try:
        raw  = call_model(
            Deployments.gpt4o(), messages,
            response_json=False, temperature=0.2,
            max_tokens=500 if voice_mode else 1200,
        )
        text = raw.strip()
    except Exception as exc:
        logger.error("Ziyrak chat failed: %s", exc)
        raise RuntimeError(f"Ziyrak javobi xatosi: {exc}") from exc

    session.add_message("user",      user_message)
    session.add_message("assistant", text)
    save_session(session)

    critical_kws = [
        "shoshilinch", "darhol", "kritik", "hayotga xavf", "103",
        "reanimatsiya", "urgent", "emergency", "critical",
    ]
    is_critical = any(kw in text.lower() for kw in critical_kws)

    return {
        "text":             text,
        "session_id":       session_id,
        "is_critical":      is_critical,
        "critical_message": text if is_critical else "",
        "guard_blocked":    False,
    }


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Ziyrak Chat Stream (SSE)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def ziyrak_chat_stream(
    session_id:   str,
    user_message: str,
    voice_mode:   bool = True,
) -> Iterator[str]:
    """Streaming version вЂ” yields text chunks."""
    session = get_session(session_id)
    if not session:
        yield '[{"error": "Sessiya topilmadi"}]'
        return

    guard = AnatomyGuard.check(user_message, use_ai=False)
    if not guard.passed:
        yield guard.message
        return

    prompt = user_message + ("\n\n[REJIM: Ovozli вЂ” QISQA javob, max 2-3 gap]" if voice_mode else "")
    messages = _build_messages(session, prompt)

    full_text = ""
    try:
        client = gpt4o_client()
        stream = client.chat.completions.create(
            model=Deployments.gpt4o(), messages=messages,
            temperature=0.2,
            max_tokens=500 if voice_mode else 1200,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                full_text += delta
                yield delta
    except Exception as exc:
        logger.error("Ziyrak stream error: %s", exc)
        yield f"[Xatolik: {exc}]"
        return

    session.add_message("user",      user_message)
    session.add_message("assistant", full_text)
    save_session(session)


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Transcript helpers
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def add_transcript_to_session(
    session_id: str, text: str, speaker: str = "unknown"
) -> dict:
    session = get_session(session_id)
    if not session:
        return {"error": "Sessiya topilmadi"}

    session.add_transcript_chunk(speaker, text)

    critical_patterns = [
        "nafas olishim qiyin", "ko'krak og'riq", "hushdan ketdi",
        "qon tomir", "yurak tutdi",
        "dyshat tyazhelo", "chest pain", "unconscious",
    ]
    is_critical = any(p in text.lower() for p in critical_patterns)
    save_session(session)

    from .speech_service import save_transcript_chunk
    save_transcript_chunk(session_id, text, speaker)

    return {
        "saved":       True,
        "is_critical": is_critical,
        "alert":       "SHOSHILINCH: Muhim klinik belgi aniqlandi!" if is_critical else "",
    }


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Auto-Diagnosis (Consultation end)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_DIAGNOSIS_SYSTEM = """\
Siz Ziyrak вЂ” tibbiy tahlil AI. Quyidagi shifokor-bemor suhbati asosida:
1. Bemor shikoyatlarini QISQACHA jamla.
2. Eng ehtimoliy taxminiy tashxis (ICD-10 bilan).
3. O'zbekiston SSV protokoliga mos davolash rejasi.
4. Tavsiya etilgan dori-darmonlar (faqat O'zbekistonda ro'yxatdan o'tganlar).
5. Qo'shimcha tekshiruvlar.
6. Shoshilinch belgilar (agar aniqlangan bo'lsa).

O'zbekiston Respublikasi SSV protokollariga QATIY rioya qiling.
Barcha javoblar {language_hint} bo'lsin.
FAQAT JSON formatida javob qaytaring."""

_DIAGNOSIS_USER = """\
SUHBAT TRANSKRIPTI:
{transcript}

BEMOR QISQACHA MA'LUMOTI:
{patient_info}

JSON formatida tahlil bering:
{{
  "patient_complaints_summary": "Bemor shikoyatlari qisqacha",
  "primary_diagnosis": {{
    "name": "Tashxis nomi",
    "icd10": "X00.0",
    "probability": 80,
    "justification": "Asoslash",
    "uzbek_protocol": "SSV protokol havolasi"
  }},
  "differential_diagnoses": [{{"name": "...", "probability": 20, "reason": "..."}}],
  "treatment_plan": ["1-qadam...", "2-qadam..."],
  "medications": [{{"name": "Savdo nomi","dosage":"...","frequency":"...","duration":"...","instructions":"..."}}],
  "recommended_tests": ["Tekshiruv"],
  "critical_findings": ["Shoshilinch belgi (agar bo'lsa)"],
  "follow_up": "Kuzatuv ko'rsatmasi",
  "consultation_duration_note": "Suhbat sifati haqida"
}}"""


def generate_consultation_diagnosis(
    session_id: str, language: str = "uz-L"
) -> dict:
    """Konsultatsiya yakunida suhbat asosida avtomatik tashxis."""
    session = get_session(session_id)
    if not session:
        from .speech_service import get_full_transcript_text
        transcript   = get_full_transcript_text(session_id)
        patient_info = ""
    else:
        transcript   = session.get_full_transcript()
        pd           = session.patient_data
        patient_info = (
            f"Yoshi: {pd.get('age','')}, Jinsi: {pd.get('gender','')}\n"
            f"Allergiya: {pd.get('allergies','')}\n"
            f"Joriy dorilar: {pd.get('currentMedications','')}\n"
        )

    if len(transcript.strip()) < 50:
        return {"error": "Transkript juda qisqa, tashxis uchun yetarli ma'lumot yo'q."}

    lang_hint = _LANG_HINTS.get(language, _LANG_HINTS["uz-L"])
    kb_ctx    = get_uz_context(include_protocols=True)
    system    = _DIAGNOSIS_SYSTEM.format(language_hint=lang_hint) + "\n\n" + kb_ctx
    user      = _DIAGNOSIS_USER.format(
        transcript=transcript[:4000], patient_info=patient_info
    )

    try:
        raw    = call_model(
            Deployments.gpt4o(),
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_json=True, temperature=0.1, max_tokens=3000,
        )
        result = parse_json(raw, "consultation_diagnosis")
        if not isinstance(result, dict):
            result = {"error": "Tashxis javobi noto'g'ri formatda"}
    except Exception as exc:
        logger.error("Consultation diagnosis failed: %s", exc)
        result = {"error": str(exc)}

    result["_session_id"]    = session_id
    result["_generated_at"]  = timezone.now().isoformat()
    return result


def get_session_info(session_id: str) -> dict:
    session = get_session(session_id)
    if not session:
        return {"error": "Sessiya topilmadi"}
    return {
        "session_id":        session.session_id,
        "mode":              session.mode,
        "language":          session.language,
        "created_at":        session.created_at,
        "last_active":       session.last_active,
        "message_count":     len(session.messages),
        "transcript_chunks": len(session.transcript),
        "transcript_words":  sum(
            len(r.get("text","").split()) for r in session.transcript
        ),
        "has_patient_data":  bool(session.patient_data.get("complaints")),
    }