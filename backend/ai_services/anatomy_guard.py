"""
Anatomy Guard вЂ” Production-Ready Middleware & Decorator
========================================================

Har bir AI so'rovini ikki darajada tekshiradi:

  Level 1 вЂ“ FAST RULE-BASED CHECK  (regex, <1ms, AI chaqirmasdan)
    вЂў Anatomik imkonsiz joylashishlar  (tizzadagi oshqozon, ko'zdagi yurak ...)
    вЂў Aldamchi / sinov so'rovlar       (men mushukman, zaharni qancha berish ...)
    вЂў Fiziologik ziddiyatlar           (5 yoshda, 30 yillik kasallik ...)
    вЂў Prompt injection                 (ignore previous, jailbreak ...)

  Level 2 вЂ“ SEMANTIC AI CHECK  (AiDoktor-mini, ~500ms, faqat shubhada)
    вЂў Chuqur semantik tahlil
    вЂў Kontekstga bog'liq anatomik xatolar
    вЂў Murakkab mantiqiy ziddiyatlar

Ishlatish usullari:
  1. Django Middleware  в†’  settings.py MIDDLEWARE ga qo'shiladi
  2. View Decorator     в†’  @anatomy_guard() dekorator sifatida
  3. Direct call        в†’  AnatomyGuard.check(patient_data)

Natija: GuardResult(passed, level, message, details)
"""

from __future__ import annotations

import functools
import json
import logging
import re
from dataclasses import dataclass
from typing import Callable

logger = logging.getLogger(__name__)

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Result
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@dataclass
class GuardResult:
    passed:  bool
    level:   str    # "ok" | "anatomic" | "deceptive" | "contradiction" | "injection"
    message: str
    details: str

    def to_dict(self) -> dict:
        return {"passed": self.passed, "level": self.level,
                "message": self.message, "details": self.details}

PASS_RESULT = GuardResult(passed=True, level="ok", message="", details="")


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Level 1 вЂ“ Rule-based checks
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

# Anatomik jihatdan imkonsiz organвЂ“joy juftliklari (O'zbek + Rus + English)
_ANATOMIC_RULES: list[tuple[str, str]] = [
    # (organ) + (noto'g'ri joy)
    (
        r"\b(oshqozon|me[''']da|jigar|buyrak|o[''']pka|o'pka|yurak|ichak|taloq"
        r"|qalqonsimon|prostata|bachadon)\b.{0,60}"
        r"\b(tizza|tirsak|bilak|barmoq|bosh|yonoq|quloq|ko[''']z|burun|yelka"
        r"|boldir|tos|dum gajak|tos suyak)\b",
        "organ_anatomik_xato_uz",
    ),
    (
        r"\b(tizza|tirsak|bilak|barmoq|yonoq|quloq|ko[''']z|burun)\b.{0,60}"
        r"\b(oshqozon|me[''']da|jigar|buyrak|o[''']pka|yurak|taloq)\b",
        "organ_joy_teskari_xato_uz",
    ),
    # Russian anatomic errors
    (
        r"\b(Р¶РµР»СѓРґРѕРє|РїРµС‡РµРЅСЊ|РїРѕС‡РєРё?|Р»С‘РіРєРё[РµС…]|СЃРµСЂРґС†Рµ|РєРёС€РµС‡РЅРёРє|СЃРµР»РµР·С‘РЅРєР°)\b.{0,60}"
        r"\b(РєРѕР»РµРЅ[РѕРё]|Р»РѕРєС‚[РµС‘]|Р·Р°РїСЏСЃС‚|РїР°Р»СЊС†|РіРѕР»РѕРІ[Р°Рµ]|С‰РµРє[Р°Рµ]|СѓС€[РµРё]|РіР»Р°Р·[Р°Рµ])\b",
        "organ_anatomic_error_ru",
    ),
    # English
    (
        r"\b(stomach|liver|kidney|lung|heart|intestine|spleen)\b.{0,60}"
        r"\b(knee|elbow|wrist|finger|head|cheek|ear|eye|nose)\b",
        "organ_anatomic_error_en",
    ),
]

# Aldamchi / test so'rovlar
_DECEPTIVE_RULES: list[tuple[str, str]] = [
    (r"\bmen\s+(mushukman|itman|robotman|AIman|kompyuterman|hayvonman)\b",
     "inson_emas_uz"),
    (r"\b(СЏ\s+РєРѕС‚|СЏ\s+СЂРѕР±РѕС‚|СЏ\s+Р¶РёРІРѕС‚РЅРѕРµ)\b",
     "inson_emas_ru"),
    (r"\bi\s+am\s+a?\s*(cat|robot|dog|animal|ai|computer)\b",
     "inson_emas_en"),
    (r"\b(zahar\s+(ber|ichi)|o[''']ldirish\s+uchun|zaharla[r]?|suiiste[''']mol)\b",
     "xavfli_sorov"),
    (r"\b(yadu|РєР°Рє\s+РѕС‚СЂР°РІРёС‚СЊ|how\s+to\s+poison|how\s+to\s+kill)\b",
     "xavfli_sorov_global"),
    (r"\b(test\s+savol|sinov\s+uchun|dummy\s+patient|fake\s+case)\b",
     "sinov_sorov"),
]

# Prompt injection
_INJECTION_RULES: list[tuple[str, str]] = [
    (r"(ignore\s+(all\s+)?previous|forget\s+(all\s+)?instructions|"
     r"jailbreak|DAN\s+mode|act\s+as\s+(a|an)?\s*(DAN|villain|hacker)|"
     r"pretend\s+you\s+(are|have\s+no)\s*(restriction|limit)|"
     r"you\s+are\s+now\s+(free|unrestricted|evil))",
     "prompt_injection"),
    (r"(sistem\s+promptni\s+o[''']chir|tizim\s+ko[''']rsatmalarni\s+e[''']tiborsiz)",
     "prompt_injection_uz"),
]

# Fiziologik ziddiyat: yosh < kasallik yili
_PHYSIO_CONTRADICTION = re.compile(
    r"(\d{1,3})\s*yosh.{0,80}(\d{1,3})\s*(yil(?:dan\s*beri|(?:\s+avval)?|(?:\s+mobaynida)?))",
    re.IGNORECASE,
)


def _level1_check(text: str) -> GuardResult | None:
    lower = text.lower()

    for pattern, tag in _ANATOMIC_RULES:
        if re.search(pattern, lower, re.IGNORECASE | re.DOTALL):
            return GuardResult(
                passed  = False,
                level   = "anatomic",
                message = (
                    "Inson anatomiyasiga ko'ra bu joylashuv tibbiy jihatdan mumkin emas. "
                    "Iltimos, simptomlar va ularning aniq joylashuvini qayta ko'rib chiqing."
                ),
                details = f"L1-anatomic: {tag}",
            )

    for pattern, tag in _DECEPTIVE_RULES:
        if re.search(pattern, lower, re.IGNORECASE):
            return GuardResult(
                passed  = False,
                level   = "deceptive",
                message = (
                    "Bu so'rov tibbiy maslahat maqsadiga mos emas. "
                    "Iltimos, haqiqiy tibbiy holatingizni tasvirlang."
                ),
                details = f"L1-deceptive: {tag}",
            )

    for pattern, tag in _INJECTION_RULES:
        if re.search(pattern, lower, re.IGNORECASE):
            return GuardResult(
                passed  = False,
                level   = "injection",
                message = "Bu so'rov tizimga kirib borish urinishi sifatida aniqlandi.",
                details = f"L1-injection: {tag}",
            )

    # Fiziologik ziddiyat
    m = _PHYSIO_CONTRADICTION.search(text)
    if m:
        try:
            age, years = int(m.group(1)), int(m.group(2))
            if years >= age:
                return GuardResult(
                    passed  = False,
                    level   = "contradiction",
                    message = (
                        f"Ma'lumotlarda ziddiyat: {age} yoshli bemor {years} yildan beri "
                        "kasalligi biologik jihatdan imkonsiz. Iltimos, ma'lumotlarni tekshiring."
                    ),
                    details = f"L1-contradiction: age={age} yrs={years}",
                )
        except ValueError:
            pass

    return None


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Level 2 вЂ“ Semantic AI check (mini model)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_L2_SYSTEM = """\
Siz tibbiy ma'lumot tekshiruvchisi siz. Berilgan klinik matnda:
1. Anatomik xato: Organ inson tanasida mavjud bo'lmagan joyda tasvirlangan?
2. Fiziologik imkonsizlik: Holatlar biologik jihatdan mumkin emas?
3. Aldov: Ma'lumot tibbiy maqsaddan boshqa niyatda?
4. Oddiy: Tibbiy jihatdan mantiqiy ma'lumot.

FAQAT JSON: {"status":"ok"|"anatomic"|"physiologic"|"deceptive","reason":"..."}"""


def _level2_check(text: str) -> GuardResult | None:
    try:
        from .azure_utils import call_model, build_messages, parse_json, Deployments
        raw = call_model(
            Deployments.mini(),
            build_messages(_L2_SYSTEM, f"Matn:\n{text[:600]}", want_json=True),
            response_json=True, temperature=0.0, max_tokens=150,
        )
        data   = parse_json(raw, "anatomy_guard_l2")
        status = str(data.get("status", "ok")).lower()
        reason = str(data.get("reason", ""))
        if status == "ok":
            return None
        msgs = {
            "anatomic":    "Inson anatomiyasiga ko'ra bu joylashuv mumkin emas.",
            "physiologic": "Tibbiy ma'lumotlarda fiziologik ziddiyat aniqlandi.",
            "deceptive":   "Bu so'rov tibbiy maslahat maqsadiga mos emas.",
        }
        return GuardResult(
            passed  = False,
            level   = status,
            message = msgs.get(status, "Ma'lumotlarda xatolik aniqlandi."),
            details = f"L2-AI: {reason}",
        )
    except Exception as exc:
        logger.warning("AnatomyGuard L2 failed (pass-through): %s", exc)
        return None   # fail-open: AI xato bo'lsa, o'tkazib yubor


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Public guard class
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

class AnatomyGuard:
    """
    Stateless guard. Use .check() class-method directly.
    """

    @classmethod
    def check(cls, patient_data: dict | str, use_ai: bool = True) -> GuardResult:
        """
        Run full anatomy/logic guard on patient data.

        Args:
            patient_data:  dict (patient fields) or plain text string.
            use_ai:        Enable Level-2 AI check.

        Returns:
            GuardResult вЂ“ .passed=True means safe to proceed.
        """
        if isinstance(patient_data, dict):
            text = " ".join([
                str(patient_data.get(k, ""))
                for k in ("complaints", "history", "objectiveData",
                           "additionalInfo", "labResults")
            ])
        else:
            text = str(patient_data)

        # Level 1
        l1 = _level1_check(text)
        if l1 is not None:
            logger.info("AnatomyGuard L1 BLOCKED: %s", l1.details)
            return l1

        # Level 2 (only if text is substantial)
        if use_ai and len(text.strip()) > 30:
            l2 = _level2_check(text[:1200])
            if l2 is not None:
                logger.info("AnatomyGuard L2 BLOCKED: %s", l2.details)
                return l2

        return PASS_RESULT


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Django View Decorator
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def anatomy_guard(use_ai: bool = True):
    """
    DRF view decorator. Extracts `patient_data` from request.data and
    runs AnatomyGuard before the view function.

    Usage:
        @api_view(["POST"])
        @permission_classes([IsAuthenticated])
        @anatomy_guard(use_ai=True)
        def my_view(request):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(request, *args, **kwargs):
            from rest_framework.response import Response
            patient_data = request.data.get("patient_data") or {}
            result       = AnatomyGuard.check(patient_data, use_ai=use_ai)
            if not result.passed:
                return Response(
                    {
                        "success":      False,
                        "filtered":     True,
                        "filter_level": result.level,
                        "error": {
                            "code":    422,
                            "message": result.message,
                        },
                    },
                    status=422,
                )
            return func(request, *args, **kwargs)
        return wrapper
    return decorator


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Django Middleware  (URL-level, non-AI endpoints uchun ham ishlaydi)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

class AnatomyGuardMiddleware:
    """
    Django WSGI middleware. Faqat AI endpointlariga tegishli POST so'rovlarni
    tekshiradi (URL /api/ai/ prefiksi bilan).

    settings.py ga qo'shish:
        MIDDLEWARE = [
            ...
            'ai_services.anatomy_guard.AnatomyGuardMiddleware',
            ...
        ]
    """

    _GUARDED_PATHS = ("/api/ai/consilium/", "/api/ai/doctor-support/",
                      "/api/ai/generate-diagnoses/", "/api/ai/autonomous-protocol/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (request.method == "POST"
                and any(request.path.startswith(p) for p in self._GUARDED_PATHS)):
            try:
                body  = json.loads(request.body.decode("utf-8"))
                pd    = body.get("patient_data") or {}
                guard = AnatomyGuard.check(pd, use_ai=False)  # middleware'da AI off (hД±zlД±)
                if not guard.passed:
                    from django.http import JsonResponse
                    return JsonResponse(
                        {
                            "success":      False,
                            "filtered":     True,
                            "filter_level": guard.level,
                            "error": {
                                "code":    422,
                                "message": guard.message,
                            },
                        },
                        status=422,
                    )
            except Exception as exc:
                logger.debug("AnatomyGuardMiddleware parse error (skip): %s", exc)

        return self.get_response(request)