"""Pasport seriya raqami — bemorning doimiy ID raqami."""
from __future__ import annotations

import re

from rest_framework.exceptions import ValidationError

# O'zbekiston biometrik pasport: 2 lotin harfi + 7 raqam (masalan AB1234567)
PASSPORT_SERIAL_RE = re.compile(r'^[A-Z]{2}\d{7}$')
LEGACY_NUMERIC_RE = re.compile(r'^\d{8}$')


def normalize_passport_serial(value: str | None) -> str:
    return (value or '').strip().upper().replace(' ', '').replace('-', '')


def validate_passport_serial_format(value: str | None) -> str:
    """Normalizatsiya qiladi; noto'g'ri formatda ValidationError."""
    normalized = normalize_passport_serial(value)
    if not normalized:
        raise ValidationError('Pasport seriya raqami kiritilishi shart.')
    if PASSPORT_SERIAL_RE.match(normalized) or LEGACY_NUMERIC_RE.match(normalized):
        return normalized
    raise ValidationError(
        "Pasport seriyasi noto'g'ri. Masalan: AB1234567 (2 harf + 7 raqam)."
    )
