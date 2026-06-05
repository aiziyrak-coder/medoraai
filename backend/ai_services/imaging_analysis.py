"""
Yuklangan tasvirlarni (EKG, UZI, rentgen) backend vision orqali tahlil qilish.
"""
from __future__ import annotations

import concurrent.futures
import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

MAX_IMAGES = 3
VISION_MAX_TOKENS = 900


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


def _vision_prompt(kind: str, lang_note: str, complaints: str) -> str:
    return (
        f"Siz tajribali radiolog/kardiologsiz. {kind} tasvirini PIKSELLAR bo'yicha o'qing. "
        f"Til: {lang_note}. Qisqa JSON: "
        '{"summary":"1-2 jumla","key_findings":["..."],"clinical_significance":"...","limitations":"..."}. '
        f"Kontekst shikoyat: {complaints[:300]}"
    )


def _analyze_single_image(img: dict, lang_note: str, complaints: str) -> tuple[str, dict | None]:
    from .clinical_tools import _try_vision

    kind = _classify_kind(img["name"])
    prompt = _vision_prompt(kind, lang_note, complaints)
    text = _try_vision(prompt, img["data"], img["mime"], max_tokens=VISION_MAX_TOKENS)
    structured: dict | None = None
    if text:
        try:
            raw = text.replace("```json", "").replace("```", "").strip()
            structured = json.loads(raw)
        except json.JSONDecodeError:
            structured = {"summary": text[:1200], "key_findings": [], "clinical_significance": "", "limitations": ""}
    block = f"[{kind}] {img['name']}:\n{(structured or {}).get('summary') or text or 'tahlil mavjud emas'}"
    return block, structured


def _modality_key(kind: str) -> str:
    return {
        "EKG": "ecg",
        "UZI": "ultrasound",
        "RENTGEN": "xray",
        "KT": "ct",
        "MRI": "mri",
    }.get(kind, "general")


def analyze_attachments(patient_data: dict, language: str = "uz-L") -> str:
    """Vision tahlil matnini qaytaradi."""
    images = _attachment_images(patient_data)
    if not images:
        return ""

    lang_note = {
        "uz-L": "O'zbek (lotin)",
        "uz-C": "O'zbek (kirill)",
        "ru": "Rus",
        "en": "Ingliz",
        "kaa": "Qoraqalpoq",
    }.get(language, "O'zbek")

    complaints = str(patient_data.get("complaints") or "")[:500]
    blocks: list[str] = []
    structured_map: dict[str, dict] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(3, len(images))) as pool:
        future_map = {
            pool.submit(_analyze_single_image, img, lang_note, complaints): img
            for img in images
        }
        for fut in concurrent.futures.as_completed(future_map):
            img = future_map[fut]
            try:
                block, structured = fut.result(timeout=45)
                blocks.append(block)
                if structured:
                    kind = _classify_kind(img["name"])
                    key = _modality_key(kind)
                    if key != "general":
                        structured_map[key] = structured
            except Exception as exc:
                logger.warning("Tasvir tahlil xatosi (%s): %s", img["name"], exc)
                blocks.append(f"[{img['name']}]: tahlil vaqtincha mavjud emas")

    if structured_map:
        patient_data["imagingStructured"] = structured_map

    if not blocks:
        return ""
    return "TASVIR TAHLILI (AI VISION):\n" + "\n\n".join(blocks)


def merge_imaging_into_context(patient_data: dict, language: str = "uz-L") -> dict:
    """patient_data ga imagingAnalysisSummary va imagingStructured qo'shadi."""
    if patient_data.get("imagingAnalysisSummary"):
        return patient_data
    atts = patient_data.get("attachments") or []
    if not atts:
        return patient_data
    patient_data = dict(patient_data)
    summary = analyze_attachments(patient_data, language)
    if summary:
        patient_data["imagingAnalysisSummary"] = summary
    return patient_data
