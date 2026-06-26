"""Bemor dublikatlarini topish va birlashtirish."""
from __future__ import annotations

from django.db import transaction
from django.db.models import Q

from .models import Patient
from .phone import normalize_patient_phone, patient_phone_variants


PASSPORT_FIELDS = (
    'first_name', 'last_name', 'father_name', 'age', 'gender',
    'phone', 'address', 'region_id', 'district_id',
)


def find_existing_patient(
    *,
    phone: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    father_name: str | None = None,
    age: str | None = None,
    registry_number: str | None = None,
    exclude_id: int | None = None,
) -> Patient | None:
    """Mavjud bemorni pasport ID, telefon yoki to'liq FIO+yosh bo'yicha topish."""
    qs = Patient.objects.all()
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)

    from .passport_serial import normalize_passport_serial

    rn = normalize_passport_serial(registry_number)
    if rn:
        by_rn = qs.filter(registry_number__iexact=rn)
        if by_rn.exists():
            return by_rn.first()

    normalized = normalize_patient_phone(phone)
    if normalized:
        variants = patient_phone_variants(phone)
        by_phone = qs.filter(Q(phone__in=variants) | Q(phone=normalized))
        if by_phone.count() == 1:
            return by_phone.first()
        if by_phone.exists():
            # Bir nechta yozuv — normalizatsiya bo'yicha aniq moslik
            for p in by_phone:
                if normalize_patient_phone(p.phone) == normalized:
                    return p
            return by_phone.order_by('-updated_at').first()

    fn = (first_name or '').strip()
    ln = (last_name or '').strip()
    father = (father_name or '').strip()
    age_s = (age or '').strip()
    if fn and ln and father and age_s:
        exact = qs.filter(
            first_name__iexact=fn,
            last_name__iexact=ln,
            father_name__iexact=father,
            age=age_s,
        )
        if exact.count() == 1:
            return exact.first()
    return None


def apply_passport_fields(patient: Patient, data: dict) -> Patient:
    """Pasport maydonlarini yangilash — bo'sh klinik maydonlarni o'zgartirmaydi."""
    changed = []
    for field in PASSPORT_FIELDS:
        val = data.get(field)
        if val is None:
            continue
        if isinstance(val, str):
            val = val.strip()
        if field == 'phone':
            val = normalize_patient_phone(val) or val
        if val != '' and getattr(patient, field) != val:
            setattr(patient, field, val)
            changed.append(field)
    if changed:
        patient.save(update_fields=changed + ['updated_at'])
    return patient


@transaction.atomic
def merge_patients(keep: Patient, remove: Patient) -> Patient:
    """remove bemorni keep ga birlashtirish (tahlillar, fayllar ko'chiriladi)."""
    if keep.pk == remove.pk:
        return keep
    from analyses.models import AnalysisRecord, ImagingStudyRecord
    from .models import PatientAttachment

    AnalysisRecord.objects.filter(patient=remove).update(patient=keep)
    ImagingStudyRecord.objects.filter(patient=remove).update(patient=keep)
    PatientAttachment.objects.filter(patient=remove).update(patient=keep)

    for field in PASSPORT_FIELDS:
        if not getattr(keep, field) and getattr(remove, field):
            setattr(keep, field, getattr(remove, field))
    keep.save()
    remove.delete()
    return keep


def merge_all_phone_duplicates() -> list[tuple[int, int]]:
    """Barcha telefon dublikatlarini birlashtirish — (saqlangan_id, o'chirilgan_id)."""
    from analyses.models import AnalysisRecord

    merged: list[tuple[int, int]] = []
    seen_phones: set[str] = set()
    for patient in Patient.objects.exclude(phone='').order_by('created_at'):
        key = normalize_patient_phone(patient.phone)
        if not key or key in seen_phones:
            continue
        dupes = [
            p for p in Patient.objects.filter(phone__isnull=False).exclude(phone='')
            if normalize_patient_phone(p.phone) == key
        ]
        if len(dupes) < 2:
            seen_phones.add(key)
            continue

        def _analysis_count(p: Patient) -> int:
            return AnalysisRecord.objects.filter(patient=p).count()

        dupes.sort(key=lambda p: (-_analysis_count(p), p.created_at))
        keep = dupes[0]
        for other in dupes[1:]:
            removed_id = other.pk
            merge_patients(keep, other)
            merged.append((keep.pk, removed_id))
        seen_phones.add(key)
    return merged
