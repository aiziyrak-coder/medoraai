"""
Yuklangan tasvirlarni (EKG, UZI, rentgen) backend vision orqali tahlil qilish.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

MAX_IMAGES = 4


def _attachment_images(patient_data: dict) -> list[dict[str, str]]:
    atts = patient_data.get("attachments") or []
    out: list[dict[str, str]] = []
    if not isinstance(atts, list):
        return out
    for att in atts[:12]:
        if not isinstance(att, dict):
            continue
        b64 = att.get("base64Data") or att.get("base64_data") or att.get("data")
        mime = (att.get("mimeType") or att.get("mime_type") or "image/jpeg").strip()
        name = (att.get("name") or att.get("fileName") or "attachment").strip()
        if not b64 or not str(b64).strip():
            continue
        if "pdf" in mime.lower():
            continue
        if not mime.lower().startswith("image/"):
            if not re.search(r"\.(jpe?g|png|webp|gif)$", name, re.I):
                continue
            mime = "image/jpeg"
        out.append({"name": name, "mime": mime, "data": str(b64).split(",")[-1]})
        if len(out) >= MAX_IMAGES:
            break
    return out


def _classify_kind(name: str) -> str:
    n = name.lower()
    if "ecg" in n or "ekg" in n:
        return "EKG"
    if any(k in n for k in ("uzi", "utt", "ultra", "sono")):
        return "UZI"
    if any(k in n for k in ("rentgen", "xray", "x-ray", "rg")):
        return "RENTGEN"
    if any(k in n for k in ("ct", "kt", "tomograf")):
        return "KT"
    if any(k in n for k in ("mri", "mrt", "rezonans")):
        return "MRI"
    return "TASVIR"


def analyze_attachments(patient_data: dict, language: str = "uz-L") -> str:
    """Vision tahlil matnini qaytaradi; xato bo'lsa bo'sh string."""
    images = _attachment_images(patient_data)
    if not images:
        return ""

    try:
        from . import claude_utils
        if claude_utils._get_client() is None:
            return ""
    except Exception:
        return ""

    blocks: list[str] = []
    lang_note = {
        "uz-L": "O'zbek (lotin)",
        "uz-C": "O'zbek (kirill)",
        "ru": "Rus",
        "en": "Ingliz",
        "kaa": "Qoraqalpoq",
    }.get(language, "O'zbek")

    for img in images:
        kind = _classify_kind(img["name"])
        system = (
            f"Siz tajribali radiolog/kardiolog. {kind} tasvir fayli yuklangan. "
            f"Tasvir piksellarini ko'ra olmaysiz — fayl nomi, turi va bemor shikoyatiga asoslanib "
            f"ehtimoliy klinik yo'nalish va keyingi qadamlarni qisqa yozing. "
            f"Til: {lang_note}. Qisqa, aniq: taxminiy yo'nalish, shoshilinchlik, cheklovlar."
        )
        user_text = (
            f"Fayl: {img['name']} ({kind}, {img['mime']}). "
            f"Bemor shikoyati: {(patient_data.get('complaints') or '')[:500]}"
        )
        try:
            text = claude_utils._call_claude(
                user_text,
                claude_utils.CLAUDE_FAST,
                system=system,
                max_output_tokens=1200,
            )
            if text:
                blocks.append(f"[{kind}] {img['name']}:\n{text}")
        except Exception as exc:
            logger.warning("Tasvir tahlil xatosi (%s): %s", img["name"], exc)
            blocks.append(f"[{kind}] {img['name']}: tahlil vaqtincha mavjud emas.")

    if not blocks:
        return ""
    return "TASVIR TAHLILI (AI VISION):\n" + "\n\n".join(blocks)


def merge_imaging_into_context(patient_data: dict, language: str = "uz-L") -> dict:
    """patient_data ga imagingAnalysisSummary qo'shadi."""
    summary = analyze_attachments(patient_data, language)
    if summary:
        patient_data = dict(patient_data)
        patient_data["imagingAnalysisSummary"] = summary
    return patient_data
