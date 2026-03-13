"""
Multi-Agent Medical Consilium System
=====================================
5 ta virtual professor agent parallel ravishda ishlab,
o'zaro bahslashadi va yakuniy konsensus tashxisga keladi.

Arxitektura:
    1. GPT-4o (FJSTI-gpt4o)   в†’ Prof. Alisher Toshmatov (Rais, Kardiolog/Terapevt)
    2. DeepSeek (FJSTI-deepseek) в†’ Prof. Dilshod Yusupov (Reasoning Expert, Nevrolog)
    3. Llama 3.3 (FJSTI-llama)   в†’ Prof. Nodira Karimova (Tibbiy Ensiklopedist, Onkolog)
    4. Mistral (FJSTI-mistral)   в†’ Prof. Bahrom Nazarov (Klinik Standartlar, Gastroenterolog)
    5. GPT-4o-mini (FJSTI-mini)  в†’ Prof. Sarvinoz Mirzayeva (Farmakolog)
"""

import json
import logging
import concurrent.futures
from typing import Any

from django.utils import timezone

from .azure_utils import (
    get_azure_client,
    _patient_text,
    _parse_json_response,
    DEPLOY_GPT4O,
    DEPLOY_DEEPSEEK,
    DEPLOY_LLAMA,
    DEPLOY_MISTRAL,
    DEPLOY_MINI,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Professor Definitions
# ---------------------------------------------------------------------------

PROFESSORS: list[dict[str, str]] = [
    {
        "id": "chair",
        "name": "Prof. Alisher Toshmatov",
        "title": "Kardiolog & Umumiy Terapevt | Kengash Raisi",
        "deployment": "gpt4o",
        "specialty": "Kardiologiya, Ichki kasalliklar",
        "persona": (
            "Men Toshkent Tibbiyot Akademiyasining yetakchi kardiologi va umumiy terapevtiman. "
            "Kengash raisi sifatida barcha fikrlarni tartibga solib, yakuniy qarorga olib kelaman. "
            "SSV klinik protokollariga qat'iy rioya qilaman."
        ),
    },
    {
        "id": "reasoning",
        "name": "Prof. Dilshod Yusupov",
        "title": "Nevrolog & Klinik Mantiq Mutaxassisi",
        "deployment": "deepseek",
        "specialty": "Nevrologiya, Klinik Mantiq",
        "persona": (
            "Men chuqur mantiqiy tahlil va differensial diagnostika bo'yicha mutaxassisРјР°РЅ. "
            "Har bir gipotezani step-by-step mantiqiy zanjir orqali tekshiraman. "
            "Boshqalarning xatolarini aniqlash mening asosiy vazifam."
        ),
    },
    {
        "id": "encyclopedist",
        "name": "Prof. Nodira Karimova",
        "title": "Onkolog & Tibbiy Ensiklopedist",
        "deployment": "llama",
        "specialty": "Onkologiya, Tibbiy Adabiyot",
        "persona": (
            "Men zamonaviy tibbiy adabiyot va xalqaro klinik tadqiqotlar bo'yicha ekspertman. "
            "Har bir tavsiyani dalil asosida (evidence-based) beraman. "
            "O'zbekiston va xalqaro SSV/WHO standartlarini yaxshi bilaman."
        ),
    },
    {
        "id": "standards",
        "name": "Prof. Bahrom Nazarov",
        "title": "Gastroenterolog & Klinik Standartlar Eksperti",
        "deployment": "mistral",
        "specialty": "Gastroenterologiya, Klinik Protokollar",
        "persona": (
            "Men O'zbekiston SSV klinik protokollari va xalqaro davolash standartlari bo'yicha mutaxassisРјР°РЅ. "
            "Protokollarga to'liq muvofiqlikni ta'minlayman va qoidabuzarliklarni aniqlayman."
        ),
    },
    {
        "id": "pharmacologist",
        "name": "Prof. Sarvinoz Mirzayeva",
        "title": "Farmakolog & Toksikolog",
        "deployment": "mini",
        "specialty": "Farmakologiya, Toksikologiya",
        "persona": (
            "Men farmakologiya bo'yicha mutaxassisРјР°РЅ. "
            "Dori-darmonlar, dozalar, o'zaro ta'sirlar va nojo'ya ta'sirlar mening soham. "
            "FAQAT O'zbekistonda ro'yxatdan o'tgan dorilar tavsiya qilaman."
        ),
    },
]

DEPLOY_MAP = {
    "gpt4o": DEPLOY_GPT4O,
    "deepseek": DEPLOY_DEEPSEEK,
    "llama": DEPLOY_LLAMA,
    "mistral": DEPLOY_MISTRAL,
    "mini": DEPLOY_MINI,
}


# ---------------------------------------------------------------------------
# Helper: single Azure call
# ---------------------------------------------------------------------------

def _chat(deployment: str, system_msg: str, user_msg: str,
          response_json: bool = False, max_tokens: int = 3000) -> str:
    """Simple chat completion call."""
    client = get_azure_client()
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]
    kwargs: dict[str, Any] = {
        "model": deployment,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    if response_json:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        resp = client.chat.completions.create(**kwargs)
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        logger.error("Chat call failed (deployment=%s): %s", deployment, e)
        return f"[Xatolik: {e}]"


# ---------------------------------------------------------------------------
# Step 1: Moderator introduces the case
# ---------------------------------------------------------------------------

def _moderator_intro(patient_text: str, language_hint: str) -> str:
    system = (
        "Siz tibbiy kengash raisisiz. Kengashni rasmiy oching va klinik holatni barcha "
        "a'zolarga qisqacha taqdim eting. O'zbek tilida (Lotin) yozing."
    )
    user = (
        f"Klinik holat:\n{patient_text}\n\n"
        f"Iltimos kengashni oching va barcha professorlarga bu holatni taqdim eting. "
        f"Til: {language_hint}."
    )
    return _chat(DEPLOY_GPT4O(), system, user, max_tokens=600)


# ---------------------------------------------------------------------------
# Step 2: Each professor gives independent diagnosis (parallel)
# ---------------------------------------------------------------------------

def _professor_initial_diagnosis(prof: dict, patient_text: str, language_hint: str) -> dict:
    """One professor's initial diagnosis вЂ“ called in thread pool."""
    deployment = DEPLOY_MAP[prof["deployment"]]()
    system = (
        f"Siz {prof['name']} вЂ” {prof['title']}. {prof['persona']}\n"
        "Klinik holat tahlil qilib, mustaqil tashxis bildiring. "
        "O'zbekiston SSV klinik protokollariga rioya qiling. "
        f"Javob tili: {language_hint}. FAQAT JSON."
    )
    user = (
        f"Bemor:\n{patient_text}\n\n"
        "Quyidagi JSON strukturada javob bering:\n"
        '{"primary_diagnosis": "...", "probability": 80, "reasoning": "...", '
        '"differential": ["...", "..."], "red_flags": ["..."], '
        '"recommended_tests": ["..."], "initial_treatment": "..."}'
    )
    raw = _chat(deployment, system, user, response_json=True, max_tokens=1500)
    parsed = _parse_json_response(raw, f"prof_{prof['id']}_initial")
    if not isinstance(parsed, dict):
        parsed = {"primary_diagnosis": "Tashxis aniqlanmadi", "error": raw[:200]}
    parsed["professor_id"] = prof["id"]
    parsed["professor_name"] = prof["name"]
    parsed["professor_title"] = prof["title"]
    return parsed


# ---------------------------------------------------------------------------
# Step 3: Moderator summarizes round 1 and raises debate points
# ---------------------------------------------------------------------------

def _moderator_synthesis(
    patient_text: str,
    initial_opinions: list[dict],
    round_num: int,
    language_hint: str,
) -> str:
    system = (
        "Siz tibbiy kengash raisisiz. Barcha a'zolar fikrini tahlil qilib, "
        "ziddiyatli nuqtalarni ko'rsating va keyingi muhokama uchun savollar bering. "
        f"Javob tili: {language_hint}."
    )
    opinions_text = json.dumps(initial_opinions, ensure_ascii=False, indent=2)
    user = (
        f"Bemor:\n{patient_text}\n\n"
        f"{round_num}-bosqich natijalari:\n{opinions_text}\n\n"
        "Iltimos:\n"
        "1. Barcha professorlarning asosiy fikrlarini qisqacha jamlang.\n"
        "2. Ziddiyatli nuqtalarni aniqlab ko'rsating.\n"
        "3. Har bir professordagi kuchli va zaif tomonlarni ayting.\n"
        "4. Keyingi bahsda aniqlashtirish kerak bo'lgan 2-3 asosiy savolni bering."
    )
    return _chat(DEPLOY_GPT4O(), system, user, max_tokens=800)


# ---------------------------------------------------------------------------
# Step 4: Debate round вЂ“ professors critique each other
# ---------------------------------------------------------------------------

def _professor_debate(
    prof: dict,
    patient_text: str,
    initial_opinions: list[dict],
    synthesis: str,
    language_hint: str,
) -> dict:
    """One professor's debate response вЂ“ critiques others and defends own view."""
    deployment = DEPLOY_MAP[prof["deployment"]]()
    other_opinions = [o for o in initial_opinions if o["professor_id"] != prof["id"]]
    system = (
        f"Siz {prof['name']} вЂ” {prof['title']}. {prof['persona']}\n"
        "Boshqa professorlarning fikrlarini tanqid qiling, xatolarini toping "
        "va o'z pozitsiyangizni ilmiy dalillar bilan himoya qiling. "
        f"Javob tili: {language_hint}. FAQAT JSON."
    )
    user = (
        f"Bemor:\n{patient_text}\n\n"
        f"Rais xulosasi:\n{synthesis}\n\n"
        f"Boshqa professorlar fikrlari:\n{json.dumps(other_opinions, ensure_ascii=False)}\n\n"
        "Quyidagi JSON strukturada javob bering:\n"
        '{"critique": "Boshqalarning xatolari va munosabatim...", '
        '"defense": "O\'z pozitsiyamni himoya qilaman...", '
        '"revised_diagnosis": "...", '
        '"revised_probability": 80, '
        '"key_argument": "Asosiy ilmiy dalil..."}'
    )
    raw = _chat(deployment, system, user, response_json=True, max_tokens=1500)
    parsed = _parse_json_response(raw, f"prof_{prof['id']}_debate")
    if not isinstance(parsed, dict):
        parsed = {"critique": "", "defense": raw[:200], "revised_diagnosis": ""}
    parsed["professor_id"] = prof["id"]
    parsed["professor_name"] = prof["name"]
    return parsed


# ---------------------------------------------------------------------------
# Step 5: Final consensus by moderator
# ---------------------------------------------------------------------------

def _final_consensus(
    patient_text: str,
    initial_opinions: list[dict],
    debate_responses: list[dict],
    language_hint: str,
) -> dict:
    system = (
        "Siz tibbiy kengash raisisiz. Barcha professorlar bahsini diqqat bilan o'rganib, "
        "yakuniy konsensus tashxis va davolash rejasini tayyorlang. "
        "O'zbekiston SSV klinik protokollariga to'liq rioya qiling. "
        f"Javob tili: {language_hint}. FAQAT JSON."
    )
    all_data = {
        "patient": patient_text,
        "initial_opinions": initial_opinions,
        "debate_round": debate_responses,
    }
    user = (
        f"Barcha ma'lumotlar:\n{json.dumps(all_data, ensure_ascii=False, indent=2)}\n\n"
        "Quyidagi JSON strukturada YAKUNIY KONSENSUS hisobotini bering:\n"
        '{\n'
        '  "consensus_diagnosis": {\n'
        '    "name": "Asosiy tashxis nomi",\n'
        '    "probability": 90,\n'
        '    "justification": "Asoslash...",\n'
        '    "evidenceLevel": "High",\n'
        '    "reasoningChain": ["Qadam 1", "Qadam 2"],\n'
        '    "uzbekProtocolMatch": "SSV protokol nomi"\n'
        '  },\n'
        '  "differential_diagnoses": [\n'
        '    {"name": "...", "probability": 30, "reason": "..."}\n'
        '  ],\n'
        '  "rejected_hypotheses": [\n'
        '    {"name": "...", "reason": "Nega rad etildi..."}\n'
        '  ],\n'
        '  "treatment_plan": ["1-qadam...", "2-qadam..."],\n'
        '  "medications": [\n'
        '    {\n'
        '      "name": "Dori nomi (savdo nomi)",\n'
        '      "dosage": "...",\n'
        '      "frequency": "...",\n'
        '      "duration": "...",\n'
        '      "timing": "Ovqatdan keyin",\n'
        '      "instructions": "...",\n'
        '      "local_availability": "O\'zbekistonda mavjud"\n'
        '    }\n'
        '  ],\n'
        '  "recommended_tests": ["..."],\n'
        '  "critical_finding": {\n'
        '    "finding": "Shoshilinch holat (faqat o\'zbekcha, agar mavjud bo\'lsa)",\n'
        '    "implication": "Oqibat (faqat o\'zbekcha)",\n'
        '    "urgency": "Zudlik bilan / O\'rtacha / Past yoki HIGH/MEDIUM/LOW"\n'
        '  },\n'
        '  "uzbekistan_note": "O\'zbekiston Respublikasi SSV protokollariga muvofiq...",\n'
        '  "professor_agreement_summary": "Professorlar umumiy kelishuvni qanday ta\'rifladi...",\n'
        '  "dissenting_opinions": ["Farqli fikrlar (agar bo\'lsa)"],\n'
        '  "follow_up_plan": "Kuzatuv rejasi..."\n'
        '}\n\n'
        "Barcha matn qiymatlari (critical_finding finding, implication va boshqalar) faqat o'zbek tilida bo'lsin; yulduzcha (*) va inglizcha iboralar ishlatmang."
    )
    raw = _chat(DEPLOY_GPT4O(), system, user, response_json=True, max_tokens=4000)
    parsed = _parse_json_response(raw, "final_consensus")
    if not isinstance(parsed, dict):
        return {
            "error": "Konsensus yaratishda xatolik",
            "raw": raw[:300],
            "consensus_diagnosis": {"name": "Tashxis aniqlanmadi", "probability": 0},
        }
    return parsed


# ---------------------------------------------------------------------------
# Step 6: Pharmacology review by specialist
# ---------------------------------------------------------------------------

def _pharmacology_review(
    patient_text: str,
    consensus: dict,
    language_hint: str,
) -> dict:
    """Dedicated pharmacology pass to validate & enrich medications."""
    system = (
        "Siz Prof. Sarvinoz Mirzayeva вЂ” farmakolog. "
        "Taklif etilgan dorilarni tekshiring: dozalar to'g'rimi, o'zaro ta'sirlar bormi, "
        "nojo'ya ta'sirlar ogohlantirilganmi, O'zbekistonda ro'yxatdan o'tganmi. "
        f"Javob tili: {language_hint}. FAQAT JSON."
    )
    meds = consensus.get("medications", [])
    allergies = ""
    for line in patient_data_context:
        if "Allergiya:" in line:
            allergies = line
            break

    user = (
        f"Bemor:\n{patient_text}\n\n"
        f"Taklif etilgan dorilar:\n{json.dumps(meds, ensure_ascii=False)}\n\n"
        "Quyidagi JSON formatida javob bering:\n"
        '{"validated_medications": [...], "interactions_found": [...], '
        '"warnings": [...], "substitutions": [...], "pharmacology_note": "..."}'
    )
    raw = _chat(DEPLOY_MINI(), system, user, response_json=True, max_tokens=2000)
    return _parse_json_response(raw, "pharmacology_review")


# Workaround: patient_data_context passed via module-level temp
patient_data_context: list[str] = []


# ---------------------------------------------------------------------------
# Main Public Function
# ---------------------------------------------------------------------------

def run_multi_agent_consilium(patient_data: dict, language: str = "uz-L") -> dict:
    """
    Run the full Multi-Agent Medical Consilium.

    Flow:
        1. Moderator opens the session (GPT-4o)
        2. All 5 professors give independent diagnoses (parallel)
        3. Moderator synthesizes & raises debate points (GPT-4o)
        4. Professors debate each other (parallel)
        5. Final consensus by moderator (GPT-4o)
        6. Pharmacology review (GPT-4o-mini)

    Args:
        patient_data: Patient clinical data dict.
        language: Output language code (uz-L, uz-C, ru, en).

    Returns:
        Full consilium result dict.
    """
    global patient_data_context

    lang_map = {
        "uz-L": "O'zbek (Lotin)",
        "uz-C": "O'zbek (Kirill)",
        "kaa": "Qoraqolpoq",
        "ru": "Ruscha",
        "en": "Inglizcha",
    }
    language_hint = lang_map.get(language, "O'zbek (Lotin)")
    patient_text = _patient_text(patient_data)
    patient_data_context = patient_text.split("\n")

    result: dict[str, Any] = {
        "session_id": f"consilium_{timezone.now().strftime('%Y%m%d_%H%M%S')}",
        "started_at": timezone.now().isoformat(),
        "language": language,
        "professors": [
            {
                "id": p["id"],
                "name": p["name"],
                "title": p["title"],
                "specialty": p["specialty"],
            }
            for p in PROFESSORS
        ],
        "steps": {},
        "final_report": None,
    }

    # -----------------------------------------------------------------------
    # STEP 1: Moderator intro
    # -----------------------------------------------------------------------
    logger.info("[Consilium] Step 1: Moderator intro")
    try:
        intro = _moderator_intro(patient_text, language_hint)
        result["steps"]["intro"] = intro
    except Exception as e:
        logger.error("Moderator intro failed: %s", e)
        result["steps"]["intro"] = "Kengash ochildi."

    # -----------------------------------------------------------------------
    # STEP 2: Parallel initial diagnoses
    # -----------------------------------------------------------------------
    logger.info("[Consilium] Step 2: Parallel initial diagnoses (%d professors)", len(PROFESSORS))
    initial_opinions: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(_professor_initial_diagnosis, prof, patient_text, language_hint): prof
            for prof in PROFESSORS
        }
        for future in concurrent.futures.as_completed(futures):
            prof = futures[future]
            try:
                opinion = future.result(timeout=60)
                initial_opinions.append(opinion)
                logger.info("[Consilium] %s diagnosis done", prof["name"])
            except Exception as e:
                logger.error("Professor %s initial diagnosis failed: %s", prof["name"], e)
                initial_opinions.append({
                    "professor_id": prof["id"],
                    "professor_name": prof["name"],
                    "professor_title": prof["title"],
                    "primary_diagnosis": "Tahlil muvaffaqiyatsiz",
                    "error": str(e),
                })

    # Sort by PROFESSORS order
    order = {p["id"]: i for i, p in enumerate(PROFESSORS)}
    initial_opinions.sort(key=lambda x: order.get(x.get("professor_id", ""), 99))
    result["steps"]["initial_opinions"] = initial_opinions

    # -----------------------------------------------------------------------
    # STEP 3: Moderator synthesis
    # -----------------------------------------------------------------------
    logger.info("[Consilium] Step 3: Moderator synthesis")
    try:
        synthesis = _moderator_synthesis(patient_text, initial_opinions, 1, language_hint)
        result["steps"]["synthesis_round1"] = synthesis
    except Exception as e:
        logger.error("Moderator synthesis failed: %s", e)
        synthesis = "Barcha professorlar o'z fikrlarini bildirdi."
        result["steps"]["synthesis_round1"] = synthesis

    # -----------------------------------------------------------------------
    # STEP 4: Debate round (parallel)
    # -----------------------------------------------------------------------
    logger.info("[Consilium] Step 4: Debate round")
    debate_responses: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(
                _professor_debate, prof, patient_text, initial_opinions, synthesis, language_hint
            ): prof
            for prof in PROFESSORS
        }
        for future in concurrent.futures.as_completed(futures):
            prof = futures[future]
            try:
                debate = future.result(timeout=60)
                debate_responses.append(debate)
                logger.info("[Consilium] %s debate done", prof["name"])
            except Exception as e:
                logger.error("Professor %s debate failed: %s", prof["name"], e)
                debate_responses.append({
                    "professor_id": prof["id"],
                    "professor_name": prof["name"],
                    "critique": "",
                    "defense": str(e),
                    "revised_diagnosis": "",
                })

    debate_responses.sort(key=lambda x: order.get(x.get("professor_id", ""), 99))
    result["steps"]["debate_responses"] = debate_responses

    # -----------------------------------------------------------------------
    # STEP 5: Final consensus
    # -----------------------------------------------------------------------
    logger.info("[Consilium] Step 5: Final consensus")
    try:
        consensus = _final_consensus(patient_text, initial_opinions, debate_responses, language_hint)
        result["steps"]["consensus"] = consensus
    except Exception as e:
        logger.error("Final consensus failed: %s", e)
        consensus = {"error": str(e), "consensus_diagnosis": {"name": "Xatolik", "probability": 0}}
        result["steps"]["consensus"] = consensus

    # -----------------------------------------------------------------------
    # STEP 6: Pharmacology review
    # -----------------------------------------------------------------------
    logger.info("[Consilium] Step 6: Pharmacology review")
    try:
        pharma = _pharmacology_review(patient_text, consensus, language_hint)
        result["steps"]["pharmacology_review"] = pharma
        # Merge validated medications back into consensus
        if isinstance(pharma, dict) and pharma.get("validated_medications"):
            consensus["medications"] = pharma["validated_medications"]
            consensus["pharmacology_warnings"] = pharma.get("warnings", [])
            consensus["drug_interactions"] = pharma.get("interactions_found", [])
    except Exception as e:
        logger.error("Pharmacology review failed: %s", e)
        result["steps"]["pharmacology_review"] = {"error": str(e)}

    # -----------------------------------------------------------------------
    # Build final report
    # -----------------------------------------------------------------------
    final_report = _build_final_report(consensus, initial_opinions, debate_responses)
    result["final_report"] = final_report
    result["completed_at"] = timezone.now().isoformat()

    logger.info("[Consilium] Completed: %s", result["session_id"])
    return result


def _build_final_report(
    consensus: dict,
    initial_opinions: list[dict],
    debate_responses: list[dict],
) -> dict:
    """Build standardised final report from consilium data."""
    cd = consensus.get("consensus_diagnosis") or {}
    meds_raw = consensus.get("medications") or []

    # Build medication list
    medications = []
    for m in meds_raw:
        if not isinstance(m, dict):
            continue
        medications.append({
            "name": str(m.get("name") or ""),
            "dosage": str(m.get("dosage") or ""),
            "frequency": str(m.get("frequency") or ""),
            "duration": str(m.get("duration") or ""),
            "timing": str(m.get("timing") or ""),
            "instructions": str(m.get("instructions") or ""),
            "notes": str(m.get("notes") or ""),
            "localAvailability": str(m.get("local_availability") or "O'zbekistonda mavjud"),
            "priceEstimate": "",
        })

    # Build debate history for frontend consumption
    debate_history = []
    for prof in PROFESSORS:
        initial = next((o for o in initial_opinions if o["professor_id"] == prof["id"]), {})
        debate = next((d for d in debate_responses if d["professor_id"] == prof["id"]), {})
        if initial.get("primary_diagnosis"):
            debate_history.append({
                "id": f"{prof['id']}-initial",
                "author": prof["name"],
                "authorTitle": prof["title"],
                "content": (
                    f"**Dastlabki tashxis:** {initial.get('primary_diagnosis', '')}\n"
                    f"**Ehtimollik:** {initial.get('probability', '')}%\n"
                    f"**Asoslash:** {initial.get('reasoning', '')}\n"
                    f"**Qizil bayroqlar:** {', '.join(initial.get('red_flags', []))}"
                ),
                "round": "initial",
            })
        if debate.get("critique") or debate.get("defense"):
            debate_history.append({
                "id": f"{prof['id']}-debate",
                "author": prof["name"],
                "authorTitle": prof["title"],
                "content": (
                    f"**Tanqid:** {debate.get('critique', '')}\n"
                    f"**Himoya:** {debate.get('defense', '')}\n"
                    f"**Yangilangan tashxis:** {debate.get('revised_diagnosis', '')}"
                ),
                "round": "debate",
            })

    critical = consensus.get("critical_finding")
    if isinstance(critical, dict) and not critical.get("finding"):
        critical = None

    return {
        "consensusDiagnosis": [
            {
                "name": str(cd.get("name") or "Tashxis aniqlanmadi"),
                "probability": int(cd.get("probability") or 70),
                "justification": str(cd.get("justification") or ""),
                "evidenceLevel": str(cd.get("evidenceLevel") or "Moderate"),
                "reasoningChain": cd.get("reasoningChain") or [],
                "uzbekProtocolMatch": str(cd.get("uzbekProtocolMatch") or "SSV protokollariga muvofiq"),
            }
        ] + [
            {
                "name": str(d.get("name") or ""),
                "probability": int(d.get("probability") or 30),
                "justification": str(d.get("reason") or ""),
                "evidenceLevel": "Moderate",
                "reasoningChain": [],
                "uzbekProtocolMatch": "",
            }
            for d in (consensus.get("differential_diagnoses") or [])[:4]
        ],
        "rejectedHypotheses": [
            {"name": str(r.get("name") or ""), "reason": str(r.get("reason") or "")}
            for r in (consensus.get("rejected_hypotheses") or [])
        ],
        "treatmentPlan": consensus.get("treatment_plan") or [],
        "medicationRecommendations": medications,
        "recommendedTests": consensus.get("recommended_tests") or [],
        "unexpectedFindings": consensus.get("professor_agreement_summary") or "",
        "uzbekistanLegislativeNote": consensus.get("uzbekistan_note") or (
            "O'zbekiston Respublikasi sog'liqni saqlash qonunchiligi va "
            "SSV tasdiqlangan klinik protokollariga muvofiq"
        ),
        "criticalFinding": critical,
        "debateHistory": debate_history,
        "professorSummary": [
            {
                "name": p["name"],
                "title": p["title"],
                "initialDiagnosis": next(
                    (o.get("primary_diagnosis") for o in initial_opinions
                     if o["professor_id"] == p["id"]), ""
                ),
                "finalDiagnosis": next(
                    (d.get("revised_diagnosis") or "" for d in debate_responses
                     if d["professor_id"] == p["id"]), ""
                ),
            }
            for p in PROFESSORS
        ],
        "pharmacologyWarnings": consensus.get("pharmacology_warnings") or [],
        "drugInteractions": consensus.get("drug_interactions") or [],
        "dissentingOpinions": consensus.get("dissenting_opinions") or [],
        "followUpPlan": consensus.get("follow_up_plan") or "",
        "generatedBy": "Farg'ona jamoat salomatligi tibbiyot instituti (FJSTI) — Multi-Agent Konsilium",
    }