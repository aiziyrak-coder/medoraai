"""XKT-10 (ICD-10) sinflari — kasallik turlari bo'yicha statistika uchun.

Excel'dagi "D uchot" (NKB) ustuni B65-B83, T78.4, K29.9 kabi kodlarni saqlaydi.
Bu modul har qanday kodni XKT-10 sinfiga (bobiga) bog'laydi.
"""
from __future__ import annotations

import re
from functools import lru_cache

ICD10_CHAPTERS: list[dict] = [
    {'key': 'A00-B99', 'roman': 'I', 'start': ('A', 0), 'end': ('B', 99),
     'uz': 'Yuqumli va parazitar kasalliklar',
     'ru': 'Инфекционные и паразитарные болезни',
     'en': 'Infectious and parasitic diseases'},
    {'key': 'C00-D48', 'roman': 'II', 'start': ('C', 0), 'end': ('D', 48),
     'uz': "O'smalar (neoplazmalar)",
     'ru': 'Новообразования',
     'en': 'Neoplasms'},
    {'key': 'D50-D89', 'roman': 'III', 'start': ('D', 50), 'end': ('D', 89),
     'uz': 'Qon va immun tizimi kasalliklari',
     'ru': 'Болезни крови и иммунного механизма',
     'en': 'Diseases of the blood and immune mechanism'},
    {'key': 'E00-E90', 'roman': 'IV', 'start': ('E', 0), 'end': ('E', 90),
     'uz': 'Endokrin, ovqatlanish va modda almashinuvi kasalliklari',
     'ru': 'Болезни эндокринной системы, расстройства питания и обмена веществ',
     'en': 'Endocrine, nutritional and metabolic diseases'},
    {'key': 'F00-F99', 'roman': 'V', 'start': ('F', 0), 'end': ('F', 99),
     'uz': 'Ruhiy va xulq-atvor buzilishlari',
     'ru': 'Психические расстройства и расстройства поведения',
     'en': 'Mental and behavioural disorders'},
    {'key': 'G00-G99', 'roman': 'VI', 'start': ('G', 0), 'end': ('G', 99),
     'uz': 'Asab tizimi kasalliklari',
     'ru': 'Болезни нервной системы',
     'en': 'Diseases of the nervous system'},
    {'key': 'H00-H59', 'roman': 'VII', 'start': ('H', 0), 'end': ('H', 59),
     'uz': "Ko'z va uning qo'shimcha a'zolari kasalliklari",
     'ru': 'Болезни глаза и его придаточного аппарата',
     'en': 'Diseases of the eye and adnexa'},
    {'key': 'H60-H95', 'roman': 'VIII', 'start': ('H', 60), 'end': ('H', 95),
     'uz': "Quloq va so'rg'ichsimon o'siq kasalliklari",
     'ru': 'Болезни уха и сосцевидного отростка',
     'en': 'Diseases of the ear and mastoid process'},
    {'key': 'I00-I99', 'roman': 'IX', 'start': ('I', 0), 'end': ('I', 99),
     'uz': 'Qon aylanish tizimi kasalliklari',
     'ru': 'Болезни системы кровообращения',
     'en': 'Diseases of the circulatory system'},
    {'key': 'J00-J99', 'roman': 'X', 'start': ('J', 0), 'end': ('J', 99),
     'uz': "Nafas olish a'zolari kasalliklari",
     'ru': 'Болезни органов дыхания',
     'en': 'Diseases of the respiratory system'},
    {'key': 'K00-K93', 'roman': 'XI', 'start': ('K', 0), 'end': ('K', 93),
     'uz': "Ovqat hazm qilish a'zolari kasalliklari",
     'ru': 'Болезни органов пищеварения',
     'en': 'Diseases of the digestive system'},
    {'key': 'L00-L99', 'roman': 'XII', 'start': ('L', 0), 'end': ('L', 99),
     'uz': 'Teri va teri osti kletchatkasi kasalliklari',
     'ru': 'Болезни кожи и подкожной клетчатки',
     'en': 'Diseases of the skin and subcutaneous tissue'},
    {'key': 'M00-M99', 'roman': 'XIII', 'start': ('M', 0), 'end': ('M', 99),
     'uz': "Suyak-mushak tizimi va biriktiruvchi to'qima kasalliklari",
     'ru': 'Болезни костно-мышечной системы и соединительной ткани',
     'en': 'Diseases of the musculoskeletal system and connective tissue'},
    {'key': 'N00-N99', 'roman': 'XIV', 'start': ('N', 0), 'end': ('N', 99),
     'uz': 'Siydik-tanosil tizimi kasalliklari',
     'ru': 'Болезни мочеполовой системы',
     'en': 'Diseases of the genitourinary system'},
    {'key': 'O00-O99', 'roman': 'XV', 'start': ('O', 0), 'end': ('O', 99),
     'uz': "Homiladorlik, tug'ish va tug'ruqdan keyingi davr",
     'ru': 'Беременность, роды и послеродовой период',
     'en': 'Pregnancy, childbirth and the puerperium'},
    {'key': 'P00-P96', 'roman': 'XVI', 'start': ('P', 0), 'end': ('P', 96),
     'uz': 'Perinatal davrda yuzaga keladigan holatlar',
     'ru': 'Отдельные состояния перинатального периода',
     'en': 'Certain conditions originating in the perinatal period'},
    {'key': 'Q00-Q99', 'roman': 'XVII', 'start': ('Q', 0), 'end': ('Q', 99),
     'uz': "Tug'ma nuqsonlar va xromosoma anomaliyalari",
     'ru': 'Врождённые аномалии и хромосомные нарушения',
     'en': 'Congenital malformations and chromosomal abnormalities'},
    {'key': 'R00-R99', 'roman': 'XVIII', 'start': ('R', 0), 'end': ('R', 99),
     'uz': 'Simptomlar, belgilar va aniqlanmagan holatlar',
     'ru': 'Симптомы, признаки и отклонения от нормы',
     'en': 'Symptoms, signs and abnormal clinical findings'},
    {'key': 'S00-T98', 'roman': 'XIX', 'start': ('S', 0), 'end': ('T', 98),
     'uz': "Jarohatlar, zaharlanishlar va tashqi ta'sirlar oqibatlari",
     'ru': 'Травмы, отравления и последствия внешних причин',
     'en': 'Injury, poisoning and consequences of external causes'},
    {'key': 'V01-Y98', 'roman': 'XX', 'start': ('V', 1), 'end': ('Y', 98),
     'uz': "Kasallanish va o'limning tashqi sabablari",
     'ru': 'Внешние причины заболеваемости и смертности',
     'en': 'External causes of morbidity and mortality'},
    {'key': 'Z00-Z99', 'roman': 'XXI', 'start': ('Z', 0), 'end': ('Z', 99),
     'uz': "Sog'liqqa ta'sir etuvchi omillar va murojaatlar",
     'ru': 'Факторы, влияющие на состояние здоровья и обращения',
     'en': 'Factors influencing health status and contact with health services'},
    {'key': 'U00-U85', 'roman': 'XXII', 'start': ('U', 0), 'end': ('U', 85),
     'uz': 'Maxsus maqsadlardagi kodlar',
     'ru': 'Коды для особых целей',
     'en': 'Codes for special purposes'},
]

UNKNOWN_CHAPTER_KEY = 'unknown'
UNKNOWN_CHAPTER_LABELS = {
    'uz': "Aniqlanmagan / kod yo'q",
    'ru': 'Не указано / без кода',
    'en': 'Unspecified / no code',
}

_CODE_RE = re.compile(r'([A-Z])\s*(\d{1,2})')


def normalize_icd_code(raw: str | None) -> str:
    """'b65 - b83' -> 'B65-B83', 't78.4' -> 'T78.4'."""
    s = (raw or '').strip().upper()
    if not s:
        return ''
    s = re.sub(r'\s*-\s*', '-', s)
    return re.sub(r'\s+', ' ', s)


def _code_key(code: str) -> tuple[str, int] | None:
    m = _CODE_RE.search(normalize_icd_code(code))
    if not m:
        return None
    return m.group(1), int(m.group(2))


def icd_chapter_key(code: str | None) -> str:
    """Kod bo'yicha XKT-10 bobi kaliti ('I00-I99'), topilmasa 'unknown'."""
    key = _code_key(code or '')
    if not key:
        return UNKNOWN_CHAPTER_KEY
    for ch in ICD10_CHAPTERS:
        if ch['start'] <= key <= ch['end']:
            return ch['key']
    return UNKNOWN_CHAPTER_KEY


@lru_cache(maxsize=1)
def _chapter_index() -> dict[str, dict]:
    return {ch['key']: ch for ch in ICD10_CHAPTERS}


def chapter_label(chapter_key: str, language: str = 'uz') -> str:
    lang = language if language in ('uz', 'ru', 'en') else 'uz'
    ch = _chapter_index().get(chapter_key)
    if not ch:
        return UNKNOWN_CHAPTER_LABELS[lang]
    return ch[lang]


def chapter_catalog(language: str = 'uz') -> list[dict]:
    """Frontend filtri uchun barcha kasallik turlari ro'yxati."""
    lang = language if language in ('uz', 'ru', 'en') else 'uz'
    items = [
        {'key': ch['key'], 'roman': ch['roman'], 'range': ch['key'], 'label': ch[lang]}
        for ch in ICD10_CHAPTERS
    ]
    items.append({
        'key': UNKNOWN_CHAPTER_KEY,
        'roman': '',
        'range': '',
        'label': UNKNOWN_CHAPTER_LABELS[lang],
    })
    return items


def chapter_code_prefixes(chapter_key: str) -> list[str]:
    """Bob ichidagi barcha kod prefikslari (A00, A01, ... B99) — SQL filtri uchun."""
    ch = _chapter_index().get(chapter_key)
    if not ch:
        return []
    s_letter, s_num = ch['start']
    e_letter, e_num = ch['end']
    out: list[str] = []
    for o in range(ord(s_letter), ord(e_letter) + 1):
        letter = chr(o)
        lo = s_num if letter == s_letter else 0
        hi = e_num if letter == e_letter else 99
        out.extend(f'{letter}{n:02d}' for n in range(lo, hi + 1))
    return out
