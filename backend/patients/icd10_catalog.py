"""XKT-10 kasallik turlari (22 ta sinf) — statistika filtrlari uchun."""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Icd10Chapter:
    code: str
    range_label: str
    name_uz: str
    name_ru: str
    letter_start: str
    num_start: int
    letter_end: str
    num_end: int


ICD10_CHAPTERS: tuple[Icd10Chapter, ...] = (
    Icd10Chapter('I', 'A00-B99', 'Yuqumli va parazitar kasalliklar', 'Инфекционные и паразитарные болезни', 'A', 0, 'B', 99),
    Icd10Chapter('II', 'C00-D48', 'O\'sma va xarakterlanishi noma\'lum o\'smalar', 'Новообразования', 'C', 0, 'D', 48),
    Icd10Chapter('III', 'D50-D89', 'Qon, qon hosil qiluvchi organlar va immunitet', 'Болезни крови и иммунитета', 'D', 50, 'D', 89),
    Icd10Chapter('IV', 'E00-E90', 'Endokrin va metabolik kasalliklar', 'Эндокринные и метаболические болезни', 'E', 0, 'E', 90),
    Icd10Chapter('V', 'F00-F99', 'Ruhiy va xulq-atvor buzilishlari', 'Психические расстройства', 'F', 0, 'F', 99),
    Icd10Chapter('VI', 'G00-G99', 'Asab tizimi kasalliklari', 'Болезни нервной системы', 'G', 0, 'G', 99),
    Icd10Chapter('VII', 'H00-H59', "Ko'z va qo'shimchalari kasalliklari", 'Болезни глаза', 'H', 0, 'H', 59),
    Icd10Chapter('VIII', 'H60-H95', 'Quloq va mastoid jarayoni', 'Болезни уха', 'H', 60, 'H', 95),
    Icd10Chapter('IX', 'I00-I99', 'Qon aylanish tizimi kasalliklari', 'Болезни системы кровообращения', 'I', 0, 'I', 99),
    Icd10Chapter('X', 'J00-J99', 'Nafas olish organlari kasalliklari', 'Болезни органов дыхания', 'J', 0, 'J', 99),
    Icd10Chapter('XI', 'K00-K93', 'Ovqat hazm qilish organlari kasalliklari', 'Болезни органов пищеварения', 'K', 0, 'K', 93),
    Icd10Chapter('XII', 'L00-L99', "Teri va teri qo'shimchalari kasalliklari", 'Болезни кожи', 'L', 0, 'L', 99),
    Icd10Chapter('XIII', 'M00-M99', 'Suyak-mushak va biriktiruvchi to\'qima', 'Болезни костно-мышечной системы', 'M', 0, 'M', 99),
    Icd10Chapter('XIV', 'N00-N99', 'Siydik-jinsiy tizim kasalliklari', 'Болезни мочеполовой системы', 'N', 0, 'N', 99),
    Icd10Chapter('XV', 'O00-O99', 'Homiladorlik, tug\'ruq va puerperiy', 'Беременность и роды', 'O', 0, 'O', 99),
    Icd10Chapter('XVI', 'P00-P96', 'Perinatal davr kasalliklari', 'Перинатальные состояния', 'P', 0, 'P', 96),
    Icd10Chapter('XVII', 'Q00-Q99', 'Tug\'ma nuqsonlar', 'Врожденные аномалии', 'Q', 0, 'Q', 99),
    Icd10Chapter('XVIII', 'R00-R99', 'Simptomlar va laboratoriya og\'ishlari', 'Симптомы и отклонения', 'R', 0, 'R', 99),
    Icd10Chapter('XIX', 'S00-T98', 'Jarohatlar, zaharlanish va boshqalar', 'Травмы и отравления', 'S', 0, 'T', 98),
    Icd10Chapter('XX', 'V01-Y98', 'Tashqi sabablar', 'Внешние причины', 'V', 1, 'Y', 98),
    Icd10Chapter('XXI', 'Z00-Z99', 'Salomatlik holati va xizmatlar', 'Факторы здоровья', 'Z', 0, 'Z', 99),
    Icd10Chapter('XXII', 'U00-U85', 'Maxsus maqsadlar uchun kodlar', 'Особые цели', 'U', 0, 'U', 85),
)

_CHAPTER_BY_CODE = {c.code: c for c in ICD10_CHAPTERS}


def normalize_icd_code(raw: str) -> str:
    code = (raw or '').strip().upper().replace(' ', '')
    if not code:
        return ''
    code = code.replace(',', '.')
    m = re.match(r'^([A-Z])(\d{1,2})(?:[\.\-](\d{1,2}))?', code)
    if not m:
        return code[:20]
    letter, major, minor = m.group(1), int(m.group(2)), m.group(3)
    if minor is not None:
        return f'{letter}{major:02d}.{minor}'
    return f'{letter}{major:02d}'


def _icd_sort_key(code: str) -> tuple[str, int, int]:
    m = re.match(r'^([A-Z])(\d{2})(?:\.(\d+))?', code or '')
    if not m:
        return ('Z', 999, 999)
    return (m.group(1), int(m.group(2)), int(m.group(3) or 0))


def icd_in_chapter(icd_code: str, chapter: Icd10Chapter) -> bool:
    code = normalize_icd_code(icd_code)
    m = re.match(r'^([A-Z])(\d{2})', code)
    if not m:
        return False
    letter, num = m.group(1), int(m.group(2))
    if letter < chapter.letter_start or letter > chapter.letter_end:
        return False
    if letter == chapter.letter_start and num < chapter.num_start:
        return False
    if letter == chapter.letter_end and num > chapter.num_end:
        return False
    return True


def chapter_for_icd(icd_code: str) -> Icd10Chapter | None:
    for ch in ICD10_CHAPTERS:
        if icd_in_chapter(icd_code, ch):
            return ch
    return None


def chapter_choices(lang: str = 'uz') -> list[dict[str, str]]:
    name_key = 'name_ru' if lang == 'ru' else 'name_uz'
    return [
        {'code': c.code, 'range': c.range_label, 'label': getattr(c, name_key)}
        for c in ICD10_CHAPTERS
    ]


def chapter_by_code(code: str) -> Icd10Chapter | None:
    return _CHAPTER_BY_CODE.get(code)
