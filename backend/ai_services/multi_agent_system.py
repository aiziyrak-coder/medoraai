"""
Multi-Agent Medical Consilium System  —  Production-Ready v3
=============================================================

5 ta Azure deployment:
  medora-gpt4o     → Orchestrator / Rais (GPT-4o)
  medora-deepseek  → Mantiqiy Tahlilchi  (DeepSeek-R1)
  medora-llama     → Faktik Bazasi       (Llama-3.3-70B)
  medora-mistral   → SSV Protokollar     (Mistral-Large)
  medora-mini      → Farmakolog          (GPT-4o-mini)

3-fazali debate (Orchestrator boshqaruvi ostida):

  PHASE 1 – Independent Analysis
      4 ta agent PARALLEL, bir-birini BILMAY mustaqil tashxis chiqaradi.
      Timeout: 90s/agent. Failure-safe: xato bo'lsa partial natija saqlanadi.

  PHASE 2 – Cross-Examination + Refutation
      Har bir agent BOSHQALARNING tashxisini o'qiydi.
      Majburiy: xato topsa REFUTATION (ilmiy inkor) yozadi.
      Majburiy: o'z pozitsiyasini yangi dalil bilan HIMOYA qiladi.
      Orchestrator har bir refutation'ni BAHOLAYDI (kuchli/zaif).

  PHASE 3 – Weighted Consensus
      Orchestrator har bir agentga refutation kuchiga qarab WEIGHT beradi.
      Eng kuchli dalillar asosida YAKUNIY Medora Konsilium Xulosasi.

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
from typing import Any

from django.utils import timezone

from .azure_utils import (
    call_model,
    build_messages,
    parse_json,
    patient_text,
    Deployments,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Agent Registry
# ─────────────────────────────────────────────────────────────────────────────

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
            "Har bir gipotezani step-by-step reasoning zanjiri (chain-of-thought) orqali "
            "tekshirasiz. Boshqalarning mantiqiy zaifliklarini ilmiy dalil bilan ANIQ ko'rsatish "
            "va o'z pozitsiyangizni mantiqiy HIMOYA QILISH – asosiy kuchingiz."
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
            "o'tgan preparatlar – sizning sohangiz. "
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
        "YAKUNIY konsensus qaror qabul qilish. Tarafkashlik yo'q – faqat ilm."
    ),
)

_AGENT_ID_MAP: dict[str, Agent] = {a.id: a for a in AGENTS}

# ─────────────────────────────────────────────────────────────────────────────
# Result container
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 – Independent Analysis
# ─────────────────────────────────────────────────────────────────────────────

_P1_SYSTEM = """\
{persona}

MUSTAQIL TAHLIL QOIDALARI:
1. BOSHQA HECH BIR mutaxassisning fikrini bilmaysiz – faqat o'z klinik bilimlaring.
2. O'zbekiston SSV (Sog'liqni Saqlash Vazirligi) milliy klinik protokollariga rioya qiling.
3. Faqat O'zbekistonda rasmiy ro'yxatdan o'tgan dori-darmonlarni tavsiya qiling.
4. Har bir xulosa uchun ilmiy asoslash (reasoning_chain) majburiy.
5. FAQAT JSON formatida javob qaytaring."""

_P1_USER = """\
BEMOR MA'LUMOTLARI:
{patient}

Quyidagi JSON formatida MUSTAQIL tashxisingizni bildiring:
{{
  "primary_diagnosis": "Aniq tashxis nomi (O'zbek tilida)",
  "probability": 80,
  "reasoning_chain": [
    "Belgi/simptom → klinik ahamiyati",
    "Lab/ob'ektiv → xulosasi",
    "Differensial → nega bu ehtimolroq"
  ],
  "supporting_evidence": ["Dalil 1", "Dalil 2"],
  "red_flags": ["Shoshilinch belgi (agar bo'lsa)"],
  "differential": [
    {{"name": "Alt tashxis", "probability": 20, "reason": "Nega kamroq"}}
  ],
  "recommended_tests": ["Tekshiruv 1"],
  "initial_treatment_notes": "Qisqa tavsiya",
  "confidence": "HIGH/MEDIUM/LOW",
  "evidence_level": "A/B/C"
}}"""


def _phase1_single(agent: Agent, patient_str: str) -> dict:
    system = _P1_SYSTEM.format(persona=agent.persona)
    user   = _P1_USER.format(patient=patient_str)
    t0 = time.monotonic()
    try:
        raw    = call_model(agent.deployment,
                            build_messages(system, user, want_json=True),
                            response_json=True, temperature=0.15, max_tokens=1500)
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
    """4 agent parallel – independent diagnosis."""
    order = {a.id: i for i, a in enumerate(AGENTS)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_phase1_single, a, patient_str): a for a in AGENTS}
        results = []
        for fut in concurrent.futures.as_completed(futures):
            agent = futures[fut]
            try:
                results.append(fut.result(timeout=90))
            except Exception as exc:
                logger.error("Phase1 timeout[%s]: %s", agent.id, exc)
                results.append({
                    "agent_id": agent.id, "agent_name": agent.name,
                    "primary_diagnosis": "Timeout", "error": str(exc),
                })
    results.sort(key=lambda x: order.get(x.get("agent_id", ""), 99))
    return results


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 – Cross-Examination + Refutation
# ─────────────────────────────────────────────────────────────────────────────

_P2_SYSTEM = """\
{persona}

DEBATE VA REFUTATION QOIDALARI:
1. Boshqa professorlarning tashxisini DIQQAT BILAN o'qing.
2. REFUTATION (Inkor): Agar birining tashxisi noto'g'ri yoki zaif bo'lsa –
   ANIQ va ILMIY asosda inkor qiling. "Bu xato chunki ..." shakli talab qilinadi.
3. HIMOYA: O'z tashxisingizni yangilangan dalillar bilan QUVVATLANG.
4. REVIZIYA: Agar boshqa professor kuchli dalil keltirgan bo'lsa, pozitsiyangizni
   yangilashingiz MUMKIN va KERAK – bu ilmiy halollik belgisi.
5. FAQAT JSON formatida javob qaytaring."""

_P2_USER = """\
BEMOR:
{patient}

BOSHQA PROFESSORLAR MUSTAQIL TASHXISLARI:
{others_json}

SIZNING DASTLABKI TASHXISINGIZ:
{own_json}

Debate javobingizni quyidagi JSON formatida yozing:
{{
  "refutations": [
    {{
      "target_agent_id": "deepseek",
      "target_diagnosis": "Ular aytgan tashxis",
      "refutation": "Bu noto'g'ri/zaif chunki: [ANIQ ILMIY SABAB]",
      "strength": "STRONG/MODERATE/WEAK"
    }}
  ],
  "defense": {{
    "my_diagnosis_stands": true,
    "argument": "O'z pozitsiyamni himoya qilaman chunki ...",
    "new_evidence": "Yangi qo'shilgan dalil"
  }},
  "revised_diagnosis": "Yangilangan tashxis (o'zgarmasa, dastlabki tashxisni yozing)",
  "revised_probability": 85,
  "accepted_from_others": [
    {{"agent_id": "llama", "point": "Bu professorda to'g'ri nuqta: ..."}}
  ],
  "key_argument": "Eng muhim klinik dalil yoki mantiqiy nuqta"
}}"""


def _phase2_single(agent: Agent, patient_str: str,
                   own: dict, others: list[dict]) -> dict:
    import json as _json
    others_text = _json.dumps(
        [{
            "agent_id":   o.get("agent_id"),
            "agent_name": o.get("agent_name"),
            "diagnosis":  o.get("primary_diagnosis"),
            "probability": o.get("probability"),
            "reasoning":  o.get("reasoning_chain"),
            "evidence":   o.get("supporting_evidence"),
        } for o in others],
        ensure_ascii=False, indent=2,
    )
    own_text = _json.dumps({
        "diagnosis":   own.get("primary_diagnosis"),
        "probability": own.get("probability"),
        "reasoning":   own.get("reasoning_chain"),
        "evidence":    own.get("supporting_evidence"),
        "confidence":  own.get("confidence"),
    }, ensure_ascii=False, indent=2)

    system = _P2_SYSTEM.format(persona=agent.persona)
    user   = _P2_USER.format(patient=patient_str,
                              others_json=others_text, own_json=own_text)
    t0 = time.monotonic()
    try:
        raw    = call_model(agent.deployment,
                            build_messages(system, user, want_json=True),
                            response_json=True, temperature=0.2, max_tokens=1800)
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
    """4 agent parallel – cross-examination + refutation."""
    order      = {a.id: i for i, a in enumerate(AGENTS)}
    id_to_p1   = {r.get("agent_id"): r for r in p1}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {}
        for agent in AGENTS:
            own    = id_to_p1.get(agent.id, {})
            others = [r for r in p1 if r.get("agent_id") != agent.id]
            futures[pool.submit(_phase2_single, agent, patient_str, own, others)] = agent
        results = []
        for fut in concurrent.futures.as_completed(futures):
            agent = futures[fut]
            try:
                results.append(fut.result(timeout=90))
            except Exception as exc:
                logger.error("Phase2 timeout[%s]: %s", agent.id, exc)
                results.append({"agent_id": agent.id, "error": str(exc)})
    results.sort(key=lambda x: order.get(x.get("agent_id", ""), 99))
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Refutation Scoring  (Orchestrator komponent)
# ─────────────────────────────────────────────────────────────────────────────

def _score_refutations(p2: list[dict]) -> dict[str, float]:
    """
    Har bir agentga refutation kuchiga qarab WEIGHT hisoblash.
    STRONG refutation qilgan agent +0.3, WEAK −0.1 oladi.
    Kimning tashxisi ko'p inkor qilinsa, weight'i kamayadi.
    """
    weights: dict[str, float] = {a.id: 1.0 for a in AGENTS}

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


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 – Weighted Consensus  (Orchestrator: GPT-4o)
# ─────────────────────────────────────────────────────────────────────────────

_P3_SYSTEM = """\
{persona}

KONSENSUS QAROR QOIDALARI:
1. Har bir agentga berilgan WEIGHT (og'irlik koeffitsienti) e'tiborga oling.
   Kuchli refutation qilgan agent – yuqori weight → uning tashxisiga ko'proq ishon.
2. Eng kuchli dalillar bilan qo'llab-quvvatlangan tashxisni tanlang.
3. O'zbekiston SSV milliy klinik protokollariga to'liq muvofiqlikni ta'minlang.
4. Faqat O'zbekistonda rasmiy ro'yxatdan o'tgan dorilar tavsiya qiling.
5. FAQAT JSON formatida javob qaytaring."""

_P3_USER = """\
BEMOR:
{patient}

AGENTLAR REFUTATION OG'IRLIKLARI (weight):
{weights_json}

PHASE 1 – Mustaqil tashxislar:
{phase1_json}

PHASE 2 – Debate va refutation'lar:
{phase2_json}

Quyidagi JSON formatida YAKUNIY MEDORA KONSILIUM XULOSASINI bering:
{{
  "consensus_diagnosis": {{
    "name": "Asosiy tashxis nomi",
    "icd10": "X00.0",
    "probability": 88,
    "justification": "Barcha dalillarni hisobga olgan xulosaning asosi ...",
    "evidence_level": "A",
    "reasoning_chain": ["Qadam 1 ...", "Qadam 2 ..."],
    "uzbek_protocol_match": "SSV buyrug'i/protokol nomi",
    "strongest_supporter": "deepseek"
  }},
  "differential_diagnoses": [
    {{"name": "Alt tashxis", "probability": 20, "reason": "Nega kam ehtimol"}}
  ],
  "rejected_hypotheses": [
    {{"name": "Rad etilgan tashxis", "reason": "Kim nima asosida rad etdi"}}
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
  "uzbekistan_protocol_note": "O'zbekiston Respublikasi SSV buyrug'i №XX ...",
  "agreement_level": "HIGH/MEDIUM/LOW",
  "agreement_summary": "Professorlar kelishuvi haqida qisqa tavsif ...",
  "dissenting_opinions": ["Farqli fikrlar (agar bo'lsa)"],
  "follow_up_plan": "Kuzatuv rejasi ...",
  "agent_weights_used": {{}}
}}"""


def run_phase3(patient_str: str, p1: list[dict],
               p2: list[dict], weights: dict[str, float]) -> dict:
    """Orchestrator – weighted consensus."""
    import json as _json
    p1_text = _json.dumps(p1, ensure_ascii=False, indent=2)
    p2_text = _json.dumps(p2, ensure_ascii=False, indent=2)
    w_text  = _json.dumps(weights, ensure_ascii=False, indent=2)

    system = _P3_SYSTEM.format(persona=ORCHESTRATOR.persona)
    user   = _P3_USER.format(patient=patient_str,
                              weights_json=w_text,
                              phase1_json=p1_text,
                              phase2_json=p2_text)
    t0 = time.monotonic()
    try:
        raw    = call_model(ORCHESTRATOR.deployment,
                            build_messages(system, user, want_json=True),
                            response_json=True, temperature=0.05, max_tokens=4500)
        result = parse_json(raw, "p3_consensus")
        result = result if isinstance(result, dict) else {}
        result["agent_weights_used"] = weights
    except Exception as exc:
        logger.error("Phase3 consensus failed: %s", exc)
        result = {"error": str(exc)}
    result["_elapsed_ms"] = round((time.monotonic() - t0) * 1000)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Final report builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_final_report(consensus: dict, p1: list[dict],
                        p2: list[dict], weights: dict[str, float]) -> dict:
    cd   = consensus.get("consensus_diagnosis") or {}
    meds = [
        {
            "name":              str(m.get("name", "")),
            "generic":           str(m.get("generic", "")),
            "dosage":            str(m.get("dosage", "")),
            "frequency":         str(m.get("frequency", "")),
            "duration":          str(m.get("duration", "")),
            "timing":            str(m.get("timing", "")),
            "instructions":      str(m.get("instructions", "")),
            "notes":             str(m.get("contraindications", "")),
            "localAvailability": str(m.get("local_availability", "O'zbekistonda mavjud")),
            "priceEstimate":     "",
        }
        for m in (consensus.get("medications") or [])
        if isinstance(m, dict)
    ]

    # Build debate timeline
    id_to_p2   = {r.get("agent_id"): r for r in p2}
    debate_log = []
    for agent in AGENTS:
        p1r = next((r for r in p1 if r.get("agent_id") == agent.id), {})
        p2r = id_to_p2.get(agent.id, {})
        w   = round(weights.get(agent.id, 1.0), 2)

        if p1r.get("primary_diagnosis"):
            debate_log.append({
                "id":          f"{agent.id}-p1",
                "author":      agent.name,
                "authorTitle": agent.title,
                "phase":       "independent",
                "weight":      w,
                "content": (
                    f"**Tashxis:** {p1r.get('primary_diagnosis','')}\n"
                    f"**Ehtimollik:** {p1r.get('probability','')}%  "
                    f"**Ishonch:** {p1r.get('confidence','')}  "
                    f"**Dalil darajasi:** {p1r.get('evidence_level','')}\n"
                    f"**Reasoning:** {' → '.join(p1r.get('reasoning_chain') or [])}\n"
                    f"**Qizil bayroqlar:** {', '.join(p1r.get('red_flags') or [])}"
                ),
            })

        reftns = p2r.get("refutations") or []
        if reftns or p2r.get("defense"):
            ref_text = "\n".join(
                f"  ↳ [{r.get('strength','?')}] {r.get('target_agent_id','?')}: {r.get('refutation','')}"
                for r in reftns
            )
            accepted = ", ".join(
                a.get("point", "") for a in (p2r.get("accepted_from_others") or [])
            )
            debate_log.append({
                "id":          f"{agent.id}-p2",
                "author":      agent.name,
                "authorTitle": agent.title,
                "phase":       "debate",
                "weight":      w,
                "content": (
                    f"**Refutation'lar:**\n{ref_text}\n\n"
                    f"**Himoya:** {p2r.get('defense', {}).get('argument','')}\n"
                    f"**Yangilangan tashxis:** {p2r.get('revised_diagnosis','')}\n"
                    f"**Boshqalardan qabul:** {accepted}\n"
                    f"**Asosiy dalil:** {p2r.get('key_argument','')}"
                ),
            })

    cf = consensus.get("critical_finding") or {}
    critical = cf if (isinstance(cf, dict) and cf.get("present")) else None

    return {
        "consensusDiagnosis": [
            {
                "name":               str(cd.get("name", "Tashxis aniqlanmadi")),
                "icd10":              str(cd.get("icd10", "")),
                "probability":        int(cd.get("probability") or 70),
                "justification":      str(cd.get("justification", "")),
                "evidenceLevel":      str(cd.get("evidence_level") or "Moderate"),
                "reasoningChain":     cd.get("reasoning_chain") or [],
                "uzbekProtocolMatch": str(cd.get("uzbek_protocol_match", "")),
                "strongestSupporter": str(cd.get("strongest_supporter", "")),
            }
        ] + [
            {
                "name":               str(d.get("name", "")),
                "probability":        int(d.get("probability") or 25),
                "justification":      str(d.get("reason", "")),
                "evidenceLevel":      "Moderate",
                "reasoningChain":     [],
                "uzbekProtocolMatch": "",
            }
            for d in (consensus.get("differential_diagnoses") or [])[:4]
        ],
        "rejectedHypotheses": [
            {"name": str(r.get("name", "")), "reason": str(r.get("reason", ""))}
            for r in (consensus.get("rejected_hypotheses") or [])
        ],
        "treatmentPlan":             consensus.get("treatment_plan") or [],
        "medicationRecommendations": meds,
        "recommendedTests":          consensus.get("recommended_tests") or [],
        "unexpectedFindings":        consensus.get("agreement_summary") or "",
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
        "generatedBy": "Medora Multi-Agent Consilium v3 (Azure AI Foundry)",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

def run_consilium(patient_data: dict, language: str = "uz-L") -> dict:
    """
    Full 3-phase Multi-Agent Medical Consilium.

    Returns ConsiliumResult.to_dict() with all phases and final_report.
    """
    t_start = time.monotonic()
    now     = timezone.now()

    result = ConsiliumResult(
        session_id  = f"consilium_{now.strftime('%Y%m%d_%H%M%S')}",
        started_at  = now.isoformat(),
        language    = language,
        professors  = [
            {"id": a.id, "name": a.name, "title": a.title,
             "specialty": a.specialty, "deployment": a.deployment}
            for a in [ORCHESTRATOR] + AGENTS
        ],
    )

    ptext = patient_text(patient_data)

    # Phase 1
    logger.info("[%s] Phase 1: Independent analysis started", result.session_id)
    p1 = run_phase1(ptext)
    result.phases["phase1_independent"] = p1

    # Phase 2
    logger.info("[%s] Phase 2: Cross-examination started", result.session_id)
    p2 = run_phase2(ptext, p1)
    result.phases["phase2_debate"] = p2

    # Refutation scoring
    weights = _score_refutations(p2)
    result.phases["refutation_weights"] = weights

    # Phase 3
    logger.info("[%s] Phase 3: Weighted consensus started", result.session_id)
    consensus = run_phase3(ptext, p1, p2, weights)
    result.phases["phase3_consensus_raw"] = consensus

    # Final report
    result.final_report = _build_final_report(consensus, p1, p2, weights)
    result.completed_at = timezone.now().isoformat()
    result.duration_sec = time.monotonic() - t_start

    logger.info("[%s] Completed in %.1fs", result.session_id, result.duration_sec)
    return result.to_dict()
