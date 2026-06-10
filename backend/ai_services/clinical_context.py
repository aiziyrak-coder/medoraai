"""
To'liq klinik kontekst — faqat shikoyat/anamnez emas, barcha mavjud ma'lumotlardan foydalanish.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from .uzbekistan_knowledge_base import get_uz_context


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _format_structured_labs(data: dict) -> str:
    raw = data.get("structuredLabResults") or data.get("structured_lab_results")
    if not raw or not isinstance(raw, dict):
        return ""
    lines: list[str] = []
    for test, entries in raw.items():
        if not isinstance(entries, list):
            continue
        for e in entries:
            if not isinstance(e, dict):
                continue
            v = _s(e.get("value"))
            u = _s(e.get("unit"))
            tr = _s(e.get("trend"))
            if v:
                lines.append(f"  - {test}: {v} {u}" + (f" (trend: {tr})" if tr else ""))
    return "\n".join(lines) if lines else ""


def _format_symptom_timeline(data: dict) -> str:
    raw = data.get("symptomTimeline") or data.get("symptom_timeline")
    if not isinstance(raw, list) or not raw:
        return ""
    lines = []
    for ev in raw[:20]:
        if not isinstance(ev, dict):
            continue
        lines.append(
            f"  - {_s(ev.get('date'))}: {_s(ev.get('symptom'))} "
            f"(og'irlik {_s(ev.get('severity'))}/10)"
            + (f" — {_s(ev.get('notes'))}" if _s(ev.get("notes")) else "")
        )
    return "\n".join(lines)


def _format_mental_health(data: dict) -> str:
    raw = data.get("mentalHealthScores") or data.get("mental_health_scores")
    if not isinstance(raw, dict) or not raw:
        return ""
    parts = []
    if raw.get("phq9") is not None:
        parts.append(f"PHQ-9: {raw['phq9']}")
    if raw.get("gad7") is not None:
        parts.append(f"GAD-7: {raw['gad7']}")
    return ", ".join(parts)


def _format_attachments_meta(data: dict) -> str:
    atts = data.get("attachments") or []
    if not isinstance(atts, list) or not atts:
        return ""
    lines = []
    for i, att in enumerate(atts[:12], 1):
        if not isinstance(att, dict):
            continue
        name = _s(att.get("name")) or f"fayl-{i}"
        mime = _s(att.get("mimeType") or att.get("mime_type")) or "noma'lum"
        kind = "rasm/PDF"
        ml = mime.lower()
        if "ecg" in name.lower() or "ekg" in name.lower():
            kind = "EKG/ECG"
        elif any(x in ml for x in ("image/", "jpeg", "png", "webp")):
            if any(k in name.lower() for k in ("uzi", "utt", "ultra", "sono")):
                kind = "UZI/UTT"
            elif any(k in name.lower() for k in ("rentgen", "xray", "x-ray", "rg")):
                kind = "Rengen"
            elif any(k in name.lower() for k in (" ct", "kt", "tomograf", "computed")) or name.lower().startswith("ct"):
                kind = "KT"
            elif any(k in name.lower() for k in ("mri", "mrt", "magnit", "rezonans")):
                kind = "MRI"
            else:
                kind = "Tibbiy rasm"
        elif "pdf" in ml:
            kind = "PDF protokol"
        lines.append(f"  - [{kind}] {name} ({mime})")
    return "\n".join(lines)


def _format_doctor_diagnoses(data: dict) -> str:
    raw = data.get("doctorDiagnoses") or data.get("doctor_diagnoses")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    if isinstance(raw, list) and raw:
        lines = [f"  - {_s(x)}" for x in raw if _s(x)]
        return "\n".join(lines)
    return ""


def _format_prescribed_medications(data: dict) -> str:
    raw = data.get("prescribedMedications") or data.get("prescribed_medications")
    if not isinstance(raw, list) or not raw:
        return ""
    lines: list[str] = []
    for i, med in enumerate(raw[:30], 1):
        if isinstance(med, str) and med.strip():
            lines.append(f"  {i}. {med.strip()}")
            continue
        if not isinstance(med, dict):
            continue
        name = _s(med.get("name"))
        if not name:
            continue
        dose = _s(med.get("dosage") or med.get("dose"))
        freq = _s(med.get("frequency"))
        dur = _s(med.get("duration"))
        instr = _s(med.get("instructions"))
        parts = [name]
        if dose:
            parts.append(f"doza: {dose}")
        if freq:
            parts.append(f"chastota: {freq}")
        if dur:
            parts.append(f"muddati: {dur}")
        if instr:
            parts.append(f"ko'rsatma: {instr}")
        lines.append(f"  {i}. " + " | ".join(parts))
    return "\n".join(lines)


def _format_vitals(data: dict) -> str:
    parts: list[str] = []
    w = data.get("weightKg") or data.get("weight_kg")
    h = data.get("heightCm") or data.get("height_cm")
    bmi = data.get("bmi")
    if w not in (None, ""):
        parts.append(f"vazn: {w} kg")
    if h not in (None, ""):
        parts.append(f"bo'y: {h} sm")
    if bmi not in (None, ""):
        parts.append(f"BMI: {bmi}")
    return ", ".join(parts)


def _format_user_feedback(data: dict) -> str:
    fb = data.get("userDiagnosisFeedback") or data.get("user_diagnosis_feedback")
    if not isinstance(fb, dict) or not fb:
        return ""
    lines = [f"  - {k}: {v}" for k, v in fb.items() if k and v]
    return "\n".join(lines)


def _truncate_field(val: str, limit: int) -> str:
    v = val.strip()
    if len(v) <= limit:
        return v
    return v[: limit - 3] + "..."


def build_clinical_context(
    patient_data: dict | None,
    extra: Optional[dict] = None,
    *,
    include_uz_protocols: bool = True,
    compact: bool = False,
    language: str = "uz-L",
) -> str:
    """Bemor + qo'shimcha kontekst (mutaxassislar, DDX, mintaqa)."""
    d = patient_data or {}
    ex = extra or {}
    parts: list[str] = []

    first = _s(d.get("firstName") or d.get("first_name"))
    last = _s(d.get("lastName") or d.get("last_name"))
    father = _s(d.get("fatherName") or d.get("father_name"))
    age = _s(d.get("age"))
    gender = _s(d.get("gender"))
    name_line = f"{first} {last}".strip()
    if father:
        name_line += f" {father} o'g'li/qizi"
    display_name = name_line or "Noma'lum"
    parts.append(f"BEMOR: {display_name}, {age or '-'} yosh, jins: {gender or '-'}.")

    vitals = _format_vitals(d)
    if vitals:
        parts.append(f"VITAL KO'RSATKICHLAR: {vitals}")

    doctor_dx = _format_doctor_diagnoses(d)
    if doctor_dx:
        parts.append(f"SHIFOKOR TOMONIDAN QO'YILGAN TASHXIS(LAR):\n{doctor_dx}")

    prescribed = _format_prescribed_medications(d)
    if prescribed:
        parts.append(f"SHIFOKOR TOMONIDAN BERILGAN DORI-DARMONLAR:\n{prescribed}")

    for key, label in [
        ("complaints", "SHIKOYATLAR"),
        ("history", "ANAMNEZ"),
        ("objectiveData", "OB'EKTIV KO'RIK / VITAL"),
        ("objective_data", "OB'EKTIV KO'RIK / VITAL"),
        ("labResults", "LABORATORIYA / Tahlillar"),
        ("lab_results", "LABORATORIYA / Tahlillar"),
        ("allergies", "ALLERGIYA"),
        ("currentMedications", "JORIY DORI-DARMONLAR"),
        ("current_medications", "JORIY DORI-DARMONLAR"),
        ("familyHistory", "OILAVIY ANAMNEZ"),
        ("family_history", "OILAVIY ANAMNEZ"),
        ("additionalInfo", "QO'SHIMCHA MA'LUMOT"),
        ("additional_info", "QO'SHIMCHA MA'LUMOT"),
        ("pharmacogenomicsReport", "FARMAKOGENOMIKA"),
        ("pharmacogenomics_report", "FARMAKOGENOMIKA"),
    ]:
        val = _s(d.get(key))
        if val and label not in [p.split(":")[0].strip() for p in parts if ":" in p]:
            # skip duplicate objective/lab snake vs camel
            if key.endswith("_data") and _s(d.get("objectiveData")):
                continue
            if key.endswith("_results") and _s(d.get("labResults")):
                continue
            if compact:
                val = _truncate_field(val, 600)
            parts.append(f"{label}: {val}")

    struct_labs = _format_structured_labs(d)
    if struct_labs:
        parts.append(f"STRUKTUR LAB:\n{struct_labs}")

    timeline = _format_symptom_timeline(d)
    if timeline:
        parts.append(f"SIMPTOM DINAMIKASI:\n{timeline}")

    mh = _format_mental_health(d)
    if mh:
        parts.append(f"RUHIY SALOMATLIK SKORLARI: {mh}")

    long_notes = _s(d.get("longitudinalClinicalNotes") or d.get("longitudinal_clinical_notes"))
    if long_notes:
        cap = 1200 if compact else 5000
        parts.append(f"OLDINGI TAHLILLAR / DINAMIKA:\n{long_notes[:cap]}")

    att_meta = _format_attachments_meta(d)
    if att_meta:
        parts.append(
            "YUKLANGAN HUJJATLAR (EKG, UZI, rengen, PDF — tahlilda TO'LIQ hisobga oling):\n"
            + att_meta
        )

    imaging_summary = _s(d.get("imagingAnalysisSummary") or d.get("imaging_analysis_summary"))
    if imaging_summary:
        parts.append(imaging_summary)

    fb = _format_user_feedback(d)
    if fb:
        parts.append(f"SHIFOKOR TASHXIS FIKRI (feedback):\n{fb}")

    ddx = ex.get("differential_diagnoses") or ex.get("differentialDiagnoses")
    if ddx:
        if isinstance(ddx, list):
            names = []
            for item in ddx:
                if isinstance(item, dict):
                    names.append(_s(item.get("name")))
                else:
                    names.append(_s(item))
            ddx_text = ", ".join(n for n in names if n)
        else:
            ddx_text = _s(ddx)
        if ddx_text:
            parts.append(f"QO'SHIMCHA / DIFFERENSIAL TASHXISLAR: {ddx_text}")

    debate = _s(ex.get("specialist_debate_summary") or ex.get("specialistDebateSummary"))
    if debate:
        cap = 2000 if compact else 6000
        parts.append(f"MUTAXASSISLAR MUNOZARASI (xulosa):\n{debate[:cap]}")

    region = _s(ex.get("regional_context") or ex.get("regionalContext"))
    if not region:
        region = _s(d.get("regionalContext") or d.get("regional_context"))
    if region:
        parts.append(f"LOKAL / MINTAQAVIY HOLAT: {region}")

    ddx_notes = _s(d.get("differentialDiagnosesNotes") or d.get("differential_diagnoses_notes"))
    if ddx_notes:
        parts.append(f"DIFFERENSIAL TASHXISLAR (shifokor): {ddx_notes}")

    if include_uz_protocols and not compact:
        complaints = _s(d.get("complaints"))
        try:
            parts.append(get_uz_context(complaints, include_protocols=True))
        except Exception:
            pass

    if not compact:
        parts.append(
            "\nMUHIM: Xulosa FAQAT shikoyat va anamnezga emas — ob'ektiv, lab, "
            "yuklangan tasvirlar (EKG/UZI/rengen), mutaxassislar fikri, differensial "
            "tashxislar va oldingi tahlillarni birgalikda sintez qiling."
        )
    return "\n\n".join(parts)


def patient_text(patient_data: dict | None, extra: Optional[dict] = None, **kwargs) -> str:
    """azure_utils / claude_utils uchun mos alias."""
    return build_clinical_context(patient_data, extra, **kwargs)
