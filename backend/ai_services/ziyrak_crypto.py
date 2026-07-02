"""FJSTI Ziyrak — klinik payload shifrlash (AES-256-GCM)."""
from __future__ import annotations

import base64
import hashlib
import json
import os
from typing import Any

from django.conf import settings


def _payload_key() -> bytes | None:
    raw = (getattr(settings, "FJSTI_ZIYRAK_PAYLOAD_KEY", None) or "").strip()
    if not raw:
        return None
    try:
        if len(raw) == 64 and all(c in "0123456789abcdefABCDEF" for c in raw):
            return bytes.fromhex(raw)
        digest = hashlib.sha256(raw.encode("utf-8")).digest()
        return digest
    except Exception:
        return None


def payload_encryption_enabled() -> bool:
    return _payload_key() is not None


def encrypt_payload(data: dict[str, Any]) -> dict[str, Any]:
    key = _payload_key()
    if not key:
        return data
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError as exc:
        raise RuntimeError("Shifrlash moduli o'rnatilmagan") from exc

    plaintext = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, None)
    blob = base64.b64encode(nonce + ciphertext).decode("ascii")
    return {"v": 1, "enc": True, "data": blob}


def decrypt_envelope(body: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ValueError("Noto'g'ri so'rov formati")
    if not body.get("enc"):
        return body

    key = _payload_key()
    if not key:
        raise ValueError("Shifrlangan so'rov qabul qilinmaydi")

    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError as exc:
        raise RuntimeError("Shifrlash moduli o'rnatilmagan") from exc

    raw = base64.b64decode(str(body.get("data") or ""))
    if len(raw) < 13:
        raise ValueError("Shifrlangan ma'lumot buzilgan")
    nonce, ciphertext = raw[:12], raw[12:]
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    parsed = json.loads(plaintext.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("Shifrlangan ma'lumot noto'g'ri")
    return parsed
