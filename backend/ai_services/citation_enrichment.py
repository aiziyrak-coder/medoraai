"""
Klinik matn va hisobotdagi manba havolalarini aniq URL bilan boyitish (LLM chaqiruvisiz).
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from .uzbekistan_knowledge_base import find_protocols_for_diagnosis

_SSV_PORTAL = "https://ssv.uz/uz/klinik-protokollar"
_LEX_SEARCH = "https://lex.uz/ru/search?type=1&search_text={q}"

_PLACEHOLDER_CITATION_RE = re.compile(
    r"\((?:"
    r"Protokol|SSV\s*protokoli?|Milliy\s+protokol|"
    r"Manba|Dalil|Qo['']llanma|Guideline|WHO|ESC|NICE|PubMed|"
    r"SSV\s+buyrug['']i|klinik\s+protokol"
    r")(?:\s*,\s*https?://[^\s)]+)?\)",
    re.I,
)

_BARE_URL_PLACEHOLDER_RE = re.compile(
    r"https?://(?:lex\.uz/\.\.\.|pubmed\.ncbi\.nlm\.nih\.gov/\.\.\.|www\.example\.com[^\s)]*)",
    re.I,
)

_PROTOCOL_ONLY_PARENS_RE = re.compile(
    r"\((?:O['']zbekiston\s+)?(?:SSV|Milliy)[^)]*protokol[^)]*\)",
    re.I,
)


def pubmed_search_url(term: str) -> str:
    return f"https://pubmed.ncbi.nlm.nih.gov/?term={quote((term or 'clinical guideline')[:160])}"


def lex_search_url(query: str) -> str:
    q = (query or "klinik protokol").strip()[:120]
    return _LEX_SEARCH.format(q=quote(q))


def cochrane_search_url(term: str) -> str:
    return f"https://www.cochranelibrary.com/search?q={quote((term or 'systematic review')[:120])}"


def protocol_urls(protocol: dict) -> dict[str, str]:
    """Protokol uchun ishlaydigan qidiruv havolalari."""
    name = str(protocol.get("name") or "").strip()
    ref = str(protocol.get("ref") or name).strip()
    icd = ", ".join(protocol.get("icd10") or [])[:40]
    pubmed_term = f"{name} Uzbekistan clinical protocol {icd}".strip()
    lex_q = f"{name} klinik protokol SSV"
    return {
        "ssv": _SSV_PORTAL,
        "lex": lex_search_url(lex_q),
        "pubmed": pubmed_search_url(pubmed_term),
        "label": ref or f"O'zbekiston SSV — {name} protokoli",
    }


def match_protocols(diagnosis: str = "", complaints: str = "", limit: int = 3) -> list[dict]:
    return find_protocols_for_diagnosis(diagnosis, complaints, limit=limit)


def build_protocol_research_rows(
    diagnosis: str,
    complaints: str = "",
    language: str = "uz-L",
) -> list[dict[str, str]]:
    """Tashxisga mos aniq SSV protokol manbalari."""
    protos = match_protocols(diagnosis, complaints, limit=2)
    rows: list[dict[str, str]] = []
    for p in protos:
        urls = protocol_urls(p)
        rows.append({
            "title": urls["label"],
            "url": urls["lex"],
            "summary": (
                f"Milliy klinik protokol: {p.get('name', '')}. "
                f"1-qator: {'; '.join((p.get('first_line') or [])[:2])}"
            )[:280],
        })
        rows.append({
            "title": f"PubMed — {p.get('name', diagnosis)} (xalqaro dalil)",
            "url": urls["pubmed"],
            "summary": f"«{p.get('name', diagnosis)}» bo'yicha xalqaro maqola va RCT qidiruvi",
        })
    if not rows and diagnosis.strip():
        rows.append({
            "title": f"SSV klinik protokollari — {diagnosis[:80]}",
            "url": lex_search_url(f"{diagnosis} klinik protokol"),
            "summary": "O'zbekiston Respublikasi SSV milliy protokollari (lex.uz qidiruv)",
        })
    return rows


def _primary_protocol_citation(protocols: list[dict]) -> tuple[str, str]:
    if not protocols:
        return ("O'zbekiston SSV klinik protokollari", lex_search_url("klinik protokol SSV"))
    urls = protocol_urls(protocols[0])
    return (urls["label"], urls["lex"])


def inject_citation_urls(text: str, protocols: list[dict] | None = None) -> str:
    """Placeholder manbalarni aniq URL bilan almashtiradi."""
    if not text or not str(text).strip():
        return text

    protos = protocols or []
    label, url = _primary_protocol_citation(protos)
    citation = f"({label}, {url})"

    s = str(text)
    s = _BARE_URL_PLACEHOLDER_RE.sub(url, s)
    s = _PLACEHOLDER_CITATION_RE.sub(citation, s)

    if protos and _PROTOCOL_ONLY_PARENS_RE.search(s):
        s = _PROTOCOL_ONLY_PARENS_RE.sub(citation, s, count=1)

    # «Manba» yoki «Protokol» so'zi yolg'iz qolsa — birinchi marta URL qo'shish
    if "http" not in s and protos:
        if re.search(r"\b(?:protokol|SSV|milliy)\b", s, re.I):
            s = f"{s.rstrip()} {citation}"

    return s


def _enrich_string_list(items: Any, protocols: list[dict]) -> list[str]:
    if not isinstance(items, list):
        return items
    return [inject_citation_urls(str(x), protocols) for x in items if str(x).strip()]


def enrich_consensus_citations(consensus: dict, patient_data: dict | None = None) -> dict:
    """Konsensus JSON ichidagi matn maydonlariga aniq manba URL qo'shadi."""
    if not isinstance(consensus, dict):
        return consensus

    pd = patient_data or {}
    cd = consensus.get("consensus_diagnosis") or {}
    diag = ""
    if isinstance(cd, dict):
        diag = str(cd.get("name") or "").strip()
    complaints = str(
        pd.get("complaints") or pd.get("chiefComplaint") or pd.get("chief_complaint") or ""
    ).strip()
    protos = match_protocols(diag, complaints)

    if isinstance(cd, dict):
        for key in ("justification", "uzbek_protocol_match", "uzbekistan_protocol_note"):
            if cd.get(key):
                cd[key] = inject_citation_urls(str(cd[key]), protos)
        for key in ("reasoning_chain", "reasoningChain"):
            if cd.get(key):
                cd[key] = _enrich_string_list(cd[key], protos)
        consensus["consensus_diagnosis"] = cd

    for key in ("agreement_summary", "unexpected_findings", "unexpectedFindings",
                "uzbekistan_protocol_note", "uzbekistanLegislativeNote", "follow_up_plan"):
        if consensus.get(key):
            consensus[key] = inject_citation_urls(str(consensus[key]), protos)

    synth = consensus.get("debate_synthesis") or consensus.get("debateSynthesis")
    if isinstance(synth, dict):
        for sk in ("summary", "key_agreements", "key_disputes_resolved", "winning_arguments"):
            if isinstance(synth.get(sk), list):
                synth[sk] = _enrich_string_list(synth[sk], protos)
            elif synth.get(sk):
                synth[sk] = inject_citation_urls(str(synth[sk]), protos)
        consensus["debate_synthesis"] = synth

    for plan_key in ("treatment_plan", "treatmentPlan"):
        if consensus.get(plan_key):
            consensus[plan_key] = _enrich_string_list(consensus[plan_key], protos)

    # uzbek_protocol_match bo'sh yoki umumiy bo'lsa — protokol bazasidan to'ldirish
    if isinstance(cd, dict) and protos:
        match = str(cd.get("uzbek_protocol_match") or "")
        if not match or len(match) < 20 or "protokol" in match.lower() and "http" not in match:
            urls = protocol_urls(protos[0])
            cd["uzbek_protocol_match"] = f"{urls['label']} ({urls['lex']})"
            consensus["consensus_diagnosis"] = cd

    return consensus


def enrich_debate_content(content: str, diagnosis: str = "", complaints: str = "") -> str:
    protos = match_protocols(diagnosis, complaints)
    return inject_citation_urls(content, protos)


def enrich_debate_log(
    debate_log: list[dict],
    diagnosis: str = "",
    complaints: str = "",
) -> list[dict]:
    out: list[dict] = []
    for entry in debate_log:
        if not isinstance(entry, dict):
            continue
        row = dict(entry)
        if row.get("content"):
            row["content"] = enrich_debate_content(
                str(row["content"]), diagnosis, complaints
            )
        out.append(row)
    return out
