"""
Multi-Agent Medical Consilium System   -   Production-Ready v3
=============================================================

5 ta Azure deployment:
  FJSTI-gpt4o         ->  Orchestrator / Rais (GPT-4o)
  FJSTI-deepseek   ->  Mantiqiy Tahlilchi  (DeepSeek-R1)
  FJSTI-llama      ->  Faktik Bazasi       (Llama-3.3-70B)
  FJSTI-mistral       ->  SSV Protokollar     (Mistral-Large)
  FJSTI-mini       ->  Farmakolog          (GPT-4o-mini)

3-fazali debate (Orchestrator boshqaruvi ostida):

  PHASE 1  -  Independent Analysis
      4 ta agent PARALLEL, bir-birini BILMAY mustaqil tashxis chiqaradi.
      Timeout: 90s/agent. Failure-safe: xato bo'lsa partial natija saqlanadi.

  PHASE 2  -  Cross-Examination + Refutation
      Har bir agent BOSHQALARNING tashxisini o'qiydi.
      Majburiy: xato topsa REFUTATION (ilmiy inkor) yozadi.
      Majburiy: o'z pozitsiyasini yangi dalil bilan HIMOYA qiladi.
      Orchestrator har bir refutation'ni BAHOLAYDI (kuchli/zaif).

  PHASE 3  -  Weighted Consensus
      Orchestrator har bir agentga refutation kuchiga qarab WEIGHT beradi.
      Eng kuchli dalillar asosida YAKUNIY Farg'ona JSTI Konsilium Xulosasi.

Xavfsizlik:
  - PhysiologyFilter views.py da OLDIN chaqiriladi.
  - Har bir agent javobi max_tokens bilan cheklangan.
  - Timeout'da partial natija qaytariladi (not crash).
"""

from __future__ import annotations

import concurrent.futures
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from django.utils import timezone

from .azure_utils import (
    call_model,
    build_messages,
    parse_json,
    patient_text,
    Deployments,
)
from .debate_format import (
    CLINICAL_OUTPUT_RULES,
    DENSE_JSON_HINT,
    DEBATE_INTENSITY_RULES,
    P1_DENSITY_RULES,
    ANTI_REPETITION_RULES,
    SPECIALIST_THINKING_MANDATE,
    AGENT_SPECIALTY_FOCUS,
    debate_author_fields,
    format_p1_debate_content,
    format_p2_debate_content,
    format_specialist_roster,
    agent_specialty_label as _specialty_from_agent_obj,
)
from .consilium_cost import (
    compact_phase1,
    compact_phase2,
    dumps_compact,
    phase1_max_tokens,
    phase2_max_tokens,
    phase3_max_tokens,
    pharma_max_tokens,
    phase_timeout_sec,
    skip_phase2_debate,
    consilium_agent_limit,
)
from .clinical_context import build_clinical_context
from .report_fields import (
    extended_consensus_json_instructions,
    merge_enriched_report_fields,
    enrich_medications_from_consensus,
    normalize_nutrition_extended,
)

logger = logging.getLogger(__name__)

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Agent Registry
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@dataclass(frozen=True)
class Agent:
    id:         str
    name:       str
    title:      str
    specialty:  str
    deployment: str
    persona:    str
    weight:     float = 1.0   # initial weight; updated after refutation scoring


AGENTS: list[Agent] = [
    Agent(
        id="deepseek",
        name="Prof. Dilshod Yusupov",
        title="Nevrolog & Klinik Mantiq Mutaxassisi",
        specialty="Nevrologiya, Differensial Diagnostika, Chain-of-Thought Reasoning",
        deployment=Deployments.deepseek(),
        persona=(
            "Siz chuqur mantiqiy tahlil va differensial diagnostika mutaxassisi siz. "
            "Har bir gipotezani 5-6 qadamli reasoning zanjiri orqali tekshirasiz. "
            "Boshqalarning mantiqiy zaifliklarini bemor fakti bilan ANIQ ko'rsatasiz. "
            "Umumiy gap yozmaysiz — har band amaliy klinik qiymat bersin."
        ),
    ),
    Agent(
        id="llama",
        name="Prof. Nodira Karimova",
        title="Onkolog & Tibbiy Ensiklopedist",
        specialty="Onkologiya, Evidence-Based Medicine, Tibbiy Adabiyot",
        deployment=Deployments.llama(),
        persona=(
            "Siz zamonaviy tibbiy adabiyot, meta-tahlillar va xalqaro klinik tadqiqotlar "
            "bo'yicha tibbiy ensiklopediyasiz. "
            "Har bir tavsiyangiz dalil darajasi (Level A/B/C) bilan tasdiqlangan. "
            "O'zbekiston SSV protokollari va WHO ko'rsatmalarini yaxshi bilasiz."
        ),
    ),
    Agent(
        id="mistral",
        name="Prof. Bahrom Nazarov",
        title="Gastroenterolog & Klinik Standartlar Eksperti",
        specialty="Gastroenterologiya, SSV Milliy Protokollar, Klinik Standartlar",
        deployment=Deployments.mistral(),
        persona=(
            "Siz O'zbekiston SSV milliy klinik protokollar va xalqaro davolash standartlari "
            "bo'yicha qat'iy mutaxassisisiz. "
            "Har qanday tavsiya protokollarga to'liq muvofiqligini ta'minlaysiz. "
            "Protokoldan og'ish bo'lsa, ilmiy asoslash talab qilasiz."
        ),
    ),
    Agent(
        id="mini",
        name="Prof. Sarvinoz Mirzayeva",
        title="Farmakolog & Klinik Toksikolog",
        specialty="Farmakologiya, Toksikologiya, Dori-Dori O'zaro Ta'sirlari",
        deployment=Deployments.mini(),
        persona=(
            "Siz farmakologiya mutaxassisi siz: dori dozalari, farmakokinetika, "
            "o'zaro ta'sirlar (DDI), nojo'ya ta'sirlar va faqat O'zbekistonda ro'yxatdan "
            "o'tgan preparatlar  -  sizning sohangiz. "
            "Xavfli dori kombinatsiyalarini darhol ko'rsatasiz."
        ),
    ),
]

ORCHESTRATOR = Agent(
    id="gpt4o",
    name="Prof. Alisher Toshmatov",
    title="Kardiolog & Tibbiy Kengash Raisi",
    specialty="Kardiologiya, Umumiy Terapiya, Klinik Qarorlar",
    deployment=Deployments.gpt4o(),
    persona=(
        "Siz tibbiy kengash raisi siz. Vazifangiz: barcha agentlarning "
        "tashxis va refutation'larini BAHOLAB, eng kuchli dalillar asosida "
        "YAKUNIY konsensus qaror qabul qilish. Tarafkashlik yo'q  -  faqat ilm."
    ),
)

_AGENT_ID_MAP: dict[str, Agent] = {a.id: a for a in AGENTS}
_AGENT_ID_MAP[ORCHESTRATOR.id] = ORCHESTRATOR

# Joriy konsilium uchun faol agentlar (run_consilium boshida o'rnatiladi)
_active_consilium_agents: list[Agent] = list(AGENTS)

# Konsilium professor idlari (multi_agent_consilium bilan mos)
_PROF_ID_ALIASES: dict[str, str] = {
    "chair": ORCHESTRATOR.id,
    "reasoning": "deepseek",
    "encyclopedist": "llama",
    "standards": "mistral",
    "pharmacologist": "mini",
}


def _agent_specialty_label(agent_id: str) -> str:
    """Foydalanuvchiga ko'rinadigan mutaxassislik (ism yoki texnik id emas)."""
    raw = str(agent_id or "").strip()
    if not raw:
        return "Hamkasb mutaxassis"
    resolved = _PROF_ID_ALIASES.get(raw, raw)
    agent = _AGENT_ID_MAP.get(resolved)
    return _specialty_from_agent_obj(agent, resolved)


def _active_agents() -> list[Agent]:
    """Joriy konsilium uchun tanlangan professor agentlari."""
    return list(_active_consilium_agents)


def _configure_consilium_agents(extra: Optional[dict] = None) -> list[Agent]:
    """Bemor va tanlangan mutaxassislarga mos agentlar."""
    global _active_consilium_agents
    from .specialist_routing import agent_ids_for_specialists

    extra = extra or {}
    patient_data = extra.get("patient_data") or {}
    selected = extra.get("selected_specialists") or []
    ddx = extra.get("differential_diagnoses") or []

    agent_ids = agent_ids_for_specialists(selected, patient_data, ddx)
    limit = consilium_agent_limit()
    picked: list[Agent] = []
    for aid in agent_ids:
        agent = _AGENT_ID_MAP.get(aid)
        if agent and agent.id != ORCHESTRATOR.id and agent not in picked:
            picked.append(agent)
        if len(picked) >= limit:
            break

    if len(picked) < 2:
        picked = list(AGENTS)[:limit]

    _active_consilium_agents = picked
    logger.info("Consilium agents: %s", [a.id for a in picked])
    return picked


_LANG_HINT: dict[str, str] = {
    "uz-L": "O'zbek (Lotin)",
    "uz-C": "O'zbek (Kirill)",
    "ru": "Rus",
    "en": "Ingliz",
    "kaa": "Qoraqalpoq",
}


_OPENING_SYSTEM = """\
{persona}

Siz tibbiy kengash raisi siz. Konsiliumni RASMIY OCHING.

VAZIFA:
1. Kengashni qisqa rasmiy oching (1 jumla).
2. Bemor haqida TO'LIQ klinik ma'lumot bering: yosh, jins, shikoyatlar, anamnez, vitallar, laboratoriya, tasvir — mavjud barcha faktlar.
3. Har bir mutaxassisni ixtisosligi bilan konsiliumga CHORLANG va nima baholashini aniq so'rang.
4. Oxirida: har bir mutaxassis mustaqil tashxis va o'z ixtisoslik burchagidan fakt bildirishi kerakligini ayting.

QOIDALAR:
- Oddiy matn, markdown yo'q.
- Ma'lumotni qisqartirmang — to'liq taqdim eting.
- Bu yagona joy — bemor holati shu yerda to'liq; mutaxassislar keyin takrorlamasin.

""" + CLINICAL_OUTPUT_RULES

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Result container
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@dataclass
class ConsiliumResult:
    session_id:   str
    started_at:   str
    language:     str
    professors:   list[dict] = field(default_factory=list)
    phases:       dict       = field(default_factory=dict)
    final_report: dict       = field(default_factory=dict)
    completed_at: str        = ""
    duration_sec: float      = 0.0

    def to_dict(self) -> dict:
        return {
            "session_id":   self.session_id,
            "started_at":   self.started_at,
            "language":     self.language,
            "professors":   self.professors,
            "phases":       self.phases,
            "final_report": self.final_report,
            "completed_at": self.completed_at,
            "duration_sec": round(self.duration_sec, 1),
        }


def run_orchestrator_opening(patient_str: str, language: str = "uz-L") -> dict:
    """Rais konsiliumni ochadi — scale rejimida shablon (tez), aks holda AI."""
    from .consilium_cost import ai_cost_mode

    lang = _LANG_HINT.get(language, _LANG_HINT["uz-L"])
    roster = format_specialist_roster(_active_agents())
    t0 = time.monotonic()

    if ai_cost_mode() in ("scale", "economy"):
        content = (
            "▸ KONSILIUM OCHILDI\n"
            f"{patient_str[:1200]}\n\n"
            f"▸ CHORLANGAN MUTAXASSISLAR\n{roster}\n\n"
            "Har bir mutaxassis o'z ixtisosligi bo'yicha mustaqil tashxis va dalil bildirsin."
        )
        return {
            "content": content,
            "elapsed_ms": round((time.monotonic() - t0) * 1000),
        }

    system = _OPENING_SYSTEM.format(persona=ORCHESTRATOR.persona)
    user = (
        f"BEMOR MA'LUMOTLARI:\n{patient_str}\n\n"
        f"KONSILIUMGA CHORLANGAN MUTAXASSISLAR:\n{roster}\n\n"
        f"Til: {lang}.\n"
        "Konsiliumni oching, bemor holatini to'liq taqdim eting va yuqoridagi mutaxassislarni "
        "mustaqil fikr bildirishga chorlang."
    )
    t0 = time.monotonic()
    try:
        content = call_model(
            ORCHESTRATOR.deployment,
            build_messages(system, user, want_json=False),
            response_json=False,
            temperature=0.2,
            max_tokens=900,
        )
        content = str(content or "").strip()
    except Exception as exc:
        logger.error("Orchestrator opening failed: %s", exc)
        content = (
            "▸ KONSILIUM OCHILDI\n"
            f"{patient_str}\n\n"
            f"▸ CHORLANGAN MUTAXASSISLAR\n{roster}\n\n"
            "Har bir mutaxassis o'z ixtisosligi bo'yicha mustaqil tashxis va dalil bildirsin."
        )
    return {
        "content": content,
        "elapsed_ms": round((time.monotonic() - t0) * 1000),
    }


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# PHASE 1  -  Independent Analysis
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_P1_SYSTEM = """\
{persona}

MUSTAQIL TAHLIL QOIDALARI:
1. BOSHQA HECH BIR mutaxassisning fikrini bilmaysiz  -  faqat o'z klinik bilimlaring.
2. O'zbekiston SSV milliy klinik protokollariga rioya qiling.
3. Faqat O'zbekistonda rasmiy ro'yxatdan o'tgan dori-darmonlarni tavsiya qiling.
4. Har bir xulosa uchun reasoning_chain majburiy — har band ALOHIDA qadam, strelka YO'Q.
5. supporting_evidence: aniq klinik FAKTLAR (vital, lab, anamnez) + manba URL.
6. EHTIMOLLIK: Kuchli dalillar = 90-97%, o'rtacha = 85-89%, zaif = 70-84%.
7. FAQAT JSON formatida javob qaytaring.
8. Shikoyatdan tashqari ob'ektiv, lab va tasvir tahlilini majburiy hisobga oling.
9. Faqat O'Z ixtisosligingiz burchagidan yozing — boshqalar yoki rais fikrini bilmaysiz va takrorlamaysiz.

{specialty_focus}

""" + CLINICAL_OUTPUT_RULES + "\n" + P1_DENSITY_RULES + "\n" + SPECIALIST_THINKING_MANDATE + "\n" + ANTI_REPETITION_RULES + "\n" + DENSE_JSON_HINT

_P1_USER = """\
BEMOR MA'LUMOTLARI:
{patient}

Quyidagi JSON SXEMASI bo'yicha MUSTAQIL tashxisingizni bildiring.
MAJBURIY: Yuqoridagi bemor ma'lumotlaridan ANIQ faktlar ishlating — namuna matnni ko'chirmang.
{{
  "primary_diagnosis": "<sizning ixtisosligingizdan asosiy tashxis>",
  "probability": <55-97>,
  "reasoning_chain": ["<bemor faktidan 1-qadam + manba URL>", "..."],
  "supporting_evidence": ["<vital/lab/anamnez raqami>", "..."],
  "red_flags": ["<shoshilinch belgi + manba>"],
  "differential": [{{"name": "<alt tashxis>", "probability": <3-40>, "reason": "<fakt>"}}],
  "recommended_tests": ["<sizning ixtisosligingizdan tekshiruv + sabab>"],
  "initial_treatment_notes": "<qisqa tavsiya + manba>",
  "confidence": "HIGH|MEDIUM|LOW",
  "evidence_level": "A|B|C"
}}"""


def _specialty_focus(agent_id: str) -> str:
    return AGENT_SPECIALTY_FOCUS.get(agent_id, AGENT_SPECIALTY_FOCUS.get("deepseek", ""))


def _phase1_single(agent: Agent, patient_str: str) -> dict:
    system = _P1_SYSTEM.format(persona=agent.persona, specialty_focus=_specialty_focus(agent.id))
    user   = _P1_USER.format(patient=patient_str)
    t0 = time.monotonic()
    try:
        raw    = call_model(agent.deployment,
                            build_messages(system, user, want_json=True),
                            response_json=True, temperature=0.4, max_tokens=phase1_max_tokens())
        result = parse_json(raw, f"p1_{agent.id}")
        result = result if isinstance(result, dict) else {}
    except Exception as exc:
        logger.error("Phase1[%s] failed: %s", agent.id, exc)
        result = {"error": str(exc), "primary_diagnosis": "Tahlil muvaffaqiyatsiz"}
    result.update({
        "agent_id":    agent.id,
        "agent_name":  agent.name,
        "agent_title": agent.title,
        "elapsed_ms":  round((time.monotonic() - t0) * 1000),
    })
    return result


def run_phase1(patient_str: str) -> list[dict]:
    """Mustaqil tahlil — faol agentlar parallel."""
    agents = _active_agents()
    order = {a.id: i for i, a in enumerate(agents)}
    timeout = phase_timeout_sec()
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(agents)) as pool:
        futures = {pool.submit(_phase1_single, a, patient_str): a for a in agents}
        results = []
        for fut in concurrent.futures.as_completed(futures):
            agent = futures[fut]
            try:
                results.append(fut.result(timeout=timeout))
            except Exception as exc:
                logger.error("Phase1 timeout[%s]: %s", agent.id, exc)
                results.append({
                    "agent_id": agent.id, "agent_name": agent.name,
                    "primary_diagnosis": "Timeout", "error": str(exc),
                })
    results.sort(key=lambda x: order.get(x.get("agent_id", ""), 99))
    return results


def _synthesize_phase2_from_phase1(p1: list[dict]) -> list[dict]:
    """Phase 2 o'tkazib yuborilganda — P1 dan yengil sintez."""
    out: list[dict] = []
    for row in p1:
        if not isinstance(row, dict):
            continue
        rc = row.get("reasoning_chain") or []
        key_arg = rc[0] if isinstance(rc, list) and rc else ""
        out.append({
            "agent_id": row.get("agent_id"),
            "agent_name": row.get("agent_name"),
            "revised_diagnosis": row.get("primary_diagnosis"),
            "revised_probability": row.get("probability"),
            "refutations": [],
            "defense": {"my_diagnosis_stands": True, "argument": "", "new_evidence": ""},
            "accepted_from_others": [],
            "key_argument": key_arg,
            "skipped_debate": True,
        })
    return out


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# PHASE 2  -  Cross-Examination + Refutation
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_P2_SYSTEM = """\
{persona}

DEBATE VA REFUTATION QOIDALARI:
1. Boshqa mutaxassislarning tashxisini DIQQAT BILAN o'qing — ularga ISM bilan emas, mutaxassislik bilan murojaat qiling.
2. REFUTATION: Noto'g'ri yoki zaif joyni ANIQ faktlar va manba URL bilan inkor qiling.
3. HIMOYA: O'z tashxisingizni yangilangan dalillar bilan qo'llab-quvvatlang.
4. Kuchli dalil bo'lsa, pozitsiyangizni yangilang — ilmiy halollik.
5. refutation matnida shaxsiy ism, AI nomi yoki ichki agent_id KO'RSATILMASIN.
6. FAQAT JSON formatida javob qaytaring.
7. Boshqa mutaxassis gapini so'zma-so'z takrorlamang — faqat o'z ixtisosligingizdan refutation/himoya.

{specialty_focus}

""" + CLINICAL_OUTPUT_RULES + "\n" + DEBATE_INTENSITY_RULES + "\n" + SPECIALIST_THINKING_MANDATE + "\n" + ANTI_REPETITION_RULES + "\n" + DENSE_JSON_HINT

_P2_USER = """\
BEMOR:
{patient}

BOSHQA MUTAXASSISLAR MUSTAQIL TASHXISLARI (agent_id faqat ichki — matnda ishlatmang):
{others_json}

SIZNING DASTLABKI TASHXISINGIZ:
{own_json}

Debate javobingizni JSON SXEMASI bo'yicha yozing. Boshqalarning jumlasini ko'chirmang — faqat yangi fakt.
{{
  "refutations": [{{"target_agent_id": "<id>", "target_diagnosis": "<ular tashxisi>", "refutation": "<sizning ixtisosligingizdan fakt>", "strength": "STRONG|MODERATE|WEAK"}}],
  "defense": {{"my_diagnosis_stands": true, "argument": "<himoya>", "new_evidence": "<yangi fakt>"}},
  "revised_diagnosis": "<yangilangan yoki o'zgarmagan tashxis>",
  "revised_probability": <55-97>,
  "accepted_from_others": [{{"agent_id": "<id>", "point": "<qaysi aniq fakt qabul qilindi>"}}],
  "endorsements": ["<qo'llab-quvvatlash — faqat aniq fakt>"],
  "key_argument": "<sizning eng kuchli dalilingiz + manba URL>"
}}"""


def _phase2_single(agent: Agent, patient_str: str,
                   own: dict, others: list[dict]) -> dict:
    others_text = dumps_compact([
        {
            "agent_id": o.get("agent_id"),
            "specialty": _agent_specialty_label(str(o.get("agent_id", ""))),
            "diagnosis": (o.get("primary_diagnosis") or "")[:320],
            "probability": o.get("probability"),
            "reasoning": (o.get("reasoning_chain") or [])[:6],
            "evidence": (o.get("supporting_evidence") or [])[:6],
            "differential": (o.get("differential") or [])[:4],
            "red_flags": (o.get("red_flags") or [])[:4],
            "recommended_tests": (o.get("recommended_tests") or [])[:4],
            "treatment_notes": (o.get("initial_treatment_notes") or "")[:400],
        }
        for o in others
    ])
    own_text = dumps_compact({
        "diagnosis": own.get("primary_diagnosis"),
        "probability": own.get("probability"),
        "reasoning": (own.get("reasoning_chain") or [])[:6],
        "evidence": (own.get("supporting_evidence") or [])[:6],
        "differential": (own.get("differential") or [])[:4],
        "red_flags": (own.get("red_flags") or [])[:4],
        "recommended_tests": (own.get("recommended_tests") or [])[:4],
        "treatment_notes": (own.get("initial_treatment_notes") or "")[:400],
        "confidence": own.get("confidence"),
    })

    system = _P2_SYSTEM.format(persona=agent.persona, specialty_focus=_specialty_focus(agent.id))
    user   = _P2_USER.format(patient=patient_str,
                              others_json=others_text, own_json=own_text)
    t0 = time.monotonic()
    try:
        raw    = call_model(agent.deployment,
                            build_messages(system, user, want_json=True),
                            response_json=True, temperature=0.42, max_tokens=phase2_max_tokens())
        result = parse_json(raw, f"p2_{agent.id}")
        result = result if isinstance(result, dict) else {}
    except Exception as exc:
        logger.error("Phase2[%s] failed: %s", agent.id, exc)
        result = {"error": str(exc)}
    result.update({
        "agent_id":   agent.id,
        "agent_name": agent.name,
        "elapsed_ms": round((time.monotonic() - t0) * 1000),
    })
    return result


def run_phase2(patient_str: str, p1: list[dict]) -> list[dict]:
    """Bahslashuv — faol agentlar parallel (scale rejimida sintez)."""
    if skip_phase2_debate():
        logger.info("Phase 2 skipped (scale/economy) — synthesizing from Phase 1")
        return _synthesize_phase2_from_phase1(p1)

    agents = _active_agents()
    order      = {a.id: i for i, a in enumerate(agents)}
    id_to_p1   = {r.get("agent_id"): r for r in p1}
    timeout = phase_timeout_sec()
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(agents)) as pool:
        futures = {}
        for agent in agents:
            own    = id_to_p1.get(agent.id, {})
            others = [r for r in p1 if r.get("agent_id") != agent.id]
            futures[pool.submit(_phase2_single, agent, patient_str, own, others)] = agent
        results = []
        for fut in concurrent.futures.as_completed(futures):
            agent = futures[fut]
            try:
                results.append(fut.result(timeout=timeout))
            except Exception as exc:
                logger.error("Phase2 timeout[%s]: %s", agent.id, exc)
                results.append({"agent_id": agent.id, "error": str(exc)})
    results.sort(key=lambda x: order.get(x.get("agent_id", ""), 99))
    return results


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Refutation Scoring  (Orchestrator komponent)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def _score_refutations(p2: list[dict]) -> dict[str, float]:
    """
    Har bir agentga refutation kuchiga qarab WEIGHT hisoblash.
    STRONG refutation qilgan agent +0.3, WEAK в€’0.1 oladi.
    Kimning tashxisi ko'p inkor qilinsa, weight'i kamayadi.
    """
    weights: dict[str, float] = {a.id: 1.0 for a in _active_agents()}

    for resp in p2:
        agent_id   = resp.get("agent_id", "")
        refutations = resp.get("refutations") or []
        for ref in refutations:
            strength = str(ref.get("strength", "WEAK")).upper()
            target   = ref.get("target_agent_id", "")
            if strength == "STRONG":
                weights[agent_id] = weights.get(agent_id, 1.0) + 0.3
                weights[target]   = weights.get(target, 1.0)   - 0.2
            elif strength == "MODERATE":
                weights[agent_id] = weights.get(agent_id, 1.0) + 0.15
                weights[target]   = weights.get(target, 1.0)   - 0.1
            else:  # WEAK
                weights[agent_id] = weights.get(agent_id, 1.0) - 0.05

    # Clamp [0.3, 2.0]
    for aid in weights:
        weights[aid] = max(0.3, min(2.0, weights[aid]))

    logger.info("Refutation weights: %s", weights)
    return weights


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# PHASE 3  -  Weighted Consensus  (Orchestrator: GPT-4o)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

_P3_SYSTEM = """\
{persona}

KONSENSUS QAROR QOIDALARI:
1. Har bir agentga berilgan WEIGHT e'tiborga oling — kuchli dalil ustun.
2. Eng kuchli faktlar bilan qo'llab-quvvatlangan tashxisni tanlang.
3. O'zbekiston SSV protokollari ASOSIY yo'riqnoma; parallel ravishda xalqaro dalillar majburiy:
   PubMed, Cochrane, Lancet, NEJM, JAMA, BMJ, ESC/ADA/NICE/WHO guideline.
4. related_research: kamida 5 ta manba — kamida 2 ta xalqaro jurnal/qo'llanma, 1 ta SSV, 1 ta Cochrane/PubMed RCT.
5. Faqat O'zbekistonda ro'yxatdan o'tgan dorilar.
6. justification va reasoning_chain: har band alohida, manba URL bilan.
7. Shaxsiy ism yoki AI nomi ISHLATMANG — mutaxassislik yoki "konsilium" deb yozing.
8. FAQAT JSON formatida javob qaytaring.
9. nutrition_prevention MAJBURIY: dietary_guidelines 4-6 ta, prevention_measures 4-6 ta, individual_diet_by_diagnosis.
10. individual_diet_by_diagnosis — har bir asosiy tashxis uchun alohida parhez.
11. rejected_hypotheses: munozarada rad etilgan kamida 2 ta gipoteza + aniq sabab.
12. treatment_plan: MAJBURIY — kamida 3 ta aniq, ketma-ket amaliy qadam (bo'sh yoki umumiy ibora YO'Q).
13. debate_synthesis: kelishuvlar, hal qilingan bahslar va g'olib dalillar — har ro'yxatda kamida 2 ta aniq band.
14. agreement_summary: MAJBURIY 4–6 jumla — munozarada kim qaysi gipotezaga qarshi chiqdi, nima rad etildi, kutilmagan topilma.
15. unexpected_findings: agreement_summary bilan bir xil mazmun, lekin aniqroq — rad etilgan gipotezalar va bahs natijalari.
16. Bemor shikoyatini/anamnezni QAYTA AYTMAG — faqat munozara natijasi va yakuniy qaror.
17. Har bir mutaxassisning ENG KUCHLI dalilini alohida qayd eting — umumiy sintez yetarli emas.
18. consensus_diagnosis.justification: kamida 4 jumla, har biri aniq klinik fakt + manba.
19. debate_synthesis: key_agreements, key_disputes_resolved, winning_arguments — har biri kamida 3 ta band.
20. MKB-10 (ICD-10-CM, 10-reviziya): asosiy va har bir differensial tashxis uchun aniq kod (masalan I10, E11.9).
21. Tashxislar raqamlanadi: 1-asosiy, 2-5-differensial. Namuna kodlar (X00.0) ISHLATMANG.

""" + CLINICAL_OUTPUT_RULES + "\n" + SPECIALIST_THINKING_MANDATE + "\n" + ANTI_REPETITION_RULES + "\n" + DENSE_JSON_HINT

_P3_USER = """\
BEMOR:
{patient}

AGENTLAR REFUTATION OG'IRLIKLARI (weight):
{weights_json}

PHASE 1  -  Mustaqil tashxislar:
{phase1_json}

PHASE 2  -  Debate va refutation'lar:
{phase2_json}

Quyidagi JSON formatida YAKUNIY Farg'ona JSTI KONSILIUM XULOSASINI bering:
{{
  "consensus_diagnosis": {{
    "name": "Asosiy tashxis nomi (MKB-10 rasmiy termin)",
    "icd10": "I10",
    "icd10_description": "MKB-10 bo'yicha to'liq nom",
    "probability": 94,
    "justification": "Barcha dalillarni hisobga olgan xulosaning asosi ...",
    "evidence_level": "A",
    "reasoning_chain": ["Aniq fakt + (SSV protokoli, https://lex.uz/...)", "Keyingi fakt + (PubMed, https://pubmed.ncbi.nlm.nih.gov/...)"],
    "uzbek_protocol_match": "SSV buyrug'i/protokol nomi (https://lex.uz/...)"
  }},
  "differential_diagnoses": [
    {{"name": "2-tashxis (MKB-10 termin)", "icd10": "E11.9", "probability": 6, "reason": "Nega kam ehtimol"}}
  ],
  "rejected_hypotheses": [
    {{"name": "Rad etilgan tashxis", "reason": "Nevrolog mutaxassisi dalillari asosida rad etildi — faktlar"}}
  ],
  "treatment_plan": [
    "1-qadam: ...",
    "2-qadam: ..."
  ],
  "medications": [
    {{
      "name": "Savdo nomi (O'zbekiston)",
      "generic": "Generik nomi",
      "dosage": "...",
      "frequency": "...",
      "duration": "...",
      "timing": "Ovqatdan keyin/oldin",
      "instructions": "...",
      "contraindications": "...",
      "local_availability": "O'zbekistonda mavjud / Aptekada bor"
    }}
  ],
  "recommended_tests": ["Tekshiruv 1"],
  "critical_finding": {{
    "present": false,
    "finding": "",
    "implication": "",
    "urgency": "HIGH/MEDIUM/LOW"
  }},
  "uzbekistan_protocol_note": "O'zbekiston Respublikasi SSV buyrug'i No. XX ...",
  "agreement_level": "HIGH/MEDIUM/LOW",
  "agreement_summary": "Munozara natijasi: kim kimga qarshi chiqdi, qaysi dalil g'olib bo'ldi (4-6 jumla, aniq faktlar)",
  "unexpected_findings": "Kutilmagan topilmalar, rad etilgan gipotezalar va munozara xulosasi (batafsil matn)",
  "debate_synthesis": {{
    "summary": "Kengash raisi munozara xulosasi — 2-3 jumla",
    "key_agreements": ["Kelishilgan fakt 1", "Kelishilgan fakt 2"],
    "key_disputes_resolved": ["Bahs: ... Hal qilindi: ..."],
    "winning_arguments": ["Eng kuchli dalil + manba"]
  }},
  "dissenting_opinions": ["Farqli fikr + sabab (kamida 1 ta agar munozara bo'lgan bo'lsa)"],
  "follow_up_plan": "Kuzatuv rejasi ...",
  "folk_medicine": {{
    "intro": "Tanlangan dorivor o'simliklar konservativ davolashga qo'shimcha sifatida qo'llaniladi (WHO Traditional Medicine, https://pubmed.ncbi.nlm.nih.gov/?term=medicinal+plants+evidence)",
    "disclaimer": "Rasmiy dori va shifokor ko'rsatmasi o'rnini bosmaydi",
    "items": [
      {{
        "plant_name": "Matricaria chamomilla",
        "plant_part": "gul",
        "preparation_or_usage": "choy",
        "traditional_context": "yumshoq spazm va uyqu uchun (PubMed chamomile review, https://pubmed.ncbi.nlm.nih.gov/?term=chamomile+spasm)",
        "precautions": "allergiya, dori bilan ta'sir"
      }}
    ]
  }},
  "nutrition_prevention": {{
    "intro": "Tashxisga mos parhez va profilaktika choralari (WHO diet guidelines, https://pubmed.ncbi.nlm.nih.gov/?term=WHO+dietary+guidelines)",
    "dietary_guidelines": ["Tuz va qandni nazorat (WHO, https://pubmed.ncbi.nlm.nih.gov/?term=salt+sugar+intake+guideline)", "Kuniga yetarli suv"],
    "prevention_measures": ["Muntazam yengil harakat (SSV profilaktika, https://pubmed.ncbi.nlm.nih.gov/?term=physical+activity+prevention)", "Rejalashtirilgan tekshiruvlar"],
    "disclaimer": "Individual parhez uchun mutaxassis bilan maslahat"
  }},
  "protocol_compliance_gaps": [],
  "care_quality_audit": {{ "overall_score": 0, "summary": "", "errors": [], "strengths": [] }},
  "imaging_interpretation": {{ "ecg": null, "ultrasound": null, "xray": null, "ct": null, "mri": null, "general_correlation": "" }},
  "patient_routing": {{ "recommended_specialists": [], "exam_plan": [], "disposition": "outpatient", "disposition_reason": "", "follow_up_timeline": "", "hospitalization_indicated": false, "hospitalization_reason": "" }},
  "risk_factors": [],
  "severity_assessment": {{ "level": "moderate", "score": 5, "rationale": "", "red_flags": [] }},
  "adverse_event_risks": [],
  "related_research": [
    {{"title": "PubMed / Lancet / NEJM maqola yoki tizimli sharh", "url": "https://pubmed.ncbi.nlm.nih.gov/?term=...", "summary": "Qaysi tashxis/davolash uchun dalil"}},
    {{"title": "Cochrane Library", "url": "https://www.cochranelibrary.com/search?q=...", "summary": "Meta-tahlil yoki RCT xulosasi"}},
    {{"title": "ESC/WHO/NICE xalqaro guideline", "url": "https://pubmed.ncbi.nlm.nih.gov/?term=...", "summary": "Xalqaro protokol bandi"}},
    {{"title": "O'zbekiston SSV protokoli", "url": "https://pubmed.ncbi.nlm.nih.gov/?term=Uzbekistan+clinical+protocol+...", "summary": "Milliy protokol mosligi"}}
  ],
  "agent_weights_used": {{}}
}}"""


def run_phase3(patient_str: str, p1: list[dict],
               p2: list[dict], weights: dict[str, float]) -> dict:
    """Orchestrator  -  weighted consensus (Sonnet, qisqa kontekst)."""
    p1_text = dumps_compact(compact_phase1(p1))
    p2_text = dumps_compact(compact_phase2(p2))
    w_text  = dumps_compact(weights)

    system = _P3_SYSTEM.format(persona=ORCHESTRATOR.persona)
    user   = _P3_USER.format(patient=patient_str,
                              weights_json=w_text,
                              phase1_json=p1_text,
                              phase2_json=p2_text)
    user += extended_consensus_json_instructions()
    t0 = time.monotonic()
    try:
        raw    = call_model(ORCHESTRATOR.deployment,
                            build_messages(system, user, want_json=True),
                            response_json=True, temperature=0.12, max_tokens=phase3_max_tokens())
        result = parse_json(raw, "p3_consensus")
        result = result if isinstance(result, dict) else {}
        result["agent_weights_used"] = weights
    except Exception as exc:
        logger.error("Phase3 consensus failed: %s", exc)
        result = {"error": str(exc)}
    result["_elapsed_ms"] = round((time.monotonic() - t0) * 1000)
    return result


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Final report builder
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def _folk_medicine_from_consensus(consensus: dict) -> Optional[dict]:
    fm = consensus.get("folk_medicine") or consensus.get("folkMedicine")
    if not isinstance(fm, dict):
        return None
    items_raw = fm.get("items") or []
    items = []
    for it in items_raw:
        if not isinstance(it, dict):
            continue
        pn = str(it.get("plant_name") or it.get("plantName") or "").strip()
        if not pn:
            continue
        entry: dict[str, Any] = {"plantName": pn}
        pp = str(it.get("plant_part") or it.get("plantPart") or "").strip()
        if pp:
            entry["plantPart"] = pp
        pu = str(it.get("preparation_or_usage") or it.get("preparationOrUsage") or "").strip()
        if pu:
            entry["preparationOrUsage"] = pu
        tc = str(it.get("traditional_context") or it.get("traditionalContext") or "").strip()
        if tc:
            entry["traditionalContext"] = tc
        pr = str(it.get("precautions") or "").strip()
        if pr:
            entry["precautions"] = pr
        items.append(entry)
    intro = str(fm.get("intro") or "").strip()
    disclaimer = str(fm.get("disclaimer") or "").strip()
    if not items and not intro and not disclaimer:
        return None
    out: dict[str, Any] = {"items": items}
    if intro:
        out["intro"] = intro
    if disclaimer:
        out["disclaimer"] = disclaimer
    return out


def _nutrition_prevention_from_consensus(consensus: dict) -> Optional[dict]:
    np = consensus.get("nutrition_prevention") or consensus.get("nutritionPrevention")
    if not isinstance(np, dict):
        return None

    def _str_list(val: Any) -> list[str]:
        if not isinstance(val, list):
            return []
        out: list[str] = []
        for x in val:
            s = str(x).strip() if x is not None else ""
            if s:
                out.append(s)
        return out

    dietary = _str_list(np.get("dietary_guidelines") or np.get("dietaryGuidelines"))
    prevention = _str_list(np.get("prevention_measures") or np.get("preventionMeasures"))
    intro = str(np.get("intro") or "").strip()
    disclaimer = str(np.get("disclaimer") or "").strip()
    if not dietary and not prevention and not intro and not disclaimer:
        return None
    out: dict[str, Any] = {
        "dietaryGuidelines": dietary,
        "preventionMeasures": prevention,
    }
    if intro:
        out["intro"] = intro
    if disclaimer:
        out["disclaimer"] = disclaimer
    return out


def _chair_debate_entry(entry_id: str, phase: str, content: str) -> dict:
    chair_fields = debate_author_fields(ORCHESTRATOR)
    return {
        "id":          entry_id,
        "author":      chair_fields["author"],
        "authorTitle": chair_fields["authorTitle"],
        "phase":       phase,
        "weight":      1.0,
        "isChair":     True,
        "content":     content,
    }


def _build_final_report(consensus: dict, p1: list[dict],
                        p2: list[dict], weights: dict[str, float],
                        orchestrator_opening: str = "",
                        patient_data: Optional[dict] = None,
                        language: str = "uz-L") -> dict:
    cd   = consensus.get("consensus_diagnosis") or {}
    meds = enrich_medications_from_consensus(consensus.get("medications") or [])

    # Build debate timeline: rais ochadi → mutaxassislar → rais yopadi
    id_to_p2   = {r.get("agent_id"): r for r in p2}
    debate_log: list[dict] = []
    opening_text = str(orchestrator_opening or "").strip()
    if opening_text:
        debate_log.append(_chair_debate_entry("chair-opening", "opening", opening_text))

    for agent in AGENTS:
        p1r = next((r for r in p1 if r.get("agent_id") == agent.id), {})
        p2r = id_to_p2.get(agent.id, {})
        w   = round(weights.get(agent.id, 1.0), 2)

        author_fields = debate_author_fields(agent)
        if p1r.get("primary_diagnosis"):
            debate_log.append({
                "id":          f"{agent.id}-p1",
                "author":      author_fields["author"],
                "authorTitle": author_fields["authorTitle"],
                "phase":       "independent",
                "weight":      w,
                "content":     format_p1_debate_content(p1r),
            })

        reftns = p2r.get("refutations") or []
        defense_block = p2r.get("defense")
        has_defense = isinstance(defense_block, dict) and (
            defense_block.get("argument") or defense_block.get("new_evidence")
        )
        if reftns or has_defense or p2r.get("key_argument") or p2r.get("accepted_from_others"):
            p2_content = format_p2_debate_content(p2r, _agent_specialty_label)
            if p2_content:
                debate_log.append({
                    "id":          f"{agent.id}-p2",
                    "author":      author_fields["author"],
                    "authorTitle": author_fields["authorTitle"],
                    "phase":       "debate",
                    "weight":      w,
                    "content":     p2_content,
                })

    cf = consensus.get("critical_finding") or {}
    critical = cf if (isinstance(cf, dict) and cf.get("present")) else None

    folk_medicine = _folk_medicine_from_consensus(consensus)
    nutrition_prevention = normalize_nutrition_extended(
        consensus.get("nutrition_prevention") or consensus.get("nutritionPrevention")
    ) or _nutrition_prevention_from_consensus(consensus)

    from .prognosis_builder import build_prognosis_report
    prognosis_report = build_prognosis_report(consensus, patient_data, language)

    report = {
        "consensusDiagnosis": [
            {
                "name":               str(cd.get("name", "Tashxis aniqlanmadi")),
                "icd10":              str(cd.get("icd10", "")),
                "icd10Description":   str(cd.get("icd10_description") or cd.get("icd10Description") or ""),
                "diagnosisRank":      1,
                "probability":        int(cd.get("probability") or 70),
                "justification":      str(cd.get("justification", "")),
                "evidenceLevel":      str(cd.get("evidence_level") or "Moderate"),
                "reasoningChain":     cd.get("reasoning_chain") or [],
                "uzbekProtocolMatch": str(cd.get("uzbek_protocol_match", "")),
            }
        ] + [
            {
                "name":               str(d.get("name", "")),
                "icd10":              str(d.get("icd10", "")),
                "icd10Description":   str(d.get("icd10_description") or d.get("icd10Description") or ""),
                "diagnosisRank":      idx + 2,
                "probability":        int(d.get("probability") or 25),
                "justification":      str(d.get("reason", "")),
                "evidenceLevel":      "Moderate",
                "reasoningChain":     [],
                "uzbekProtocolMatch": "",
            }
            for idx, d in enumerate((consensus.get("differential_diagnoses") or [])[:4])
        ],
        "rejectedHypotheses": [
            {"name": nm, "reason": rs}
            for r in (consensus.get("rejected_hypotheses") or [])
            if isinstance(r, dict)
            for nm, rs in [(
                str(r.get("name", "")).strip(),
                str(r.get("reason", "")).strip(),
            )]
            if nm and nm.lower() not in ("aniqlanmadi", "tashxis aniqlanmadi", "noma'lum", "unknown")
        ],
        "treatmentPlan":             consensus.get("treatment_plan") or [],
        "medicationRecommendations": meds,
        "recommendedTests":          consensus.get("recommended_tests") or [],
        "unexpectedFindings":        (
            consensus.get("unexpected_findings")
            or consensus.get("unexpectedFindings")
            or consensus.get("agreement_summary")
            or ""
        ),
        "uzbekistanLegislativeNote": consensus.get("uzbekistan_protocol_note") or
                                     "O'zbekiston Respublikasi SSV protokollariga muvofiq",
        "criticalFinding":           critical,
        "debateHistory":             debate_log,
        "agentWeights":              weights,
        "agreementLevel":            consensus.get("agreement_level", "MEDIUM"),
        "dissenting_opinions":       consensus.get("dissenting_opinions") or [],
        "follow_up_plan":            consensus.get("follow_up_plan") or "",
        "professorSummary": [
            {
                "id":             a.id,
                "name":           a.name,
                "title":          a.title,
                "deployment":     a.deployment,
                "weight":         round(weights.get(a.id, 1.0), 2),
                "initialDiagnosis": next(
                    (r.get("primary_diagnosis", "") for r in p1 if r.get("agent_id") == a.id), ""
                ),
                "finalDiagnosis": next(
                    (r.get("revised_diagnosis", "") for r in p2 if r.get("agent_id") == a.id), ""
                ),
            }
            for a in AGENTS
        ],
        "generatedBy": "Farg'ona jamoat salomatligi tibbiyot instituti (FJSTI)  -  Multi-Agent Konsilium",
        "prognosisReport": prognosis_report,
        **({"folkMedicine": folk_medicine} if folk_medicine else {}),
        **({"nutritionPrevention": nutrition_prevention} if nutrition_prevention else {}),
    }
    merged = merge_enriched_report_fields(report, consensus)
    # Yakuniy hisobotda bo'sh maydonlarni kamaytirish
    from .consensus_repair import (
        build_unexpected_findings,
        ensure_treatment_plan,
        _is_generic_agreement,
        _is_usable_treatment_step,
        _plan_item_to_str,
        _s,
    )
    uf = merged.get("unexpectedFindings") or ""
    if not _s(uf) or _is_generic_agreement(_s(uf)):
        rebuilt = build_unexpected_findings(consensus, p1, p2, _s(cd.get("name")))
        if rebuilt:
            merged["unexpectedFindings"] = rebuilt
    elif not merged.get("unexpectedFindings") and consensus.get("agreement_summary"):
        merged["unexpectedFindings"] = str(consensus.get("agreement_summary"))[:4500]
    existing_plan = merged.get("treatmentPlan") or []
    usable_plan = [
        _plan_item_to_str(x) for x in existing_plan
        if _is_usable_treatment_step(_plan_item_to_str(x))
    ]
    if len(usable_plan) < 2:
        merged["treatmentPlan"] = ensure_treatment_plan(consensus, p1, p2, _s(cd.get("name")))
    elif usable_plan:
        merged["treatmentPlan"] = usable_plan[:8]
    if not merged.get("recommendedTests") and consensus.get("recommended_tests"):
        merged["recommendedTests"] = consensus.get("recommended_tests")
    comp = consensus.get("_clinical_completeness")
    if isinstance(comp, dict):
        merged["clinicalCompleteness"] = comp
    from .consensus_repair import ensure_nutrition_prevention
    if not merged.get("nutritionPrevention"):
        patched = ensure_nutrition_prevention(dict(consensus), language_hint=language)
        np = patched.get("nutrition_prevention") or patched.get("nutritionPrevention")
        if np:
            normalized = normalize_nutrition_extended(np)
            if normalized:
                merged["nutritionPrevention"] = normalized
    if not merged.get("relatedResearch"):
        from .evidence_sources import build_fast_research_sources
        merged["relatedResearch"] = build_fast_research_sources(_s(cd.get("name")), language)
    return merged


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Main entry point
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def _merge_imaging_into_consensus(consensus: dict, patient_data: dict) -> dict:
    """Vision natijasini imaging_interpretation ga qo'shadi."""
    structured = patient_data.get("imagingStructured") or patient_data.get("imaging_structured")
    if not isinstance(structured, dict) or not structured:
        return consensus
    imaging = consensus.get("imaging_interpretation") or consensus.get("imagingInterpretation")
    if not isinstance(imaging, dict):
        imaging = {}
    for key, block in structured.items():
        if key not in imaging or not imaging.get(key):
            imaging[key] = block
    consensus["imaging_interpretation"] = imaging
    return consensus


def _merge_protocol_audit(consensus: dict, patient_data: dict, completeness: dict) -> dict:
    from .protocol_audit import rule_protocol_gaps

    rule_gaps = rule_protocol_gaps(patient_data)
    ai_gaps = consensus.get("protocol_compliance_gaps") or consensus.get("protocolComplianceGaps") or []
    if not isinstance(ai_gaps, list):
        ai_gaps = []
    seen = {str(g.get("gap", "")).lower()[:40] for g in ai_gaps if isinstance(g, dict)}
    for g in rule_gaps:
        sig = str(g.get("gap", "")).lower()[:40]
        if sig and sig not in seen:
            ai_gaps.append(g)
            seen.add(sig)
    if ai_gaps:
        consensus["protocol_compliance_gaps"] = ai_gaps

    from .protocol_audit import merge_care_quality_audit, rule_care_quality_audit

    cd = consensus.get("consensus_diagnosis") or {}
    if isinstance(cd, list) and cd:
        first = cd[0]
        primary_dx = str(first.get("name", "") if isinstance(first, dict) else first).strip()
    elif isinstance(cd, dict):
        primary_dx = str(cd.get("name") or "").strip()
    else:
        primary_dx = ""

    audit = consensus.get("care_quality_audit") or consensus.get("careQualityAudit")
    rule_audit = rule_care_quality_audit(patient_data, completeness, primary_dx)
    consensus["care_quality_audit"] = merge_care_quality_audit(audit, rule_audit)
    return consensus


def run_consilium(
    patient_data: dict,
    language: str = "uz-L",
    extra: Optional[dict] = None,
) -> dict:
    """
    Full 3-phase Multi-Agent Medical Consilium.

    Returns ConsiliumResult.to_dict() with all phases and final_report.
    """
    from .imaging_analysis import merge_imaging_into_context
    from .clinical_red_flags import evaluate_red_flags
    from .clinical_completeness import score_clinical_completeness
    from .pharmacology_review import run_pharmacology_review

    patient_data = merge_imaging_into_context(dict(patient_data or {}), language)
    red_flags = evaluate_red_flags(patient_data)
    completeness = score_clinical_completeness(patient_data)

    t_start = time.monotonic()
    now     = timezone.now()

    ctx_extra = extra or {}
    ptext = build_clinical_context(patient_data, ctx_extra, language=language)

    agent_ctx = {
        **ctx_extra,
        "patient_data": patient_data,
        "selected_specialists": (
            ctx_extra.get("selected_specialists")
            or patient_data.get("selectedSpecialists")
            or patient_data.get("selected_specialists")
            or []
        ),
        "differential_diagnoses": ctx_extra.get("differential_diagnoses") or [],
    }
    active = _configure_consilium_agents(agent_ctx)

    result = ConsiliumResult(
        session_id  = f"consilium_{now.strftime('%Y%m%d_%H%M%S')}",
        started_at  = now.isoformat(),
        language    = language,
        professors  = [
            {"id": a.id, "name": a.name, "title": a.title, "specialty": a.specialty}
            for a in [ORCHESTRATOR] + active
        ],
    )

    # Orchestrator opening
    logger.info("[%s] Orchestrator: konsilium ochilmoqda", result.session_id)
    opening = run_orchestrator_opening(ptext, language)
    result.phases["orchestrator_opening"] = opening

    # Phase 1 — to'liq klinik kontekst
    logger.info("[%s] Phase 1: Independent analysis started (%d agents)", result.session_id, len(active))
    p1 = run_phase1(ptext)
    result.phases["phase1_independent"] = p1

    # Phase 2 — scale rejimida sintez, aks holda bahslashuv
    logger.info("[%s] Phase 2: Cross-examination started", result.session_id)
    p2 = run_phase2(ptext, p1)
    result.phases["phase2_debate"] = p2

    # Refutation scoring
    weights = _score_refutations(p2)
    result.phases["refutation_weights"] = weights

    # Phase 3 — to'liq kontekst + boyitilgan P1/P2
    logger.info("[%s] Phase 3: Weighted consensus started", result.session_id)
    consensus = run_phase3(ptext, p1, p2, weights)
    from .consensus_repair import ensure_consensus_from_phases
    consensus = ensure_consensus_from_phases(consensus, p1, p2, weights, language)
    consensus = _merge_imaging_into_consensus(consensus, patient_data)
    consensus = _merge_protocol_audit(consensus, patient_data, completeness)
    consensus["_clinical_completeness"] = completeness
    result.phases["phase3_consensus_raw"] = consensus

    # Pharmacology + DDI review
    pharma = run_pharmacology_review(patient_data, consensus, language, max_tokens=pharma_max_tokens())
    result.phases["pharmacology_review"] = pharma
    if pharma.get("warnings"):
        consensus["pharmacology_warnings"] = pharma.get("warnings")
    validated = pharma.get("validated_medications") or []
    if isinstance(validated, list) and validated:
        consensus["medications"] = validated
    elif not consensus.get("medications"):
        from .consensus_repair import ensure_medications
        primary = str((consensus.get("consensus_diagnosis") or {}).get("name") or "")
        consensus["medications"] = ensure_medications(consensus, p1, p2, primary)

    # Tashxis asosida klinik vositalar (ICD-10, qo'llanma, DDI, bemor tushuntirishi)
    from .diagnosis_enrichment import enrich_consensus_with_diagnosis_tools
    consensus = enrich_consensus_with_diagnosis_tools(consensus, patient_data, language)
    from .consensus_repair import ensure_nutrition_prevention, ensure_related_research
    consensus = ensure_nutrition_prevention(consensus, language_hint=language)
    consensus = ensure_related_research(consensus, language_hint=language)
    result.phases["diagnosis_enrichment"] = {
        "icd10": (consensus.get("consensus_diagnosis") or {}).get("icd10"),
        "has_family_explanation": bool(consensus.get("simplified_family_explanation")),
        "research_count": len(consensus.get("related_research") or []),
    }

    # Final report
    result.final_report = _build_final_report(
        consensus, p1, p2, weights,
        orchestrator_opening=str(opening.get("content") or ""),
        patient_data=patient_data,
        language=language,
    )
    if pharma.get("warnings"):
        result.final_report["pharmacologyWarnings"] = pharma.get("warnings")
    if red_flags:
        result.final_report["clinicalRedFlags"] = red_flags
        critical = [f for f in red_flags if f.get("severity") == "critical"]
        if critical and not result.final_report.get("criticalFinding"):
            result.final_report["criticalFinding"] = {
                "present": True,
                "finding": critical[0].get("message", ""),
                "action": critical[0].get("action", "103 chaqiring"),
            }
    result.completed_at = timezone.now().isoformat()
    result.duration_sec = time.monotonic() - t_start
    result.phases["clinical_red_flags"] = red_flags
    result.phases["clinical_completeness"] = completeness

    logger.info("[%s] Completed in %.1fs", result.session_id, result.duration_sec)
    out = result.to_dict()
    out["clinical_red_flags"] = red_flags
    out["clinical_completeness"] = completeness
    return out