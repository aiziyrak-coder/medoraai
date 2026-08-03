"""
Konsilium munozarasi matnini foydalanuvchiga ko'rinadigan professional formatda yig'ish.
"""
from __future__ import annotations

import re
from typing import Any

# Platforma UI tillari — AI chiqishi shu tilga majburan bog'lanadi
LANG_LABELS: dict[str, str] = {
    "uz-L": "Uzbek Latin (O'zbek lotin)",
    "uz-C": "Uzbek Cyrillic (O'zbek kirill)",
    "ru": "Russian (Русский)",
    "en": "English",
    "kaa": "Karakalpak Latin (Qaraqalpaqsha)",
}


def lang_label(language: str | None) -> str:
    code = (language or "uz-L").strip() or "uz-L"
    return LANG_LABELS.get(code, LANG_LABELS["uz-L"])


def normalize_language(language: str | None) -> str:
    code = (language or "uz-L").strip() or "uz-L"
    if code in LANG_LABELS:
        return code
    low = code.lower()
    if low in ("ru", "rus", "russian"):
        return "ru"
    if low in ("en", "eng", "english"):
        return "en"
    if low in ("uz-c", "uzc", "cyrillic"):
        return "uz-C"
    if low in ("kaa", "karakalpak"):
        return "kaa"
    if low in ("uz", "uz-l", "uzl", "latin"):
        return "uz-L"
    return "uz-L"


def output_language_rule(language: str | None) -> str:
    """Har bir AI chaqiruviga qo'shiladigan eng yuqori prioritet til qoidasi."""
    code = normalize_language(language)
    label = lang_label(code)
    if code == "en":
        return (
            "STRICT OUTPUT LANGUAGE (HIGHEST PRIORITY — overrides all other instructions):\n"
            "- Every user-visible string MUST be in English (clinical register).\n"
            "- Do NOT write Uzbek, Russian, or Karakalpak sentences.\n"
            "- Patient data may be in Uzbek/Russian — TRANSLATE analysis, diagnoses, "
            "justifications, treatment and debate into English (do not copy source language).\n"
            "- Allowed exceptions only: drug trade/generic names, ICD-10 codes, URLs, "
            "and fixed enums (HIGH/MEDIUM/LOW, A/B/C, routine|soon|urgent|emergent).\n"
            "- Even if this prompt text is in another language, ALL JSON string values and "
            "debate text must be English."
        )
    if code == "ru":
        return (
            "СТРОГИЙ ЯЗЫК ВЫВОДА (ВЫСШИЙ ПРИОРИТЕТ — важнее всех остальных инструкций):\n"
            "- Все видимые пользователю строки ДОЛЖНЫ быть на русском языке (клинический стиль).\n"
            "- НЕ пишите на узбекском (латиница/кириллица), английском или каракалпакском.\n"
            "- Данные пациента могут быть на узбекском — ПЕРЕВЕДИТЕ анализ, диагнозы "
            "(напр. «психогенная анорексия», не «Psixogenik anoreksiya»), обоснования, "
            "лечение и дискуссию на русский; не копируйте узбекский текст.\n"
            "- Исключения только: торговые/МНН названия препаратов, коды МКБ-10, URL "
            "и фиксированные enum (HIGH/MEDIUM/LOW, A/B/C, routine|soon|urgent|emergent).\n"
            "- Даже если текст инструкций на другом языке, ВСЕ строковые значения JSON "
            "и текст дискуссии — только на русском."
        )
    if code == "uz-C":
        return (
            f"QAT'IY CHIQISH TILI (ENG YUQORI PRIORITET — boshqa barcha qoidalardan ustun):\n"
            f"- Foydalanuvchiga ko'rinadigan HAR BIR matn FAQAT {label} tilida bo'lsin.\n"
            f"- Lotin o'zbekcha, ruscha, inglizcha yoki qoraqalpoqcha jumlalar YOZILMASIN.\n"
            f"- Bemor matni boshqa alifboda bo'lsa ham — tahlilni KIRILL o'zbekchaga o'giring.\n"
            f"- Istisno faqat: dori savdo/generik nomlari, MKB-10 kodlari, URL va enum qiymatlari.\n"
            f"- Prompt boshqa tilda yozilgan bo'lsa ham, JSON satrlari va munozara matni FAQAT kirill o'zbekcha."
        )
    if code == "kaa":
        return (
            f"STRICT OUTPUT LANGUAGE (HIGHEST PRIORITY):\n"
            f"- All user-visible strings MUST be in {label}.\n"
            f"- Do NOT use Uzbek, Russian, English, or Cyrillic sentences except drug names, "
            f"ICD-10, URLs and fixed enums.\n"
            f"- Patient data may be in another language — TRANSLATE into Karakalpak Latin.\n"
            f"- Translate diagnoses, justifications, treatment, nutrition, debate commentary "
            f"into Karakalpak Latin."
        )
    # uz-L default
    return (
        f"QAT'IY CHIQISH TILI (ENG YUQORI PRIORITET — boshqa barcha qoidalardan ustun):\n"
        f"- Foydalanuvchiga ko'rinadigan HAR BIR matn FAQAT {label} tilida bo'lsin.\n"
        f"- Ruscha, inglizcha, kirill o'zbekcha yoki qoraqalpoqcha jumlalar YOZILMASIN.\n"
        f"- Bemor matni boshqa tilda bo'lsa ham — tahlilni LOTIN o'zbekchaga o'giring.\n"
        f"- Istisno faqat: dori savdo/generik nomlari, MKB-10 kodlari, URL va enum qiymatlari.\n"
        f"- Prompt boshqa tilda yozilgan bo'lsa ham, JSON satrlari va munozara matni FAQAT lotin o'zbekcha."
    )


def language_user_suffix(language: str | None) -> str:
    """User prompt oxiriga qo'shiladigan qisqa til eslatmasi."""
    code = normalize_language(language)
    label = lang_label(code)
    if code == "en":
        return (
            f"OUTPUT LANGUAGE: English only. All JSON string fields in {label}. "
            f"Translate from patient language if needed — never leave Uzbek/Russian sentences."
        )
    if code == "ru":
        return (
            f"ЯЗЫК ОТВЕТА: только русский. Все строковые поля JSON — на {label}. "
            f"Если данные пациента на узбекском — переведите ответ на русский "
            f"(диагнозы тоже на русском, не латиницей)."
        )
    return f"JAVOB TILI: FAQAT {label}. Barcha JSON matn maydonlari shu tilda."


def undiagnosed_label(language: str | None) -> str:
    code = normalize_language(language)
    return {
        "en": "Diagnosis not established",
        "ru": "Диагноз не установлен",
        "uz-C": "Ташхис аниқланмади",
        "kaa": "Diagnoz anıqlanbadı",
    }.get(code, "Tashxis aniqlanmadi")


# Munozara UI sarlavhalari — platforma tiliga mos
_DEBATE_LABELS: dict[str, dict[str, str]] = {
    "uz-L": {
        "clinical_opinion": "Klinik baho",
        "primary_dx": "Asosiy tashxis (mening fikrim)",
        "clinical_thought": "Klinik fikr",
        "key_facts": "Muhim faktlar",
        "recommendation": "Tavsiya",
        "tests": "Tekshiruv",
        "red_flags": "Shoshilinch belgi",
        "differentials": "Boshqa ehtimollar",
        "critique": "Tanqid va javob",
        "defense": "Himoya",
        "extra_evidence": "Qo'shimcha dalil",
        "revised": "Yangilangan fikr",
        "accepted": "Qabul qilingan fikrlar",
        "key_argument": "Asosiy klinik dalil",
        "commentary": "Professor pozitsiyasi",
        "endorse": "Qo'llab-quvvatlash",
        "closed": "KONSILIUM YOPILDI",
        "closed_body": "Kengash muhokamasi yakunlandi. Quyida yakuniy klinik xulosa.",
        "final_dx": "YAKUNIY TASHXISLAR (MKB-10)",
        "justification": "ASOS (asosiy tashxis)",
        "treatment": "DAVOLASH REJASI",
        "rec_tests": "TAVSIYA ETILGAN TEKSHIRUVLAR",
        "follow_up": "KUZATUV REJASI",
        "debate_summary": "MUNOZARA XULOSASI",
        "dissent": "FARQLI FIKRLAR",
        "agreements": "KELISHUVLAR",
        "disputes": "HAL QILINGAN BAHSLAR",
        "winning": "G'OLIB DALILLAR",
        "council_summary": "KENGASH XULOSASI",
    },
    "ru": {
        "clinical_opinion": "Клиническая оценка",
        "primary_dx": "Основной диагноз (мое мнение)",
        "clinical_thought": "Клиническое рассуждение",
        "key_facts": "Ключевые факты",
        "recommendation": "Рекомендация",
        "tests": "Обследования",
        "red_flags": "Тревожные признаки",
        "differentials": "Дифференциальный ряд",
        "critique": "Критика и ответ",
        "defense": "Защита позиции",
        "extra_evidence": "Дополнительное доказательство",
        "revised": "Уточнённое мнение",
        "accepted": "Принятые тезисы",
        "key_argument": "Ключевой клинический аргумент",
        "commentary": "Позиция профессора",
        "endorse": "Поддержка",
        "closed": "КОНСИЛИУМ ЗАКРЫТ",
        "closed_body": "Обсуждение совета завершено. Ниже итоговое клиническое заключение.",
        "final_dx": "ИТОГОВЫЕ ДИАГНОЗЫ (МКБ-10)",
        "justification": "ОБОСНОВАНИЕ (основной диагноз)",
        "treatment": "ПЛАН ЛЕЧЕНИЯ",
        "rec_tests": "РЕКОМЕНДУЕМЫЕ ОБСЛЕДОВАНИЯ",
        "follow_up": "ПЛАН НАБЛЮДЕНИЯ",
        "debate_summary": "ИТОГ ДИСКУССИИ",
        "dissent": "ОСОБЫЕ МНЕНИЯ",
        "agreements": "СОГЛАСИЯ",
        "disputes": "РАЗРЕШЁННЫЕ СПОРЫ",
        "winning": "СИЛЬНЕЙШИЕ АРГУМЕНТЫ",
        "council_summary": "ЗАКЛЮЧЕНИЕ СОВЕТА",
    },
    "en": {
        "clinical_opinion": "Clinical assessment",
        "primary_dx": "Primary diagnosis (my view)",
        "clinical_thought": "Clinical reasoning",
        "key_facts": "Key facts",
        "recommendation": "Recommendation",
        "tests": "Investigations",
        "red_flags": "Red flags",
        "differentials": "Differentials",
        "critique": "Critique and reply",
        "defense": "Defense",
        "extra_evidence": "Additional evidence",
        "revised": "Revised opinion",
        "accepted": "Accepted points",
        "key_argument": "Key clinical argument",
        "commentary": "Professor position",
        "endorse": "Endorsement",
        "closed": "CONSILIUM CLOSED",
        "closed_body": "Council discussion is complete. Final clinical conclusion below.",
        "final_dx": "FINAL DIAGNOSES (ICD-10)",
        "justification": "JUSTIFICATION (primary diagnosis)",
        "treatment": "TREATMENT PLAN",
        "rec_tests": "RECOMMENDED TESTS",
        "follow_up": "FOLLOW-UP PLAN",
        "debate_summary": "DEBATE SUMMARY",
        "dissent": "DISSENTING VIEWS",
        "agreements": "AGREEMENTS",
        "disputes": "RESOLVED DISPUTES",
        "winning": "STRONGEST ARGUMENTS",
        "council_summary": "COUNCIL SUMMARY",
    },
}


def debate_labels(language: str | None) -> dict[str, str]:
    code = normalize_language(language)
    if code in _DEBATE_LABELS:
        return _DEBATE_LABELS[code]
    if code == "uz-C":
        # Kirill UI uchun lotin sarlavhalar o'rniga o'zbek lotin (matn AI dan kirill keladi)
        return _DEBATE_LABELS["uz-L"]
    if code == "kaa":
        return _DEBATE_LABELS["uz-L"]
    return _DEBATE_LABELS["uz-L"]


# Promptlarga qo'shiladigan qat'iy qoidalar
CLINICAL_OUTPUT_RULES = """
KONSILIUM USLUBI (MAJBURIY — buzish MUMKIN EMAS):
1. Markdown (**qalin**, *, __) ISHLATMANG — faqat oddiy matn.
2. Mantiqiy zanjirda "->", "→" yoki strelka ISHLATMANG — har bir qadam ALOHIDA band.
3. Boshqa mutaxassislarga SHAXSIY ISM (Prof. ..., ism-familiya) bilan murojaat QILMANG —
   faqat mutaxassislik: "Nevrolog mutaxassisi", "Onkolog mutaxassisi", "Farmakolog mutaxassisi".
4. MANBA VA URL YO'ZMASLIG — (SSV protokoli), (PubMed), (WHO) kabi qavs ichidagi manba
   IQTIBOSLARINI O'ZINGIZ GENERATSIYA QILMANG. Faqat bemorning ANIQ klinik faktlarini yozing.
   Manbalar (SSV protokollari, PubMed, Cochrane, Lancet, NEJM) tizim tomonidan avtomatik qo'shiladi.
5. supporting_evidence — aniq klinik FAKTLAR: vital (AB, puls, SpO2), lab qiymatlari, anamnez;
   umumiy gap, spekulyatsiya va o'ylab topilgan manba YO'Q.
6. Yulduzcha (*), emoji va ichki AI/model nomlarini ISHLATMANG.
7. Dalil darajasi va foizlarni JSON ichida saqlang; foydalanuvchiga ko'rinadigan matnda
   «Ishonch», «Dalil darajasi A/B/C», «90%» kabi meta-yozuvlar ISHLATMANG.
8. Ob'ektiv, lab va tasvir (EKG/UZI/rengen) mavjud bo'lsa — ularni shikoyatdan ustun qo'llang.
9. MKB-10 kodlari faqat yakuniy hisobot uchun; munozara matnida alohida «TASHXIS (F01.9)» bloklari YO'Q.
10. Munozarada faqat klinik fakt, tahlil va amaliy tavsiya — tasdiqlanmagan da'vo YO'Q.
"""

DEEP_CLINICAL_HINT = (
    "Javob FAQAT JSON. Har band CHUQUR va AMALIY bo'lsin: aniq klinik qiymat (raqam+birlik), "
    "mexanizm yoki patofiziologik bog'liqlik, keyingi qadam. Bo'sh iboralar ('ehtimol', "
    "'ko'rib chiqildi', 'umuman olganda') YO'Q — har satr foydali klinik ma'lumot bersin."
)

# Eski nom bilan moslik
DENSE_JSON_HINT = DEEP_CLINICAL_HINT

DEBATE_INTENSITY_RULES = """
KONSILIUM CHANGI (MAJBURIY — CHUQUR MUNOZARA):
1. Boshqa mutaxassis tashxisi boshqacha bo'lsa — KAMIDA 2 ta refutation (1 ta STRONG + 1 ta MODERATE).
2. Har refutation: bemorning ANIQ ko'rsatkichi + patofiziologik sabab + nima uchun zaif (2-3 jumla).
3. Himoya (defense): o'z ixtisosligingizdan KAMIDA 3 ta yangi fakt — boshqalarning jumlasini KO'CHIRMAN.
4. accepted_from_others: kamida 1 ta band (agar qabul qilsangiz) — aniq qaysi fakt va qaysi mutaxassis dalili.
5. key_argument: 3-4 jumla — eng kuchli KLINIK FAKT zanjiri (raqam, lab, simptom).
6. debate_commentary: 4-6 jumla — professor uslubida munozaraga o'z pozitsiyangizni izohlang.
7. revised_diagnosis o'zgarsa — nima o'zgartirdi (qaysi refutation/dalil) yozing.
8. Umumiy gaplar taqiqlangan — har band bemor uchun amaliy qiymat bersin.
"""

P1_DENSITY_RULES = """
PHASE 1 CHUQURLIK (MAJBURIY — PROFESSOR USLUBI):
- clinical_opinion: 7-10 jumla — haqiqiy professor kabi: patofiziologik mantiq, differensial tahlil, amaliy xulosa.
- reasoning_chain: kamida 6-8 qadam — har biri: bemor fakti → klinik talqin → xulosa.
- supporting_evidence: kamida 6 ta — vital, lab, anamnez, tasvir yoki dori tarixidan ANIQ qiymatlar.
- differential: kamida 2 ta alternativ — har biri uchun aniq klinik sabab (2 jumla).
- recommended_tests: kamida 3 ta + klinik indikatsiya va kutilgan natija.
- red_flags: kamida 1 ta (agar mavjud bo'lsa) — shoshilinch harakat bilan.
- initial_treatment_notes: kamida 3 jumla — o'z ixtisosligingizdan aniq, amaliy tavsiya.
"""

PROFESSOR_OPINION_RULES = """
PROFESSOR FIKRI (MAJBURIY USLUB):
1. clinical_opinion maydonida haqiqiy klinik professor kabi yozing: aniq, ishonchli, dalillangan.
2. Umumiy gaplar ("ehtimol", "ko'rib chiqish kerak") o'rniga aniq klinik pozitsiya bildiring.
3. Har jumla bemor ma'lumotidagi faktdan boshlansin yoki unga bog'lansin.
4. Tashxis nomi + nega aynan shu + nima qilish kerak — ketma-ket, o'qilishi oson.
5. Boshqa mutaxassis yoki rais nutqini takrorlamang — o'z noyob burchak.
"""

P3_CONSENSUS_STRENGTH = """
YAKUNIY XULOSA SIFATI (PROFESSIONAL DARAJA — MAJBURIY):
1. consensus_diagnosis.justification: kamida 6-8 jumla — har biri aniq klinik fakt + talqin + dalil.
2. consensus_diagnosis.reasoning_chain: kamida 6-8 bosqich — munozaradagi ENG KUCHLI dalillarni sintez.
3. agreement_summary: 5-7 jumla — qaysi mutaxassis qaysi gipotezni qo'llab-quvvatlash/rad etdi (fakt bilan).
4. unexpected_findings: rad etilgan gipotezalar + sabab + qaysi dalil hal qildi (kamida 4 jumla).
5. treatment_plan: har qadam aniq (nima, doza/muddat, monitoring) — umumiy ibora YO'Q.
6. debate_synthesis.winning_arguments: har band aniq klinik fakt + qaysi mutaxassisning dalili g'olib bo'ldi.
7. agreement_level faqat dalillar asosida — spekulyatsiya va noaniq iboralar YO'Q.
8. Yakuniy xulosa universitet klinikasi konsilium protokoliga mos, faktlarga asoslangan bo'lsin.
"""

SPECIALIST_THINKING_MANDATE = """
MUTAXASSIS FIKRLASHI (MAKSIMAL CHUQURLIK):
1. Sizning javobingiz boshqa mutaxassislardan FARQ qilishi kerak — o'z noyob klinik burchagingiz.
2. Har da'vo bemor ma'lumotidagi ANIQ faktdan boshlansin (raqam, vaqt, dori, simptom).
3. Tashxis nomi bir xil bo'lsa ham — dalillar, tekshiruvlar va xavf nuqtalari BOSHQA bo'lsin.
4. Yetarli ma'lumot bo'lmasa — qaysi qo'shimcha ma'lumot/tekshiruv kerakligini aniq yozing.
5. Har bir tavsiya amaliy: nima qilish, qachon, qanday monitoring.
"""

ANTI_REPETITION_RULES = """
TAKRORLASH TAQIQLANADI (MAJBURIY):
1. Bemor shikoyatini so'zma-so'z qayta yozmang — faqat o'z ixtisosligingizdan foydalanilgan faktlar.
2. Boshqa mutaxassis, rais yoki namuna matndagi jumlalarni KO'CHIRMAN — o'z mustaqil tahlil.
3. Umumiy konsensus jumlalar ("konsilium", "hamkasblar", "shikoyat asosida") YO'Q — faqat aniq klinik da'vo.
4. Har mutaxassis BOSHQA burchakdan qarashi kerak: bir xil tashxis nomi bo'lsa ham dalillar va tekshiruvlar farq qilsin.
5. Rais ochish nutqidagi bemor tavsifini takrorlamang — faqat o'z ixtisoslik nuqtai nazaringizni bering.
"""

AGENT_SPECIALTY_FOCUS: dict[str, str] = {
    "deepseek": (
        "SIZNING BURCHAGINGIZ (Nevrolog/mantiq): neyrologik simptomlar, uyqu-arousal, kognitiv, "
        "neuromuskulyar, markaziy vs periferik ajratish. MAJBURIY chiqaring: differensial mantiq "
        "zanjiri (5+ qadam), neyrologik red flag, agar kerak bo'lsa EMG/EEG/polisomnografiya. "
        "Boshqa mutaxassis aytmagan neyrologik mexanizmni izohlang."
    ),
    "llama": (
        "SIZNING BURCHAGINGIZ (Onkolog/EBM): malign xavf, paraneoplastik sindrom, metastaz, "
        "survival/prognostik omillar. MAJBURIY: evidence level (A/B/C), qaysi screening kerak, "
        "qaysi onkologik gipoteza rad etiladi va nega. Onkologiya bo'lmasa ham — EBM asosida "
        "o'z tekshiruv va kuzatuv rejangizni bering."
    ),
    "mistral": (
        "SIZNING BURCHAGINGIZ (Protokol/SSV): O'zbekiston SSV protokol raqami/nomi, majburiy "
        "diagnostik algoritm, xavf stratifikatsiyasi, statsionar vs ambulator. MAJBURIY: "
        "protokolga mos/qarshi qaysi qadam, qaysi tekshiruv protokolda majburiy, qaysi "
        "davolash bosqichi tavsiya etiladi."
    ),
    "mini": (
        "SIZNING BURCHAGINGIZ (Farmakolog): har bir dori uchun doza, DDI, kontrendikatsiya, "
        "monitoring (qon, jigar, buyrak), O'zbekistonda mavjud savdo nomi. MAJBURIY: "
        "xavfli kombinatsiya, pediatrik/geriatrik tuzatish, alternativ preparat, "
        "nojo'ya ta'sir profilaksi rejasi."
    ),
    "gpt4o": (
        "SIZNING BURCHAGINGIZ (Kengash raisi): munozarani sintez qiling — har mutaxassisning "
        "eng kuchli dalilini og'irlik bilan birlashtiring; zaif dalillarni rad eting."
    ),
}


def _conf_label_uz(conf: str) -> str:
    m = {"HIGH": "Yuqori", "MEDIUM": "O'rtacha", "LOW": "Past"}
    key = str(conf or "").strip().upper()
    return m.get(key, str(conf or "").strip() or "—")


def _clean_step_text(step: str) -> str:
    s = str(step or "").strip()
    s = re.sub(r"\s*->\s*", " — ", s)
    s = re.sub(r"\s*→\s*", " — ", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    return s.strip()


_RECAP_LINE = re.compile(
    r"^(shikoyat|bemor\s+\d+\s*yosh|patient\s+is\s+\d+|erkak|ayol)[\s,:]",
    re.I,
)


def _filter_recap_lines(text: str) -> str:
    """Shikoyat/anamnez takrorini UI matnidan olib tashlash."""
    if not text:
        return text
    kept: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            kept.append(line)
            continue
        content = re.sub(r"^[\s•▸\d.]+", "", stripped)
        if _RECAP_LINE.search(content) and not re.search(
            r"\d+\s*(mmHg|mg|ml|/|min|L|%)", content, re.I
        ):
            continue
        kept.append(line)
    return "\n".join(kept)


def format_reasoning_steps(chain: Any) -> str:
    lines: list[str] = []
    if not isinstance(chain, list):
        return ""
    for i, raw in enumerate(chain, 1):
        step = _clean_step_text(raw)
        if step:
            lines.append(f"  {i}. {step}")
    return "\n".join(lines)


def format_bullet_items(items: Any, prefix: str = "  • ") -> str:
    if not isinstance(items, list):
        return ""
    lines: list[str] = []
    for raw in items:
        s = _clean_step_text(raw)
        if s:
            lines.append(f"{prefix}{s}")
    return "\n".join(lines)


def format_p1_debate_content(p1r: dict, language: str | None = "uz-L") -> str:
    """Mustaqil faza — professor klinik fikri va amaliy tavsiyalar."""
    L = debate_labels(language)
    sections: list[str] = []

    opinion = _clean_step_text(p1r.get("clinical_opinion", ""))
    if opinion:
        sections.append(f"▸ {L['clinical_opinion']}\n{opinion}")

    diag = _clean_step_text(p1r.get("primary_diagnosis", ""))
    if diag:
        sections.append(f"▸ {L['primary_dx']}\n  {diag}")

    reasoning = p1r.get("reasoning_chain")
    reasoning = format_reasoning_steps(reasoning)
    if reasoning:
        sections.append(f"▸ {L['clinical_thought']}\n{reasoning}")

    evidence = format_bullet_items(p1r.get("supporting_evidence"))
    if evidence:
        sections.append(f"▸ {L['key_facts']}\n{evidence}")

    notes = _clean_step_text(p1r.get("initial_treatment_notes", ""))
    if notes:
        sections.append(f"▸ {L['recommendation']}\n{notes}")

    tests = format_bullet_items(p1r.get("recommended_tests"))
    if tests:
        sections.append(f"▸ {L['tests']}\n{tests}")

    reds = format_bullet_items(p1r.get("red_flags"))
    if reds:
        sections.append(f"▸ {L['red_flags']}\n{reds}")

    diff_lines: list[str] = []
    for d in p1r.get("differential") or []:
        if not isinstance(d, dict):
            continue
        nm = _clean_step_text(d.get("name", ""))
        if not nm:
            continue
        rs = _clean_step_text(d.get("reason", ""))
        diff_lines.append(f"  • {nm}" + (f" — {rs}" if rs else ""))
    if diff_lines:
        sections.append(f"▸ {L['differentials']}\n" + "\n".join(diff_lines))

    if not sections:
        diag = _clean_step_text(p1r.get("primary_diagnosis", ""))
        if diag:
            sections.append(f"▸ {L['clinical_thought']}\n{diag}")

    return _filter_recap_lines("\n\n".join(sections))


def format_p2_debate_content(
    p2r: dict,
    specialty_resolver: Any,
    language: str | None = "uz-L",
) -> str:
    L = debate_labels(language)
    sections: list[str] = []

    ref_lines: list[str] = []
    for r in p2r.get("refutations") or []:
        if not isinstance(r, dict):
            continue
        target = specialty_resolver(str(r.get("target_agent_id", "")))
        body = _clean_step_text(r.get("refutation", ""))
        strength = str(r.get("strength", "")).strip().upper()
        tag = f"[{strength}] " if strength in ("STRONG", "MODERATE", "WEAK") else ""
        target_dx = _clean_step_text(r.get("target_diagnosis", ""))
        prefix = f"{target}"
        if target_dx:
            prefix = f"{target} («{target_dx}»)"
        if body:
            ref_lines.append(f"  • {tag}{prefix}: {body}")
    if ref_lines:
        sections.append(f"▸ {L['critique']}\n" + "\n".join(ref_lines))

    defense = p2r.get("defense") or {}
    if isinstance(defense, dict):
        arg = _clean_step_text(defense.get("argument", ""))
        new_ev = _clean_step_text(defense.get("new_evidence", ""))
        if arg:
            sections.append(f"▸ {L['defense']}\n{arg}")
        if new_ev:
            sections.append(f"▸ {L['extra_evidence']}\n{new_ev}")

    revised = _clean_step_text(p2r.get("revised_diagnosis", ""))
    if revised:
        sections.append(f"▸ {L['revised']}\n{revised}")
    accepted_lines: list[str] = []
    for a in p2r.get("accepted_from_others") or []:
        if not isinstance(a, dict):
            continue
        spec = specialty_resolver(str(a.get("agent_id", "")))
        pt = _clean_step_text(a.get("point", ""))
        if pt:
            accepted_lines.append(f"  • {spec}: {pt}")
    if accepted_lines:
        sections.append(f"▸ {L['accepted']}\n" + "\n".join(accepted_lines))

    key_arg = _clean_step_text(p2r.get("key_argument", ""))
    if key_arg:
        sections.append(f"▸ {L['key_argument']}\n{key_arg}")

    commentary = _clean_step_text(p2r.get("debate_commentary", ""))
    if commentary:
        sections.append(f"▸ {L['commentary']}\n{commentary}")

    endorse = format_bullet_items(p2r.get("endorsements"))
    if endorse:
        sections.append(f"▸ {L['endorse']}\n{endorse}")

    return _filter_recap_lines("\n\n".join(sections))


def format_specialist_roster(agents: list[Any]) -> str:
    """Konsiliumga chorlangan mutaxassislar ro'yxati."""
    lines: list[str] = []
    for agent in agents:
        fields = debate_author_fields(agent)
        lines.append(f"  • {fields['authorTitle']} — {fields['author']}")
    return "\n".join(lines)


def format_orchestrator_closing(consensus: dict, language: str | None = "uz-L") -> str:
    """Rais konsiliumni yopadi va yakuniy xulosa beradi."""
    if not isinstance(consensus, dict):
        return ""
    L = debate_labels(language)
    sections: list[str] = [f"▸ {L['closed']}\n{L['closed_body']}"]

    cd = consensus.get("consensus_diagnosis") or {}
    diag_lines: list[str] = []
    if isinstance(cd, dict) and cd.get("name"):
        icd = _clean_step_text(cd.get("icd10", ""))
        icd_desc = _clean_step_text(cd.get("icd10_description", ""))
        prob = cd.get("probability")
        prob_s = f" — {prob}%" if prob is not None else ""
        line = f"1. {_clean_step_text(cd['name'])}"
        if icd:
            line += f" (MKB-10: {icd}"
            if icd_desc:
                line += f" — {icd_desc}"
            line += ")"
        line += prob_s
        diag_lines.append(line)
    diffs = consensus.get("differential_diagnoses") or []
    if isinstance(diffs, list):
        for idx, d in enumerate(diffs[:4], start=2):
            if not isinstance(d, dict) or not d.get("name"):
                continue
            icd = _clean_step_text(d.get("icd10", ""))
            icd_desc = _clean_step_text(d.get("icd10_description", ""))
            prob = d.get("probability")
            prob_s = f" — {prob}%" if prob is not None else ""
            line = f"{idx}. {_clean_step_text(d['name'])}"
            if icd:
                line += f" (MKB-10: {icd}"
                if icd_desc:
                    line += f" — {icd_desc}"
                line += ")"
            line += prob_s
            diag_lines.append(line)
    if diag_lines:
        sections.append(f"▸ {L['final_dx']}\n" + "\n".join(diag_lines))
        just = _clean_step_text(cd.get("justification", "")) if isinstance(cd, dict) else ""
        if just:
            sections.append(f"▸ {L['justification']}\n{just}")

    treatment = consensus.get("treatment_plan") or []
    if isinstance(treatment, list) and treatment:
        block = format_bullet_items(treatment)
        if block:
            sections.append(f"▸ {L['treatment']}\n{block}")

    tests = consensus.get("recommended_tests") or []
    if isinstance(tests, list) and tests:
        block = format_bullet_items(tests)
        if block:
            sections.append(f"▸ {L['rec_tests']}\n{block}")

    follow = _clean_step_text(consensus.get("follow_up_plan", ""))
    if follow:
        sections.append(f"▸ {L['follow_up']}\n{follow}")

    synth = consensus.get("debate_synthesis") or consensus.get("debateSynthesis")
    synth_text = format_debate_synthesis(synth, language) if synth else ""
    agreement = _clean_step_text(consensus.get("agreement_summary", ""))
    if synth_text:
        sections.append(synth_text)
    elif agreement:
        sections.append(f"▸ {L['debate_summary']}\n{agreement}")

    dissent = format_bullet_items(consensus.get("dissenting_opinions"))
    if dissent:
        sections.append(f"▸ {L['dissent']}\n{dissent}")

    return "\n\n".join(sections)


def format_debate_synthesis(synthesis: dict, language: str | None = "uz-L") -> str:
    """Rais yakuniy munozara xulosasi."""
    if not isinstance(synthesis, dict):
        return ""
    L = debate_labels(language)
    sections: list[str] = []
    for key, title_key in (
        ("key_agreements", "agreements"),
        ("key_disputes_resolved", "disputes"),
        ("winning_arguments", "winning"),
    ):
        block = format_bullet_items(synthesis.get(key))
        if block:
            sections.append(f"▸ {L[title_key]}\n{block}")
    summary = _clean_step_text(synthesis.get("summary", ""))
    if summary:
        sections.insert(0, f"▸ {L['council_summary']}\n{summary}")
    return "\n\n".join(sections)


def agent_specialty_label(agent: Any, agent_id: str = "") -> str:
    """Professor shaxsiy ismi emas — mutaxassislik."""
    if agent is not None:
        spec = getattr(agent, "specialty", None) or (agent.get("specialty") if isinstance(agent, dict) else None)
        if spec:
            return str(spec).split(",")[0].strip()
        title = getattr(agent, "title", None) or (agent.get("title") if isinstance(agent, dict) else None)
        if title:
            return str(title).split("|")[0].strip()
    return "Hamkasb mutaxassis"


def format_consilium_initial(opinion: dict) -> str:
    """multi_agent_consilium mustaqil fikr maydonlarini umumiy formatga."""
    reasoning = opinion.get("reasoning_chain") or opinion.get("reasoning")
    if isinstance(reasoning, str) and reasoning.strip():
        reasoning = [reasoning]
    return format_p1_debate_content({
        "primary_diagnosis": opinion.get("primary_diagnosis", ""),
        "probability": opinion.get("probability", ""),
        "reasoning_chain": reasoning if isinstance(reasoning, list) else [],
        "supporting_evidence": opinion.get("supporting_evidence") or [],
        "red_flags": opinion.get("red_flags") or [],
        "recommended_tests": opinion.get("recommended_tests") or [],
        "initial_treatment_notes": opinion.get("initial_treatment") or opinion.get("initial_treatment_notes") or "",
        "confidence": opinion.get("confidence", "MEDIUM"),
        "evidence_level": opinion.get("evidence_level", "B"),
    })


def format_consilium_debate(debate: dict) -> str:
    sections: list[str] = []
    critique = _clean_step_text(debate.get("critique", ""))
    if critique:
        sections.append(f"▸ TANQID VA JAVOB\n{critique}")
    defense = _clean_step_text(debate.get("defense", ""))
    if defense:
        sections.append(f"▸ HIMOYA\n{defense}")
    revised = _clean_step_text(debate.get("revised_diagnosis", ""))
    if revised:
        sections.append(f"▸ YANGILANGAN FIKR\n{revised}")
    key = _clean_step_text(debate.get("key_argument", ""))
    if key:
        sections.append(f"▸ ASOSIY KLINIK DALIL\n{key}")
    return "\n\n".join(sections)


def debate_author_fields(agent: Any) -> dict[str, str]:
    """Munozara kartochkasi: ism emas, mutaxassislik."""
    specialty = agent_specialty_label(agent)
    title = getattr(agent, "title", "") or ""
    # "Prof. Ism" qismini olib tashlash — faqat lavozim qolsin
    title_clean = re.sub(r"Prof\.\s*[\w''\-]+\s*[\w''\-]+", "", str(title)).strip(" -|")
    return {
        "author": specialty,
        "authorTitle": title_clean or specialty,
    }
