"""Farmakologiya tekshiruvi — konsilium yakuniy dorilar uchun."""
from __future__ import annotations

import json
import logging
from typing import Any

from .azure_utils import call_model, build_messages, parse_json, Deployments

logger = logging.getLogger(__name__)


def run_pharmacology_review(
    patient_text: str,
    consensus: dict,
    language: str = "uz-L",
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

    system = (
        "Siz klinik farmakologsiz. Taklif etilgan dorilarni tekshiring: "
        "dozalar, o'zaro ta'sirlar, allergiya, kontrendikatsiyalar, O'zbekiston formularyasi. "
        f"Til: {lang}. FAQAT JSON."
    )
    user = (
        f"Bemor:\n{patient_text[:8000]}\n\n"
        f"Dorilar:\n{json.dumps(meds, ensure_ascii=False)[:6000]}\n\n"
        'JSON: {"validated_medications":[],"interactions_found":[],"warnings":[],'
        '"substitutions":[],"pharmacology_note":"","blocked_medications":[]}'
    )
    try:
        raw = call_model(
            Deployments.mini(),
            build_messages(system, user, want_json=True),
            response_json=True,
            max_tokens=2000,
        )
        return parse_json(raw) or {}
    except Exception as exc:
        logger.warning("Pharmacology review failed: %s", exc)
        return {"warnings": [str(exc)], "error": True}
