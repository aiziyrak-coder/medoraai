"""
Doctor Support Mode
====================
Konsiliumdan butunlay farqli:
  - Bahs yo'q вЂ“ faqat eng aqlli model (GPT-4o)
  - O'zbekiston RSM/SSV protokollari MAJBURIY
  - Faqat O'zbekistonda ro'yxatdan o'tgan dorilar
  - Tez javob (max 3000 token)
  - Streaming uchun alohida usul

Prompt Engineering qatlamlari:
  1. System prompt  вЂ“ O'zbekiston qonunchilik + SSV + farmatsevtik cheklovlar
  2. Context block  вЂ“ bemor profili
  3. Task block     вЂ“ doktor so'rovi turi (tashxis/davolash/dori/tekshiruv)
  4. Output schema  вЂ“ har doim JSON
"""

from __future__ import annotations

import logging
from typing import Iterator

from .azure_utils import (
    call_model,
    build_messages,
    parse_json,
    patient_text,
    Deployments,
    gpt4o_client,
    USE_GEMINI,
)
from .uzbekistan_knowledge_base import get_uz_context, get_drug_context

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# O'zbekiston SSV konteksti (Prompt Engineering qatlami)
# ---------------------------------------------------------------------------

UZ_MEDICAL_CONTEXT = """
=== O'ZBEKISTON TIBBIY KONTEKST (MAJBURIY) ===

QONUNCHILIK:
- "Sog'liqni saqlash to'g'risida" O'zbekiston Respublikasi Qonuni (1996, yangilanishlar bilan)
- O'zbekiston Respublikasi SSV (Sog'liqni Saqlash Vazirligi) buyruqlari va yo'riqnomalariga rioya qiling.

KLINIK PROTOKOLLAR:
- Faqat O'zbekiston SSV tasdiqlagan milliy klinik protokollar va standartlardan foydalaning.
- Agar bemorning holatiga tegishli milliy protokol mavjud bo'lsa, unga aniq havola qiling.
- Xalqaro standartlar (WHO, ESC, AHA) faqat SSV tomonidan qabul qilingan bo'lsa mos keladi.

FARMATSEVTIKA:
- FAQAT O'zbekistonda davlat ro'yxatidan o'tgan dori-darmonlarni tavsiya qiling.
- Savdo nomlari bilan yozing: Nimesil, Sumamed, Augmentin, Metformin, Enalapril,
  Amlodipin, Omeprazol, Pantoprazol, Paratsetamol, Ibuprofen, Ketoprofen,
  Klaritromisin, Amoksitsillin, Siprofloksatsin, Azitromitsin va hokazo.
- Dozalar O'zbekiston standartlariga mos bo'lsin; bolalar va keksalar uchun alohida.
- Dori o'zaro ta'sirlari va allergiyani HAR DOIM tekshiring.

LABORATORIYA:
- O'zbekiston LITS (Laboratoriya-indekslar va tibbiy standartlar) birliklarini ishlating.
- Normal qiymatlarni O'zbekistonda qabul qilingan referens chegaralar bo'yicha bering.

SHOSHILINCH HOLAT:
- Yuzaga kelgan shoshilinch holatda 103 (tez tibbiy yordam) raqamini ko'rsating.
- Reanimatsiya markazlariga yo'llash tartibini qo'shing.
=== KONTEKST TUGADI ===
"""

# ---------------------------------------------------------------------------
# Doctor task types
# ---------------------------------------------------------------------------

TASK_QUICK_CONSULT = "quick_consult"       # Tezkor maslahat
TASK_DIAGNOSIS     = "diagnosis"            # Tashxis
TASK_TREATMENT     = "treatment_plan"       # Davolash rejasi
TASK_DRUG_CHECK    = "drug_check"           # Dori tekshiruvi
TASK_LAB_INTERPRET = "lab_interpretation"   # Lab tahlili
TASK_FOLLOW_UP     = "follow_up"            # Kuzatuv rejasi

# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def _doctor_system_prompt(task_type: str, language_hint: str,
                           complaints: str = "") -> str:
    lang_map = {
        "uz-L": "O'zbek tilida (Lotin grafikasida)",
        "uz-C": "O'zbek tilida (Kirill grafikasida)",
        "kaa":  "Qoraqolpoq tilida",
        "ru":   "Ruscha",
        "en":   "English",
    }
    lang_instruction = lang_map.get(language_hint, lang_map["uz-L"])

    task_instructions = {
        TASK_QUICK_CONSULT: (
            "Shifokorga qisqa, aniq va amaliy maslahat bering. "
            "Asosiy tashxis, zaruriy tekshiruvlar, darhol choralar. "
            "Maksimal 5 qadam."
        ),
        TASK_DIAGNOSIS: (
            "3вЂ“5 ta differensial tashxis bering. "
            "Har biri uchun: ehtimollik (%), asoslash va SSV protokol havolasi. "
            "Eng kuchli dalil asosida asosiy tashxisni ajratib ko'rsating."
        ),
        TASK_TREATMENT: (
            "O'zbekiston SSV protokoliga mos to'liq davolash rejasi yozing. "
            "Dori dozalari, qabul vaqti, davomiyligi aniq ko'rsatilsin. "
            "Nojo'ya ta'sirlar va qarshi ko'rsatmalarni qayd eting."
        ),
        TASK_DRUG_CHECK: (
            "Berilgan dorilarni tahlil qiling: "
            "o'zaro ta'sirlar, dozalar to'g'riligi, O'zbekistonda mavjudligi. "
            "Xavfli kombinatsiyalarni alohida belgilang."
        ),
        TASK_LAB_INTERPRET: (
            "Lab natijalarini O'zbekiston LITS standartlari bo'yicha izohlang. "
            "Anormal ko'rsatkichlarni klinik ahamiyati bilan tushuntiring."
        ),
        TASK_FOLLOW_UP: (
            "Kuzatuv rejasi tuzing: qachon qaytib kelish, qanday belgilarda darhol "
            "murojaat etish, qanday tekshiruvlar kerak."
        ),
    }

    task_instr = task_instructions.get(task_type, task_instructions[TASK_QUICK_CONSULT])

    # Dynamic knowledge base context
    kb_context = get_uz_context(complaints_text=complaints, include_protocols=True)
    drug_ctx   = get_drug_context()

    return f"""Siz AiDoktor tibbiy yordamchisiz вЂ“ yuqori malakali klinik mutaxassis.

VAZIFA: {task_instr}

{kb_context}

{drug_ctx}

TIL: Barcha javoblar {lang_instruction} bo'lsin.
MUHIM: Javobni FAQAT JSON formatida qaytaring."""


# ---------------------------------------------------------------------------
# JSON output schemas per task
# ---------------------------------------------------------------------------

_SCHEMA_QUICK = (
    '{{'
    '"summary": "Qisqa klinik xulosa",'
    '"primary_diagnosis": "Asosiy tashxis",'
    '"probability": 80,'
    '"immediate_actions": ["1-chora", "2-chora"],'
    '"medications": [{{"name":"...","dosage":"...","frequency":"...","duration":"...","instructions":"..."}}],'
    '"recommended_tests": ["..."],'
    '"follow_up": "Kuzatuv ko\'rsatmasi",'
    '"critical_alert": {{"present": false, "message": ""}}'
    '}}'
)

_SCHEMA_DIAGNOSIS = (
    '{{'
    '"diagnoses": ['
    '  {{"name":"...","probability":70,"justification":"...","evidence_level":"High",'
    '    "reasoning_chain":["..."],"uzbek_protocol":"SSV protokol nomi"}}'
    '],'
    '"recommended_tests": ["..."],'
    '"red_flags": ["Shoshilinch belgilar"]'
    '}}'
)

_SCHEMA_TREATMENT = (
    '{{'
    '"diagnosis": "Tasdiqlangan tashxis",'
    '"treatment_plan": ["1-qadam...", "2-qadam..."],'
    '"medications": ['
    '  {{"name":"Savdo nomi","dosage":"...","frequency":"...","duration":"...","timing":"Ovqatdan keyin",'
    '    "instructions":"...","contraindications":"...","local_availability":"O\'zbekistonda mavjud"}}'
    '],'
    '"non_pharmacological": ["Rejim ko\'rsatmasi"],'
    '"monitoring": ["Kuzatish parametri"],'
    '"uzbek_protocol_ref": "SSV protokol havolasi"'
    '}}'
)

_SCHEMA_DRUG = (
    '{{'
    '"drugs_analyzed": ['
    '  {{"name":"...","registered_in_uzbekistan": true,'
    '    "dose_correct": true,"dose_comment":"..."}}'
    '],'
    '"interactions": [{{"drugs":["A","B"],"severity":"HIGH/MEDIUM/LOW","description":"..."}}],'
    '"allergies_check": "...", '
    '"overall_safety": "SAFE/CAUTION/DANGEROUS",'
    '"recommendations": ["..."]'
    '}}'
)

_SCHEMA_LAB = (
    '{{'
    '"interpretations": ['
    '  {{"parameter":"...","value":"...","unit":"...","reference":"...","status":"HIGH/LOW/NORMAL",'
    '    "clinical_significance":"...","action_needed":false}}'
    '],'
    '"summary": "Umumiy xulosa",'
    '"urgent_findings": ["Shoshilinch topilmalar"]'
    '}}'
)

_SCHEMA_FOLLOW_UP = (
    '{{'
    '"return_visit": "7 kun ichida",'
    '"red_flag_symptoms": ["Darhol murojaat belgilari"],'
    '"monitoring_at_home": ["Uyda kuzatish"],'
    '"repeat_tests": ["Takror tahlillar"],'
    '"lifestyle_advice": ["Turmush tarzi"],'
    '"emergency_contact": "103 вЂ“ Tez tibbiy yordam"'
    '}}'
)

SCHEMAS = {
    TASK_QUICK_CONSULT: _SCHEMA_QUICK,
    TASK_DIAGNOSIS:     _SCHEMA_DIAGNOSIS,
    TASK_TREATMENT:     _SCHEMA_TREATMENT,
    TASK_DRUG_CHECK:    _SCHEMA_DRUG,
    TASK_LAB_INTERPRET: _SCHEMA_LAB,
    TASK_FOLLOW_UP:     _SCHEMA_FOLLOW_UP,
}


# ---------------------------------------------------------------------------
# Core: synchronous call
# ---------------------------------------------------------------------------

def doctor_consult(
    patient_data: dict,
    query: str = "",
    task_type: str = TASK_QUICK_CONSULT,
    language: str = "uz-L",
) -> dict:
    """
    Single-model doctor support consultation (GPT-4o only, no debate).

    Args:
        patient_data: Patient clinical data dict.
        query:        Additional doctor question/context.
        task_type:    One of the TASK_* constants.
        language:     Output language code.

    Returns:
        Parsed JSON result dict.
    """
    complaints  = str(patient_data.get("complaints", ""))
    ptext       = patient_text(patient_data)
    schema      = SCHEMAS.get(task_type, _SCHEMA_QUICK)
    system      = _doctor_system_prompt(task_type, language, complaints)

    user = (
        f"BEMOR:\n{ptext}\n\n"
        + (f"SHIFOKOR SO'ROVI:\n{query}\n\n" if query else "")
        + f"Quyidagi JSON strukturada javob bering:\n{schema}"
    )

    try:
        raw = call_model(
            Deployments.gpt4o(),
            build_messages(system, user, want_json=True),
            response_json=True,
            temperature=0.1,
            max_tokens=3000,
        )
        result = parse_json(raw, f"doctor_{task_type}")
        if not isinstance(result, dict):
            result = {"error": "AI javob qayta ishlashda xatolik", "raw": raw[:200]}
    except Exception as exc:
        logger.error("DoctorSupport.consult failed: %s", exc)
        result = {"error": str(exc)}

    result["_task_type"] = task_type
    result["_language"]  = language
    return result


# ---------------------------------------------------------------------------
# Streaming generator (for Server-Sent Events)
# ---------------------------------------------------------------------------

def doctor_consult_stream(
    patient_data: dict,
    query: str = "",
    task_type: str = TASK_QUICK_CONSULT,
    language: str = "uz-L",
) -> Iterator[str]:
    """
    Stream tokens from GPT-4o for Doctor Support Mode.
    Yields raw text chunks; caller wraps in SSE format.
    """
    ptext  = patient_text(patient_data)
    schema = SCHEMAS.get(task_type, _SCHEMA_QUICK)
    system = _doctor_system_prompt(task_type, language)

    user = (
        f"BEMOR:\n{ptext}\n\n"
        + (f"SHIFOKOR SO'ROVI:\n{query}\n\n" if query else "")
        + f"Quyidagi JSON strukturada javob bering:\n{schema}"
    )

    msgs = build_messages(system, user, want_json=True)

    try:
        if USE_GEMINI:
            full = call_model(
                Deployments.gpt4o(),
                msgs,
                response_json=True,
                temperature=0.1,
                max_tokens=3000,
            )
            if full:
                yield full
        else:
            client = gpt4o_client()
            stream = client.chat.completions.create(
                model=Deployments.gpt4o(),
                messages=msgs,
                temperature=0.1,
                max_tokens=3000,
                response_format={"type": "json_object"},
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield delta
    except Exception as exc:
        logger.error("DoctorSupport stream failed: %s", exc)
        yield f'{{"error": "{exc}"}}'