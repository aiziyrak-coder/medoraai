"""
Tadqiqot markazi — innovatsion davolash bo'yicha ekspertlar muhokamasi va hisobot.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import quote

logger = logging.getLogger(__name__)

LANG_LABELS = {
    "uz-L": "O'zbek (lotin)",
    "uz-C": "O'zbek (kirill)",
    "ru": "Rus",
    "en": "Ingliz",
    "kaa": "Qoraqalpoq",
}

FOCUS_LABELS = {
    "innovative": "Innovatsion davolash strategiyalari",
    "biomarkers": "Biomarkerlar va shaxsiylashtirilgan terapiya",
    "trials": "Klinik sinovlar va eksperimental protokollar",
    "pharmacogenomics": "Farmakogenomika va maqsadli terapiya",
    "comprehensive": "To'liq strategik tahlil",
}


def _pubmed(term: str) -> str:
    return f"https://pubmed.ncbi.nlm.nih.gov/?term={quote(term)}"


def _clinical_trials(term: str) -> str:
    return f"https://clinicaltrials.gov/search?term={quote(term)}"


def default_sources(disease: str) -> list[dict]:
    return [
        {"title": f"PubMed — {disease}", "uri": _pubmed(disease)},
        {"title": f"ClinicalTrials.gov — {disease}", "uri": _clinical_trials(disease)},
        {"title": "WHO Health Topics", "uri": "https://www.who.int/health-topics"},
    ]


def _parse_json(raw: str) -> dict | None:
    text = raw.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _ensure_report_shape(data: dict, disease: str) -> dict:
    report = data.get("report") if isinstance(data.get("report"), dict) else data
    if not isinstance(report, dict):
        report = {}

    report.setdefault("diseaseName", disease)
    report.setdefault("summary", "")
    report.setdefault("pathophysiology", "")
    report.setdefault("strategicConclusion", "")
    report.setdefault("epidemiology", {"prevalence": "", "incidence": "", "keyRiskFactors": []})
    report.setdefault("emergingBiomarkers", [])
    report.setdefault("clinicalGuidelines", [])
    report.setdefault("potentialStrategies", [])
    report.setdefault("pharmacogenomics", {"relevantGenes": [], "targetSubgroup": ""})
    report.setdefault("patentLandscape", {"competingPatents": [], "whitespaceOpportunities": []})
    report.setdefault("relatedClinicalTrials", [])
    sources = report.get("sources") or []
    if len(sources) < 2:
        sources = default_sources(disease) + [s for s in sources if isinstance(s, dict)]
    report["sources"] = [
        {"title": str(s.get("title") or "Manba"), "uri": str(s.get("uri") or s.get("url") or _pubmed(disease))}
        for s in sources
        if isinstance(s, dict)
    ][:12]

    debate = data.get("debateMessages") or data.get("debate_messages") or []
    if not isinstance(debate, list):
        debate = []
    messages = []
    for item in debate:
        if not isinstance(item, dict):
            continue
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        messages.append({
            "author": str(item.get("author") or "Ekspert"),
            "content": content,
        })

    return {"debateMessages": messages, "report": report}


def generate_research_report(payload: dict, language: str = "uz-L") -> dict:
    from . import claude_utils

    disease = str(payload.get("diseaseName") or payload.get("disease_name") or "").strip()
    if not disease:
        raise ValueError("Kasallik nomi kiritilmagan")

    focus = str(payload.get("focus") or "comprehensive").strip()
    stage = str(payload.get("stage") or "").strip()
    context = str(payload.get("patientContext") or payload.get("patient_context") or "").strip()
    lang = LANG_LABELS.get(language, LANG_LABELS["uz-L"])
    focus_label = FOCUS_LABELS.get(focus, FOCUS_LABELS["comprehensive"])

    meta = {
        "disease": disease,
        "focus": focus_label,
        "stage": stage or "noma'lum",
        "patientContext": context or "umumiy tahlil",
    }

    prompt = (
        f"Siz xalqaro tadqiqot kengashi sifatida ishlayapsiz. Til: {lang}.\n"
        f"Mavzu: {json.dumps(meta, ensure_ascii=False)}\n\n"
        "Vazifa:\n"
        "1) Kamida 4 ta ekspert munozara xabari (onkolog, farmakolog, genetik, klinik tadqiqotchi).\n"
        "2) To'liq tadqiqot hisoboti — PubMed/ClinicalTrials.gov uslubidagi haqiqiy manbalar bilan.\n"
        "3) Kamida 3 ta innovatsion davolash strategiyasi (mexanizm, dalil, risk/foyda, roadmap).\n"
        "4) Klinik sinovlar, biomarkerlar, farmakogenomika, patent landshafti.\n\n"
        "FAQAT JSON:\n"
        "{\n"
        '  "debateMessages": [{"author":"Onkolog","content":"..."},{"author":"Farmakolog","content":"..."}],\n'
        '  "report": {\n'
        '    "diseaseName":"", "summary":"",\n'
        '    "epidemiology":{"prevalence":"","incidence":"","keyRiskFactors":[]},\n'
        '    "pathophysiology":"",\n'
        '    "emergingBiomarkers":[{"name":"","type":"Prognostic|Predictive|Diagnostic","description":""}],\n'
        '    "clinicalGuidelines":[{"guidelineTitle":"","source":"","recommendations":[{"category":"","details":[]}]}],\n'
        '    "potentialStrategies":[{"name":"","mechanism":"","evidence":"","pros":[],"cons":[],'
        '"riskBenefit":{"risk":"Low|Medium|High|Very High","benefit":"Incremental|Significant|Breakthrough"},'
        '"developmentRoadmap":[{"stage":"","duration":"","cost":""}],'
        '"molecularTarget":{"name":"","pdbId":""},'
        '"ethicalConsiderations":[],"requiredCollaborations":[],"companionDiagnosticNeeded":""}],\n'
        '    "pharmacogenomics":{"relevantGenes":[{"gene":"","mutation":"","impact":""}],"targetSubgroup":""},\n'
        '    "patentLandscape":{"competingPatents":[{"patentId":"","title":"","assignee":""}],"whitespaceOpportunities":[]},\n'
        '    "relatedClinicalTrials":[{"trialId":"NCT...","title":"","status":"","url":"https://clinicaltrials.gov/..."}],\n'
        '    "strategicConclusion":"",\n'
        '    "sources":[{"title":"","uri":"https://..."}]\n'
        "  }\n"
        "}\n"
        "Manbalar haqiqiy URL bo'lsin. Strategiyalar ilmiy jihatdan asoslangan bo'lsin."
    )

    raw = claude_utils._call_claude(
        prompt,
        claude_utils.CLAUDE_PRO,
        response_mime_type="application/json",
        max_output_tokens=8000,
    )
    parsed = _parse_json(raw)
    if not parsed:
        raise ValueError("Tadqiqot hisoboti JSON formatida kelmadi")

    result = _ensure_report_shape(parsed, disease)
    if not result["report"].get("summary"):
        result["report"]["summary"] = (
            f"{disease} bo'yicha {focus_label} yo'nalishida strategik tahlil tayyorlandi."
        )
    if not result["debateMessages"]:
        result["debateMessages"] = [
            {"author": "Onkolog", "content": f"{disease} uchun zamonaviy standartlar va klinik sinovlar ko'rib chiqildi."},
            {"author": "Farmakolog", "content": "Maqsadli terapiya va kombinatsion rejimlar munosabatlari tahlil qilindi."},
            {"author": "Tadqiqotchi", "content": "Innovatsion pipeline va translatsion tadqiqot imkoniyatlari belgilandi."},
        ]
    return result
