"""
Farg'ona JSTI Ziyrak AI — yagona ichki inference provayderi.
Tashqi provayder nomlari faqat server ichida; API/javob/logda ko'rinmaydi.
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Any

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

FJSTI_MODEL_FAST = "FJSTI-ziyrak-fast"
FJSTI_MODEL_PRO = "FJSTI-ziyrak-pro"
FJSTI_MODEL_REASONER = "FJSTI-ziyrak-reasoner"

_LEGACY_MODEL_MAP = {
    "deepseek-chat": FJSTI_MODEL_FAST,
    "deepseek-reasoner": FJSTI_MODEL_REASONER,
    "gpt-4o-mini": FJSTI_MODEL_FAST,
    "gpt-4o": FJSTI_MODEL_PRO,
    "claude-3-5-haiku-latest": FJSTI_MODEL_FAST,
    "claude-sonnet-4-20250514": FJSTI_MODEL_PRO,
}


def ziyrak_engine_ready() -> bool:
    return bool((getattr(settings, "OPENAI_API_KEY", None) or "").strip())


def public_model_name(model: str | None) -> str:
    m = (model or "").strip()
    if not m:
        return FJSTI_MODEL_PRO
    if m.startswith("FJSTI-ziyrak"):
        return m
    low = m.lower()
    if "reasoner" in low or "opus" in low:
        return FJSTI_MODEL_REASONER
    if "mini" in low or "haiku" in low or "chat" in low or "fast" in low:
        return FJSTI_MODEL_FAST
    return FJSTI_MODEL_PRO


def _resolve_internal_model(public_model: str) -> str:
    from . import claude_utils

    pub = public_model_name(public_model)
    mode = (getattr(settings, "AI_COST_MODE", "scale") or "scale").strip().lower()
    if pub == FJSTI_MODEL_FAST:
        return claude_utils._fast_model()
    if pub == FJSTI_MODEL_REASONER and mode == "quality":
        return claude_utils._pro_model()
    if pub == FJSTI_MODEL_REASONER:
        return claude_utils._pro_model()
    return claude_utils._pro_model()


def _cache_key(prefix: str, payload: str) -> str:
    digest = hashlib.sha256((payload or "").encode("utf-8", errors="ignore")).hexdigest()[:32]
    return f"ziyrak:{prefix}:{digest}"


def _sanitize_error(exc: Exception) -> str:
    msg = str(exc or "")
    msg = re.sub(r"openai[^\s]*", "FJSTI Ziyrak", msg, flags=re.I)
    msg = re.sub(r"deepseek[^\s]*", "FJSTI Ziyrak", msg, flags=re.I)
    msg = re.sub(r"api\.[a-z0-9.-]+", "fjsti.local", msg, flags=re.I)
    msg = re.sub(r"sk-[A-Za-z0-9]+", "[kalit]", msg)
    if not msg.strip():
        return "FJSTI Ziyrak AI vaqtincha ishlamadi."
    return msg[:400]


def ziyrak_chat_completion(
    *,
    model: str,
    messages: list[dict[str, str]],
    max_tokens: int = 2048,
    temperature: float = 0.1,
    want_json: bool = False,
    use_cache: bool = True,
) -> dict[str, Any]:
    """
    FJSTI Ziyrak AI inference.
    Returns OpenAI-compatible shape for frontend compatibility.
    """
    if not ziyrak_engine_ready():
        raise RuntimeError("FJSTI Ziyrak AI xizmati sozlanmagan.")

    from . import claude_utils

    client = claude_utils._get_client()
    if not client:
        raise RuntimeError("FJSTI Ziyrak AI xizmati sozlanmagan.")

    internal_model = _resolve_internal_model(model)
    normalized_messages = []
    for msg in messages or []:
        role = (msg.get("role") or "user").strip()
        content = str(msg.get("content") or "")
        if content:
            normalized_messages.append({"role": role, "content": content})
    if not normalized_messages:
        raise ValueError("So'rov matni bo'sh")

    user_tail = normalized_messages[-1]["content"]
    if want_json and "faqat json" not in user_tail.lower():
        normalized_messages[-1] = {
            **normalized_messages[-1],
            "content": user_tail + "\n\nMuhim: Javobni FAQAT toza JSON formatida qaytaring.",
        }

    cache_payload = f"{internal_model}|{max_tokens}|{normalized_messages!r}"
    ck = _cache_key("infer", cache_payload)
    if use_cache:
        cached = cache.get(ck)
        if cached:
            return cached

    try:
        response = client.chat.completions.create(
            model=internal_model,
            messages=normalized_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except Exception as exc:
        logger.warning("FJSTI Ziyrak inference xatosi")
        raise RuntimeError(_sanitize_error(exc)) from None

    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("FJSTI Ziyrak AI bo'sh javob qaytardi")

    out = {
        "engine": "FJSTI Ziyrak AI",
        "model": public_model_name(model),
        "content": [{"type": "text", "text": text}],
    }
    if use_cache:
        cache.set(ck, out, timeout=3600)
    return out


def map_legacy_models_in_text(text: str) -> str:
    if not text:
        return text
    out = text
    for legacy, pub in _LEGACY_MODEL_MAP.items():
        out = re.sub(re.escape(legacy), pub, out, flags=re.I)
    return out
