"""
Yuklangan tasvirlarni (EKG, UZI, rentgen, KT, MRT) OpenAI vision orqali tahlil qilish.
Konsilium boshlanishidan oldin patient_data ga imagingAnalysisSummary qo'shiladi.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

VISION_MAX_TOKENS = 4096

_LANG = {
    "uz-L": "O'zbek (lotin)",
    "uz-C": "O'zbek (kirill)",
    "ru": "Rus",
    "en": "Ingliz",
    "kaa": "Qoraqalpoq",
}

_CONSILIUM_SCHEMA = (
    '{"ecg":null,"ultrasound":null,"xray":null,"ct":null,"mri":null,"general_correlation":""}'
    ' — har bir modality null yoki '
    '{"summary":"...","key_findings":["..."],"clinical_significance":"...","limitations":"..."}'
)


def _attachments_as_files(patient_data: dict) -> list[dict[str, Any]]:
    atts = patient_data.get("attachments") or []
    files: list[dict[str, Any]] = []
    if not isinstance(atts, list):
        return files
    for att in atts[:12]:
        if not isinstance(att, dict):
            continue
        b64 = att.get("base64Data") or att.get("base64_data") or att.get("data")
        if not b64 or not str(b64).strip():
            continue
        files.append({
            "base64Data": str(b64),
            "mimeType": att.get("mimeType") or att.get("mime_type") or "image/jpeg",
            "fileName": att.get("name") or att.get("fileName") or "attachment",
        })
    return files


def _consilium_vision_prompt(language: str, complaints: str, image_labels: list[str]) -> str:
    lang = _LANG.get(language, "O'zbek")
    labels = "\n".join(f"  - {n}" for n in image_labels) if image_labels else "  - attachment"
    ctx = (complaints or "").strip()[:800] or "—"
    return (
        f"Siz yuqori malakali radiolog/kardiologsiz. BIROKTILGAN BARCHA TASVIRLARNI "
        f"PIKSELLAR BO'YICHA o'qing — fayl nomiga asoslanmang.\n"
        f"Til: {lang}.\n"
        f"Shikoyatlar: {ctx}\n\n"
        f"Tasvirlar:\n{labels}\n\n"
        "MODALITETLAR: EKG/ECG, UZI/UTT (ultrasound), rentgen (xray), KT (ct), MRT (mri).\n"
        "Har bir modalitet uchun alohida blok bering (bo'lmasa null).\n"
        "key_findings: ko'rinadigan aniq topilmalar; measurements raqamlarini nusxalang.\n"
        "limitations: faqat haqiqiy texnik cheklovlar.\n"
        "general_correlation: barcha tasvirlarni klinik kontekst bilan bog'lash.\n"
        f"FAQAT JSON: {_CONSILIUM_SCHEMA}"
    )


def _block_from_modality(mod: dict | None, label: str) -> str:
    if not mod or not isinstance(mod, dict):
        return ""
    summary = str(mod.get("summary") or "").strip()
    if not summary:
        return ""
    findings = mod.get("key_findings") or []
    extra = ""
    if isinstance(findings, list) and findings:
        extra = "\n  • " + "\n  • ".join(str(f) for f in findings[:8] if f)
    return f"[{label}]\n{summary}{extra}"


def _map_consilium_result(result: dict) -> tuple[str, dict[str, dict]]:
    """Vision JSON → matn xulosa + imagingStructured map."""
    structured: dict[str, dict] = {}
    modality_map = {
        "ecg": "ecg",
        "ultrasound": "ultrasound",
        "uzi": "ultrasound",
        "xray": "xray",
        "rentgen": "xray",
        "ct": "ct",
        "kt": "ct",
        "mri": "mri",
        "mrt": "mri",
    }
    label_map = {
        "ecg": "EKG",
        "ultrasound": "UZI/UTT",
        "xray": "RENTGEN",
        "ct": "KT",
        "mri": "MRT",
    }

    for raw_key, norm_key in modality_map.items():
        block = result.get(raw_key)
        if block and isinstance(block, dict) and norm_key not in structured:
            structured[norm_key] = block

    blocks: list[str] = []
    for key, label in label_map.items():
        text = _block_from_modality(structured.get(key), label)
        if text:
            blocks.append(text)

    correlation = str(result.get("general_correlation") or "").strip()
    if correlation:
        blocks.append(f"[UMUMIY KORELYATSIYA]\n{correlation}")

    summary_text = "TASVIR TAHLILI (OpenAI Vision):\n\n" + "\n\n".join(blocks) if blocks else ""
    return summary_text, structured


def analyze_attachments(patient_data: dict, language: str = "uz-L") -> str:
    """Barcha biriktirmalarni bitta OpenAI vision chaqiruvi bilan tahlil qiladi."""
    from .vision_utils import VisionAnalysisError, prepare_imaging_images, vision_json

    files = _attachments_as_files(patient_data)
    images = prepare_imaging_images(files)
    if not images:
        return ""

    complaints = str(patient_data.get("complaints") or "")[:500]
    labels = [img.get("name") or f"rasm-{i+1}" for i, img in enumerate(images)]
    prompt = _consilium_vision_prompt(language, complaints, labels)

    try:
        result = vision_json(prompt, images, max_tokens=VISION_MAX_TOKENS)
        summary_text, structured = _map_consilium_result(result)
        if structured:
            patient_data["imagingStructured"] = structured
        return summary_text
    except Exception as exc:
        logger.warning("Konsilium vision tahlil xatosi: %s", exc)
        if isinstance(exc, VisionAnalysisError):
            return f"TASVIR TAHLILI: {exc}"
        return ""


def merge_imaging_into_context(patient_data: dict, language: str = "uz-L") -> dict:
    """patient_data ga imagingAnalysisSummary va imagingStructured qo'shadi."""
    patient_data = dict(patient_data)
    prior = str(
        patient_data.get("imagingAnalysisSummary") or patient_data.get("imaging_analysis_summary") or ""
    ).strip()
    atts = patient_data.get("attachments") or []
    if atts:
        attachment_summary = analyze_attachments(patient_data, language)
        if attachment_summary:
            patient_data["imagingAnalysisSummary"] = (
                f"{prior}\n\n{attachment_summary}".strip() if prior else attachment_summary
            )
    elif prior:
        patient_data["imagingAnalysisSummary"] = prior
    return patient_data
