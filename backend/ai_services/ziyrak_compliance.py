"""FJSTI Ziyrak — sertifikatlash / audit ma'lumotlari."""
from __future__ import annotations

import time
from typing import Any

from django.conf import settings
from django.core.cache import cache

from .ziyrak_crypto import payload_encryption_enabled
from .ziyrak_provider import ziyrak_engine_ready

AUDIT_CACHE_KEY = "ziyrak:audit:recent"
AUDIT_MAX = 200


def record_inference_audit(*, user_id: int | None, model: str, bytes_in: int) -> None:
    entry = {
        "ts": int(time.time()),
        "user_id": user_id,
        "engine": "FJSTI Ziyrak AI",
        "model": model,
        "region": "UZ-FJSTI",
        "bytes_in": bytes_in,
        "external_client": False,
    }
    rows: list[dict[str, Any]] = cache.get(AUDIT_CACHE_KEY) or []
    rows.insert(0, entry)
    cache.set(AUDIT_CACHE_KEY, rows[:AUDIT_MAX], timeout=86400 * 7)


def compliance_status() -> dict[str, Any]:
    host = (getattr(settings, "ALLOWED_HOSTS", None) or ["aishifokor.uz"])[0]
    return {
        "platform": "Farg'ona JSTI Tibbiy AI Platformasi",
        "ai_engine": "FJSTI Ziyrak AI",
        "version": "3.0",
        "operational": ziyrak_engine_ready(),
        "data_residency": {
            "country": "O'zbekiston",
            "processing_site": "FJSTI serverlari (Farg'ona viloyati)",
            "client_to_external_ai": False,
            "all_ai_via": f"https://{host}/api/ziyrak/",
        },
        "security": {
            "transport_encryption": "TLS 1.2+ (HTTPS)",
            "payload_encryption": "AES-256-GCM" if payload_encryption_enabled() else "TLS + JWT",
            "authentication": "JWT (Bearer)",
            "audit_logging": True,
        },
        "architecture": {
            "pattern": "Single-tenant FJSTI AI gateway",
            "browser_calls": ["POST /api/ziyrak/inference/", "POST /api/ziyrak/consilium/"],
            "note": "Brauzer faqat FJSTI API bilan aloqa qiladi; klinik ma'lumotlar platforma ichida qayta ishlanadi.",
        },
    }


def compliance_audit_log(limit: int = 50) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = cache.get(AUDIT_CACHE_KEY) or []
    return rows[: max(1, min(limit, AUDIT_MAX))]
