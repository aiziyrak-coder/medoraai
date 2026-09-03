"""
103 — Tezkor triaj (Emergency Triage)
=====================================

Foydalanish sharoiti: feldsher bemor uyida, vaqt kam, klaviatura noqulay.
Kirish: shikoyat(lar) + yosh guruhi + jins. Boshqa hech narsa majburiy emas.
Chiqish: qizil bayroqlar → ehtimoliy holat → hozir nima qilish → qaror.

MUHIM tamoyillar:
  1. Bu QAROR QO'LLAB-QUVVATLASH. Yakuniy qarorni feldsher/shifokor qabul qiladi.
  2. AI javob bermasa — SOXTA javob qaytarilmaydi. Ochiq "xizmat ishlamayapti" deyiladi.
  3. Qizil bayroq (hayotga xavf) doim birinchi o'rinda.
  4. Doza yosh guruhisiz berilmaydi.
"""

from __future__ import annotations

import logging

from .azure_utils import build_messages, call_model, parse_json, Deployments

logger = logging.getLogger(__name__)

# Tezkor triaj uchun javob qisqa bo'lishi kerak — tezlik muhim.
_MAX_TOKENS = 1400
_TEMPERATURE = 0.0  # klinik triajda tasodifiylik kerak emas


class EmergencyAIUnavailable(RuntimeError):
    """AI xizmati javob bermadi. Soxta triaj qaytarish TAQIQLANADI."""


AGE_BANDS = {
    "infant":     "Chaqaloq (0-1 yosh)",
    "child":      "Bola (1-12 yosh)",
    "teen":       "O'smir (12-18 yosh)",
    "adult":      "Kattalar (18-65 yosh)",
    "elderly":    "Keksa (65+ yosh)",
}

SEX = {"male": "Erkak", "female": "Ayol"}

DISPOSITIONS = (
    "reanimatsiya",      # darhol reanimatsiya / hayotni saqlash choralari
    "statsionar",        # kasalxonaga olib ketish
    "kuzatuv",           # joyida yordam + kuzatuv, holat yomonlashsa olib ketish
    "uyda_qoldirish",    # yordam ko'rsatildi, uyda qoldirish mumkin
)

_SYSTEM = """Siz O'zbekiston tez tibbiy yordam (103) brigadasi uchun tezkor triaj yordamchisisiz.

SHAROIT: feldsher bemor uyida turibdi. Vaqt juda kam. Javob QISQA va AMALIY bo'lsin.

QAT'IY QOIDALAR:
1. Siz qaror QABUL QILMAYSIZ — feldsherga variant ko'rsatasiz. Yakuniy qaror feldsherniki.
2. Hayotga xavf belgilari (red flags) BIRINCHI o'ringa chiqadi.
3. Dori/ukol tavsiya qilsangiz: nomi, dozasi, yuborish yo'li (v/i, m/i, t/o), va ehtiyot chorasi.
   Doza berilgan yosh guruhiga MOS bo'lishi shart. Bolalarda vazn noma'lum bo'lsa —
   dozani mg/kg ko'rinishida bering va "vaznni aniqlang" deb yozing.
4. Faqat O'zbekistonda tez yordam brigadasida REAL mavjud bo'ladigan dorilarni tavsiya qiling.
5. Ma'lumot triaj uchun yetarli bo'lmasa — taxmin qilmang. "clarify" maydoniga
   1-2 ta eng muhim savolni yozing (feldsher 5 soniyada so'rab oladi).
6. Hech qachon ma'lumotni o'ylab topmang. Bilmasangiz — bo'sh qoldiring.

Javobni FAQAT quyidagi JSON strukturada bering, boshqa matn yozmang."""

_SCHEMA = """{
  "red_flags": ["hayotga xavf belgisi — bo'lmasa bo'sh ro'yxat"],
  "time_critical": true,
  "probable_conditions": [
    {"name": "holat nomi", "likelihood": "yuqori|o'rta|past", "why": "qisqa asos (1 jumla)"}
  ],
  "immediate_actions": [
    {"action": "nima qilish", "drug": "dori nomi yoki bo'sh", "dose": "doza yoki bo'sh",
     "route": "v/i|m/i|t/o|ingalyatsiya|bo'sh", "caution": "ehtiyot chorasi yoki bo'sh"}
  ],
  "do_not": ["shu holatda QILMASLIK kerak bo'lgan narsa"],
  "disposition": "reanimatsiya|statsionar|kuzatuv|uyda_qoldirish",
  "disposition_reason": "qisqa asos (1 jumla)",
  "clarify": ["ma'lumot yetarli bo'lmasa — so'raladigan savol"]
}"""


def _age_label(age_band: str, age_years=None) -> str:
    if age_years not in (None, "", 0):
        return f"{age_years} yosh"
    return AGE_BANDS.get(age_band or "", "yosh noma'lum")


def build_triage_prompt(
    complaints: list[str],
    note: str = "",
    age_band: str = "",
    age_years=None,
    sex: str = "",
    language: str = "uz-L",
) -> list[dict]:
    """Triaj uchun xabarlar ro'yxatini quradi."""
    selected = [c.strip() for c in (complaints or []) if str(c).strip()]
    sex_label = SEX.get(sex or "", "noma'lum")
    lines = [
        f"YOSH: {_age_label(age_band, age_years)}",
        f"JINS: {sex_label}",
    ]
    if selected:
        lines.append("SHIKOYATLAR (tanlangan): " + ", ".join(selected))
    if (note or "").strip():
        lines.append("QO'SHIMCHA (feldsher yozgan): " + note.strip())
    if not selected and not (note or "").strip():
        lines.append("SHIKOYAT KIRITILMAGAN")

    lines.append("")
    lines.append(f"Javob tili: {language}")
    lines.append("Quyidagi JSON strukturada javob bering:")
    lines.append(_SCHEMA)

    return build_messages(_SYSTEM, "\n".join(lines), want_json=True)


def _clean_action(item) -> dict | None:
    if not isinstance(item, dict):
        return None
    action = str(item.get("action") or "").strip()
    drug = str(item.get("drug") or "").strip()
    if not action and not drug:
        return None
    return {
        "action":  action,
        "drug":    drug,
        "dose":    str(item.get("dose") or "").strip(),
        "route":   str(item.get("route") or "").strip(),
        "caution": str(item.get("caution") or "").strip(),
    }


def _clean_condition(item) -> dict | None:
    if not isinstance(item, dict):
        return None
    name = str(item.get("name") or "").strip()
    if not name:
        return None
    likelihood = str(item.get("likelihood") or "").strip().lower()
    if likelihood not in ("yuqori", "o'rta", "past"):
        likelihood = ""
    return {"name": name, "likelihood": likelihood, "why": str(item.get("why") or "").strip()}


def _str_list(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()]


def normalize_triage(raw: dict) -> dict:
    """
    Model javobini xavfsiz ko'rinishga keltiradi.

    Hech narsa O'YLAB TOPILMAYDI: maydon bo'sh bo'lsa bo'sh qoladi.
    Yagona istisno — disposition noma'lum bo'lsa, eng ehtiyotkor variant
    ('kuzatuv') tanlanadi, chunki bo'sh qaror feldsherga foyda bermaydi.
    """
    raw = raw if isinstance(raw, dict) else {}

    disposition = str(raw.get("disposition") or "").strip().lower()
    if disposition not in DISPOSITIONS:
        disposition = "kuzatuv"

    conditions = [c for c in (_clean_condition(x) for x in (raw.get("probable_conditions") or [])) if c]
    actions = [a for a in (_clean_action(x) for x in (raw.get("immediate_actions") or [])) if a]

    return {
        "red_flags":           _str_list(raw.get("red_flags")),
        "time_critical":       bool(raw.get("time_critical")),
        "probable_conditions": conditions[:5],
        "immediate_actions":   actions[:6],
        "do_not":              _str_list(raw.get("do_not"))[:5],
        "disposition":         disposition,
        "disposition_reason":  str(raw.get("disposition_reason") or "").strip(),
        "clarify":             _str_list(raw.get("clarify"))[:3],
        # Feldsherga doim ko'rsatiladigan eslatma
        "advisory": (
            "Bu — qaror qo'llab-quvvatlash. Yakuniy qarorni brigada feldsheri/shifokori "
            "o'z ko'rigi va protokoli asosida qabul qiladi."
        ),
    }


def run_emergency_triage(
    complaints: list[str],
    note: str = "",
    age_band: str = "",
    age_years=None,
    sex: str = "",
    language: str = "uz-L",
) -> dict:
    """
    Tezkor triaj. AI javob bermasa EmergencyAIUnavailable ko'taradi —
    soxta triaj HECH QACHON qaytarilmaydi.
    """
    msgs = build_triage_prompt(complaints, note, age_band, age_years, sex, language)

    try:
        text = call_model(
            Deployments.mini(),          # tezlik uchun tez model
            msgs,
            response_json=True,
            temperature=_TEMPERATURE,
            max_tokens=_MAX_TOKENS,
        )
    except Exception as exc:
        logger.error("Emergency triage AI call failed: %s", exc)
        raise EmergencyAIUnavailable(str(exc)) from exc

    if not (text or "").strip():
        raise EmergencyAIUnavailable("AI bo'sh javob qaytardi")

    parsed = parse_json(text)
    if not isinstance(parsed, dict) or not parsed:
        logger.error("Emergency triage: model javobi JSON emas (%d belgi)", len(text or ""))
        raise EmergencyAIUnavailable("AI javobini o'qib bo'lmadi")

    return normalize_triage(parsed)
