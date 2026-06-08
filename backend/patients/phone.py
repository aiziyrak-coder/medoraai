"""Bemor telefon raqamini yagona formatga keltirish."""
from __future__ import annotations

import re


def normalize_patient_phone(phone: str | None) -> str:
    if not phone:
        return ''
    cleaned = re.sub(r'[\s\-().]', '', str(phone).strip())
    if not cleaned:
        return ''
    if cleaned.startswith('+'):
        return cleaned
    if cleaned.startswith('998'):
        return '+' + cleaned
    if cleaned.isdigit() and len(cleaned) == 9:
        return '+998' + cleaned
    if cleaned.isdigit():
        return '+' + cleaned
    return cleaned


def patient_phone_variants(phone: str | None) -> list[str]:
    """DB qidiruv uchun mumkin bo'lgan telefon yozuvlari."""
    normalized = normalize_patient_phone(phone)
    if not normalized:
        return []
    digits = re.sub(r'\D', '', normalized)
    variants = {normalized, digits}
    if digits.startswith('998') and len(digits) >= 12:
        variants.add('+' + digits)
        variants.add(digits[3:])
    return [v for v in variants if v]
