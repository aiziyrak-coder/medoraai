"""Farmakologiya tekshiruvi — konsilium yakuniy dorilar uchun (DDI bilan)."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from .azure_utils import call_model, build_messages, parse_json, Deployments
from .clinical_context import build_clinical_context

logger = logging.getLogger(__name__)


def _extract_drug_names(patient_data: dict, consensus: dict) -> list[str]:
    names: list[str] = []
    meds_text = str(patient_data.get("currentMedications") or patient_data.get("current_medications") or "")
    for part in re.split(r"[,;\n]+", meds_text):
        s = part.strip()
        if len(s) > 2:
            names.append(s[:80])
    for m in consensus.get("medications") or consensus.get("medication_recommendations") or []:
        if isinstance(m, dict):
            for key in ("name", "generic"):
                v = str(m.get(key) or "").strip()
                if v:
                    names.append(v[:80])
    seen: set[str] = set()
    out: list[str] = []
    for n in names:
        k = n.lower()
        if k not in seen:
            seen.add(k)
            out.append(n)
    return out[:12]


def run_pharmacology_review(
    patient_data: dict,
    consensus: dict,
    language: str = "uz-L",
    max_tokens: int = 1500,
) -> dict[str, Any]:
    meds = consensus.get("medications") or consensus.get("medication_recommendations") or []
    if not meds and not consensus.get("treatment_plan"):
        return {"warnings": [], "validated_medications": [], "interactions_found": []}

    lang = {
        "uz-L": "O'zbek (lotin)",
        "uz-C": "O'zbek (kirill)",
        "ru": "Rus",
        "en": "Ingliz",
        "kaa": "Qoraqalpoq",
    }.get(language, "O'zbek")

    patient_summary = build_clinical_context(
        patient_data, compact=True, include_uz_protocols=False, language=language
    )[:3500]

    ddi_notes: list[str] = []
    existing_warn = consensus.get("pharmacology_warnings") or []
    if isinstance(existing_warn, list) and existing_warn:
        ddi_notes.extend(str(w)[:300] for w in existing_warn[:4] if w)
    drug_names = _extract_drug_names(patient_data, consensus)
    if len(drug_names) >= 2 and not ddi_notes:
        try:
            from .clinical_tools import drug_interactions
            ddi = drug_interactions(drug_names, language)
            if ddi.get("description"):
                ddi_notes.append(
                    f"DDI ({ddi.get('severity', 'Moderate')}): {ddi['description'][:400]}"
                )
            for rec in (ddi.get("recommendations") or [])[:3]:
                ddi_notes.append(str(rec)[:200])
        except Exception as exc:
            logger.warning("DDI check failed: %s", exc)

    allergies = str(patient_data.get("allergies") or "")[:300]
    allergy_line = allergies if allergies else "ko'rsatilmagan"
    system = (
        "Klinik farmakolog. Dorilarni tekshiring: doza, DDI, allergiya, kontrendikatsiya, "
        f"O'zbekiston formularyasi. Til: {lang}. FAQAT JSON."
    )
    user = (
        f"Bemor (qisqa):\n{patient_summary}\n\n"
        f"Allergiya: {allergy_line}\n\n"
        f"Taklif dorilar:\n{json.dumps(meds, ensure_ascii=False)[:4000]}\n\n"
        f"DDI tekshiruv:\n{'; '.join(ddi_notes) or 'yoq'}\n\n"
        'JSON: {"validated_medications":[],"interactions_found":[],"warnings":[],'
        '"substitutions":[],"pharmacology_note":"","blocked_medications":[]}'
    )
    try:
        raw = call_model(
            Deployments.mini(),
            build_messages(system, user, want_json=True),
            response_json=True,
            max_tokens=max_tokens,
        )
        parsed = parse_json(raw) or {}
        if ddi_notes and isinstance(parsed, dict):
            warnings = list(parsed.get("warnings") or [])
            for note in ddi_notes:
                if note not in warnings:
                    warnings.append(note)
            parsed["warnings"] = warnings[:12]
            parsed["interactions_found"] = (parsed.get("interactions_found") or []) + ddi_notes[:4]
        return parsed
    except Exception as exc:
        logger.warning("Pharmacology review failed: %s", exc)
        return {"warnings": ddi_notes or [str(exc)], "error": True}
