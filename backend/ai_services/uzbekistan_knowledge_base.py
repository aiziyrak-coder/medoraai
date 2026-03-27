"""
O'zbekiston Tibbiy Ma'lumotlar Bazasi  -  Knowledge Base
=======================================================
Prompt Engineering uchun kontekst bloki: SSV protokollar, mahalliy dorilar,
dorixona mavjudligi, qonunchilik asoslari.

Foydalanish:
    from .uzbekistan_knowledge_base import get_uz_context, DRUG_DB, PROTOCOL_DB
    context_block = get_uz_context(complaints_text)
"""

from __future__ import annotations

# -----------------------------------------------------------------------------
# MAHALLIY DORI-DARMONLAR MA'LUMOTLAR BAZASI
# Manba: O'zbekiston Respublikasi SSV ro'yxatidan o'tgan preparatlar (2024)
# -----------------------------------------------------------------------------

DRUG_DB: list[dict] = [
    # -- NSAIDs ----------------------------------------------------------------
    {"trade": "Nimesil",       "generic": "Nimesulid",      "class": "NSAID",
     "forms": "granula, 100mg", "available": True,
     "note": "Og'riq, isitma; 15 yoshdan; jigar kasalligida EHTIYOTKORLIK"},
    {"trade": "Ibuprofen",     "generic": "Ibuprofen",      "class": "NSAID",
     "forms": "tab 200/400mg, suspenziya",  "available": True,
     "note": "Analgetik, antipretik; bolalar uchun suspenziya mavjud"},
    {"trade": "Ketoprofen",    "generic": "Ketoprofen",     "class": "NSAID",
     "forms": "amp, kapsul", "available": True,
     "note": "Og'riq sindromida; in/m in'eksiya"},
    {"trade": "Diklofenak",    "generic": "Diklofenak natriy", "class": "NSAID",
     "forms": "amp, tab, gel", "available": True, "note": ""},
    {"trade": "Meloksikam",    "generic": "Meloksikam",     "class": "NSAID",
     "forms": "amp, tab 7.5/15mg", "available": True, "note": ""},

    # -- Analgetiklar / Antipiretiklar -----------------------------------------
    {"trade": "Paratsetamol",  "generic": "Paracetamol",    "class": "Analgetik/Antipiretik",
     "forms": "tab, suspenziya, suppositoriya", "available": True,
     "note": "Jigar yetishmovchiligida EHTIYOTKORLIK; dozani kamaytirish"},
    {"trade": "Analgin",       "generic": "Metamizol",      "class": "Analgetik",
     "forms": "amp, tab", "available": True, "note": "Agranulotsitoz xavfi; uzoq muddatli emas"},

    # -- Antibiotiklar ---------------------------------------------------------
    {"trade": "Amoksitsillin", "generic": "Amoxicillin",    "class": "Antibiotik/Penitsill",
     "forms": "kaps 250/500mg, suspenziya", "available": True,
     "note": "Penitsill allergiyasida QARSHI"},
    {"trade": "Augmentin",     "generic": "Amox+Klavulanat", "class": "Antibiotik",
     "forms": "tab 375/625/1000mg, suspenziya", "available": True,
     "note": "Keng spektr; jigar funksiyasini kuzat"},
    {"trade": "Sumamed",       "generic": "Azitromitsin",   "class": "Antibiotik/Makrolid",
     "forms": "kaps 250/500mg", "available": True,
     "note": "Atipik infeksiyalar, respirator"},
    {"trade": "Klaritromisin", "generic": "Clarithromycin", "class": "Antibiotik/Makrolid",
     "forms": "tab 250/500mg", "available": True, "note": ""},
    {"trade": "Siprofloksatsin","generic": "Ciprofloxacin", "class": "Antibiotik/Ftorxinolon",
     "forms": "tab 250/500mg, amp", "available": True,
     "note": "18 yoshdan; tendinit xavfi"},
    {"trade": "Levofloksatsin","generic": "Levofloxacin",  "class": "Antibiotik/Ftorxinolon",
     "forms": "tab 250/500mg, amp", "available": True, "note": ""},
    {"trade": "Doksitsiklin",  "generic": "Doxycycline",    "class": "Antibiotik/Tetratsiklin",
     "forms": "kaps 100mg", "available": True,
     "note": "Bolalar uchun QARSHI (<8 yosh); quyoshga sezgirlik"},
    {"trade": "Metronidazol",  "generic": "Metronidazole",  "class": "Antibiotik/Imidazol",
     "forms": "tab 250mg, amp, gel", "available": True, "note": "Alkogol QARSHI"},
    {"trade": "Flukonazol",    "generic": "Fluconazole",    "class": "Antifungal",
     "forms": "kaps 50/150mg, amp", "available": True, "note": ""},

    # -- Yurak-qon tomir dorilar -----------------------------------------------
    {"trade": "Enalapril",     "generic": "Enalapril",      "class": "APF ingibitor",
     "forms": "tab 5/10/20mg", "available": True,
     "note": "Gipertoniya, YuQM; homiladorlikda QARSHI"},
    {"trade": "Amlodipin",     "generic": "Amlodipine",     "class": "CCB",
     "forms": "tab 5/10mg", "available": True,
     "note": "Gipertoniya, stenokardiya"},
    {"trade": "Losartan",      "generic": "Losartan",       "class": "ARB",
     "forms": "tab 25/50/100mg", "available": True,
     "note": "Gipertoniya; homiladorlikda QARSHI"},
    {"trade": "Bisoprolol",    "generic": "Bisoprolol",     "class": "Beta-blokator",
     "forms": "tab 2.5/5/10mg", "available": True, "note": "BOOS'da ehtiyot"},
    {"trade": "Metoprolol",    "generic": "Metoprolol",     "class": "Beta-blokator",
     "forms": "tab 25/50/100mg", "available": True, "note": ""},
    {"trade": "Aspirin Cardio","generic": "Acetylsalicylic acid", "class": "Antiaggregant",
     "forms": "tab 100mg", "available": True,
     "note": "Yurak xurujining oldini olish; oshqozon yarasi  -  EHTIYOT"},

    # -- Qandli diabet ---------------------------------------------------------
    {"trade": "Metformin",     "generic": "Metformin",      "class": "Biguanid",
     "forms": "tab 500/850/1000mg", "available": True,
     "note": "QD tip 2; KFSKda ehtiyot (<45 ml/min QARSHI)"},
    {"trade": "Gliclazid",     "generic": "Gliclazide",     "class": "Sulfonilmochevina",
     "forms": "tab 80mg, MR 30/60mg", "available": True, "note": "Gipoglikemiya xavfi"},
    {"trade": "Glibenklamid",  "generic": "Glibenclamide",  "class": "Sulfonilmochevina",
     "forms": "tab 2.5/5mg", "available": True,
     "note": "Keksalarda EHTIYOT; gipoglikemiya"},

    # -- Gastroenterologiya ---------------------------------------------------
    {"trade": "Omeprazol",     "generic": "Omeprazole",     "class": "PPI",
     "forms": "kaps 20/40mg, amp", "available": True, "note": ""},
    {"trade": "Pantoprazol",   "generic": "Pantoprazole",   "class": "PPI",
     "forms": "tab 20/40mg, amp", "available": True, "note": ""},
    {"trade": "Famotidin",     "generic": "Famotidine",     "class": "H2-blokator",
     "forms": "tab 20/40mg", "available": True, "note": ""},
    {"trade": "Domperidon",    "generic": "Domperidone",    "class": "Prokinetik",
     "forms": "tab 10mg, suspenziya", "available": True, "note": "QT uzayishi xavfi"},
    {"trade": "Trimebutin",    "generic": "Trimebutine",    "class": "Spazmolitik",
     "forms": "tab 100/200mg", "available": True, "note": "IBS"},
    {"trade": "Smecta",        "generic": "Diosmektit",     "class": "Enterosorbent",
     "forms": "paket 3g", "available": True, "note": "Ich ketish, diareya"},
    {"trade": "Enterofuril",   "generic": "Nifuroksazid",   "class": "Intestinal antiseptik",
     "forms": "kaps 200mg", "available": True, "note": ""},

    # -- Nafas yo'llari --------------------------------------------------------
    {"trade": "Salbutamol",    "generic": "Salbutamol",     "class": "Beta-2-agonist",
     "forms": "inhaler, nebula", "available": True,
     "note": "Astma, BOOS; bronxospazm"},
    {"trade": "Berodual",      "generic": "Ipratropium+Feno", "class": "Bronxodilatator",
     "forms": "inhaler, nebula", "available": True, "note": ""},
    {"trade": "Budesonid",     "generic": "Budesonide",     "class": "ICS",
     "forms": "inhaler, nebula", "available": True, "note": "Astma, BOOS; og'iz yuvish"},
    {"trade": "Acetilsistein", "generic": "Acetylcysteine", "class": "Mukolitik",
     "forms": "granula, amp", "available": True, "note": "Yo'tal; bronxoektaz"},
    {"trade": "Ambroksol",     "generic": "Ambroxol",       "class": "Mukolitik",
     "forms": "tab, sirop, amp", "available": True, "note": ""},

    # -- Nevrologiya -----------------------------------------------------------
    {"trade": "Carbamazepine", "generic": "Carbamazepine",  "class": "Antikonvulsant",
     "forms": "tab 200/400mg", "available": True,
     "note": "Epilepsiya, nevralgiya; gematolojik kuzatuv"},
    {"trade": "Valproat",      "generic": "Valproic acid",  "class": "Antikonvulsant",
     "forms": "tab, sirop, amp", "available": True,
     "note": "Jigar toksikligi; homiladorlikda EHTIYOT"},
    {"trade": "Sumatriptan",   "generic": "Sumatriptan",    "class": "Triptan",
     "forms": "tab 50/100mg", "available": True, "note": "Migran"},

    # -- Vitaminlar va Mikroelementlar ----------------------------------------
    {"trade": "Vitrum",        "generic": "Multivitamin",   "class": "Vitamin",
     "forms": "tab", "available": True, "note": ""},
    {"trade": "Calcium D3 Nikomed","generic": "Ca+D3",      "class": "Mineral",
     "forms": "tab chaynab yeyish", "available": True, "note": "Suyak sog'lig'i"},
    {"trade": "Ferrum Lek",    "generic": "Ferrum sulfit",  "class": "Temir preparati",
     "forms": "tab, sirop, amp", "available": True, "note": "Temir tanqisligi anemiyasi"},
]

# Tezkor qidiruv indekslari
DRUG_BY_TRADE:   dict[str, dict] = {d["trade"].lower(): d for d in DRUG_DB}
DRUG_BY_GENERIC: dict[str, dict] = {d["generic"].lower(): d for d in DRUG_DB}
DRUG_BY_CLASS:   dict[str, list] = {}
for _d in DRUG_DB:
    DRUG_BY_CLASS.setdefault(_d["class"], []).append(_d)


def find_drug(name: str) -> dict | None:
    """Savdo nomi yoki generik nomi bo'yicha dori qidirish."""
    n = name.lower().strip()
    return DRUG_BY_TRADE.get(n) or DRUG_BY_GENERIC.get(n)


def drugs_by_class(drug_class: str) -> list[dict]:
    return DRUG_BY_CLASS.get(drug_class, [])


def available_drug_names() -> list[str]:
    return sorted(d["trade"] for d in DRUG_DB)


# -----------------------------------------------------------------------------
# SSV PROTOKOLLAR MA'LUMOTLAR BAZASI
# -----------------------------------------------------------------------------

PROTOCOL_DB: list[dict] = [
    {
        "id": "uz-ssv-htn-2022",
        "name": "Arterial Gipertoniya",
        "icd10": ["I10", "I11", "I12", "I13"],
        "keywords": ["gipertoniya", "yuqori qon bosim", "AGB", "РіРёРїРµСЂС‚РѕРЅРёСЏ", "hypertension", "qon bosimi"],
        "first_line": ["Amlodipin 5-10mg", "Enalapril 10-20mg", "Losartan 50-100mg"],
        "targets": "< 140/90 mmHg (60 yoshdan: < 150/90)",
        "ref": "O'zbekiston SSV buyrug'i No. XX (2022)  -  Arterial Gipertoniya protokoli",
        "monitoring": "3 oyda 1 marta qon bosimi, yiliga ECG, UZDG",
    },
    {
        "id": "uz-ssv-dm2-2023",
        "name": "Qandli Diabet 2-tip",
        "icd10": ["E11"],
        "keywords": ["qandli diabet", "diabet", "РґРёР°Р±РµС‚", "diabetes", "CD tip 2", "giperoglikemiya"],
        "first_line": ["Metformin 500-1000mg", "Gliclazid MR 30-60mg"],
        "targets": "HbA1c < 7%; glukoza aГ§liqda 4.4-7.0 mmol/L",
        "ref": "O'zbekiston SSV buyrug'i  -  QD 2-tip protokoli (2023)",
        "monitoring": "HbA1c 3 oyda, kreatinin yiliga, oftalmolog yiliga",
    },
    {
        "id": "uz-ssv-acs-2021",
        "name": "O'tkir Koronar Sindrom / MI",
        "icd10": ["I21", "I22", "I20"],
        "keywords": ["MI", "yurak xuruj", "infarkt", "РёРЅС„Р°СЂРєС‚", "o'tkir koronar", "AKS"],
        "first_line": ["Aspirin 300mg stat", "Klopidogrel", "Heparin", "Statin"],
        "targets": "PCI в‰¤90 daqiqa maqsad",
        "ref": "O'zbekiston SSV  -  OKS protokoli (2021)",
        "monitoring": "ICU, continuous ECG, troponin",
    },
    {
        "id": "uz-ssv-copd-2022",
        "name": "BOOS (Surunkali Obstruktiv O'pka Kasalligi)",
        "icd10": ["J44"],
        "keywords": ["BOOS", "COPD", "Рѕ'pka", "nafas", "yo'tal", "bronxit surunkali"],
        "first_line": ["Berodual inhaler", "Salbutamol", "Budesonid"],
        "targets": "FEV1 monitoringi, sigaretdan voz kechish",
        "ref": "O'zbekiston SSV  -  BOOS protokoli (2022)",
        "monitoring": "Spirometriya yiliga, SATS, qon gazi",
    },
    {
        "id": "uz-ssv-asthma-2022",
        "name": "Bronxial Astma",
        "icd10": ["J45", "J46"],
        "keywords": ["astma", "Р±СЂРѕРЅС…РёР°Р»СЊРЅР°СЏ Р°СЃС‚РјР°", "bronxospazm", "nafas qisilishi"],
        "first_line": ["Salbutamol (relief)", "Budesonid (controller)", "Berodual"],
        "targets": "Astma nazoratini ta'minlash, ACOS",
        "ref": "O'zbekiston SSV  -  Bronxial Astma protokoli (2022)",
        "monitoring": "Peak-flow, spirometriya 6 oyda",
    },
    {
        "id": "uz-ssv-pneumonia-2023",
        "name": "Pnevmoniya (Jamoaviy va Nosokomial)",
        "icd10": ["J15", "J18"],
        "keywords": ["pnevmoniya", "o'pka yallig'", "pneumonia", "РїРЅРµРІРјРѕРЅРёСЏ"],
        "first_line": [
            "Jamoaviy (mild): Amoksitsillin 0.5gГ - 3",
            "Jamoaviy (og'ir): Augmentin + Azitromitsin",
            "Og'ir/ICU: Piperasillin+Tazobaktam yoki Karbapenem",
        ],
        "targets": "Klinik yaxshilanish 48-72 soatda",
        "ref": "O'zbekiston SSV  -  Pnevmoniya protokoli (2023)",
        "monitoring": "Rentgen, SATS, CRP, leykositlar",
    },
    {
        "id": "uz-ssv-uti-2022",
        "name": "Siydik Yo'li Infeksiyasi",
        "icd10": ["N39.0", "N30", "N10"],
        "keywords": ["SYI", "siydik yo'li infeksiya", "tsistit", "pielonefrit", "РРњРџ", "UTI"],
        "first_line": [
            "Qo'ziqorinli tsistit: Nitrofurantoin 100mgГ - 2Г - 5kun",
            "Og'ir SYI: Siprofloksatsin 500mgГ - 2",
        ],
        "targets": "Bakteriuriya yo'qolishi, simptomlar remissiyasi",
        "ref": "O'zbekiston SSV  -  SYI protokoli (2022)",
        "monitoring": "OAT 3 kunda, bakteriologik tekshiruv",
    },
    {
        "id": "uz-ssv-peptic-ulcer-2021",
        "name": "Peptik Yara Kasalligi",
        "icd10": ["K25", "K26"],
        "keywords": ["yara", "gastrit", "meda yara", "oshqozon yara", "H.pylori", "СЏР·РІР°"],
        "first_line": ["Omeprazol 20-40mg", "H.pylori: 3-komponent (Amox+Klaritr+PPI)"],
        "targets": "Simptomsiz remissiya, H.pylori eradikatsiyasi",
        "ref": "O'zbekiston SSV  -  Peptik Yara protokoli (2021)",
        "monitoring": "FGDS, urease test 4 haftadan keyin",
    },
    {
        "id": "uz-ssv-stroke-2022",
        "name": "Insult (Ishemik va Gemorragik)",
        "icd10": ["I63", "I61"],
        "keywords": ["insult", "РёРЅСЃСѓР»СЊС‚", "stroke", "ishemik insult", "miya qon aylanishi"],
        "first_line": [
            "Ishemik: Aspirin 300mg + Statin + IV alteplase (agar <4.5h)",
            "Gemorragik: qon bosimini boshqarish, jarrohlik maslahat",
        ],
        "targets": "NIHSS monitoring, kuzatuv bloki",
        "ref": "O'zbekiston SSV  -  Insult protokoli (2022)",
        "monitoring": "KT/MRT, neyromonitoring, reabilitatsiya",
    },
    {
        "id": "uz-ssv-anemia-2022",
        "name": "Temir Tanqisligi Anemiyasi",
        "icd10": ["D50"],
        "keywords": ["anemiya", "Р°РЅРµРјРёСЏ", "anemia", "temir tanqisligi", "gemoglobin past", "temir yetishmovchiligi"],
        "first_line": ["Ferrum Lek tab yoki sirop", "IV Venofer og'ir hollarda"],
        "targets": "Hb > 120 g/L (ayol), > 130 g/L (erkak)",
        "ref": "O'zbekiston SSV  -  Anemiya protokoli (2022)",
        "monitoring": "KAK 1 oyda, ferritin, serum temir",
    },
]

# Keyword indeksi
_PROTOCOL_KEYWORD_INDEX: dict[str, str] = {}
for _p in PROTOCOL_DB:
    for _kw in _p.get("keywords", []):
        _PROTOCOL_KEYWORD_INDEX[_kw.lower()] = _p["id"]

_PROTOCOL_ID_MAP: dict[str, dict] = {p["id"]: p for p in PROTOCOL_DB}


def find_protocols(complaints_text: str) -> list[dict]:
    """Shikoyat matni asosida tegishli SSV protokollarni topish."""
    text   = complaints_text.lower()
    found  = set()
    for kw, pid in _PROTOCOL_KEYWORD_INDEX.items():
        if kw in text:
            found.add(pid)
    return [_PROTOCOL_ID_MAP[pid] for pid in found if pid in _PROTOCOL_ID_MAP]


# -----------------------------------------------------------------------------
# Prompt Engineering: Kontekst Bloki
# -----------------------------------------------------------------------------

_BASE_CONTEXT = """\
=== O'ZBEKISTON TIBBIY KONTEKST (MAJBURIY) ===

QONUNCHILIK:
- "Sog'liqni saqlash to'g'risida" O'zbekiston Respublikasi Qonuni (30.08.1996 No. 258-I, yangilanishlar bilan)
- Farmatsevtika sohasi: O'zR "Dori vositalari va farmatsevtika faoliyati to'g'risida" Qonuni
- Bemorlar huquqlari: Tibbiy maxfiylik, yozma rozilik (18 yoshdan)

FARMATSEVTIKA CHEKLOVLARI:
- FAQAT O'zbekiston Respublikasi Sog'liqni saqlash vazirligi tomonidan davlat ro'yxatidan o'tgan preparatlar.
- Dori savdo nomlarini yozing (generik emas): Nimesil, Sumamed, Augmentin, Metformin, Enalapril, Amlodipin, Omeprazol, Pantoprazol, Paratsetamol, Salbutamol, Ferrum Lek...
- Narkotik va psixotrop moddalar uchun maxsus ruxsatnoma talab etiladi.

SHOSHILINCH YORDAM:
- 103  -  Tez tibbiy yordam (Respublika Bo'yicha)
- Shoshilinch holatlarda: darhol shifokorga, reanimatsiya tayyorligi

SSV PROTOKOL HUJJATLARI:
- Milliy klinik protokollar SSV.UZ da mavjud (ssv.uz/klinik-protokollar)
- Protokollardan og'ish uchun klinik asoslash yozing

DORIXONA TARMOQI:
- Asosiy zanjirlar: Dori-Darmon (davlat), Pharmacia Dori, Mega Pharm, Narxon Dorixona
- Sovuq zanjir talab qiluvchi dorilar (insulin, vaksina)  -  maxsus saqlash sharoiti
=== KONTEKST TUGADI ==="""


def get_uz_context(complaints_text: str = "", include_protocols: bool = True) -> str:
    """
    Bemorning shikoyatlariga mos keluvchi O'zbekiston tibbiy kontekst blokini qaytaradi.
    Doctor Support va Consilium promptlariga biriktiriladi.

    Args:
        complaints_text:    Bemor shikoyatlari (kalit so'zlarni aniqlash uchun).
        include_protocols:  Tegishli SSV protokollarni qo'shish.
    """
    ctx = _BASE_CONTEXT

    if include_protocols and complaints_text:
        protos = find_protocols(complaints_text)
        if protos:
            ctx += "\n\nTEGISHLI SSV PROTOKOLLAR (USHBU HOLAT UCHUN):\n"
            for p in protos[:3]:
                ctx += (
                    f"\n- {p['name']} ({p['ref']})\n"
                    f"  ICD-10: {', '.join(p['icd10'])}\n"
                    f"  1-qator: {'; '.join(p['first_line'])}\n"
                    f"  Maqsad: {p['targets']}\n"
                    f"  Monitoring: {p['monitoring']}\n"
                )

    return ctx


# -----------------------------------------------------------------------------
# JARROHLIK PROTOKOLLARI
# -----------------------------------------------------------------------------

SURGERY_PROTOCOLS: list[dict] = [
    {
        "id": "uz-ssv-surgery-prep-2022",
        "name": "Preoperativ Tayyorgarlik Protokoli",
        "icd10": [],
        "keywords": ["operatsiya tayyorlash", "preoperativ", "jarrohlik oldidan"],
        "steps": [
            "ECG, qon tahlili (KAK, biokimyo, koagulologiya)",
            "Allergiya tarixi, joriy dorilar ro'yxati",
            "Anesteziya konsultatsiyasi",
            "To'liq ovqat iste'mol qilmaslik: kattalarda 6 soat, bolalarda 4 soat",
            "Antibiotik profilaktika: Sefazolin 1-2g operatsiyadan 30 daqiqa oldin",
        ],
        "ref": "O'zR SSV buyrug'i No. 178  -  Preoperativ tayyorgarlik standarti (2022)",
    },
    {
        "id": "uz-ssv-anesthesia-2023",
        "name": "Umumiy Anesteziya Protokoli",
        "icd10": [],
        "keywords": ["anesteziya", "narkoz", "umumiy og'riqsizlantirish"],
        "steps": [
            "Induktasiya: Propofol 1.5-2.5mg/kg IV yoki Ketamin 1-2mg/kg",
            "Miorelaksant: Suksinilxolin 1.5mg/kg (tez induktasiya)",
            "Inhalyasiya: Sevofluran 1-3% yoki Izofluran 1-2%",
            "Monitorlash: ECG, SpO2, ETCO2, qon bosim",
            "Uyg'onish: Neostigmin + Atropin (nondepolarizant antidoti)",
        ],
        "ref": "O'zbekiston Anesteziolog-Reanimatologlar Assotsiatsiyasi Protokoli (2023)",
    },
    {
        "id": "uz-ssv-postop-2022",
        "name": "Postoperativ Kuzatuv Protokoli",
        "icd10": [],
        "keywords": ["postoperativ", "operatsiyadan keyin", "PACU", "uyg'onish xona"],
        "steps": [
            "PACU'da minimum 30 daqiqa kuzatuv (Aldrete Score >= 9)",
            "Og'riqni boshqarish: Paratsetamol 1g IV, Ketoprofen 50-100mg IV",
            "Antiemetiklar: Ondansetron 4mg IV (qayt oldini olish)",
            "Tromboprofilaktika: Enoksaparin 40mg kuniga (xavf guruhida)",
            "Infuzion terapiya: Ringer laktati yoki Natriy xlorid 0.9%",
            "Antibiotiklar: Qo'shimcha 24-48 soat (zarur bo'lsa)",
        ],
        "ref": "O'zR SSV buyrug'i No. 201  -  Postoperativ parvarishlash standarti (2022)",
    },
    {
        "id": "uz-ssv-sterile-2021",
        "name": "Jarrohlik Aseptikasi va Sterilizatsiya",
        "icd10": [],
        "keywords": ["steril", "aseptika", "dezinfeksiya", "jarrohlik gigiena"],
        "steps": [
            "Qo'l gigiena: Betadin yoki Xlorheksidin 4% bilan 5 daqiqa yuvish",
            "Operatsiya maydoni dezinfeksiyasi: Yod-Pvp yoki Xlorheksidin",
            "Steril kiyim, qo'lqop, niqob majburiy",
            "Asboblar: Avtoklavda 134°C 3 daqiqa yoki ETO",
            "SSI oldini olish: WHO protokoli (checklist)",
        ],
        "ref": "O'zR SSV buyrug'i No. 102  -  Infeksion nazorat standarti (2021)",
    },
]

_SURGERY_KW_INDEX: dict[str, str] = {}
_SURGERY_ID_MAP: dict[str, dict] = {}
for _sp in SURGERY_PROTOCOLS:
    _SURGERY_ID_MAP[_sp["id"]] = _sp
    for _kw in _sp.get("keywords", []):
        _SURGERY_KW_INDEX[_kw.lower()] = _sp["id"]


def find_surgery_protocols(text: str) -> list[dict]:
    """Matn asosida tegishli jarrohlik protokollarini topish."""
    lower = text.lower()
    found = set()
    for kw, pid in _SURGERY_KW_INDEX.items():
        if kw in lower:
            found.add(pid)
    return [_SURGERY_ID_MAP[pid] for pid in found]


def get_surgery_context(operation_type: str = "") -> str:
    """Jarrohlik rejimi uchun maxsus kontekst bloki."""
    protos = find_surgery_protocols(operation_type) if operation_type else SURGERY_PROTOCOLS[:2]
    ctx = "\n=== JARROHLIK PROTOKOLLARI KONTEKSTI ===\n"
    for p in protos[:3]:
        ctx += (
            f"\n- {p['name']} ({p['ref']})\n"
            f"  Qadamlar: {'; '.join(p['steps'][:3])}\n"
        )
    ctx += "\n=== JARROHLIK KONTEKSTI TUGADI ===\n"
    return ctx


def get_drug_context(drug_names: list[str] = None) -> str:
    """
    Dorilarning O'zbekistondagi mavjudligi va cheklovlari haqida kontekst.
    """
    if not drug_names:
        # Birinchi 20 ta mashhur dori ro'yxatini qaytaradi
        sample = DRUG_DB[:20]
    else:
        sample = [find_drug(n) for n in drug_names if find_drug(n)]

    if not sample:
        return ""

    lines = ["O'ZBEKISTONDA MAVJUD DORILAR (TAVSIYA ETILGANLAR):"]
    for d in sample:
        if d:
            lines.append(
                f"- {d['trade']} ({d['generic']})  -  {d['forms']}"
                + (f" [EHTIYOT: {d['note']}]" if d.get("note") else "")
            )
    return "\n".join(lines)