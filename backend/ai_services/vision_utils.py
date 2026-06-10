"""
Multimodal vision — UZI/UTT/rentgen/MRT/KT/EKG tahlili.

Arxitektura:
  - TASVIR → OpenAI GPT-4o (asosiy), zaxira: Gemini, Azure GPT-4o
  - MATN  → DeepSeek (claude_utils / doctor_support / konsilium)
"""
from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

MAX_VISION_IMAGES = 12
MAX_PDF_PAGES = 4
VISION_TIMEOUT_SEC = 180


class VisionNotConfiguredError(RuntimeError):
    pass


class VisionAnalysisError(RuntimeError):
    pass


def _parse_json(raw: str) -> Any:
    text = (raw or "").replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"[\[{][\s\S]*[\]}]", text)
        if match:
            return json.loads(match.group(0))
        raise


def _openai_configured() -> bool:
    return bool((getattr(settings, "OPENAI_API_KEY", None) or "").strip())


def _gemini_configured() -> bool:
    return bool((getattr(settings, "GEMINI_API_KEY", None) or "").strip())


def _azure_configured() -> bool:
    return bool(
        (getattr(settings, "AZURE_OPENAI_ENDPOINT", None) or "").strip()
        and (getattr(settings, "AZURE_OPENAI_API_KEY", None) or "").strip()
    )


def vision_available() -> bool:
    return _openai_configured() or _gemini_configured() or _azure_configured()


def vision_provider() -> str:
    if _openai_configured():
        return "openai"
    if _gemini_configured():
        return "gemini"
    if _azure_configured():
        return "azure"
    return "none"


def _pdf_pages_to_images(pdf_b64: str, name: str) -> list[dict[str, str]]:
    try:
        import fitz  # pymupdf
    except ImportError:
        logger.warning("pymupdf not installed — PDF pages cannot be rendered")
        return []

    try:
        raw = base64.b64decode(pdf_b64)
        doc = fitz.open(stream=raw, filetype="pdf")
    except Exception as exc:
        logger.warning("PDF open failed (%s): %s", name, exc)
        return []

    out: list[dict[str, str]] = []
    pages = min(len(doc), MAX_PDF_PAGES)
    for i in range(pages):
        try:
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
            img_bytes = pix.tobytes("jpeg")
            out.append({
                "data": base64.b64encode(img_bytes).decode("ascii"),
                "mime": "image/jpeg",
                "name": f"{name} (sahifa {i + 1})",
            })
        except Exception as exc:
            logger.warning("PDF page render failed %s p%d: %s", name, i + 1, exc)
    doc.close()
    return out


def prepare_imaging_images(files: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Fayllarni vision uchun rasm ro'yxatiga aylantiradi (PDF → JPEG sahifalar)."""
    out: list[dict[str, str]] = []
    for f in files[:12]:
        b64 = str(f.get("base64Data") or f.get("base64_data") or "").split(",")[-1].strip()
        if not b64:
            continue
        name = str(f.get("fileName") or f.get("name") or "fayl").strip()
        mime = str(f.get("mimeType") or f.get("mime_type") or "image/jpeg").lower()

        if "pdf" in mime or name.lower().endswith(".pdf"):
            pages = _pdf_pages_to_images(b64, name)
            if pages:
                out.extend(pages)
            else:
                logger.warning("PDF %s: sahifalar render qilinmadi", name)
            continue

        if not mime.startswith("image/"):
            if name.lower().endswith(".png"):
                mime = "image/png"
            elif name.lower().endswith(".webp"):
                mime = "image/webp"
            elif name.lower().endswith(".gif"):
                mime = "image/gif"
            else:
                mime = "image/jpeg"
        out.append({"data": b64, "mime": mime, "name": name})
        if len(out) >= MAX_VISION_IMAGES:
            break
    return out[:MAX_VISION_IMAGES]


def _openai_vision(
    prompt: str,
    images: list[dict[str, str]],
    max_tokens: int,
    system: str | None = None,
) -> str | None:
    key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
    if not key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("openai package not installed")
        return None

    model = (getattr(settings, "OPENAI_VISION_MODEL", None) or "gpt-4o").strip()
    base_url = (getattr(settings, "OPENAI_BASE_URL", None) or "").strip() or None

    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for img in images:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{img['mime']};base64,{img['data']}",
                "detail": "high",
            },
        })

    try:
        client = OpenAI(api_key=key, base_url=base_url, timeout=VISION_TIMEOUT_SEC)
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": content})
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.1,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception as exc:
        logger.warning("OpenAI vision failed (%s): %s", model, exc)
        return None


def _gemini_vision(
    prompt: str,
    images: list[dict[str, str]],
    max_tokens: int,
    system: str | None = None,
) -> str | None:
    key = (getattr(settings, "GEMINI_API_KEY", None) or "").strip()
    if not key:
        return None

    model = (getattr(settings, "GEMINI_VISION_MODEL", None) or "gemini-2.0-flash").strip()
    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    parts: list[dict[str, Any]] = [{"text": full_prompt}]
    for img in images:
        parts.append({
            "inline_data": {
                "mime_type": img["mime"],
                "data": img["data"],
            }
        })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    try:
        resp = requests.post(
            url,
            params={"key": key},
            json=payload,
            timeout=VISION_TIMEOUT_SEC,
        )
        if resp.status_code != 200:
            logger.warning("Gemini vision HTTP %s: %s", resp.status_code, resp.text[:400])
            return None
        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return None
        content = candidates[0].get("content") or {}
        text_parts = content.get("parts") or []
        text = "".join(p.get("text", "") for p in text_parts if isinstance(p, dict)).strip()
        return text or None
    except Exception as exc:
        logger.warning("Gemini vision failed: %s", exc)
        return None


def _azure_vision(
    prompt: str,
    images: list[dict[str, str]],
    max_tokens: int,
    system: str | None = None,
) -> str | None:
    if not _azure_configured():
        return None
    try:
        from openai import AzureOpenAI
    except ImportError:
        return None

    endpoint = settings.AZURE_OPENAI_ENDPOINT.strip()
    api_key = settings.AZURE_OPENAI_API_KEY.strip()
    api_version = getattr(settings, "AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
    deployment = getattr(settings, "AZURE_DEPLOY_GPT4O", "FJSTI-gpt4o")

    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for img in images:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{img['mime']};base64,{img['data']}",
                "detail": "high",
            },
        })

    try:
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            timeout=VISION_TIMEOUT_SEC,
        )
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": content})
        resp = client.chat.completions.create(
            model=deployment,
            messages=messages,
            temperature=0.1,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception as exc:
        logger.warning("Azure vision failed: %s", exc)
        return None


def _call_vision_raw(
    prompt: str,
    images: list[dict[str, str]],
    max_tokens: int,
    system: str | None = None,
) -> str | None:
    """OpenAI → Gemini → Azure ketma-ketligi."""
    for fn in (_openai_vision, _gemini_vision, _azure_vision):
        raw = fn(prompt, images, max_tokens, system)
        if raw:
            return raw
    return None


def vision_json(
    prompt: str,
    images: list[dict[str, str]],
    *,
    max_tokens: int = 4096,
    system: str | None = None,
) -> dict:
    """Tasvirlar bilan JSON javob qaytaradi (OpenAI GPT-4o asosiy)."""
    if not images:
        raise VisionAnalysisError("Tahlil uchun rasm topilmadi")

    raw = _call_vision_raw(prompt, images, max_tokens, system)
    if not raw:
        if not vision_available():
            raise VisionNotConfiguredError(
                "Tasvir tahlili uchun OPENAI_API_KEY sozlanmagan. "
                "Administrator: backend/.env ga OPENAI_API_KEY qo'shing."
            )
        raise VisionAnalysisError(
            "Tasvirlarni o'qib bo'lmadi. Fayl formati yoki sifati tekshirilsin."
        )

    try:
        result = _parse_json(raw)
        if isinstance(result, dict):
            return result
    except Exception as exc:
        logger.warning("Vision JSON parse failed: %s | raw=%s", exc, raw[:300])
    raise VisionAnalysisError("AI javobi qayta ishlanmadi. Qayta urinib ko'ring.")
