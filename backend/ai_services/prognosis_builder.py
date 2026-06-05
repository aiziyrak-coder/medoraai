"""
Konsilium yakuniy hisobotida kasallik prognozi — P3/LLM bo'lmasa ham to'ldiriladi.
"""
from __future__ import annotations

from typing import Any


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def build_prognosis_report(
    consensus: dict,
    patient_data: dict | None = None,
    language: str = "uz-L",
) -> dict:
    """Konsensus va bemor ma'lumotlaridan prognoz blokini yig'adi."""
    patient_data = patient_data or {}
    cd = consensus.get("consensus_diagnosis") or {}
    if isinstance(cd, list) and cd:
        cd = cd[0] if isinstance(cd[0], dict) else {}
    dx_name = _s(cd.get("name")) or "klinik holat"
    complaints = _s(patient_data.get("complaints"))
    age = patient_data.get("age")
    treatment = consensus.get("treatment_plan") or []
    meds = consensus.get("medications") or []
    med_names = [
        _s(m.get("name") or m.get("generic"))
        for m in meds[:4]
        if isinstance(m, dict) and _s(m.get("name") or m.get("generic"))
    ]
    plan_hint = ""
    if isinstance(treatment, list) and treatment:
        plan_hint = _s(treatment[0])[:120]

    is_ru = language == "ru"
    is_en = language == "en"

    if is_en:
        short = (
            f"Short term (1–3 months): for {dx_name}, course depends on adherence to the proposed plan"
            + (f" ({plan_hint})" if plan_hint else "")
            + ". Monitor symptoms and repeat tests as advised; seek care if warning signs appear."
        )
        long = (
            f"Long term (1–5 years): prognosis for {dx_name} depends on chronicity, comorbidities, "
            "lifestyle, and follow-up. Regular visits and prevention reduce recurrence and complications."
        )
        factors = [
            f"Consensus diagnosis: {dx_name}",
            f"Age: {age}" if age else "Clinical context",
        ]
        if complaints:
            factors.append(f"Chief complaints: {complaints[:200]}")
        if med_names:
            factors.append(f"Key medications: {', '.join(med_names)}")
        factors.append("Treatment adherence and scheduled follow-up")
    elif is_ru:
        short = (
            f"Краткосрочно (1–3 мес.): при {dx_name} ожидается ответ на терапию при соблюдении плана"
            + (f" ({plan_hint})" if plan_hint else "")
            + "; контроль симптомов и анализов по назначению."
        )
        long = (
            f"Долгосрочно (1–5 лет): прогноз при {dx_name} зависит от хроничности, сопутствующих "
            "заболеваний и соблюдения терапии; диспансеризация снижает риск обострений."
        )
        factors = [
            f"Консенсус-диагноз: {dx_name}",
            f"Возраст: {age}" if age else "Клинический контекст",
        ]
        if complaints:
            factors.append(f"Жалобы: {complaints[:200]}")
        if med_names:
            factors.append(f"Препараты: {', '.join(med_names)}")
        factors.append("Соблюдение терапии и повторные визиты")
    else:
        short = (
            f"Qisqa muddat (1–3 oy): {dx_name} bo'yicha taklif qilingan davolash va kuzatuvga "
            "rioya qilinsa, simptomlar vaqt o'tishi bilan yaxshilanishi yoki barqarorlashishi mumkin"
            + (f" ({plan_hint})" if plan_hint else "")
            + ". Ogohlantiruvchi belgilar va qayta tekshiruvlar bo'yicha shifokor ko'rsatmalariga amal qiling."
        )
        long = (
            f"Uzoq muddat (1–5 yil): {dx_name} uchun prognoz surunkalilik, qo'shimcha kasalliklar, "
            "hayot tarzi va davolashga rioya qilish bilan bog'liq. Muntazam kuzatuv va profilaktika "
            "qayta yuzaga kelish va asoratlarni kamaytiradi."
        )
        factors = [
            f"Konsensus tashxis: {dx_name}",
            f"Yosh: {age}" if age else "Klinik kontekst",
        ]
        if complaints:
            factors.append(f"Shikoyatlar: {complaints[:200]}")
        if med_names:
            factors.append(f"Asosiy dorilar: {', '.join(med_names)}")
        factors.append("Davolashga rioya qilish va rejalashtirilgan qayta ko'rish")

    return {
        "shortTermPrognosis": short,
        "longTermPrognosis": long,
        "keyFactors": factors[:8],
        "confidenceScore": 0.55,
    }
