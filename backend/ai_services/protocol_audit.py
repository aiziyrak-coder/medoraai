"""
Qoida asosidagi protokol kamchiliklari va tibbiy yordam sifati rubrikasi.
AI javobini to'ldiradi — bemor kartasiga mos, tushunarli matn.
"""
from __future__ import annotations

import re
from typing import Any


_GENERIC_STRENGTHS = frozenset({
    "shikoyatlar aniq hujjatlashtirilgan",
    "anamnez mavjud",
    "ob'ektiv ko'rik/vital ko'rsatkichlar kiritilgan",
})

_GENERIC_SUMMARIES = frozenset({
    "ma'lumotlar yuqori darajada to'liq",
    "ma'lumotlar o'rtacha — qo'shimcha klinik ma'lumot tavsiya etiladi",
    "ma'lumotlar cheklangan — konsilium natijasini ehtiyotkor baholang",
})


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _clip(text: str, n: int = 90) -> str:
    t = _s(text)
    if len(t) <= n:
        return t
    return t[: n - 1].rstrip() + "…"


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


def _build_case_strengths(d: dict, comp: dict) -> list[str]:
    """Kartadagi haqiqiy ma'lumotlardan tushunarli bandlar."""
    strengths: list[str] = []
    breakdown = comp.get("breakdown") or {}

    complaints = _clip(_s(d.get("complaints")), 110)
    if complaints and breakdown.get("complaints"):
        strengths.append(f"Bemor shikoyatlari yozilgan: «{complaints}»")

    history = _clip(_s(d.get("history")), 100)
    if history and breakdown.get("history"):
        strengths.append(f"Kasallik tarixi (anamnez): {history}")

    obj = _clip(_s(d.get("objectiveData") or d.get("objective_data")), 110)
    if obj and breakdown.get("vitals"):
        strengths.append(f"Ob'ektiv ko'rik / vital ko'rsatkichlar: {obj}")

    labs = _clip(_s(d.get("labResults") or d.get("lab_results")), 100)
    if labs and breakdown.get("labs") and not re.search(r"yuklangan|uploaded|fayl", labs, re.I):
        strengths.append(f"Laboratoriya: {labs}")

    if breakdown.get("imaging"):
        img = _clip(
            _s(d.get("imagingAnalysisSummary") or d.get("imaging_analysis_summary")),
            90,
        )
        if img:
            strengths.append(f"Tasvir tahlili: {img}")
        else:
            strengths.append("Tibbiy tasvir (EKG/UZI/rentgen) yuklangan yoki tahlil qilingan")

    meds = _clip(_s(d.get("currentMedications") or d.get("current_medications")), 80)
    if meds and breakdown.get("medications"):
        strengths.append(f"Hozir qabul qilinayotgan dorilar: {meds}")

    allergies = _clip(_s(d.get("allergies")), 60)
    if allergies and breakdown.get("allergies"):
        strengths.append(f"Allergiya ma'lumoti: {allergies}")

    age = _s(d.get("age"))
    gender = _s(d.get("gender"))
    if age and gender and breakdown.get("demographics"):
        strengths.append(f"Bemor: {age} yosh, jinsi — {gender}")

    return strengths[:6]


def _build_audit_summary(
    score: int,
    d: dict,
    comp: dict,
    primary_diagnosis: str = "",
) -> str:
    """Ball va kartadagi mavjud/yetishmayotgan ma'lumotlarni sodda tilda."""
    breakdown = comp.get("breakdown") or {}
    present_labels = []
    if breakdown.get("complaints"):
        present_labels.append("shikoyat")
    if breakdown.get("history"):
        present_labels.append("anamnez")
    if breakdown.get("vitals"):
        present_labels.append("ob'ektiv ko'rik")
    if breakdown.get("labs"):
        present_labels.append("laboratoriya")
    if breakdown.get("imaging"):
        present_labels.append("tasvir")
    if breakdown.get("medications"):
        present_labels.append("dorilar")
    if breakdown.get("allergies"):
        present_labels.append("allergiya")

    missing_labels = []
    if not breakdown.get("vitals"):
        missing_labels.append("ob'ektiv ko'rik/vital ko'rsatkichlar")
    if not breakdown.get("labs"):
        missing_labels.append("laboratoriya natijalari")
    if not breakdown.get("imaging"):
        missing_labels.append("instrumental tekshiruv (EKG/UZI/rentgen)")
    if not breakdown.get("history") and breakdown.get("complaints"):
        missing_labels.append("batafsil anamnez")

    dx = _clip(primary_diagnosis, 80)
    complaints = _clip(_s(d.get("complaints")), 70)

    if score >= 75:
        intro = "Karta konsilium uchun yetarli darajada to'liq — tashxis va davolash rejasi ishonchliroq asoslanadi."
    elif score >= 50:
        intro = "Karta qisman to'liq — konsilium mumkin, lekin qo'shimcha ma'lumot tavsiya etiladi."
    else:
        intro = "Karta cheklangan — konsilium natijasini ehtiyotkor baholang va yetishmayotgan ma'lumotlarni to'ldiring."

    parts = [intro]
    if dx:
        parts.append(f"Asosiy klinik yo'nalish: {dx}.")
    elif complaints:
        parts.append(f"Asosiy murojaat sababi: «{complaints}».")

    if present_labels:
        parts.append(f"Kartada bor: {', '.join(present_labels)}.")
    if missing_labels and score < 85:
        parts.append(f"Yetishmaydi yoki zaif: {', '.join(missing_labels[:4])}.")

    parts.append(
        f"Ball {score}/100 — bu bemor kartasidagi ma'lumotlar to'liqligi va protokol talablariga mosligi bahosi."
    )
    return " ".join(parts)


def rule_care_quality_audit(
    patient_data: dict,
    completeness: dict | None = None,
    primary_diagnosis: str = "",
) -> dict:
    """0–100 sifat balli — bemor kartasiga mos, tushunarli audit."""
    d = patient_data or {}
    comp = completeness or {}
    score = int(comp.get("score") or 40)
    errors: list[dict] = []

    obj = _s(d.get("objectiveData") or d.get("objective_data"))
    if not (obj and re.search(r"\d", obj)):
        errors.append({
            "category": "documentation",
            "description": "Ob'ektiv ko'rik yoki vital ko'rsatkichlar (masalan, arterial bosim, puls, harorat) yetarli emas",
            "protocolReference": "SSV tibbiy hujjat yuritish talablari",
            "impact": "Tashxis va davolash qarorining ishonchliligi pasayadi",
        })
        score = max(0, score - 15)

    if comp.get("complaint_only"):
        errors.append({
            "category": "data_quality",
            "description": "Hozircha asosan shikoyat matni bor — ob'ektiv, lab yoki tasvir ma'lumoti yo'q",
            "protocolReference": "Klinik protokol — to'liq karta",
            "impact": "Differensial tashxis va davolash rejasi cheklangan bo'lishi mumkin",
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

    strengths = _build_case_strengths(d, comp)
    summary = _build_audit_summary(score, d, comp, primary_diagnosis)

    return {
        "overall_score": max(0, min(100, score)),
        "summary": summary,
        "errors": errors[:8],
        "strengths": strengths,
    }


def is_generic_care_audit(audit: dict | None) -> bool:
    if not isinstance(audit, dict):
        return True
    summary = _s(audit.get("summary")).lower()
    if summary in _GENERIC_SUMMARIES:
        return True
    strengths = audit.get("strengths") or []
    if not strengths:
        return True
    if all(_s(s).lower() in _GENERIC_STRENGTHS for s in strengths if _s(s)):
        return True
    return False


def merge_care_quality_audit(
    ai_audit: dict | None,
    rule_audit: dict,
) -> dict:
    """AI auditni qoida asosidagi tushunarli matn bilan boyitadi."""
    if not isinstance(ai_audit, dict) or is_generic_care_audit(ai_audit):
        return rule_audit

    merged = dict(ai_audit)
    try:
        ai_score = int(merged.get("overall_score") or 0)
    except (TypeError, ValueError):
        ai_score = 0
    rule_score = int(rule_audit.get("overall_score") or 0)
    merged["overall_score"] = min(ai_score, rule_score) if ai_score else rule_score

    if is_generic_care_audit({"summary": merged.get("summary"), "strengths": merged.get("strengths")}):
        merged["summary"] = rule_audit.get("summary") or merged.get("summary")
        merged["strengths"] = rule_audit.get("strengths") or []

    if not merged.get("errors") and rule_audit.get("errors"):
        merged["errors"] = rule_audit["errors"]

    return merged
