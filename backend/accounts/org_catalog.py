"""
Respublika va OTM tibbiyot tashkilotlari — klinika guruhi + login ro'yxati.
Telefon: +9989178 + 5 xonali tartib (+998 dan keyin 9 raqam, masalan +998917800050).
"""
from __future__ import annotations

import hashlib
import re

REPUBLIC_ORG_ACCOUNTS: list[dict[str, str | int]] = [
    {"idx": 1, "code": "vahidov-hir", "name": "Академик В.Вахидов номидаги республика ихтисослаштирилган хирургия илмий-амалий тиббиёт маркази"},
    {"idx": 2, "code": "on-bola", "name": "Республика ихтисослаштирилган она ва бола саломатлиги илмий-амалий тиббиёт маркази"},
    {"idx": 3, "code": "kardio", "name": "Республика ихтисослаштирилган кардиология илмий-амалий тиббиёт маркази"},
    {"idx": 4, "code": "shoshilinch", "name": "Республика шошилинч тиббий ёрдам илмий маркази"},
    {"idx": 5, "code": "koz-mikro", "name": "Республика ихтисослаштирилган кўз микрохирургияси илмий-амалий тиббиёт маркази"},
    {"idx": 6, "code": "onko-radio", "name": "Республика ихтисослаштирилган онкология ва тиббий радиология илмий-амалий тиббиёт маркази"},
    {"idx": 7, "code": "terapiya-reab", "name": "Республика ихтисослаштирилган терапия ва тиббий реабилитация илмий-амалий тиббиёт маркази"},
    {"idx": 8, "code": "nefro-trans", "name": "Республика ихтисослаштирилган нефрология ва буйрак трансплантацияси илмий-амалий тиббиёт маркази"},
    {"idx": 9, "code": "bolalar-opor", "name": "Республика болалар таянч-ҳаракат тизими касалликлари реабилитация маркази"},
    {"idx": 10, "code": "milliy-tibbiyot", "name": "Миллий тиббиёт маркази"},
    {"idx": 11, "code": "sud-tibbiy", "name": "Республика суд-тиббий экспертиза илмий-амалий маркази"},
    {"idx": 12, "code": "perinatal", "name": "Республика перинатал маркази"},
    {"idx": 13, "code": "epid-mikrob", "name": "Республика ихтисослаштирилган эпидемиология, микробиология, юқумли ва паразитар касалликлар илмий-амалий тиббиёт маркази"},
    {"idx": 14, "code": "virusologiya", "name": "Вирусология илмий-текшириш институти"},
    {"idx": 15, "code": "gematologiya", "name": "Республика ихтисослаштирилган гематология илмий-амалий тиббиёт маркази"},
    {"idx": 16, "code": "bol-endo-hir", "name": "Республика болалар кам инвазив ва эндоскопик хирургия илмий-амалий маркази"},
    {"idx": 17, "code": "angioneuro", "name": "Республика хирургик ангионеврология ихтисослаштирилган маркази"},
    {"idx": 18, "code": "ruhiy-salomat", "name": "Республика ихтисослаштирилган руҳий саломатлик илмий-амалий тиббиёт маркази"},
    {"idx": 19, "code": "allergo-immun", "name": "Республика илмий-ихтисослаштирилган аллергология ва клиник иммунология маркази"},
    {"idx": 20, "code": "pediatriya", "name": "Республика ихтисослаштирилган педиатрия илмий-амалий тиббиёт маркази"},
    {"idx": 21, "code": "ftiz-pulmo", "name": "Республика ихтисослаштирилган фтизиатрия ва пульмонология илмий-амалий тиббиёт маркази"},
    {"idx": 22, "code": "urologiya", "name": "Республика ихтисослаштирилган урология илмий-амалий тиббиёт маркази"},
    {"idx": 23, "code": "neyrohirurgiya", "name": "Республика ихтисослаштирилган нейрохирургия илмий-амалий тиббиёт маркази"},
    {"idx": 24, "code": "lor-bosh", "name": "Республика ихтисослаштирилган оториноларингология ва бош-бўйин касалликлари илмий-амалий тиббиёт"},
    {"idx": 25, "code": "tta-klinika", "name": "Тошкент тиббиёт академияси кўп тармоқли клиникаси (янги ТТА ҳудуди)"},
    {"idx": 26, "code": "travma-orto", "name": "Республика ихтисослаштирилган травматология ва ортопедия илмий-амалий тиббиёт маркази"},
    {"idx": 27, "code": "bolalar-silik", "name": "Болалар суяк сили санаторийси"},
    {"idx": 28, "code": "dermato-kosmet", "name": "Республика ихтисослаштирилган дерматовенерология ва косметология илмий-амалий тиббиёт маркази"},
    {"idx": 29, "code": "endokrinologiya", "name": "Республика ихтисослаштирилган эндокринология илмий-амалий тиббиёт маркази"},
    {"idx": 30, "code": "bolalar-orto", "name": "Республика болалар ортопедия маркази"},
    {"idx": 31, "code": "qurbanov-ruh", "name": "У.Қ.Қурбонов номидаги Республика болалар руҳий-асаб касалхонаси"},
    {"idx": 32, "code": "xalq-tabobat", "name": "Республика халқ табобати илмий-амалий маркази"},
    {"idx": 33, "code": "bolalar-milliy", "name": "Болалар Миллий Тиббиёт Маркази"},
    {"idx": 34, "code": "bolalar-onko", "name": "Болалар онкологияси, гематологияси ва иммунологияси илмий-амалий тиббиёт маркази"},
    {"idx": 35, "code": "pat-anatom", "name": "Республика патологик анатомия маркази"},
    {"idx": 36, "code": "tpi-klinika", "name": "Тошкент педиатрия тиббиёт институти клиникаси"},
    {"idx": 37, "code": "malaka-klinika", "name": "Тиббиёт ходимларининг касбий малакасини ривожлантириш марказининг кўп тармоқли клиникаси"},
    {"idx": 38, "code": "oits", "name": "Республика ОИТСга қарши курашиш маркази"},
    {"idx": 39, "code": "pharm-agent", "name": "Фармацевтика тармоғини ривожлантириш агентлиги"},
    {"idx": 40, "code": "tdpu", "name": "Тошкент давлат тиббиёт университети"},
    {"idx": 41, "code": "tfi", "name": "Тошкент фармацевтика институти"},
    {"idx": 42, "code": "adti", "name": "Андижон давлат тиббиёт институти"},
    {"idx": 43, "code": "samdpu", "name": "Самарқанд давлат тиббиёт университети"},
    {"idx": 44, "code": "buxti", "name": "Бухоро давлат тиббиёт институти"},
    {"idx": 45, "code": "fjsti", "name": "Фарғона жамоат саломатлиги тиббиёт институти"},
    {"idx": 46, "code": "tta-termiz", "name": "Тошкент тиббиёт академияси Термиз филиали"},
    {"idx": 47, "code": "tta-urgench", "name": "Тошкент тиббиёт академияси Урганч филиали"},
    {"idx": 48, "code": "tta-chirchik", "name": "Тошкент тиббиёт академияси Чирчиқ филиали"},
    {"idx": 49, "code": "qmti", "name": "Қорақалпоғистон тиббиёт институти"},
]

REGIONAL_HEALTH_ORG_ACCOUNTS: list[dict[str, str | int]] = [
    {"idx": 50, "code": "qar-vazirlik", "name": "Қорақалпоғистон Республикаси Соғлиқни сақлаш вазирлиги", "region_id": "1"},
    {"idx": 51, "code": "andijon-boshqarma", "name": "Андижон вилояти Соғлиқни сақлаш бошқармаси", "region_id": "2"},
    {"idx": 52, "code": "buxoro-boshqarma", "name": "Бухоро вилояти Соғлиқни сақлаш бошқармаси", "region_id": "3"},
    {"idx": 53, "code": "jizzax-boshqarma", "name": "Жиззах вилояти Соғлиқни сақлаш бошқармаси", "region_id": "4"},
    {"idx": 54, "code": "qashqadaryo-boshqarma", "name": "Қашқадарё вилояти Соғлиқни сақлаш бошқармаси", "region_id": "5"},
    {"idx": 55, "code": "navoiy-boshqarma", "name": "Навоий вилояти Соғлиқни сақлаш бошқармаси", "region_id": "6"},
    {"idx": 56, "code": "namangan-boshqarma", "name": "Наманган вилояти Соғлиқни сақлаш бошқармаси", "region_id": "7"},
    {"idx": 57, "code": "samarqand-boshqarma", "name": "Самарқанд вилояти Соғлиқни сақлаш бошқармаси", "region_id": "8"},
    {"idx": 58, "code": "surxandaryo-boshqarma", "name": "Сурхондарё вилояти Соғлиқни сақлаш бошқармаси", "region_id": "9"},
    {"idx": 59, "code": "sirdaryo-boshqarma", "name": "Сирдарё вилояти Соғлиқни сақлаш бошқармаси", "region_id": "10"},
    {"idx": 60, "code": "toshkent-vil-boshqarma", "name": "Тошкент вилояти Соғлиқни сақлаш бошқармаси", "region_id": "11"},
    {"idx": 61, "code": "fargona-boshqarma", "name": "Фарғона вилояти Соғлиқни сақлаш бошқармаси", "region_id": "12"},
    {"idx": 62, "code": "xorazm-boshqarma", "name": "Хоразм вилояти Соғлиқни сақлаш бошқармаси", "region_id": "13"},
    {"idx": 63, "code": "toshkent-shahar-boshqarma", "name": "Тошкент шаҳар Соғлиқни сақлаш бошқармаси", "region_id": "14"},
]

ORG_PHONE_DIGIT_PREFIX = '9989178'
ORG_PHONE_LEGACY_SUFFIX_LEN = 4
ORG_PHONE_SUFFIX_LEN = 5

_ORG_PHONE_PATTERN = re.compile(r'^\+9989178\d{4,5}$')


def org_phone_legacy(idx: int) -> str:
    """Eski format (+998 dan keyin 8 raqam) — migratsiya uchun."""
    return f"+9989178{int(idx):04d}"


def org_phone(idx: int) -> str:
    """+998 dan keyin 9 raqam (standart UI input bilan mos)."""
    return f"+9989178{int(idx):05d}"


def org_password(code: str, idx: int = 0) -> str:
    """Har tashkilot uchun barqaror, kuchli parol (CSV da eksport qilinadi)."""
    safe = "".join(ch for ch in str(code).lower() if ch.isalnum()).replace('-', '')[:12]
    digest = hashlib.sha256(f"org:{code}:{idx}:aishifokor-2026".encode()).hexdigest()[:4]
    return f"{safe}{int(idx):02d}Ai{digest}!"


def normalize_org_phone(value: str) -> str:
    cleaned = (value or '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if not cleaned.startswith('+'):
        cleaned = '+' + cleaned if cleaned.startswith('998') else '+998' + cleaned
    return cleaned


def is_org_catalog_phone(phone: str) -> bool:
    """Tashkilot test/login raqamlari (+9989178...). SMS parol tiklash yo'q."""
    return bool(_ORG_PHONE_PATTERN.match(normalize_org_phone(phone)))


def all_org_catalog_phones() -> set[str]:
    phones: set[str] = set()
    for item in REPUBLIC_ORG_ACCOUNTS:
        idx = int(item['idx'])
        phones.add(org_phone(idx))
        phones.add(org_phone_legacy(idx))
    for item in REGIONAL_HEALTH_ORG_ACCOUNTS:
        idx = int(item['idx'])
        phones.add(org_phone(idx))
        phones.add(org_phone_legacy(idx))
    return phones
