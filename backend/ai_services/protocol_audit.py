"""
Qoida asosidagi protokol kamchiliklari va tibbiy yordam sifati rubrikasi.
AI javobini to'ldiradi — qo'shimcha token sarf qilmasdan.
"""
from __future__ import annotations

import re
from typing import Any


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _text_blob(data: dict) -> str:
    parts = [
        _s(data.get("complaints")),
        _s(data.get("history")),
        _s(data.get("objectiveData") or data.get("objective_data")),
        _s(data.get("labResults") or data.get("lab_results")),
    ]
    return " ".join(parts).lower()


def rule_protocol_gaps(patient_data: dict) -> list[dict]:
    """SSV protokoliga nisbatan aniq kamchiliklar."""
    d = patient_data or {}
    blob = _text_blob(d)
    obj = _s(d.get("objectiveData") or d.get("objective_data"))
    gaps: list[dict] = []

    chest = any(k in blob for k in ("ko'krak og'riq", "kokrak ogriq", "chest pain", "sternum"))
    if chest and not re.search(r"\d{2,3}\s*/\s*\d{2,3}", obj):
        gaps.append({
            "gap": "Ko'krak og'rig'i shikoyati bilan arterial bosim/qalqonsimon bez tekshiruvi hujjatlashtirilmagan",
            "protocol_reference": "SSV yurak-qon tomir kasalliklari klinik protokoli",
            "severity": "high",
            "consequences": "MI, aort disseksiyasi yoki PE ehtimolini o'tkazib yuborish xavfi",
            "recommended_correction": "AB, puls, EKG va troponin/KT buyurish",
        })

    fever = any(k in blob for k in ("isitma", "temperatura", "fever", "lix"))
    if fever and not re.search(r"(°C|temp|harorat)\s*[:\s]*\d", obj, re.I):
        gaps.append({
            "gap": "Isitma shikoyati bilan ob'ektiv harorat qayd etilmagan",
            "protocol_reference": "SSV infeksion kasalliklar protokoli",
            "severity": "medium",
            "consequences": "Infeksiya og'irligi va davolash rejasi noto'g'ri baholanishi mumkin",
            "recommended_correction": "Harorat, puls va umumiy holatni hujjatlashtirish",
        })

    dm = any(k in blob for k in ("qandli diabet", "diabet", "glyukoza", "hba1c", "insulin"))
    labs = _s(d.get("labResults") or d.get("lab_results")).lower()
    if dm and not any(k in labs for k in ("glyukoza", "glucose", "hba1c", "глик")):
        gaps.append({
            "gap": "Diabet shubhasi/mavjudligi bilan glyukoza yoki HbA1c natijasi yo'q",
            "protocol_reference": "SSV endokrin kasalliklar protokoli / ADA",
            "severity": "medium",
            "consequences": "Giperglikemiya yoki komplikatsiyalar aniqlanmasligi mumkin",
            "recommended_correction": "Glyukoza, HbA1c va lipid profilini qo'shish",
        })

    if _s(d.get("currentMedications")) and not _s(d.get("allergies")):
        gaps.append({
            "gap": "Dori-darmonlar ko'rsatilgan, allergiya/anamsesiz",
            "protocol_reference": "SSV farmakoterapiya xavfsizligi",
            "severity": "medium",
            "consequences": "Kontrendikatsiyali dori tayinlash xavfi",
            "recommended_correction": "Allergiya va nojo'ya reaksiyalar tarixini aniqlashtirish",
        })

    return gaps[:6]


def rule_care_quality_audit(patient_data: dict, completeness: dict | None = None) -> dict:
    """0–100 sifat balli — qoida + to'liqlik."""
    d = patient_data or {}
    comp = completeness or {}
    score = int(comp.get("score") or 40)
    errors: list[dict] = []
    strengths: list[str] = []

    if _s(d.get("complaints")):
        strengths.append("Shikoyatlar aniq hujjatlashtirilgan")
    if _s(d.get("history")):
        strengths.append("Anamnez mavjud")
    obj = _s(d.get("objectiveData") or d.get("objective_data"))
    if obj and re.search(r"\d", obj):
        strengths.append("Ob'ektiv ko'rik/vital ko'rsatkichlar kiritilgan")
    else:
        errors.append({
            "category": "documentation",
            "description": "Ob'ektiv ko'rik ma'lumotlari yetarli emas",
            "protocolReference": "SSV tibbiy hujjat yuritish talablari",
            "impact": "Klinik qaror ishonchliligi pasayadi",
        })
        score = max(0, score - 15)

    if comp.get("complaint_only"):
        errors.append({
            "category": "data_quality",
            "description": "Tahlil asosan shikoyat matniga tayanadi",
            "protocolReference": "Klinik protokol — to'liq karta",
            "impact": "Tashxis va davolash rejasi suboptimal bo'lishi mumkin",
        })
        score = max(0, score - 20)

    gaps = rule_protocol_gaps(d)
    for g in gaps[:3]:
        errors.append({
            "category": "protocol",
            "description": g.get("gap", ""),
            "protocolReference": g.get("protocol_reference", ""),
            "impact": g.get("consequences", ""),
        })
        if g.get("severity") == "high":
            score = max(0, score - 10)

    summary = (
        "Ma'lumotlar yuqori darajada to'liq" if score >= 75
        else "Ma'lumotlar o'rtacha — qo'shimcha klinik ma'lumot tavsiya etiladi"
        if score >= 50
        else "Ma'lumotlar cheklangan — konsilium natijasini ehtiyotkor baholang"
    )
    return {
        "overall_score": max(0, min(100, score)),
        "summary": summary,
        "errors": errors[:8],
        "strengths": strengths[:6],
    }
