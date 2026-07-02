"""
Klinik matn va hisobotdagi manba havolalarini aniq URL bilan boyitish (LLM chaqiruvisiz).
AI o'ylab topgan (hallusinatsiya) manbalarni olib tashlaydi; faqat tekshirilgan havolalar qoladi.
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from .uzbekistan_knowledge_base import find_protocols_for_diagnosis

_SSV_PORTAL = "https://ssv.uz/uz/klinik-protokollar"
_LEX_SEARCH = "https://lex.uz/ru/search?type=1&search_text={q}"

# Qavs ichida manba ko'rinishi, lekin URL yo'q — AI hallusinatsiyasi
_FAKE_SOURCE_PARENS_RE = re.compile(
    r"\("
    r"[^)]{0,200}?"
    r"(?:protokol|protocol|SSV|Milliy|WHO|ESC|NICE|ADA|PubMed|Cochrane|Lancet|NEJM|JAMA|BMJ|"
    r"guideline|qo['']llanma|jurnal|psixiatr|psychiat|buyrug['']i|dalil|manba)"
    r"[^)]{0,120}?"
    r"\)",
    re.I,
)

_BARE_URL_PLACEHOLDER_RE = re.compile(
    r"https?://(?:lex\.uz/\.\.\.|pubmed\.ncbi\.nlm\.nih\.gov/\.\.\.|www\.example\.com[^\s)]*)",
    re.I,
)

# AI ko'pincha yozadigan umumiy iboralar — URL siz
_GENERIC_PROTOCOL_PHRASES_RE = re.compile(
    r"\(O['']zbekiston\s+SSV[^)]{0,100}?protokoli?\)",
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


def build_verified_research_sources(
    diagnosis: str,
    complaints: str = "",
    language: str = "uz-L",
) -> list[dict[str, str]]:
    """
    Tartib: 1) O'zbekiston SSV protokollari (lex.uz + ssv.uz)
            2) Xalqaro jurnallar va guideline qidiruvlari (PubMed, Cochrane, Lancet, NEJM, WHO/ESC/NICE)
    AI generatsiyasi emas — faqat tekshirilgan qidiruv URL lari.
    """
    from .evidence_sources import _international_research_rows

    dx = (diagnosis or "").strip() or "klinik holat"
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    def add(title: str, url: str, summary: str) -> None:
        u = (url or "").strip()
        if not u or not u.startswith("http") or u in seen:
            return
        seen.add(u)
        rows.append({"title": title[:200], "url": u, "summary": summary[:280]})

    protos = match_protocols(dx, complaints, limit=3)
    for p in protos:
        urls = protocol_urls(p)
        add(urls["label"], urls["lex"], f"Milliy klinik protokol: {p.get('name', '')}")
        add(f"SSV.uz — {p.get('name', dx)}", urls["ssv"], "Rasmiy SSV klinik protokollari portali")

    if not protos:
        add(
            f"O'zbekiston SSV — {dx[:80]} klinik protokoli",
            lex_search_url(f"{dx} klinik protokol SSV"),
            "lex.uz — milliy klinik protokol qidiruvi",
        )
        add("SSV.uz — klinik protokollar", _SSV_PORTAL, "Rasmiy protokollar ro'yxati")

    for title, url, summary in _international_research_rows(dx, language):
        add(title, url, summary)

    return rows[:10]


# Eski nom bilan moslik
build_protocol_research_rows = build_verified_research_sources


def _has_real_url(text: str) -> bool:
    return bool(re.search(r"https?://[^\s)]+", text or ""))


def strip_hallucinated_citations(text: str) -> str:
    """URL siz manba qavslarini olib tashlaydi (AI o'ylab topgan iqtiboslar)."""
    if not text:
        return text

    def _strip_match(m: re.Match) -> str:
        chunk = m.group(0)
        if _has_real_url(chunk):
            return chunk
        return ""

    s = str(text)
    s = _FAKE_SOURCE_PARENS_RE.sub(_strip_match, s)
    s = _GENERIC_PROTOCOL_PHRASES_RE.sub("", s)
    s = re.sub(r"\(\s*\)", "", s)
    s = re.sub(r"\s{2,}", " ", s)
    s = re.sub(r"\s+([.,;])", r"\1", s)
    return s.strip()


def _format_verified_citation(protocol: dict) -> str:
    urls = protocol_urls(protocol)
    return f"({urls['label']}, {urls['lex']})"


def inject_citation_urls(text: str, protocols: list[dict] | None = None) -> str:
    """Matndan soxta manbalarni tozalab, mavjud protokol bo'yicha aniq havola qo'shadi."""
    if not text or not str(text).strip():
        return text

    protos = protocols or []
    s = strip_hallucinated_citations(str(text))
    s = _BARE_URL_PLACEHOLDER_RE.sub(
        lex_search_url(protos[0].get("name", "klinik protokol") if protos else "klinik protokol"),
        s,
    )

    if protos and not _has_real_url(s):
        # Faqat bitta tasdiqlangan milliy protokol havolasi (oxirida)
        s = f"{s.rstrip()} {_format_verified_citation(protos[0])}"

    return s.strip()


def _enrich_string_list(items: Any, protocols: list[dict], *, add_citation: bool = False) -> list[str]:
    if not isinstance(items, list):
        return items
    out: list[str] = []
    for raw in items:
        s = str(raw).strip()
        if not s:
            continue
        cleaned = strip_hallucinated_citations(s)
        if add_citation and protocols and not _has_real_url(cleaned):
            cleaned = f"{cleaned} {_format_verified_citation(protocols[0])}"
        out.append(cleaned)
    return out


def _is_valid_research_item(item: Any) -> bool:
    if not isinstance(item, dict):
        return False
    url = str(item.get("url") or "").strip()
    title = str(item.get("title") or "").strip()
    return bool(title and url.startswith("http") and "..." not in url)


def sanitize_related_research(
    consensus: dict,
    diagnosis: str = "",
    complaints: str = "",
    language: str = "uz-L",
) -> None:
    """related_research — faqat tekshirilgan manbalar (SSV birinchi, keyin xalqaro)."""
    verified = build_verified_research_sources(diagnosis, complaints, language)
    consensus["related_research"] = verified
    consensus["relatedResearch"] = verified


def enrich_consensus_citations(consensus: dict, patient_data: dict | None = None) -> dict:
    if not isinstance(consensus, dict):
        return consensus

    pd = patient_data or {}
    cd = consensus.get("consensus_diagnosis") or {}
    diag = str(cd.get("name") or "").strip() if isinstance(cd, dict) else ""
    complaints = str(
        pd.get("complaints") or pd.get("chiefComplaint") or pd.get("chief_complaint") or ""
    ).strip()
    lang = str(pd.get("language") or consensus.get("language") or "uz-L")
    protos = match_protocols(diag, complaints)

    if isinstance(cd, dict):
        for key in ("justification", "uzbek_protocol_match", "uzbekistan_protocol_note"):
            if cd.get(key):
                cd[key] = inject_citation_urls(str(cd[key]), protos)
        for key in ("reasoning_chain", "reasoningChain"):
            if cd.get(key):
                cd[key] = _enrich_string_list(cd[key], protos)
        if protos:
            urls = protocol_urls(protos[0])
            cd["uzbek_protocol_match"] = (
                f"{urls['label']} — {urls['lex']}"
            )
        consensus["consensus_diagnosis"] = cd

    for key in (
        "agreement_summary", "unexpected_findings", "unexpectedFindings",
        "uzbekistan_protocol_note", "uzbekistanLegislativeNote", "follow_up_plan",
    ):
        if consensus.get(key):
            consensus[key] = strip_hallucinated_citations(str(consensus[key]))

    synth = consensus.get("debate_synthesis") or consensus.get("debateSynthesis")
    if isinstance(synth, dict):
        for sk in ("summary", "key_agreements", "key_disputes_resolved", "winning_arguments"):
            if isinstance(synth.get(sk), list):
                synth[sk] = _enrich_string_list(synth.get(sk), protos)
            elif synth.get(sk):
                synth[sk] = strip_hallucinated_citations(str(synth[sk]))
        consensus["debate_synthesis"] = synth

    for plan_key in ("treatment_plan", "treatmentPlan"):
        if consensus.get(plan_key):
            consensus[plan_key] = _enrich_string_list(consensus[plan_key], protos)

    sanitize_related_research(consensus, diag, complaints, lang)
    return consensus


def enrich_debate_content(content: str, diagnosis: str = "", complaints: str = "") -> str:
    protos = match_protocols(diagnosis, complaints)
    return strip_hallucinated_citations(inject_citation_urls(content, protos))


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
