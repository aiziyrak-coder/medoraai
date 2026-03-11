"""
Ziyrak-Operatsiya Moduli (Surgery Mode)
=========================================
Jarrohlar uchun maxsus AI yordamchi:

  1. Hands-free voice control  вЂ” faqat ovoz orqali boshqarish
  2. Emergency Protocols       вЂ” favqulodda holat protokollari (HLS)
  3. Anatomical Intelligence   вЂ” 100% anatomik bilim + ogohlantirish
  4. Surgery Log               вЂ” barcha muloqotni yozib borish
  5. O'zbekiston SSV protokoli вЂ” milliy jarrohlik standartlari

Arxitektura:
  SurgerySession (kesh + disk)
  в†’ GPT-4o (AiDoktor-gpt4o) real-vaqt javoblar
  в†’ AnatomyGuard Level-1 har bir buyruqda
  в†’ Favqulodda kalitlarga avtomatik javob (<1 soniya)
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from django.core.cache import cache
from django.utils import timezone

from .azure_utils import call_model, Deployments, parse_json
from .uzbekistan_knowledge_base import get_uz_context, get_surgery_context

logger = logging.getLogger(__name__)

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# O'zbekiston Milliy Jarrohlik Protokollari
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

UZBEKISTAN_SURGERY_PROTOCOLS = {
    "qon_ketish": {
        "name": "Intraoperativ Qon Ketish Protokoli",
        "ref":  "O'zRSPQ buyrug'i в„–248 вЂ” 'Jarrohlikda qon yo'qotishni boshqarish'",
        "steps": [
            "1. Qon ketish manbini aniqlash: arterial, venoz, kapillyar",
            "2. To'g'ridan-to'g'ri bosim, tamponad yoki ligasyon",
            "3. Qon o'rin bosuvchilar: kristalloidlar 3:1 nisbatda, kolloidlar",
            "4. Qon mahsulotlari: ergo 1:1:1 (eritrotsitlar:trombositlar:plazma)",
            "5. Vazopresorlar: norepinefrin 0.01-3 mkg/kg/min",
            "6. Kaltsiy xlorid 10% вЂ” 10 ml IV (massiv transfuziyada)",
            "7. Traneksamik kislota 1g IV вЂ” birinchi 3 soatda",
            "8. DIC sindrom monitoring: PTZ, APTT, fibrinogen",
        ],
        "critical_threshold": "500 ml/soat qon yo'qotish",
        "emergency_call":     "103 yoki reanimatolog",
    },
    "anesteziya_muammosi": {
        "name": "Anesteziya Asoratlari Protokoli",
        "ref":  "O'zbekiston Anesteziologlar Assotsiatsiyasi ko'rsatmasi (2023)",
        "steps": [
            "1. Laryngospazm: Suksinilxolin 1-2 mg/kg IV, reintubatsiya",
            "2. Bronxospazm: Salbutamol inhalyasiya, gidrokortizon 200mg IV",
            "3. Anafilaksiya: Adrenalin 0.3-0.5mg IM, gidrokortizon, antigistaРјРёРЅlar",
            "4. Malinoz gipertermiya: Dantrolen 2.5mg/kg IV, muzdek tuzli eritma",
            "5. Aspiratsiya: Tez intubatsiya, bronxoskopiya, antibiotik profilaktika",
            "6. Total spinal blok: Nafas qo'llab-quvvatlash, vazopresorlar",
            "7. MH protokol: Dantrolene 2.5mg/kg har 5 daqiqada max 10mg/kg",
        ],
        "emergency_call": "Anesteziolog + ICU",
    },
    "yurak_toxtatish": {
        "name": "Operatsiya Stolida YuO'T Protokoli вЂ” Advanced Cardiac Life Support",
        "ref":  "O'zbekiston Reanimatologlar Protokoli / AHA 2020 ko'rsatmasi",
        "steps": [
            "IMMEDIATE STEPS вЂ” DARHOL:",
            "1. Jarrohlikni to'xtatish (agar mumkin bo'lsa)",
            "2. Sternotomiya yoki to'g'ridan-to'g'ri yurak massaji",
            "3. Adrenalin 1mg IV/IO har 3-5 daqiqada",
            "4. VF/VT: Defibrillyasiya 200J (bifazik) yoki 360J (monofazik)",
            "5. Amiodarone 300mg IV bolus (VF uchun)",
            "6. Nafas: 100% kislorod, intubatsiya",
            "7. CPR davom: 30:2 nisbat (intubatsiya bo'lmagan)",
            "8. Post-ROSC: Targeted Temperature Management 32-36В°C",
        ],
        "reversible_causes": "4H4T: Gipoksiya, Gipotermiya, Gipo/Giperkaliyemiya, Gipoglikemiya; Tromboz (koronar/o'pka), Tamponad, Tos, Toksik",
        "emergency_call": "103 вЂ” Reanimasiya brigada",
    },
    "nafas_etishmovchiligi": {
        "name": "Intraoperativ Nafas Etishmovchiligi",
        "ref":  "SSV Anesteziologiya protokoli",
        "steps": [
            "1. SpO2 < 90%: O2 konsentratsiyasini oshirish, PEEP",
            "2. Desaturatsiya sababi: Atelektaz, bronxospazm, pnevmotoraks",
            "3. Pnevmotoraks: Darhol 2-qovurg'a, o'rta o'tkazuvchi yo'nalish bo'yicha igna torakosentezi",
            "4. Qo'l-oyoqlarni baland ko'tarish (trendelenburg pozisiya QARSHI)",
            "5. PEEP 5-15 cmH2O, tidal volume 6-8 ml/kg",
            "6. Alveol recruitment maneuver 40 cmH2O 40 soniya",
        ],
        "emergency_call": "Pulmonolog + ICU",
    },
    "septik_shok": {
        "name": "Intraoperativ Septik Shok",
        "ref":  "SSV Jarrohlik infeksiyalari protokoli / Surviving Sepsis Campaign 2021",
        "steps": [
            "1. Qon bosimi < 65 mmHg: Norepinefrin 0.01 mkg/kg/min boshla",
            "2. 1 soatda 30 ml/kg kristalloid (bolus)",
            "3. Qon madaniyat namunalari ANTIBIOTIKDAN OLDIN",
            "4. Antibiotik: Piperasillin/Tazobaktam 4.5g IV YOKI Meropenem 1g IV",
            "5. Kortikosteroidlar: Gidrokortizon 200mg/kun (infuziya)",
            "6. Laktilat darajasi kuzatuvi: maqsad < 2 mmol/L",
            "7. CVP monitoring: maqsad 8-12 mmHg",
        ],
        "emergency_call": "ICU transfer, infeksionist maslahati",
    },
}

# Tez javob kalitlari (1 soniya ichida)
RAPID_RESPONSE_KEYWORDS = {
    "qon ketish":          "qon_ketish",
    "bleeding":            "qon_ketish",
    "gemorragiya":         "qon_ketish",
    "anesteziya muammosi": "anesteziya_muammosi",
    "anesteziya asorat":   "anesteziya_muammosi",
    "yurak toxtatish":     "yurak_toxtatish",
    "yurak to'xtadi":      "yurak_toxtatish",
    "cardiac arrest":      "yurak_toxtatish",
    "YuOT":                "yurak_toxtatish",
    "nafas etishmovchilik": "nafas_etishmovchiligi",
    "desaturatsiya":       "nafas_etishmovchiligi",
    "septik shok":         "septik_shok",
    "sepsis":              "septik_shok",
}

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Surgery Session
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@dataclass
class SurgerySession:
    session_id:     str
    doctor_id:      str
    language:       str        = "uz-L"
    operation_type: str        = "Umumiy jarrohlik"
    log:            list[dict] = field(default_factory=list)
    emergency_log:  list[dict] = field(default_factory=list)
    created_at:     str        = field(default_factory=lambda: timezone.now().isoformat())
    is_active:      bool       = True

    def add_log(self, speaker: str, text: str, event_type: str = "command") -> None:
        self.log.append({
            "t":          round(time.time(), 2),
            "ts":         timezone.now().isoformat(),
            "speaker":    speaker,
            "text":       text,
            "event_type": event_type,
        })

    def to_dict(self) -> dict:
        return {
            "session_id":     self.session_id,
            "doctor_id":      self.doctor_id,
            "language":       self.language,
            "operation_type": self.operation_type,
            "log":            self.log,
            "emergency_log":  self.emergency_log,
            "created_at":     self.created_at,
            "is_active":      self.is_active,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "SurgerySession":
        s = cls(
            session_id     = d["session_id"],
            doctor_id      = d["doctor_id"],
            language       = d.get("language", "uz-L"),
            operation_type = d.get("operation_type", ""),
            created_at     = d.get("created_at", ""),
            is_active      = d.get("is_active", True),
        )
        s.log           = d.get("log", [])
        s.emergency_log = d.get("emergency_log", [])
        return s


_SURGERY_CACHE_TTL = 14400  # 4 soat (uzun operatsiya uchun)


def _surgery_cache_key(sid: str) -> str:
    return f"ziyrak_surgery_{sid}"


def _get_surgery_session(session_id: str) -> SurgerySession | None:
    data = cache.get(_surgery_cache_key(session_id))
    return SurgerySession.from_dict(data) if data else None


def _save_surgery_session(session: SurgerySession) -> None:
    cache.set(_surgery_cache_key(session.session_id),
              session.to_dict(), timeout=_SURGERY_CACHE_TTL)
    _persist_surgery_log(session)


def _persist_surgery_log(session: SurgerySession) -> None:
    """Operatsiya logini diskka saqlash (HIPAA uchun doimiy zaxira)."""
    from django.conf import settings as dj_settings
    base = Path(getattr(dj_settings, "MEDIA_ROOT", "/tmp/AiDoktor_media"))
    log_dir = base / "surgery_logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"{session.session_id}.json"
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Public API
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def create_surgery_session(
    doctor_id:      str,
    language:       str = "uz-L",
    operation_type: str = "Umumiy jarrohlik",
) -> dict:
    """Yangi operatsiya sessiyasini yaratish."""
    session = SurgerySession(
        session_id     = f"surgery_{uuid.uuid4().hex[:12]}",
        doctor_id      = doctor_id,
        language       = language,
        operation_type = operation_type,
    )
    session.add_log("system", f"Operatsiya sessiyasi ochildi: {operation_type}", "init")
    _save_surgery_session(session)

    lang_hint = {"uz-L": "O'zbek", "ru": "Rus", "en": "Ingliz"}.get(language, "O'zbek")
    greeting  = (
        f"Men Ziyrak вЂ” AiDoktor platformasining raqamli yordamchisi. "
        f"Operatsiya xonasida sizga xizmatdaman. "
        f"Operatsiya turi: {operation_type}. "
        f"Javoblar {lang_hint} tilida."
    )

    logger.info("Surgery session created: %s op=%s", session.session_id, operation_type)
    return {
        "session_id":     session.session_id,
        "operation_type": operation_type,
        "language":       language,
        "created_at":     session.created_at,
        "greeting":       greeting,
        "mode":           "surgery",
    }


def process_surgery_command(
    session_id: str,
    command:    str,
    language:   str = "uz-L",
) -> dict:
    """
    Jarroh ovozli buyrug'ini qayta ishlash.
    Tezlik: <2 soniya (favqulodda holat uchun tezroq).
    """
    from .anatomy_guard import AnatomyGuard

    session = _get_surgery_session(session_id)
    # Session topilmasa ham ishlaydi (real-time uchun)
    if not session:
        session = SurgerySession(
            session_id = session_id,
            doctor_id  = "unknown",
            language   = language,
        )

    # Anatomy Guard
    guard = AnatomyGuard.check(command, use_ai=False)
    if not guard.passed:
        session.add_log("guard", guard.message, "blocked")
        _save_surgery_session(session)
        return {
            "response":   guard.message,
            "is_emergency": False,
            "guard_blocked": True,
        }

    # Tezkor favqulodda kalitlarni tekshirish
    lower = command.lower()
    for keyword, protocol_key in RAPID_RESPONSE_KEYWORDS.items():
        if keyword in lower:
            result = _get_rapid_emergency_response(protocol_key, language, session)
            session.add_log("doctor",  command,              "voice_command")
            session.add_log("ziyrak",  result["response"],   "emergency_response")
            session.add_log("system",  f"EMERGENCY: {protocol_key}", "emergency_trigger")
            session.emergency_log.append({
                "t":            round(time.time(), 2),
                "command":      command,
                "protocol":     protocol_key,
                "response":     result["response"][:200],
            })
            _save_surgery_session(session)
            return result

    # Oddiy so'rov вЂ” GPT-4o
    response = _call_surgery_ai(command, session, language)
    session.add_log("doctor", command,  "voice_command")
    session.add_log("ziyrak", response, "ai_response")
    _save_surgery_session(session)

    return {
        "response":       response,
        "is_emergency":   False,
        "session_id":     session_id,
        "log_count":      len(session.log),
    }


def handle_emergency(
    session_id:     str,
    emergency_type: str,
    language:       str = "uz-L",
) -> dict:
    """
    Favqulodda holat protokolini to'liq qaytarish.
    emergency_type: qon_ketish | anesteziya_muammosi | yurak_toxtatish | ...
    """
    session = _get_surgery_session(session_id)

    # Protokoldan tezkor javob
    protocol  = UZBEKISTAN_SURGERY_PROTOCOLS.get(emergency_type)
    if not protocol:
        # Umumiy protokol
        protocol = {
            "name": f"Favqulodda: {emergency_type}",
            "steps": [
                "1. Operatsiyani vaqtincha to'xtatish",
                "2. Bemorni barqarorlash",
                "3. Hamkasblarga yordam chaqirish",
                "4. 103 вЂ” Shoshilinch yordam",
            ],
            "emergency_call": "103",
        }

    # AI dan batafsilroq protokol
    ai_response = _emergency_ai_response(emergency_type, protocol, language)

    # Brief TTS uchun qisqa xulosa
    protocol_summary = (
        f"Favqulodda holat: {protocol['name']}. "
        f"Birinchi qadam: {protocol['steps'][0] if protocol['steps'] else 'Darhol yordam chaqiring'}. "
        f"Yordam: {protocol.get('emergency_call', '103')}"
    )

    if session:
        session.emergency_log.append({
            "t":           round(time.time(), 2),
            "type":        emergency_type,
            "protocol":    protocol["name"],
            "summary":     protocol_summary,
        })
        session.add_log("system", f"EMERGENCY PROTOCOL: {emergency_type}", "emergency")
        _save_surgery_session(session)

    return {
        "emergency_type":    emergency_type,
        "protocol_name":     protocol["name"],
        "protocol_ref":      protocol.get("ref", ""),
        "steps":             protocol["steps"],
        "emergency_call":    protocol.get("emergency_call", "103"),
        "reversible_causes": protocol.get("reversible_causes", ""),
        "protocol_summary":  protocol_summary,
        "detailed_response": ai_response,
        "critical_threshold": protocol.get("critical_threshold", ""),
        "uzbek_protocol":    True,
    }


def get_surgery_log(session_id: str) -> dict:
    """Operatsiya logini qaytarish."""
    session = _get_surgery_session(session_id)
    if not session:
        # Diskdan o'qishga urinish
        from django.conf import settings as dj_settings
        base = Path(getattr(dj_settings, "MEDIA_ROOT", "/tmp/AiDoktor_media"))
        log_path = base / "surgery_logs" / f"{session_id}.json"
        if log_path.exists():
            with open(log_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {
                "session_id":     session_id,
                "log":            data.get("log", []),
                "emergency_log":  data.get("emergency_log", []),
                "operation_type": data.get("operation_type", ""),
                "created_at":     data.get("created_at", ""),
                "log_count":      len(data.get("log", [])),
            }
        return {"error": "Surgery log topilmadi", "session_id": session_id}

    return {
        "session_id":     session_id,
        "operation_type": session.operation_type,
        "log":            session.log,
        "emergency_log":  session.emergency_log,
        "created_at":     session.created_at,
        "log_count":      len(session.log),
        "emergency_count": len(session.emergency_log),
    }


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Internal AI calls
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_SURGERY_SYSTEM = """\
Siz Ziyrak вЂ” AiDoktor platformasining raqamli yordamchisi.
Hozir OPERATSIYA XONASIDA jarrohga yordamasiz.

OPERATSIYA XONASI QOIDALARI:
1. Javoblar JUDA QISQA (1-2 gap) va ANIQ bo'lsin вЂ” jarrohning diqqati bemorda.
2. Har bir anatomik ma'lumot 100% to'g'ri bo'lishi shart.
3. Anatomik xato ko'rsangiz вЂ” DARHOL ogohlantiring.
4. Favqulodda holatda BIRINCHI qadam va YORDAM RAQAMI ko'rsating.
5. O'zbekiston milliy jarrohlik protokollariga rioya qiling.
6. Operatsiya turi: {operation_type}
7. Til: {language_hint}
"""

_SURGERY_ANATOMY_SYSTEM = """\
Siz anatomik bilim bo'yicha 100% aniq javob berasiz.
Agar anatomik jihatdan xato ko'rsangiz, DARHOL ogohlantiring:
"DIQQAT: Bu anatomik jihatdan to'g'ri emas!"
"""


def _call_surgery_ai(
    command:  str,
    session:  SurgerySession,
    language: str,
) -> str:
    """Surgery rejimida GPT-4o ga so'rov."""
    lang_hints = {"uz-L": "O'zbek (Lotin)", "ru": "Rus", "en": "English"}
    lang_hint  = lang_hints.get(language, "O'zbek (Lotin)")
    kb_ctx      = get_uz_context(include_protocols=True)
    surgery_ctx = get_surgery_context(session.operation_type)

    system = (
        _SURGERY_SYSTEM.format(
            operation_type = session.operation_type,
            language_hint  = lang_hint,
        )
        + "\n\n" + kb_ctx
        + "\n\n" + surgery_ctx
    )

    # Oxirgi 5 ta log yozuv
    recent_log = "\n".join(
        f"[{e['speaker'].upper()}]: {e['text']}"
        for e in session.log[-5:]
    )
    if recent_log:
        system += f"\n\nOXIRGI MULOQOT:\n{recent_log}"

    try:
        return call_model(
            Deployments.gpt4o(),
            [{"role": "system", "content": system},
             {"role": "user",   "content": command}],
            response_json = False,
            temperature   = 0.1,
            max_tokens    = 300,
        ).strip()
    except Exception as exc:
        logger.error("Surgery AI call failed: %s", exc)
        return f"Xatolik yuz berdi. Iltimos, hamkasblaringizga murojaat qiling."


def _get_rapid_emergency_response(
    protocol_key: str,
    language:     str,
    session:      SurgerySession,
) -> dict:
    """Juda tez (<1s) favqulodda javob вЂ” oldindan tayyorlangan protokol."""
    protocol  = UZBEKISTAN_SURGERY_PROTOCOLS.get(protocol_key, {})
    name      = protocol.get("name", f"Favqulodda: {protocol_key}")
    steps     = protocol.get("steps", ["Darhol yordam chaqiring"])
    call_num  = protocol.get("emergency_call", "103")

    # Birinchi 3 qadamni qisqa shakl
    brief_steps = steps[:3]
    lang_map = {
        "uz-L": f"FAVQULODDA: {name}. {' | '.join(brief_steps)}. Yordam: {call_num}",
        "ru":   f"EXTRENO: {name}. Shagi: {' | '.join(brief_steps[:2])}. Pomosh: {call_num}",
        "en":   f"EMERGENCY: {name}. Steps: {' | '.join(brief_steps[:2])}. Call: {call_num}",
    }
    response = lang_map.get(language, lang_map["uz-L"])

    return {
        "response":       response,
        "is_emergency":   True,
        "protocol_name":  name,
        "protocol_key":   protocol_key,
        "full_steps":     steps,
        "emergency_call": call_num,
        "session_id":     session.session_id,
    }


def _emergency_ai_response(
    emergency_type: str,
    protocol:       dict,
    language:       str,
) -> str:
    """AI dan batafsilroq favqulodda protokol."""
    lang_hints = {"uz-L": "O'zbek (Lotin)", "ru": "Rus", "en": "English"}
    lang_hint  = lang_hints.get(language, "O'zbek (Lotin)")
    kb_ctx     = get_uz_context(include_protocols=True)

    system = (
        f"Siz Ziyrak вЂ” operatsiya xonasining tibbiy yordamchisi.\n"
        f"Favqulodda holat: {emergency_type}\n"
        f"Protokol: {protocol.get('name','')}\n"
        f"Til: {lang_hint}\n\n"
        f"{kb_ctx}\n\n"
        f"Protokol qadamlari asosida qisqa, aniq va amaliy ko'rsatma bering. Max 5 gap."
    )
    user = (
        f"Favqulodda holat: {emergency_type}\n"
        f"Protokol qadamlari: {json.dumps(protocol.get('steps', []), ensure_ascii=False)}\n"
        f"Jarrohga eng muhim 3 qadamni bering."
    )

    try:
        return call_model(
            Deployments.gpt4o(),
            [{"role": "system", "content": system},
             {"role": "user",   "content": user}],
            response_json = False,
            temperature   = 0.05,
            max_tokens    = 400,
        ).strip()
    except Exception as exc:
        logger.error("Emergency AI response failed: %s", exc)
        steps = protocol.get("steps", [])
        return " | ".join(steps[:3]) if steps else "Darhol yordam chaqiring: 103"