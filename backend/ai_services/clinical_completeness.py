"""
Klinik ma'lumotlar to'liqligi — ball (0–100) va konsilium oldidan validatsiya.
"""
from __future__ import annotations

import re
from typing import Any


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _has_vitals(data: dict) -> bool:
    obj = _s(data.get("objectiveData") or data.get("objective_data"))
    if not obj:
        return False
    if re.search(r"\d{2,3}\s*/\s*\d{2,3}", obj):
        return True
    if re.search(r"(puls|pulse|HR|bpm|SpO|harorat|°C|temp)", obj, re.I):
        return True
    return len(obj) > 25


def _has_real_labs(data: dict) -> bool:
    lab = _s(data.get("labResults") or data.get("lab_results"))
    if lab and not re.search(r"yuklangan|uploaded|fayl", lab, re.I):
        return True
    struct = data.get("structuredLabResults") or data.get("structured_lab_results")
    return isinstance(struct, dict) and bool(struct)


def _has_imaging(data: dict) -> bool:
    if _s(data.get("imagingAnalysisSummary") or data.get("imaging_analysis_summary")):
        return True
    atts = data.get("attachments") or []
    return isinstance(atts, list) and len(atts) > 0


def score_clinical_completeness(patient_data: dict | None) -> dict[str, Any]:
    """0–100 ball va tavsif."""
    d = patient_data or {}
    score = 0
    breakdown: dict[str, int] = {}

    if _s(d.get("complaints")):
        score += 20
        breakdown["complaints"] = 20
    if _s(d.get("history")):
        score += 10
        breakdown["history"] = 10
    if _has_vitals(d):
        score += 20
        breakdown["vitals"] = 20
    if _has_real_labs(d):
        score += 15
        breakdown["labs"] = 15
    if _has_imaging(d):
        score += 15
        breakdown["imaging"] = 15
    if _s(d.get("allergies")):
        score += 5
        breakdown["allergies"] = 5
    if _s(d.get("currentMedications") or d.get("current_medications")):
        score += 5
        breakdown["medications"] = 5
    if _s(d.get("familyHistory") or d.get("family_history")):
        score += 5
        breakdown["family_history"] = 5
    if _s(d.get("age")) and _s(d.get("gender")):
        score += 5
        breakdown["demographics"] = 5

    warnings: list[str] = []
    if not _has_vitals(d) and not _has_real_labs(d) and not _has_imaging(d):
        warnings.append(
            "Faqat shikoyat/anamnez — ob'ektiv, lab yoki tasvir yo'q; tashxis ishonchliligi pasayadi"
        )
    if _s(d.get("complaints")) and not _s(d.get("history")):
        warnings.append("Anamnez qo'shilsa differensial diagnostika aniqroq bo'ladi")

    level = "low"
    if score >= 75:
        level = "high"
    elif score >= 50:
        level = "medium"

    return {
        "score": min(100, score),
        "level": level,
        "breakdown": breakdown,
        "warnings": warnings,
        "complaint_only": not (_has_vitals(d) or _has_real_labs(d) or _has_imaging(d)),
    }


def validate_consilium_minimum(
    patient_data: dict | None,
    *,
    allow_incomplete: bool = False,
) -> dict[str, Any]:
    """Konsilium oldidan tekshiruv."""
    d = patient_data or {}
    errors: list[str] = []
    if not _s(d.get("complaints")):
        errors.append("Shikoyatlar kiritilmagan")

    comp = score_clinical_completeness(d)
    blocked = comp["complaint_only"] and not allow_incomplete

    return {
        "ok": not errors and not blocked,
        "errors": errors,
        "completeness": comp,
        "blocked_reason": (
            "Klinik minimum: kamida ob'ektiv ko'rik, lab yoki tasvir kerak"
            if blocked
            else None
        ),
    }
