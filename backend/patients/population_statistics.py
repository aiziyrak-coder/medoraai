"""Bemorlar statistikasi — filtrlar va kesimlar."""
from __future__ import annotations

import io
import re
from collections import Counter
from typing import Any

from django.db.models import Q, QuerySet
from openpyxl import Workbook
from openpyxl.styles import Font

from .icd10_catalog import ICD10_CHAPTERS, chapter_by_code, chapter_for_icd, icd_in_chapter, normalize_icd_code
from .models import PopulationRecord
from .primary_care_models import DispensaryRecord

AGE_BUCKETS = (
    ('0-1', 0, 1),
    ('2-17', 2, 17),
    ('18-29', 18, 29),
    ('30-44', 30, 44),
    ('45-59', 45, 59),
    ('60-74', 60, 74),
    ('75+', 75, 200),
)


def parse_age_int(age_raw: str) -> int | None:
    m = re.search(r'\d+', str(age_raw or ''))
    if not m:
        return None
    try:
        return int(m.group())
    except ValueError:
        return None


def age_bucket(age_raw: str) -> str:
    age = parse_age_int(age_raw)
    if age is None:
        return 'unknown'
    for label, lo, hi in AGE_BUCKETS:
        if lo <= age <= hi:
            return label
    return 'unknown'


def _effective_icd(rec: PopulationRecord, disp_map: dict[int, str]) -> str:
    code = (rec.dispensary_icd_code or disp_map.get(rec.id) or '').strip()
    return normalize_icd_code(code)


def _effective_disability_group(rec: PopulationRecord) -> str:
    g = (rec.disability_group or '').strip()
    if g:
        return g
    if rec.risk_disabled:
        return 'unknown'
    return ''


def _build_disp_map(pop_ids: list[int]) -> dict[int, str]:
    if not pop_ids:
        return {}
    out: dict[int, str] = {}
    for row in (
        DispensaryRecord.objects.filter(population_id__in=pop_ids, is_active=True)
        .order_by('population_id', '-registered_date')
        .values('population_id', 'icd10_code')
    ):
        pid = row['population_id']
        if pid not in out and row.get('icd10_code'):
            out[pid] = str(row['icd10_code'])
    return out


def filter_population_records(qs: QuerySet, params: dict[str, Any]) -> list[PopulationRecord]:
    """Filtrlarni qo'llash — yosh va kasallik turi Python darajasida."""
    region_id = (params.get('region_id') or '').strip()
    district_id = (params.get('district_id') or '').strip()
    health_group = (params.get('health_group') or '').strip()
    gender = (params.get('gender') or '').strip()
    q = (params.get('q') or params.get('search') or '').strip()
    disease_chapter = (params.get('disease_chapter') or params.get('disease_type') or '').strip()
    icd_code = normalize_icd_code(params.get('icd_code') or params.get('dispensary_icd') or '')
    age_group = (params.get('age_group') or '').strip()
    age_min = params.get('age_min')
    age_max = params.get('age_max')
    disability = (params.get('disability') or '').strip().lower()
    disability_group = (params.get('disability_group') or '').strip()
    dispensary = (params.get('dispensary') or params.get('d_account') or '').strip().lower()

    brigade_id = params.get('brigade_id')
    if brigade_id:
        qs = qs.filter(brigade_id=int(brigade_id))
    if region_id:
        qs = qs.filter(region_id=region_id)
    if district_id:
        qs = qs.filter(district_id=district_id)
    if health_group:
        qs = qs.filter(health_group=health_group)
    if gender in ('male', 'female', 'other'):
        qs = qs.filter(gender=gender)
    if q:
        qs = qs.filter(
            Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(father_name__icontains=q)
            | Q(registry_number__icontains=q)
            | Q(medical_card_number__icontains=q)
            | Q(phone__icontains=q)
        )

    if disability in ('yes', 'true', '1', 'ha', 'bor'):
        qs = qs.filter(Q(risk_disabled=True) | ~Q(disability_group=''))
    elif disability in ('no', 'false', '0', 'yoq', "yo'q", 'yoq'):
        qs = qs.filter(risk_disabled=False, disability_group='')

    if disability_group:
        qs = qs.filter(disability_group__iexact=disability_group)

    if dispensary in ('yes', 'true', '1', 'ha', 'bor'):
        qs = qs.filter(
            Q(dispensary_registered=True)
            | ~Q(dispensary_icd_code='')
            | Q(dispensary_records__is_active=True),
        ).distinct()
    elif dispensary in ('no', 'false', '0', 'yoq', "yo'q", 'yoq'):
        qs = qs.filter(dispensary_registered=False, dispensary_icd_code='').exclude(
            dispensary_records__is_active=True,
        ).distinct()

    if icd_code:
        qs = qs.filter(
            Q(dispensary_icd_code__iexact=icd_code)
            | Q(dispensary_icd_code__istartswith=icd_code)
            | Q(dispensary_records__icd10_code__iexact=icd_code, dispensary_records__is_active=True),
        ).distinct()

    records = list(qs.select_related('brigade'))

    if age_group:
        records = [r for r in records if age_bucket(r.age) == age_group]
    elif age_min not in (None, '') or age_max not in (None, ''):
        lo = int(age_min) if age_min not in (None, '') else 0
        hi = int(age_max) if age_max not in (None, '') else 200
        records = [
            r for r in records
            if (a := parse_age_int(r.age)) is not None and lo <= a <= hi
        ]

    if disease_chapter:
        ch = chapter_by_code(disease_chapter)
        if ch:
            disp_map = _build_disp_map([r.id for r in records])
            records = [
                r for r in records
                if (code := _effective_icd(r, disp_map)) and icd_in_chapter(code, ch)
            ]

    return records


def compute_population_statistics(records: list[PopulationRecord], *, lang: str = 'uz') -> dict[str, Any]:
    pop_ids = [r.id for r in records]
    disp_map = _build_disp_map(pop_ids)

    by_district: Counter[str] = Counter()
    by_region: Counter[str] = Counter()
    by_age: Counter[str] = Counter()
    by_health: Counter[str] = Counter()
    by_gender: Counter[str] = Counter()
    by_disability_group: Counter[str] = Counter()
    by_disease_chapter: Counter[str] = Counter()
    by_icd: Counter[str] = Counter()
    disabled_count = 0
    dispensary_count = 0

    region_names, district_meta = _region_names()

    for rec in records:
        rid = str(rec.region_id or '')
        did = str(rec.district_id or '')
        by_region[region_names.get(rid, rid or '—')] += 1
        dname = district_meta.get(did, {}).get('district_name', did or '—')
        by_district[dname] += 1
        by_age[age_bucket(rec.age)] += 1
        by_health[rec.health_group or '—'] += 1
        by_gender[rec.gender or '—'] += 1

        dg = _effective_disability_group(rec)
        if rec.risk_disabled or dg:
            disabled_count += 1
            by_disability_group[dg or 'unknown'] += 1

        icd = _effective_icd(rec, disp_map)
        if icd or rec.dispensary_registered:
            dispensary_count += 1
        if icd:
            by_icd[icd] += 1
            ch = chapter_for_icd(icd)
            if ch:
                label = ch.name_ru if lang == 'ru' else ch.name_uz
                by_disease_chapter[label] += 1

    name_key = 'name_ru' if lang == 'ru' else 'name_uz'
    chapters_meta = [
        {'code': c.code, 'range': c.range_label, 'label': getattr(c, name_key)}
        for c in ICD10_CHAPTERS
    ]

    return {
        'total': len(records),
        'disabled_total': disabled_count,
        'dispensary_total': dispensary_count,
        'by_region': _counter_list(by_region),
        'by_district': _counter_list(by_district),
        'by_age_group': _counter_list(by_age, order=[b[0] for b in AGE_BUCKETS] + ['unknown']),
        'by_health_group': _counter_list(by_health),
        'by_gender': _counter_list(by_gender),
        'by_disability_group': _counter_list(by_disability_group),
        'by_disease_chapter': _counter_list(by_disease_chapter),
        'top_icd_codes': [{'code': k, 'count': v} for k, v in by_icd.most_common(25)],
        'icd_chapters': chapters_meta,
        'age_buckets': [b[0] for b in AGE_BUCKETS],
    }


def _counter_list(c: Counter, order: list[str] | None = None) -> list[dict[str, Any]]:
    if order:
        keys = [k for k in order if k in c] + [k for k in c if k not in order]
    else:
        keys = [k for k, _ in c.most_common()]
    return [{'label': k, 'count': c[k]} for k in keys]


def _region_names() -> tuple[dict[str, str], dict[str, dict]]:
    from .address_data import load_address_catalog
    catalog = load_address_catalog()
    region_names = {r['id']: r['name_uz'] for r in catalog['regions']}
    district_meta: dict[str, dict] = {}
    for r in catalog['regions']:
        for d in r.get('districts', []):
            district_meta[str(d['id'])] = {
                'district_name': d['name_uz'],
                'region_id': r['id'],
                'region_name': r['name_uz'],
            }
    return region_names, district_meta


def export_statistics_excel(records: list[PopulationRecord]) -> bytes:
    pop_ids = [r.id for r in records]
    disp_map = _build_disp_map(pop_ids)
    region_names, district_meta = _region_names()

    wb = Workbook()
    ws = wb.active
    ws.title = 'Bemorlar'
    headers = [
        'Medkarta', 'Familiya', 'Ism', 'Otasining ismi', 'Yosh', 'Jins',
        'Viloyat', 'Tuman', 'Sog\'liq guruhi', 'NKB (D-hisob)', 'Nogironlik guruhi',
    ]
    bold = Font(bold=True)
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = bold

    for i, rec in enumerate(sorted(records, key=lambda r: (r.last_name, r.first_name)), start=2):
        meta = district_meta.get(str(rec.district_id or ''), {})
        ws.cell(row=i, column=1, value=rec.medical_card_number or rec.registry_number)
        ws.cell(row=i, column=2, value=rec.last_name)
        ws.cell(row=i, column=3, value=rec.first_name)
        ws.cell(row=i, column=4, value=rec.father_name)
        ws.cell(row=i, column=5, value=rec.age)
        ws.cell(row=i, column=6, value=rec.gender)
        ws.cell(row=i, column=7, value=region_names.get(str(rec.region_id or ''), ''))
        ws.cell(row=i, column=8, value=meta.get('district_name', ''))
        ws.cell(row=i, column=9, value=rec.health_group)
        ws.cell(row=i, column=10, value=_effective_icd(rec, disp_map))
        ws.cell(row=i, column=11, value=_effective_disability_group(rec))

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def backfill_population_statistics_fields(batch_size: int = 500) -> dict[str, int]:
    updated = 0
    from .sox_excel_import import parse_disability_group

    for pop in PopulationRecord.objects.all().order_by('id').iterator(chunk_size=batch_size):
        changed = False
        if not pop.medical_card_number and pop.registry_number:
            pop.medical_card_number = pop.registry_number
            changed = True
        if not pop.dispensary_icd_code:
            disp = (
                DispensaryRecord.objects.filter(population=pop, is_active=True)
                .order_by('-registered_date')
                .first()
            )
            if disp and disp.icd10_code:
                pop.dispensary_icd_code = normalize_icd_code(disp.icd10_code)
                pop.dispensary_diagnosis = (disp.diagnosis or '')[:255]
                pop.dispensary_registered = True
                changed = True
        if not pop.disability_group and pop.risk_disabled and 'Nogironlik:' in (pop.anamnesis or ''):
            part = pop.anamnesis.split('Nogironlik:', 1)[1].split('\n', 1)[0].strip()
            _, grp = parse_disability_group(part)
            if grp:
                pop.disability_group = grp
                changed = True
        if changed:
            pop.save(update_fields=[
                'medical_card_number', 'dispensary_icd_code', 'dispensary_diagnosis',
                'dispensary_registered', 'disability_group', 'updated_at',
            ])
            updated += 1
    return {'updated': updated}
