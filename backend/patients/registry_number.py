"""8 xonali ketma-ket bemor ro'yxat raqami (00000001 …)."""
from __future__ import annotations

from django.db import transaction
from django.db.models import Q


REGISTRY_NUMBER_WIDTH = 8
REGISTRY_NUMBER_MAX = 10**REGISTRY_NUMBER_WIDTH - 1


def format_registry_number(value: int) -> str:
    if value < 1 or value > REGISTRY_NUMBER_MAX:
        raise ValueError('Patient registry number out of range')
    return f'{value:0{REGISTRY_NUMBER_WIDTH}d}'


@transaction.atomic
def allocate_patient_registry_number() -> str:
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
    """Raqamli qidiruv — 8 xonali bemor ID (qisman ham: 42 → …00000042)."""
    q = (query or '').strip()
    if not q.isdigit():
        return None
    clause = Q()
    if len(q) <= REGISTRY_NUMBER_WIDTH:
        clause |= Q(registry_number=q.zfill(REGISTRY_NUMBER_WIDTH))
        if len(q) < REGISTRY_NUMBER_WIDTH:
            clause |= Q(registry_number__endswith=q)
    else:
        clause |= Q(registry_number=q)
    try:
        clause |= Q(pk=int(q))
    except (TypeError, ValueError):
        pass
    return clause
