"""Bemorlar statistikasi — viloyat/tuman, kasallik turi, yosh, nogironlik, D hisob.

Manba: PopulationRecord (aholi bazasi). Filtrlar birgalikda qo'llanadi.
"""
from __future__ import annotations

import io
import re
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Font

from .icd10_catalog import (
    chapter_catalog,
    chapter_label,
    icd_chapter_key,
    normalize_icd_code,
)

# (kalit, min yosh, max yosh yoki None)
AGE_GROUPS: list[tuple[str, int, int | None]] = [
    ('0-1', 0, 1),
    ('2-6', 2, 6),
    ('7-14', 7, 14),
    ('15-17', 15, 17),
    ('18-29', 18, 29),
    ('30-44', 30, 44),
    ('45-59', 45, 59),
    ('60-74', 60, 74),
    ('75+', 75, None),
]

UNKNOWN_AGE_KEY = 'unknown'

_AGE_LABELS = {
    'uz': {'75+': '75 va undan katta', UNKNOWN_AGE_KEY: "Yoshi ko'rsatilmagan"},
    'ru': {'75+': '75 и старше', UNKNOWN_AGE_KEY: 'Возраст не указан'},
    'en': {'75+': '75 and older', UNKNOWN_AGE_KEY: 'Age not specified'},
}

DISABILITY_GROUPS: list[str] = ['1', '2', '3', 'child']

_DISABILITY_LABELS = {
    'uz': {'1': 'I guruh', '2': 'II guruh', '3': 'III guruh',
           'child': 'Bolalikdan nogiron', 'none': "Nogironligi yo'q"},
    'ru': {'1': 'I группа', '2': 'II группа', '3': 'III группа',
           'child': 'Инвалид с детства', 'none': 'Нет инвалидности'},
    'en': {'1': 'Group I', '2': 'Group II', '3': 'Group III',
           'child': 'Disabled since childhood', 'none': 'No disability'},
}

_HEALTH_GROUP_LABELS = {
    'uz': {'1': "1-guruh (sog'lom)", '2': '2-guruh (xavf ostida)',
           '3': '3-guruh (surunkali)', '4': '4-guruh (nogironlik)',
           '': "Guruh ko'rsatilmagan"},
    'ru': {'1': '1 группа (здоров)', '2': '2 группа (риск)',
           '3': '3 группа (хронические)', '4': '4 группа (инвалидность)',
           '': 'Группа не указана'},
    'en': {'1': 'Group 1 (healthy)', '2': 'Group 2 (at risk)',
           '3': 'Group 3 (chronic)', '4': 'Group 4 (disability)',
           '': 'Group not specified'},
}

_GENDER_LABELS = {
    'uz': {'male': 'Erkak', 'female': 'Ayol', 'other': 'Boshqa', '': "Ko'rsatilmagan"},
    'ru': {'male': 'Мужчина', 'female': 'Женщина', 'other': 'Другое', '': 'Не указано'},
    'en': {'male': 'Male', 'female': 'Female', 'other': 'Other', '': 'Not specified'},
}

_STAT_TITLES = {
    'uz': {'sheet': 'Bemorlar statistikasi', 'metric': "Ko'rsatkich", 'count': 'Soni'},
    'ru': {'sheet': 'Статистика пациентов', 'metric': 'Показатель', 'count': 'Количество'},
    'en': {'sheet': 'Patient statistics', 'metric': 'Metric', 'count': 'Count'},
}

_DIGITS_RE = re.compile(r'\d+')

MAX_SCAN_ROWS = 200_000


def _lang(language: str | None) -> str:
    return language if language in ('uz', 'ru', 'en') else 'uz'


def age_group_label(key: str, language: str = 'uz') -> str:
    lang = _lang(language)
    override = _AGE_LABELS[lang].get(key)
    if override:
        return override
    return key


def parse_age(raw: Any) -> int | None:
    """'27', '27 yosh', '3 года' -> 27/3; bo'sh yoki noaniq -> None."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        val = int(raw)
        return val if 0 <= val <= 130 else None
    m = _DIGITS_RE.search(str(raw))
    if not m:
        return None
    val = int(m.group(0))
    return val if 0 <= val <= 130 else None


def age_group_key(age: int | None) -> str:
    if age is None:
        return UNKNOWN_AGE_KEY
    for key, lo, hi in AGE_GROUPS:
        if age >= lo and (hi is None or age <= hi):
            return key
    return UNKNOWN_AGE_KEY


def normalize_disability_group(raw: Any) -> str:
    """'2 группа', 'II guruh', '2' -> '2'; 'Нет'/bo'sh -> ''."""
    s = str(raw or '').strip().lower()
    if not s or s in ('нет', "yo'q", 'yoq', 'yuq', 'no', 'none', '-', '0'):
        return ''
    if 'детств' in s or 'bolalik' in s or 'child' in s:
        return 'child'
    if re.search(r'\biii\b|\b3\b', s):
        return '3'
    if re.search(r'\bii\b|\b2\b', s):
        return '2'
    if re.search(r'\bi\b|\b1\b', s):
        return '1'
    m = _DIGITS_RE.search(s)
    if m and m.group(0) in DISABILITY_GROUPS:
        return m.group(0)
    return ''


def normalize_health_group(raw: Any) -> str:
    """'1 группа', '2-guruh' -> '1'/'2'."""
    m = _DIGITS_RE.search(str(raw or ''))
    return m.group(0) if m and m.group(0) in ('1', '2', '3', '4') else ''


def _district_meta() -> tuple[dict[str, str], dict[str, dict]]:
    from .address_data import load_address_catalog
    catalog = load_address_catalog()
    region_names = {str(r['id']): r['name_uz'] for r in catalog['regions']}
    districts: dict[str, dict] = {}
    for r in catalog['regions']:
        for d in r.get('districts', []):
            districts[str(d['id'])] = {
                'district_name': d['name_uz'],
                'district_name_ru': d.get('name_ru', ''),
                'region_id': str(r['id']),
                'region_name': r['name_uz'],
                'region_name_ru': r.get('name_ru', ''),
            }
    return region_names, districts


def _sorted_counts(counter: dict[str, int]) -> list[tuple[str, int]]:
    return sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))


def build_patient_statistics(
    *,
    user=None,
    region_id: str = '',
    district_id: str = '',
    icd_chapter: str = '',
    icd_code: str = '',
    age_min: int | None = None,
    age_max: int | None = None,
    age_group: str = '',
    disability: str = '',
    disability_group: str = '',
    dispensary: str = '',
    health_group: str = '',
    gender: str = '',
    search: str = '',
    language: str = 'uz',
    top_codes_limit: int = 25,
) -> dict[str, Any]:
    from .primary_care_access import population_for_user

    lang = _lang(language)
    qs = population_for_user(user) if user is not None else None
    if qs is None:
        from .models import PopulationRecord
        qs = PopulationRecord.objects.all()

    region_id = (region_id or '').strip()
    district_id = (district_id or '').strip()
    if region_id:
        qs = qs.filter(region_id=region_id)
    if district_id:
        qs = qs.filter(district_id=district_id)
    if gender:
        qs = qs.filter(gender=gender)
    if health_group:
        qs = qs.filter(health_group__startswith=health_group)
    if disability == 'yes':
        qs = qs.filter(risk_disabled=True)
    elif disability == 'no':
        qs = qs.filter(risk_disabled=False)
    if disability_group:
        qs = qs.filter(disability_group=disability_group)
    if dispensary == 'yes':
        qs = qs.exclude(dispensary_icd_code='')
    elif dispensary == 'no':
        qs = qs.filter(dispensary_icd_code='')
    code_filter = normalize_icd_code(icd_code)
    if code_filter:
        qs = qs.filter(dispensary_icd_code__istartswith=code_filter)
    if search:
        from django.db.models import Q
        qs = qs.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(father_name__icontains=search)
            | Q(registry_number__icontains=search)
            | Q(medical_card_number__icontains=search)
        )

    rows = qs.values_list(
        'age', 'gender', 'region_id', 'district_id', 'health_group',
        'risk_disabled', 'disability_group', 'dispensary_icd_code',
        'dispensary_registered',
    )[:MAX_SCAN_ROWS]

    region_names, district_meta = _district_meta()

    age_counter: dict[str, int] = {}
    district_counter: dict[str, int] = {}
    region_counter: dict[str, int] = {}
    disease_counter: dict[str, int] = {}
    code_counter: dict[str, int] = {}
    disability_counter: dict[str, int] = {}
    health_counter: dict[str, int] = {}
    gender_counter: dict[str, int] = {}
    dispensary_yes = 0
    disabled_total = 0
    total = 0

    want_group = (age_group or '').strip()

    for (
        raw_age, raw_gender, r_id, d_id, raw_health,
        risk_disabled, dis_group, code, disp_registered,
    ) in rows:
        age = parse_age(raw_age)
        if age_min is not None and (age is None or age < age_min):
            continue
        if age_max is not None and (age is None or age > age_max):
            continue
        a_key = age_group_key(age)
        if want_group and a_key != want_group:
            continue
        ch_key = icd_chapter_key(code)
        if icd_chapter and ch_key != icd_chapter:
            continue

        total += 1
        age_counter[a_key] = age_counter.get(a_key, 0) + 1
        district_counter[str(d_id or '')] = district_counter.get(str(d_id or ''), 0) + 1
        region_counter[str(r_id or '')] = region_counter.get(str(r_id or ''), 0) + 1
        disease_counter[ch_key] = disease_counter.get(ch_key, 0) + 1
        norm_code = normalize_icd_code(code)
        if norm_code:
            code_counter[norm_code] = code_counter.get(norm_code, 0) + 1
            dispensary_yes += 1
        elif disp_registered:
            dispensary_yes += 1
        dg = dis_group or ''
        if dg:
            disability_counter[dg] = disability_counter.get(dg, 0) + 1
            disabled_total += 1
        elif risk_disabled:
            disability_counter['unspecified'] = disability_counter.get('unspecified', 0) + 1
            disabled_total += 1
        hg = normalize_health_group(raw_health)
        health_counter[hg] = health_counter.get(hg, 0) + 1
        gender_counter[str(raw_gender or '')] = gender_counter.get(str(raw_gender or ''), 0) + 1

    age_rows = [
        {
            'key': key,
            'label': age_group_label(key, lang),
            'min': lo,
            'max': hi,
            'count': age_counter.get(key, 0),
        }
        for key, lo, hi in AGE_GROUPS
    ]
    if age_counter.get(UNKNOWN_AGE_KEY):
        age_rows.append({
            'key': UNKNOWN_AGE_KEY,
            'label': age_group_label(UNKNOWN_AGE_KEY, lang),
            'min': None,
            'max': None,
            'count': age_counter[UNKNOWN_AGE_KEY],
        })

    district_rows = []
    for d_id, count in _sorted_counts(district_counter):
        meta = district_meta.get(d_id, {})
        name = (meta.get('district_name_ru') if lang == 'ru' else '') or meta.get('district_name', '')
        r_name = (meta.get('region_name_ru') if lang == 'ru' else '') or meta.get('region_name', '')
        district_rows.append({
            'district_id': d_id,
            'district_name': name or ('—' if not d_id else d_id),
            'region_id': meta.get('region_id', ''),
            'region_name': r_name,
            'count': count,
        })

    region_rows = [
        {
            'region_id': r_id,
            'region_name': region_names.get(r_id, '—' if not r_id else r_id),
            'count': count,
        }
        for r_id, count in _sorted_counts(region_counter)
    ]

    disease_rows = [
        {
            'key': key,
            'label': chapter_label(key, lang),
            'count': count,
        }
        for key, count in _sorted_counts(disease_counter)
    ]

    code_rows = [
        {
            'code': code,
            'chapter_key': icd_chapter_key(code),
            'chapter_label': chapter_label(icd_chapter_key(code), lang),
            'count': count,
        }
        for code, count in _sorted_counts(code_counter)[:top_codes_limit]
    ]

    disability_rows = [
        {
            'key': key,
            'label': _DISABILITY_LABELS[lang][key],
            'count': disability_counter.get(key, 0),
        }
        for key in DISABILITY_GROUPS
    ]
    if disability_counter.get('unspecified'):
        disability_rows.append({
            'key': 'unspecified',
            'label': {'uz': "Guruhi ko'rsatilmagan", 'ru': 'Группа не указана',
                      'en': 'Group not specified'}[lang],
            'count': disability_counter['unspecified'],
        })

    health_rows = [
        {
            'key': key,
            'label': _HEALTH_GROUP_LABELS[lang].get(key, key),
            'count': count,
        }
        for key, count in sorted(health_counter.items(), key=lambda kv: (kv[0] == '', kv[0]))
    ]

    gender_rows = [
        {
            'key': key,
            'label': _GENDER_LABELS[lang].get(key, key),
            'count': count,
        }
        for key, count in _sorted_counts(gender_counter)
    ]

    return {
        'total': total,
        'summary': {
            'total': total,
            'disabled': disabled_total,
            'dispensary': dispensary_yes,
            'no_dispensary': max(total - dispensary_yes, 0),
            'distinct_codes': len(code_counter),
            'distinct_districts': len([d for d in district_counter if d]),
        },
        'age_groups': age_rows,
        'districts': district_rows,
        'regions': region_rows,
        'diseases': disease_rows,
        'top_codes': code_rows,
        'disability_groups': disability_rows,
        'health_groups': health_rows,
        'genders': gender_rows,
        'filters': {
            'region_id': region_id,
            'district_id': district_id,
            'icd_chapter': icd_chapter,
            'icd_code': code_filter,
            'age_min': age_min,
            'age_max': age_max,
            'age_group': want_group,
            'disability': disability,
            'disability_group': disability_group,
            'dispensary': dispensary,
            'health_group': health_group,
            'gender': gender,
            'search': search,
        },
        'catalogs': {
            'diseases': chapter_catalog(lang),
            'age_groups': [
                {'key': key, 'label': age_group_label(key, lang), 'min': lo, 'max': hi}
                for key, lo, hi in AGE_GROUPS
            ],
            'disability_groups': [
                {'key': key, 'label': _DISABILITY_LABELS[lang][key]} for key in DISABILITY_GROUPS
            ],
            'health_groups': [
                {'key': key, 'label': _HEALTH_GROUP_LABELS[lang][key]} for key in ('1', '2', '3', '4')
            ],
        },
    }


def _write_section(ws, title: str, rows: list[tuple[str, int]], titles: dict[str, str]) -> None:
    ws.append([])
    header = ws.max_row + 1
    ws.append([title])
    ws.cell(row=header, column=1).font = Font(bold=True, size=12)
    ws.append([titles['metric'], titles['count']])
    for cell in ws[ws.max_row]:
        cell.font = Font(bold=True)
    for label, count in rows:
        ws.append([label, count])


def export_patient_statistics_excel(stats: dict[str, Any], *, language: str = 'uz') -> bytes:
    lang = _lang(language)
    titles = _STAT_TITLES[lang]
    wb = Workbook()
    ws = wb.active
    ws.title = titles['sheet'][:31]
    ws.append([titles['sheet']])
    ws.cell(row=1, column=1).font = Font(bold=True, size=14)

    summary = stats.get('summary', {})
    summary_labels = {
        'uz': [('Jami bemorlar', 'total'), ('Nogironligi bor', 'disabled'),
               ('D hisobda', 'dispensary'), ('D hisobda emas', 'no_dispensary')],
        'ru': [('Всего пациентов', 'total'), ('С инвалидностью', 'disabled'),
               ('На Д учёте', 'dispensary'), ('Не на Д учёте', 'no_dispensary')],
        'en': [('Total patients', 'total'), ('With disability', 'disabled'),
               ('On dispensary registry', 'dispensary'), ('Not registered', 'no_dispensary')],
    }[lang]
    _write_section(
        ws,
        {'uz': 'Umumiy', 'ru': 'Общее', 'en': 'Summary'}[lang],
        [(label, int(summary.get(key, 0))) for label, key in summary_labels],
        titles,
    )

    sections = [
        ({'uz': 'Tumanlar bo\'yicha', 'ru': 'По районам', 'en': 'By district'}[lang],
         [(r['district_name'], r['count']) for r in stats.get('districts', [])]),
        ({'uz': 'Kasallik turi bo\'yicha', 'ru': 'По типу заболевания', 'en': 'By disease type'}[lang],
         [(r['label'], r['count']) for r in stats.get('diseases', [])]),
        ({'uz': 'Yosh oralig\'i bo\'yicha', 'ru': 'По возрасту', 'en': 'By age range'}[lang],
         [(r['label'], r['count']) for r in stats.get('age_groups', [])]),
        ({'uz': 'Nogironlik guruhi bo\'yicha', 'ru': 'По группе инвалидности', 'en': 'By disability group'}[lang],
         [(r['label'], r['count']) for r in stats.get('disability_groups', [])]),
        ({'uz': 'D hisob (NKB) kodlari', 'ru': 'Коды Д учёта (МКБ)', 'en': 'Dispensary (ICD) codes'}[lang],
         [(r['code'], r['count']) for r in stats.get('top_codes', [])]),
        ({'uz': 'Sog\'liq guruhi bo\'yicha', 'ru': 'По группе здоровья', 'en': 'By health group'}[lang],
         [(r['label'], r['count']) for r in stats.get('health_groups', [])]),
    ]
    for title, rows in sections:
        _write_section(ws, title, rows, titles)

    ws.column_dimensions['A'].width = 58
    ws.column_dimensions['B'].width = 14

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
