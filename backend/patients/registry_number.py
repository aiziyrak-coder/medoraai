"""Bemor ID — pasport seriya raqami bo'yicha qidiruv."""
from __future__ import annotations

import re

from django.db import transaction
from django.db.models import Q

from .passport_serial import LEGACY_NUMERIC_RE, normalize_passport_serial, PASSPORT_SERIAL_RE

REGISTRY_NUMBER_WIDTH = 8
REGISTRY_NUMBER_MAX = 10**REGISTRY_NUMBER_WIDTH - 1


def format_registry_number(value: int) -> str:
    if value < 1 or value > REGISTRY_NUMBER_MAX:
        raise ValueError('Patient registry number out of range')
    return f'{value:0{REGISTRY_NUMBER_WIDTH}d}'


def looks_like_registry_query(raw: str) -> bool:
    """
    Pasport/raqamli ID/telefon — faqat shunda registry qidiruvi.
    Oddiy ism (masalan «islom») uchun False — ism qidiruvi ishlaydi.
    """
    q = (raw or '').strip()
    if not q:
        return False
    if q.isdigit():
        return True
    digits_only = re.sub(r'\D', '', q)
    if len(digits_only) >= 7 and (q.startswith('+') or digits_only == q.replace(' ', '')):
        return True
    normalized = normalize_passport_serial(q)
    if LEGACY_NUMERIC_RE.match(normalized):
        return True
    if PASSPORT_SERIAL_RE.match(normalized):
        return True
    # Qisman pasport: AB123 yoki AB
    if re.match(r'^[A-Z]{1,2}\d{0,7}$', normalized) and any(ch.isdigit() for ch in normalized):
        return True
    if re.match(r'^[A-Z]{2}$', normalized):
        return True
    return False


@transaction.atomic
def allocate_patient_registry_number() -> str:
    """Eski avtomatik raqamlar — faqat migratsiya / maxsus holatlar uchun."""
    from .models import PatientRegistryCounter

    counter, _ = PatientRegistryCounter.objects.select_for_update().get_or_create(
        pk=1,
        defaults={'last_value': 0},
    )
    counter.last_value += 1
    if counter.last_value > REGISTRY_NUMBER_MAX:
        raise ValueError('Patient registry number limit exceeded')
    counter.save(update_fields=['last_value'])
    return format_registry_number(counter.last_value)


def registry_number_lookup_q(query: str) -> Q | None:
    """Pasport seriyasi yoki eski raqamli ID bo'yicha qidiruv."""
    raw = (query or '').strip()
    if not raw or not looks_like_registry_query(raw):
        return None

    normalized = normalize_passport_serial(raw)
    clause = Q(registry_number__iexact=normalized) | Q(registry_number__icontains=normalized)

    if raw.isdigit():
        if len(raw) <= REGISTRY_NUMBER_WIDTH:
            clause |= Q(registry_number=raw.zfill(REGISTRY_NUMBER_WIDTH))
            if len(raw) < REGISTRY_NUMBER_WIDTH:
                clause |= Q(registry_number__endswith=raw)
        else:
            clause |= Q(registry_number=raw)
        try:
            clause |= Q(pk=int(raw))
        except (TypeError, ValueError):
            pass

    return clause
