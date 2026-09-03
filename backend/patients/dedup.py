"""Bemor dublikatlarini topish va birlashtirish."""
from __future__ import annotations

from django.db import transaction
from django.db.models import Q

from .models import Patient
from .phone import normalize_patient_phone, patient_phone_variants
from .registry_number import registry_number_lookup_q


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
        lookup = registry_number_lookup_q(rn)
        if lookup is not None:
            by_rn = qs.filter(lookup).order_by('-updated_at')
            if by_rn.exists():
                return by_rn.first()
        by_rn = qs.filter(registry_number__iexact=rn).order_by('-updated_at')
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
    """
    Barcha telefon dublikatlarini birlashtirish — (saqlangan_id, o'chirilgan_id).
    Bitta o'tish: jadval bir marta o'qiladi (faqat id/telefon), guruhlar normalizatsiya
    qilingan raqam bo'yicha tuziladi. Ilgari har bir bemor uchun to'liq jadval
    qayta o'qilardi (O(N²)).
    """
    from collections import defaultdict

    from django.db.models import Count

    from analyses.models import AnalysisRecord

    groups: dict[str, list[int]] = defaultdict(list)
    rows = (
        Patient.objects.exclude(phone='')
        .exclude(phone__isnull=True)
        .order_by('created_at')
        .values_list('id', 'phone')
    )
    for pk, phone in rows.iterator(chunk_size=2000):
        key = normalize_patient_phone(phone)
        if key:
            groups[key].append(pk)

    dup_ids = [pk for ids in groups.values() if len(ids) > 1 for pk in ids]
    if not dup_ids:
        return []

    # Tahlillar soni — agregat so'rov (har bir bemor uchun alohida COUNT emas).
    # IN ro'yxati bo'laklarga bo'linadi: SQLite da 999 ta o'zgaruvchi chegarasi bor.
    analysis_counts: dict[int, int] = {}
    for start in range(0, len(dup_ids), 900):
        chunk = dup_ids[start:start + 900]
        for row in (
            AnalysisRecord.objects.filter(patient_id__in=chunk)
            .order_by()
            .values('patient_id')
            .annotate(c=Count('id'))
        ):
            analysis_counts[row['patient_id']] = row['c']

    merged: list[tuple[int, int]] = []
    for ids in groups.values():
        if len(ids) < 2:
            continue
        dupes = list(Patient.objects.filter(pk__in=ids))
        if len(dupes) < 2:
            continue
        dupes.sort(key=lambda p: (-analysis_counts.get(p.pk, 0), p.created_at))
        keep = dupes[0]
        for other in dupes[1:]:
            removed_id = other.pk
            merge_patients(keep, other)
            merged.append((keep.pk, removed_id))
    return merged
