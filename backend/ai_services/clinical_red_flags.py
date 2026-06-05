"""
Deterministik klinik qizil bayroqlar — LLM dan mustaqil, hayotni qutqarish uchun.
"""
from __future__ import annotations

import re
from typing import Any


def _s(val: Any) -> str:
    return str(val or "").strip().lower()


def _parse_bp(data: dict) -> tuple[int | None, int | None]:
    obj = _s(data.get("objectiveData") or data.get("objective_data"))
    sys_m = re.search(r"(?:sys|systolic|сис|сад)[:\s]*(\d{2,3})", obj, re.I)
    dia_m = re.search(r"(?:dia|diastolic|диа|дад)[:\s]*(\d{2,3})", obj, re.I)
    if not sys_m:
        sys_m = re.search(r"(\d{2,3})\s*/\s*(\d{2,3})", obj)
        if sys_m:
            return int(sys_m.group(1)), int(sys_m.group(2))
    sys_v = int(sys_m.group(1)) if sys_m else None
    dia_v = int(dia_m.group(1)) if dia_m else None
    return sys_v, dia_v


def _parse_spo2(data: dict) -> int | None:
    obj = _s(data.get("objectiveData") or data.get("objective_data"))
    m = re.search(r"(?:spo2|сатурация|saturatsiya)[:\s]*(\d{2,3})", obj, re.I)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d{2,3})\s*%", obj)
    return int(m.group(1)) if m else None


def evaluate_red_flags(patient_data: dict | None) -> list[dict[str, str]]:
    """Return list of {severity, code, message, action}."""
    d = patient_data or {}
    flags: list[dict[str, str]] = []
    text = " ".join(
        _s(d.get(k))
        for k in (
            "complaints", "history", "objectiveData", "objective_data",
            "labResults", "lab_results", "additionalInfo", "additional_info",
        )
    )

    def add(severity: str, code: str, message: str, action: str):
        flags.append({
            "severity": severity,
            "code": code,
            "message": message,
            "action": action,
        })

    # Shoshilinch matnli belgilar
    emergency_patterns = [
        (r"st elevation|st ko.?taril|st\s*\+|инфаркт|infarkt|mi\s", "CARDIO_STEMI",
         "O'tkir koronar sindrom / infarkt shubhasi", "103 chaqiring, reanimatsiya, koronar angiografiya"),
        (r"pneumotoraks|pnevmotoraks|пневмоторакс", "PNEUMOTHORAX",
         "Pnevmotoraks shubhasi", "Rentgen KT, torakal jarroh, 103"),
        (r"sepsis|сепсис|septik", "SEPSIS",
         "Sepsis shubhasi", "Qon madaniyati, antibiotik, reanimatsiya"),
        (r"insult|инсульт|stroke|falaj|паралич", "STROKE",
         "O'tkir insult shubhasi", "103, KT/MRT, tromboliz vaqti oynasi"),
        (r"anafilaks|анафилакс", "ANAPHYLAXIS",
         "Anafilaksiya", "Adrenalin, 103, reanimatsiya"),
        (r"ich qon|qon ketish|melena|gematemez|гематемезис", "GI_BLEED",
         "Yuqori/ichki qon ketish", "Reanimatsiya, endoskopiya, qon"),
        (r"hushdan ket|бессознательн|unconscious|sinkop.*uzoq", "UNCONSCIOUS",
         "Hushdan ketish", "103, ABCDE, glyukoza/EKG"),
        (r"nafas.*to.?xt|respiratory arrest|дыхательн.*останов", "RESP_ARREST",
         "Nafas to'xtashi", "103, ventilyatsiya, reanimatsiya"),
    ]
    for pattern, code, msg, action in emergency_patterns:
        if re.search(pattern, text, re.I):
            add("critical", code, msg, action)

    sys_bp, dia_bp = _parse_bp(d)
    if sys_bp and sys_bp >= 180:
        add("high", "HTN_CRISIS", f"Gipertenziv kriz: SYS {sys_bp}", "IV antigipertenziv, EKG, bosh miya KT")
    if dia_bp and dia_bp >= 120:
        add("high", "HTN_CRISIS_DIA", f"Diastolik kriz: DIA {dia_bp}", "Shoshilinch statsionar")

    spo2 = _parse_spo2(d)
    if spo2 is not None and spo2 < 90:
        add("critical", "HYPOXIA", f"Gipoksiya SpO2={spo2}%", "Kislorod, ABCDE, 103")

    # Yosh + og'ir belgilar
    try:
        age = int(re.sub(r"\D", "", _s(d.get("age"))) or "0")
        if age >= 50 and re.search(r"ko.?krak.*og.?riq|chest pain", text, re.I):
            add("high", "CHEST_PAIN_ELDERLY", "Keksa bemor ko'krak og'rig'i", "EKG, troponin, 103 tayyor")
    except ValueError:
        pass

    return flags
