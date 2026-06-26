"""Bemor ID — pasport seriya raqami bo'yicha qidiruv."""
from __future__ import annotations

from django.db import transaction
from django.db.models import Q

from .passport_serial import normalize_passport_serial


REGISTRY_NUMBER_WIDTH = 8
REGISTRY_NUMBER_MAX = 10**REGISTRY_NUMBER_WIDTH - 1


def format_registry_number(value: int) -> str:
    if value < 1 or value > REGISTRY_NUMBER_MAX:
        raise ValueError('Patient registry number out of range')
    return f'{value:0{REGISTRY_NUMBER_WIDTH}d}'


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
    if not raw:
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
