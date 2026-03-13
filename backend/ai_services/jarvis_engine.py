"""
Farg'ona JSTI Jarvis AI Engine
========================
Ikki rejim:
  1. ConsultationMonitor  вЂ” passiv tinglash, auto-diagnosis
  2. ZIYRAKChat           вЂ” interaktiv suhbat, kontekst xotirasi

Context management:
  вЂў Har bir sessiya uchun suhbat tarixi (rolling window: 20 xabar)
  вЂў Bemor ma'lumotlari, transkript, doktor so'rovlari вЂ” birgalikda kontekst
  вЂў PhysiologyFilter + AnatomyGuard вЂ” har bir ovozli so'rovda ham ishlaydi

GPT-4o (FJSTI-gpt4o) вЂ” barcha ZIYRAK so'rovlari uchun
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
# ZIYRAK system prompt
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_ZIYRAK_SYSTEM = """\
Siz "Farg'ona JSTI Jarvis" вЂ” tibbiy yordamchi AI siz.
Siz shifokorning ishonchli yordamchisi siz, bemor emas, SHIFOKORGA yordam berasiz.

VAZIFALARINGIZ:
1. Shifokor savol bersa вЂ” aniq, qisqa, klinik jihatdan to'g'ri javob bering.
2. Suhbatni kuzatib boring va yangi klinik belgilar chiqqanda shifokorni ogohlantirib turing.
3. O'zbekiston SSV protokollariga mos tavsiya bering.
4. Faqat O'zbekistonda ro'yxatdan o'tgan dori-darmonlar tavsiya qiling.
5. Shoshilinch belgi aniqlansa вЂ” DARHOL shifokorni ogohlantirib, 103 ga murojaat tavsiya qiling.

OVOZLI MULOQOT QOIDALARI:
вЂў Javoblar QISQA va ANIQ bo'lsin (max 2-3 gap).
вЂў Matnli rejim uchun biroz batafsil bo'lishi mumkin.
вЂў Suhbat kontekstini doim eslab qoling.
вЂў Bemor nomini tilga olmang вЂ” maxfiylik.

TIL: {language_hint}
"""

_ZIYRAK_SYSTEM_UZ = "Barcha javoblar O'zbek tilida (Lotin grafikasida) bo'lsin."
_ZIYRAK_SYSTEM_RU = "Р’СЃРµ РѕС‚РІРµС‚С‹ РЅР° Р СѓСЃСЃРєРѕРј СЏР·С‹РєРµ."
_ZIYRAK_SYSTEM_EN = "All responses in English."

LANG_HINTS = {
    "uz-L": _ZIYRAK_SYSTEM_UZ,
    "uz-C": "Barcha javoblar O'zbek tilida (Kirill grafikasida) bo'lsin.",
    "ru":   _ZIYRAK_SYSTEM_RU,
    "en":   _ZIYRAK_SYSTEM_EN,
    "kaa":  "Barcha javoblar Qoraqolpoq tilida bo'lsin.",
}

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Session context (in-memory + cache)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@dataclass
class ZIYRAKSession:
    session_id:   str
    doctor_id:    str
    language:     str               = "uz-L"
    patient_data: dict              = field(default_factory=dict)
    # Rolling message history (max 20 items)
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
            "messages":     list(self.messages),
            "transcript":   self.transcript,
            "created_at":   self.created_at,
            "last_active":  self.last_active,
        }

    @classmethod
    def from_cache_dict(cls, d: dict) -> "ZIYRAKSession":
        s = cls(
            session_id   = d["session_id"],
            doctor_id    = d["doctor_id"],
            language     = d.get("language", "uz-L"),
            patient_data = d.get("patient_data", {}),
            created_at   = d.get("created_at", ""),
            last_active  = d.get("last_active", time.time()),
        )
        s.transcript = d.get("transcript", [])
        for msg in d.get("messages", []):
            s.messages.append(msg)
        return s


_CACHE_TTL = 3600  # 1 soat


def _session_cache_key(session_id: str) -> str:
    return f"ZIYRAK_session_{session_id}"


def get_session(session_id: str) -> ZIYRAKSession | None:
    data = cache.get(_session_cache_key(session_id))
    if data:
        return ZIYRAKSession.from_cache_dict(data)
    return None


def save_session(session: ZIYRAKSession) -> None:
    cache.set(_session_cache_key(session.session_id),
              session.to_cache_dict(), timeout=_CACHE_TTL)


def create_session(doctor_id: str, language: str = "uz-L",
                   patient_data: dict | None = None) -> ZIYRAKSession:
    session = ZIYRAKSession(
        session_id   = f"ZIYRAK_{uuid.uuid4().hex[:12]}",
        doctor_id    = doctor_id,
        language     = language,
        patient_data = patient_data or {},
    )
    save_session(session)
    logger.info("ZIYRAK session created: %s (doctor: %s)", session.session_id, doctor_id)
    return session


def end_session(session_id: str) -> bool:
    key = _session_cache_key(session_id)
    if cache.get(key):
        cache.delete(key)
        return True
    return False


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Helper: build GPT-4o messages from session
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def _build_gpt_messages(session: ZIYRAKSession,
                        new_user_message: str) -> list[dict]:
    lang_hint = LANG_HINTS.get(session.language, _ZIYRAK_SYSTEM_UZ)
    kb_ctx    = get_uz_context(
        complaints_text = session.patient_data.get("complaints", ""),
        include_protocols = True,
    )

    system_content = _ZIYRAK_SYSTEM.format(language_hint=lang_hint) + "\n\n" + kb_ctx

    # Add patient summary if available
    pd = session.patient_data
    if pd.get("complaints"):
        patient_summary = (
            f"\nBEMOR MA'LUMOTLARI (kontekst uchun):\n"
            f"Shikoyatlar: {pd.get('complaints','')}\n"
            f"Yoshi: {pd.get('age','')}, Jinsi: {pd.get('gender','')}\n"
            f"Allergiya: {pd.get('allergies','')}\n"
            f"Dorilar: {pd.get('currentMedications','')}\n"
        )
        system_content += patient_summary

    # Add consultation transcript context
    transcript = session.get_full_transcript()
    if transcript:
        system_content += f"\n\nKONSULTATSIYA TRANSKRIPTI:\n{transcript[-2000:]}\n"

    messages: list[dict] = [{"role": "system", "content": system_content}]

    # Add rolling history
    for msg in session.messages:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # New user message
    messages.append({"role": "user", "content": new_user_message})
    return messages


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Interaktiv ZIYRAK Chat
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def ZIYRAK_chat(
    session_id:  str,
    user_message: str,
    voice_mode:  bool = True,
) -> dict:
    """
    Shifokor в†’ ZIYRAK so'rov.

    Args:
        session_id:   ZIYRAK sessiya ID.
        user_message: Shifokorning savoli (matn yoki STT orqali kelgan).
        voice_mode:   True в†’ qisqa javob (ovoz uchun), False в†’ batafsil.

    Returns:
        {
          "text":       "AI javobi",
          "session_id": "...",
          "is_critical": false,
          "critical_message": "",
        }
    """
    session = get_session(session_id)
    if not session:
        raise ValueError(f"ZIYRAK sessiyasi topilmadi: {session_id}")

    # AnatomyGuard (ovozli so'rov uchun ham)
    guard = AnatomyGuard.check(user_message, use_ai=False)
    if not guard.passed:
        save_session(session)
        return {
            "text":             guard.message,
            "session_id":      session_id,
            "is_critical":     False,
            "guard_blocked":   True,
            "filter_level":    guard.level,
        }

    # System prompt вЂ” voice mode uchun qisqa javob yo'riqnomasi
    if voice_mode:
        user_message = user_message + "\n\n[REJIM: Ovozli вЂ” QISQA va aniq javob bering, max 2-3 gap]"

    messages = _build_gpt_messages(session, user_message)

    try:
        raw = call_model(
            Deployments.gpt4o(),
            messages,
            response_json=False,
            temperature=0.2,
            max_tokens=500 if voice_mode else 1200,
        )
        response_text = raw.strip()
    except Exception as exc:
        logger.error("ZIYRAK chat failed: %s", exc)
        raise RuntimeError(f"ZIYRAK javobi xatosi: {exc}") from exc

    # Session'ga saqlash
    session.add_message("user",      user_message.replace("\n\n[REJIM:.*", ""))
    session.add_message("assistant", response_text)
    save_session(session)

    # Critical finding detection (simple keyword check)
    critical_keywords = [
        "shoshilinch", "darhol", "kritik", "hayotga xavf", "103",
        "reanimatsiya", "СЃСЂРѕС‡РЅРѕ", "РєСЂРёС‚РёС‡РЅРѕ", "emergency", "urgent"
    ]
    is_critical = any(kw in response_text.lower() for kw in critical_keywords)

    return {
        "text":             response_text,
        "session_id":      session_id,
        "is_critical":     is_critical,
        "critical_message": response_text if is_critical else "",
        "guard_blocked":   False,
    }


def ZIYRAK_chat_stream(
    session_id:   str,
    user_message: str,
    voice_mode:   bool = True,
) -> Iterator[str]:
    """Streaming version of ZIYRAK_chat вЂ” yields text chunks."""
    session = get_session(session_id)
    if not session:
        yield '[{"error": "Sessiya topilmadi"}]'
        return

    guard = AnatomyGuard.check(user_message, use_ai=False)
    if not guard.passed:
        yield guard.message
        return

    if voice_mode:
        user_message_prompt = user_message + "\n\n[REJIM: Ovozli вЂ” QISQA javob, max 2-3 gap]"
    else:
        user_message_prompt = user_message

    messages = _build_gpt_messages(session, user_message_prompt)

    full_text = ""
    try:
        client = gpt4o_client()
        stream = client.chat.completions.create(
            model       = Deployments.gpt4o(),
            messages    = messages,
            temperature = 0.2,
            max_tokens  = 500 if voice_mode else 1200,
            stream      = True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                full_text += delta
                yield delta

    except Exception as exc:
        logger.error("ZIYRAK stream error: %s", exc)
        yield f"[Xatolik: {exc}]"
        return

    # Save after streaming completes
    session.add_message("user",      user_message)
    session.add_message("assistant", full_text)
    save_session(session)


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Consultation Monitor: transcript chunk processing
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def add_transcript_to_session(
    session_id: str,
    text:       str,
    speaker:    str = "unknown",
) -> dict:
    """
    Real-time transkript bo'lagini sessiyaga qo'shish.
    Kritik belgilar aniqlansa вЂ” ogohlantirish qaytaradi.
    """
    session = get_session(session_id)
    if not session:
        return {"error": "Sessiya topilmadi"}

    session.add_transcript_chunk(speaker, text)

    # Critical keyword alert (real-time)
    critical_patterns = [
        "nafas olishim qiyin", "ko'krak og'riq", "hushdan ketdi",
        "qon tomir", "qon bosim", "yurak tutdi",
        "РґС‹С€Р°С‚СЊ С‚СЏР¶РµР»Рѕ", "Р±РѕР»СЊ РІ РіСЂСѓРґРё", "РїРѕС‚РµСЂСЏР» СЃРѕР·РЅР°РЅРёРµ",
        "chest pain", "can't breathe", "unconscious",
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
# Consultation Auto-Diagnosis (End of consultation)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_DIAGNOSIS_SYSTEM = """\
Siz tibbiy tahlil AI siz. Quyidagi shifokor-bemor suhbati asosida:
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

Quyidagi JSON formatida tahlil bering:
{{
  "patient_complaints_summary": "Bemor shikoyatlari qisqacha",
  "primary_diagnosis": {{
    "name": "Tashxis nomi",
    "icd10": "X00.0",
    "probability": 80,
    "justification": "Asoslash",
    "uzbek_protocol": "SSV protokol havolasi"
  }},
  "differential_diagnoses": [
    {{"name": "...", "probability": 20, "reason": "..."}}
  ],
  "treatment_plan": ["1-qadam...", "2-qadam..."],
  "medications": [
    {{
      "name": "Savdo nomi",
      "dosage": "...",
      "frequency": "...",
      "duration": "...",
      "instructions": "..."
    }}
  ],
  "recommended_tests": ["Tekshiruv"],
  "critical_findings": ["Shoshilinch belgi (agar bo'lsa)"],
  "follow_up": "Kuzatuv ko'rsatmasi",
  "consultation_duration_note": "Suhbat davomiyligi va sifati haqida"
}}"""


def generate_consultation_diagnosis(
    session_id: str,
    language:   str = "uz-L",
) -> dict:
    """
    Konsultatsiya yakunida suhbat transkripti asosida avtomatik tashxis.

    Args:
        session_id: ZIYRAK sessiya ID.
        language:   Chiqish tili.

    Returns:
        Tashxis, davolash rejasi va dorilar ro'yxati.
    """
    session = get_session(session_id)
    if not session:
        # Try loading from file
        from .speech_service import get_full_transcript_text
        transcript = get_full_transcript_text(session_id)
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
        return {"error": "Transkript juda qisqa, tashxis qo'yish uchun yetarli ma'lumot yo'q."}

    lang_hint = LANG_HINTS.get(language, _ZIYRAK_SYSTEM_UZ)
    kb_ctx    = get_uz_context(include_protocols=True)

    system = _DIAGNOSIS_SYSTEM.format(language_hint=lang_hint) + "\n\n" + kb_ctx
    user   = _DIAGNOSIS_USER.format(
        transcript   = transcript[:4000],
        patient_info = patient_info,
    )

    try:
        raw    = call_model(
            Deployments.gpt4o(),
            [{"role": "system", "content": system},
             {"role": "user",   "content": user}],
            response_json  = True,
            temperature    = 0.1,
            max_tokens     = 3000,
        )
        result = parse_json(raw, "consultation_diagnosis")
        if not isinstance(result, dict):
            result = {"error": "Tashxis javobi noto'g'ri formatda"}
    except Exception as exc:
        logger.error("Consultation diagnosis failed: %s", exc)
        result = {"error": str(exc)}

    result["_session_id"] = session_id
    result["_generated_at"] = timezone.now().isoformat()
    return result


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Session info / stats
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def get_session_info(session_id: str) -> dict:
    session = get_session(session_id)
    if not session:
        return {"error": "Sessiya topilmadi"}
    return {
        "session_id":        session.session_id,
        "language":          session.language,
        "created_at":        session.created_at,
        "last_active":       session.last_active,
        "message_count":     len(session.messages),
        "transcript_chunks": len(session.transcript),
        "transcript_words":  sum(
            len(r.get("text", "").split()) for r in session.transcript
        ),
        "has_patient_data":  bool(session.patient_data.get("complaints")),
    }