"""
Tasvir tahlili uchun umumiy til qoidalari va prompt bloklari (UZI/UTT/rentgen/KT/MRT).
"""
from __future__ import annotations

LANG_LABELS = {
    "uz-L": "O'zbek (lotin)",
    "uz-C": "O'zbek (kirill)",
    "ru": "Rus",
    "en": "Ingliz",
    "kaa": "Qoraqalpoq",
}


def lang_label(language: str) -> str:
    return LANG_LABELS.get(language or "uz-L", LANG_LABELS["uz-L"])


def vision_system_prompt(language: str) -> str:
    """Vision model uchun qisqa system — til majburiyati."""
    lang = lang_label(language)
    if language == "en":
        return (
            "You are a subspecialty radiologist. All narrative JSON fields MUST be in English. "
            "Be systematic, evidence-based, and never use generic templates without verifying each structure."
        )
    return (
        f"Siz yuqori malakali radiologsiz. BARCHA JSON matn maydonlari FAQAT {lang} tilida yoziladi. "
        f"urgencyLevel dan boshqa hech qanday maydon inglizcha YO'Q. "
        f"Faqat xalqaro qisqartmalar (KT, MRT, AP, PA, HU) qoldirilishi mumkin. "
        f"Shablon 'normal study' yoki umumiy inglizcha jumlalarni ishlatmang — har bir tuzilmani alohida baholang."
    )


def language_rule_block(language: str) -> str:
    lang = lang_label(language)
    if language == "en":
        return (
            "LANGUAGE: Every string field in JSON MUST be in English (clinical register). "
            "urgencyLevel enum only: routine|soon|urgent|emergent."
        )
    return (
        f"TIL (MAJBURIY): studyType, regionOrOrgan, techniqueNotes, keyFindings[], measurements, "
        f"impression, clinicalConclusion, recommendations[], differentialDiagnosis, limitations — "
        f"HAMMASI {lang} tilida. Tasvirdagi yozuv boshqa tilda bo'lsa ham talqin {lang} tilida. "
        f"urgencyLevel faqat: routine|soon|urgent|emergent (inglizcha enum)."
    )


MODALITY_PROTOCOL = """
TIZIMLI O'QISH (mos keladiganlarini qo'llang):

UZI/UTT:
- Organ/soha, ekhotuzilma, kontur, o'lcham (mm), Doppler (faqat ko'ringan).
- Focal lesion: joylashuv, o'lcham, tuzilma, vaskulyarlik.
- Erkin suyuqlik, limfa tugunlari, devor qalinligi.

Rentgen:
- Proyeksiya (AP/PA/yon), sifat, rotatsiya.
- Siluet, konsolidatsiya, plevra, kardiomediastinal kontur, suyak, chuqurlik.

KT (kompyuter tomografiya) — har bir kesimni alohida:
- Kesim darajasi, kontrast (agar ko'rinsa), oyna (soft tissue / bone).
- Bosh miya: qon quyish turlari (epidural/subdural/subarachnoid/intraparenximal),
  midline siljishi, ventrikullar, bazal tsisternalar, suyak oynasi, sinuslar.
- Ko'krak: plevra, konsolidatsiya, mediastinum, yoqalar.
- Qorin: organlar, erkin suyuqlik/gaz, limfa tugunlari.
- HU qiymatlari va o'lchamlar ko'rinsa — nusxalang.

MRT:
- Sekvens (T1/T2/FLAIR/DWI agar ko'rinsa), signal intensivligi, kontrast.
- Massa effekti, edema, diffuziya cheklovlari.

PDF protokol: barcha matn va raqamlarni to'liq o'qing.
""".strip()


ANALYSIS_DEPTH = """
CHUQURLIK (yuzaki shablon YO'Q):
- keyFindings: 8–14 ta aniq jumla (KT/MRT uchun kamida 8); har biri alohida kuzatma.
- measurements: ko'rinadigan BARCHA raqamlar birlik bilan; yo'q bo'lsa qisqa izoh.
- impression: sintez — faqat ro'yxat takrori emas.
- clinicalConclusion: klinik ahamiyat, noaniqlik, shoshilinch xabar (agar bor).
- differentialDiagnosis: kamida 3–5 farqlovchi tashxis (hatto 'normal' ko'rinishda ham
  nima ehtimol pastligi va nima uchun — masalan subdural gematoma, ishemiya, o'sma).
- recommendations: 4–8 aniq qadam (qayta tekshiruv muddati, qo'shimcha KT/MRT, lab, mutaxassis).
- limitations: faqat haqiqiy texnik cheklovlar.

XAVFSIZLIK: favqulodda naqshlar (masalan, o'tkir qon quyish, massa effekti, torssiya)
→ urgencyLevel emergent yoki urgent va clinicalConclusion da aniq ayting.

HALOLLIK: tasvirda ko'rinmaydigan tashxis/o'lchamni IXTiRO QILMANG. Noaniq bo'lsa — ayting.
""".strip()


UZI_UTT_JSON_SCHEMA = (
    '{"studyType":"","regionOrOrgan":"","techniqueNotes":"","keyFindings":[],"measurements":"",'
    '"impression":"","clinicalConclusion":"","recommendations":[],"differentialDiagnosis":"",'
    '"limitations":"","urgencyLevel":"routine|soon|urgent|emergent"}'
)


def uzi_utt_user_prompt(language: str, clinical_context: str, file_names: list[str]) -> str:
    lang = lang_label(language)
    ctx = (clinical_context or "").strip()
    names = ", ".join(file_names[:12]) if file_names else "fayl"
    return (
        f"BIROKTILGAN TASVIRLARNI PIKSELLAR BO'YICHA to'liq o'qing — fayl nomi yoki taxminiy "
        f"shablonga asoslanmang.\n"
        f"{language_rule_block(language)}\n"
        f"Fayllar: {names}.\n"
        f"Klinik kontekst:\n{ctx[:2500] if ctx else '—'}\n\n"
        f"{MODALITY_PROTOCOL}\n\n"
        f"{ANALYSIS_DEPTH}\n\n"
        f"FAQAT JSON: {UZI_UTT_JSON_SCHEMA}"
    )
