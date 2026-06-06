"""
Yakuniy hisobot qo'shimcha maydonlari — protokol kamchiliklari, sifat audit, tasvir tahlili.
"""
from __future__ import annotations

from typing import Any, Optional


def _str_list(val: Any) -> list[str]:
    if not isinstance(val, list):
        return []
    return [str(x).strip() for x in val if x is not None and str(x).strip()]


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def extended_consensus_json_instructions(language_hint: str = "O'zbek") -> str:
    return f"""
MANBA FORMATI (majburiy): Muhim klinik da'vo, tashxis, dori yoki tavsiya oxirida qavs ichida: (Manba yoki jurnal/protokol, https://to-liq-url). "Quyida", "pastda", "bo'limda (qisqa)" kabi yo'naltiruvchi matn YO'Q.
QO'SHIMCHA MAJBURIY MAYDONLAR (til: {language_hint}):
- protocol_compliance_gaps: SSV klinik protokolga nisbatan shifokor amaliyotidagi kamchiliklar (kamida 1 ta agar mavjud; yo'q bo'lsa bo'sh []). Har biri: gap, protocol_reference, severity (high/medium/low), consequences, recommended_correction.
- care_quality_audit: {{ overall_score (0-100), summary, errors [{{category, description, protocol_reference, impact}}], strengths [] }} — tugallangan karta bo'yicha tibbiy yordam sifati.
- imaging_interpretation: {{ ecg, ultrasound, xray, ct, mri }} — har biri null yoki {{ summary, key_findings[], clinical_significance, limitations }}. Yuklangan EKG/UZI/rengen/KT/MRI bo'lsa TO'LIQ tahlil; bo'lmasa null.
- patient_routing: {{ recommended_specialists [{{specialty, reason, urgency}}], exam_plan[], disposition (outpatient|observation|inpatient|emergency), disposition_reason, follow_up_timeline, hospitalization_indicated, hospitalization_reason }}.
- risk_factors: [{{ factor, severity (high|medium|low), mitigation }}].
- severity_assessment: {{ level (critical|urgent|moderate|low), score (1-10), rationale, red_flags[] }}.
- medications: har birida adverse_effects[] (nojo'ya ta'sirlar), contraindications, monitoring.
- nutrition_prevention: individual_diet_by_diagnosis[] MAJBURIY (kamida konsensus tashxisi uchun 1 qator) — har tashxis: diagnosis, allowed_foods[], restricted_foods[], meal_plan_notes (umumiy emas, aniq parhez).
- adverse_event_risks: [{{ drug, risk, probability (0-1), management }}] — dori xavflari.
"""


def normalize_protocol_gaps(raw: Any) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        gap = str(item.get("gap") or item.get("deficiency") or "").strip()
        if not gap:
            continue
        out.append({
            "gap": gap,
            "protocolReference": str(item.get("protocol_reference") or item.get("protocolReference") or "").strip(),
            "severity": str(item.get("severity") or "medium").strip().lower(),
            "consequences": str(item.get("consequences") or item.get("impact") or "").strip(),
            "recommendedCorrection": str(
                item.get("recommended_correction") or item.get("recommendedCorrection") or ""
            ).strip(),
        })
    return out


def normalize_care_quality_audit(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    errors_raw = raw.get("errors") or []
    errors = []
    if isinstance(errors_raw, list):
        for e in errors_raw:
            if not isinstance(e, dict):
                continue
            desc = str(e.get("description") or e.get("error") or "").strip()
            if not desc:
                continue
            errors.append({
                "category": str(e.get("category") or "general").strip(),
                "description": desc,
                "protocolReference": str(e.get("protocol_reference") or e.get("protocolReference") or "").strip(),
                "impact": str(e.get("impact") or "").strip(),
            })
    score = raw.get("overall_score") or raw.get("overallScore")
    try:
        score_int = int(score) if score is not None else None
    except (TypeError, ValueError):
        score_int = None
    summary = str(raw.get("summary") or "").strip()
    strengths = _str_list(raw.get("strengths"))
    if score_int is None and not summary and not errors and not strengths:
        return None
    return {
        "overallScore": score_int,
        "summary": summary,
        "errors": errors,
        "strengths": strengths,
    }


def _norm_modality_block(block: Any) -> Optional[dict]:
    if not isinstance(block, dict) or not block:
        return None
    summary = str(block.get("summary") or "").strip()
    findings = _str_list(block.get("key_findings") or block.get("keyFindings") or block.get("findings"))
    sig = str(block.get("clinical_significance") or block.get("clinicalSignificance") or "").strip()
    lim = str(block.get("limitations") or "").strip()
    if not summary and not findings and not sig:
        return None
    out: dict[str, Any] = {}
    if summary:
        out["summary"] = summary
    if findings:
        out["keyFindings"] = findings
    if sig:
        out["clinicalSignificance"] = sig
    if lim:
        out["limitations"] = lim
    return out


def normalize_imaging_interpretation(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    ecg = _norm_modality_block(raw.get("ecg"))
    us = _norm_modality_block(raw.get("ultrasound") or raw.get("uzi"))
    xr = _norm_modality_block(raw.get("xray") or raw.get("x_ray"))
    ct = _norm_modality_block(raw.get("ct"))
    mri = _norm_modality_block(raw.get("mri"))
    corr = str(raw.get("general_correlation") or raw.get("generalCorrelation") or "").strip()
    if not ecg and not us and not xr and not ct and not mri and not corr:
        return None
    out: dict[str, Any] = {}
    if ecg:
        out["ecg"] = ecg
    if us:
        out["ultrasound"] = us
    if xr:
        out["xray"] = xr
    if ct:
        out["ct"] = ct
    if mri:
        out["mri"] = mri
    if corr:
        out["generalCorrelation"] = corr
    return out


def normalize_adverse_event_risks(raw: Any) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        drug = str(item.get("drug") or item.get("name") or "").strip()
        risk = str(item.get("risk") or "").strip()
        if not drug or not risk:
            continue
        try:
            prob = float(item.get("probability") or 0.3)
        except (TypeError, ValueError):
            prob = 0.3
        prob = max(0.0, min(1.0, prob))
        out.append({
            "drug": drug,
            "risk": risk,
            "probability": prob,
            "management": str(item.get("management") or "").strip(),
        })
    return out


def enrich_medications_from_consensus(meds_raw: Any) -> list[dict]:
    if not isinstance(meds_raw, list):
        return []
    medications = []
    for m in meds_raw:
        if not isinstance(m, dict):
            continue
        ae = _str_list(m.get("adverse_effects") or m.get("adverseEffects"))
        notes = str(m.get("notes") or m.get("instructions") or "").strip()
        if ae and "nojo'ya" not in notes.lower():
            notes = (notes + " | Nojo'ya ta'sirlar: " + "; ".join(ae[:6])).strip(" |")
        medications.append({
            "name": str(m.get("name") or ""),
            "dosage": str(m.get("dosage") or ""),
            "frequency": str(m.get("frequency") or ""),
            "duration": str(m.get("duration") or ""),
            "timing": str(m.get("timing") or ""),
            "instructions": str(m.get("instructions") or ""),
            "notes": notes,
            "localAvailability": str(m.get("local_availability") or m.get("localAvailability") or "O'zbekistonda mavjud"),
            "priceEstimate": str(m.get("price_estimate") or m.get("priceEstimate") or ""),
            "adverseEffects": ae,
            "contraindications": str(m.get("contraindications") or "").strip(),
            "monitoring": str(m.get("monitoring") or "").strip(),
        })
    return medications


def normalize_nutrition_extended(np_raw: Any) -> Optional[dict]:
    if not isinstance(np_raw, dict):
        return None

    def _diet_rows(val: Any) -> list[dict]:
        if not isinstance(val, list):
            return []
        rows = []
        for row in val:
            if not isinstance(row, dict):
                continue
            diag = str(row.get("diagnosis") or "").strip()
            if not diag:
                continue
            rows.append({
                "diagnosis": diag,
                "allowedFoods": _str_list(row.get("allowed_foods") or row.get("allowedFoods")),
                "restrictedFoods": _str_list(row.get("restricted_foods") or row.get("restrictedFoods")),
                "mealPlanNotes": str(row.get("meal_plan_notes") or row.get("mealPlanNotes") or "").strip(),
            })
        return rows

    dietary = _str_list(np_raw.get("dietary_guidelines") or np_raw.get("dietaryGuidelines"))
    prevention = _str_list(np_raw.get("prevention_measures") or np_raw.get("preventionMeasures"))
    intro = str(np_raw.get("intro") or "").strip()
    disclaimer = str(np_raw.get("disclaimer") or "").strip()
    individual = _diet_rows(
        np_raw.get("individual_diet_by_diagnosis") or np_raw.get("individualDietByDiagnosis")
    )
    if not dietary and not prevention and not intro and not individual:
        return None
    out: dict[str, Any] = {
        "dietaryGuidelines": dietary,
        "preventionMeasures": prevention,
    }
    if intro:
        out["intro"] = intro
    if disclaimer:
        out["disclaimer"] = disclaimer
    if individual:
        out["individualDietByDiagnosis"] = individual
    return out


def normalize_patient_routing(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    specs_raw = raw.get("recommended_specialists") or raw.get("recommendedSpecialists") or raw.get("referrals")
    specialists = []
    if isinstance(specs_raw, list):
        for s in specs_raw:
            if not isinstance(s, dict):
                continue
            specialty = str(s.get("specialty") or "").strip()
            if not specialty:
                continue
            urgency = str(s.get("urgency") or "").lower()
            specialists.append({
                "specialty": specialty,
                "reason": str(s.get("reason") or "").strip(),
                "urgency": "urgent" if urgency == "urgent" else "routine",
            })
    exam_plan = _str_list(raw.get("exam_plan") or raw.get("examPlan"))
    disp = str(raw.get("disposition") or "").lower()
    valid_disp = disp if disp in ("outpatient", "observation", "inpatient", "emergency") else None
    routing: dict[str, Any] = {
        "recommendedSpecialists": specialists or None,
        "examPlan": exam_plan or None,
        "disposition": valid_disp,
        "dispositionReason": str(raw.get("disposition_reason") or raw.get("dispositionReason") or "").strip() or None,
        "followUpTimeline": str(raw.get("follow_up_timeline") or raw.get("followUpTimeline") or "").strip() or None,
        "hospitalizationIndicated": bool(raw.get("hospitalization_indicated") or raw.get("hospitalizationIndicated")),
        "hospitalizationReason": str(raw.get("hospitalization_reason") or raw.get("hospitalizationReason") or "").strip() or None,
    }
    has = (
        specialists
        or exam_plan
        or valid_disp
        or routing.get("hospitalizationIndicated")
        or routing.get("followUpTimeline")
    )
    if not has:
        return None
    return {k: v for k, v in routing.items() if v is not None and v != []}


def normalize_risk_factors(raw: Any) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        factor = str(item.get("factor") or "").strip()
        if not factor:
            continue
        sev = str(item.get("severity") or "").lower()
        out.append({
            "factor": factor,
            "severity": sev if sev in ("high", "medium", "low") else None,
            "mitigation": str(item.get("mitigation") or "").strip() or None,
        })
    return out


def normalize_severity_assessment(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    level = str(raw.get("level") or "").lower()
    valid_level = level if level in ("critical", "urgent", "moderate", "low") else None
    try:
        score = int(raw.get("score")) if raw.get("score") is not None else None
    except (TypeError, ValueError):
        score = None
    if score is not None:
        score = max(1, min(10, score))
    rationale = str(raw.get("rationale") or "").strip()
    red_flags = _str_list(raw.get("red_flags") or raw.get("redFlags"))
    if not valid_level and score is None and not rationale and not red_flags:
        return None
    out: dict[str, Any] = {}
    if valid_level:
        out["level"] = valid_level
    elif score is not None or rationale or red_flags:
        out["level"] = "moderate"
    if score is not None:
        out["score"] = score
    if rationale:
        out["rationale"] = rationale
    if red_flags:
        out["redFlags"] = red_flags
    return out


def merge_enriched_report_fields(report: dict, consensus: dict) -> dict:
    """Mavjud final_report dict ga yangi maydonlarni qo'shadi."""
    gaps = normalize_protocol_gaps(
        consensus.get("protocol_compliance_gaps") or consensus.get("protocolComplianceGaps")
    )
    if gaps:
        report["protocolComplianceGaps"] = gaps

    audit = normalize_care_quality_audit(
        consensus.get("care_quality_audit") or consensus.get("careQualityAudit")
    )
    if audit:
        report["careQualityAudit"] = audit

    imaging = normalize_imaging_interpretation(
        consensus.get("imaging_interpretation") or consensus.get("imagingInterpretation")
    )
    if imaging:
        report["imagingInterpretation"] = imaging
        # imageAnalysis backwards compat
        parts = []
        for label, key in [("EKG", "ecg"), ("UZI", "ultrasound"), ("Rengen", "xray"), ("KT", "ct"), ("MRI", "mri")]:
            block = imaging.get(key)
            if block and block.get("summary"):
                parts.append(f"{label}: {block['summary']}")
        if parts:
            report["imageAnalysis"] = {
                "findings": " | ".join(parts),
                "correlation": imaging.get("generalCorrelation") or "",
            }

    aer = normalize_adverse_event_risks(
        consensus.get("adverse_event_risks") or consensus.get("adverseEventRisks")
    )
    if aer:
        report["adverseEventRisks"] = aer

    np_ext = normalize_nutrition_extended(
        consensus.get("nutrition_prevention") or consensus.get("nutritionPrevention")
    )
    if np_ext:
        report["nutritionPrevention"] = np_ext

    if consensus.get("medications"):
        report["medicationRecommendations"] = enrich_medications_from_consensus(
            consensus.get("medications")
        )

    routing = normalize_patient_routing(
        consensus.get("patient_routing") or consensus.get("patientRouting")
    )
    if routing:
        report["patientRouting"] = routing

    risks = normalize_risk_factors(
        consensus.get("risk_factors") or consensus.get("riskFactors")
    )
    if risks:
        report["riskFactors"] = risks

    severity = normalize_severity_assessment(
        consensus.get("severity_assessment") or consensus.get("severityAssessment")
    )
    if severity:
        report["severityAssessment"] = severity

    sfe = _s(consensus.get("simplified_family_explanation") or consensus.get("simplifiedFamilyExplanation"))
    if sfe:
        from .clinical_tools import strip_plain_text_markdown
        report["simplifiedFamilyExplanation"] = strip_plain_text_markdown(sfe)

    rr = consensus.get("related_research") or consensus.get("relatedResearch")
    if isinstance(rr, list) and rr:
        out_rr = []
        for item in rr:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            if not title:
                continue
            out_rr.append({
                "title": title,
                "summary": str(item.get("summary") or "").strip(),
                "url": str(item.get("url") or "").strip(),
            })
        if out_rr:
            report["relatedResearch"] = out_rr

    pharma = consensus.get("pharmacology_warnings") or consensus.get("pharmacologyWarnings")
    if isinstance(pharma, list) and pharma:
        existing = report.get("pharmacologyWarnings") or []
        if not isinstance(existing, list):
            existing = []
        merged = list(dict.fromkeys([*existing, *[str(x) for x in pharma if x]]))
        if merged:
            report["pharmacologyWarnings"] = merged[:12]

    ped = consensus.get("pediatric_dosing_notes") or consensus.get("pediatricDosingNotes")
    if isinstance(ped, list) and ped:
        notes = [str(x).strip() for x in ped if x]
        if notes:
            meds = report.get("medicationRecommendations") or []
            if isinstance(meds, list) and meds and isinstance(meds[0], dict):
                first = dict(meds[0])
                extra = _s(first.get("notes"))
                first["notes"] = (extra + " | " if extra else "") + "Pediatrik: " + "; ".join(notes[:3])
                meds = [first, *meds[1:]]
                report["medicationRecommendations"] = meds

    return report
