"""
Tez xalqaro dalil manbalari — LLM chaqiruvisiz PubMed/Cochrane/jurnal qidiruvlari.
"""
from __future__ import annotations

from urllib.parse import quote
from typing import Any

from .citation_enrichment import build_protocol_research_rows, pubmed_search_url


def _pubmed(term: str) -> str:
    return pubmed_search_url(term)


def build_fast_research_sources(
    diagnosis: str,
    language: str = "uz-L",
    complaints: str = "",
) -> list[dict[str, str]]:
    """Konsilium uchun xalqaro reytingli jurnal va guideline bazalari."""
    dx = (diagnosis or "").strip() or "clinical diagnosis"
    term = dx[:120]
    intl = f"{term} systematic review"
    cochrane = f"{term} Cochrane"
    lancet = f"{term} Lancet"
    nejm = f"{term} NEJM"
    esc = f"{term} ESC guideline"
    who = f"{term} WHO guideline"
    ssv = f"{term} Uzbekistan clinical protocol"

    # Tashxisga mos aniq SSV protokol havolalari (birinchi qator)
    protocol_rows = build_protocol_research_rows(dx, complaints, language)

    kaa_rows = [
        ("PubMed — sistemalıq sholıwlar", _pubmed(intl), f"«{term}» boyınsha xalıqaralıq maqala"),
        ("Cochrane Library", f"https://www.cochranelibrary.com/search?q={quote(cochrane)}", "Meta-tahlil hám RCT"),
        ("The Lancet", _pubmed(lancet), "Joqarı impakt faktorlı tadqiqotlar"),
        ("NEJM", _pubmed(nejm), "Dalilge tiykarlanǵan terapiya"),
        ("ESC / WHO / NICE", _pubmed(esc), "Xalıqaralıq klinikalıq qollanmalar"),
        ("Ózbekstan SSV protokolları", _pubmed(ssv), "Milliy protokol mós kelisi"),
    ]
    summaries: dict[str, list[tuple[str, str, str]]] = {
        "kaa": kaa_rows,
        "uz-L": [
            ("PubMed — tizimli sharhlar va RCT", _pubmed(intl), f"«{term}» bo'yicha xalqaro maqolalar"),
            ("Cochrane Library", f"https://www.cochranelibrary.com/search?q={quote(cochrane)}", "Tizimli ko'rib chiqishlar va meta-tahlillar"),
            ("The Lancet", _pubmed(lancet), "Yuqori impakt faktorli klinik tadqiqotlar"),
            ("New England Journal of Medicine (NEJM)", _pubmed(nejm), "Dalillarga asoslangan terapiya maqolalari"),
            ("ESC / ADA / NICE — xalqaro qo'llanmalar", _pubmed(esc), "Xalqaro klinik protokollar va guideline"),
            ("WHO — global ko'rsatmalar", _pubmed(who), "Jahon sog'liqni saqlash tashkiloti qo'llanmalari"),
            ("O'zbekiston SSV milliy protokollari", _pubmed(ssv), "Milliy klinik standartlar bilan solishtirish"),
        ],
        "ru": [
            ("PubMed — систематические обзоры", _pubmed(intl), f"Международные статьи по «{term}»"),
            ("Cochrane Library", f"https://www.cochranelibrary.com/search?q={quote(cochrane)}", "Систематические обзоры"),
            ("The Lancet", _pubmed(lancet), "Клинические исследования высокого уровня"),
            ("NEJM", _pubmed(nejm), "Доказательная терапия"),
            ("ESC / NICE — международные руководства", _pubmed(esc), "Международные клинические протоколы"),
            ("ВОЗ", _pubmed(who), "Глобальные рекомендации ВОЗ"),
            ("Протоколы МЗ РУз", _pubmed(ssv), "Национальные протоколы Узбекистана"),
        ],
        "en": [
            ("PubMed — systematic reviews", _pubmed(intl), f"International evidence for {term}"),
            ("Cochrane Library", f"https://www.cochranelibrary.com/search?q={quote(cochrane)}", "Systematic reviews and meta-analyses"),
            ("The Lancet", _pubmed(lancet), "High-impact clinical research"),
            ("NEJM", _pubmed(nejm), "Evidence-based therapy articles"),
            ("ESC / ADA / NICE guidelines", _pubmed(esc), "International clinical guidelines"),
            ("WHO", _pubmed(who), "Global WHO recommendations"),
            ("Uzbekistan MoH protocols", _pubmed(ssv), "National SSV protocol alignment"),
        ],
    }
    rows = summaries.get(language) or summaries.get("uz-L", [])
    generic = [{"title": t, "url": u, "summary": s} for t, u, s in rows]
    # Protokolga mos aniq havolalar birinchi, keyin umumiy jurnal qidiruvlari
    seen_urls: set[str] = set()
    merged: list[dict[str, str]] = []
    for item in protocol_rows + generic:
        url = str(item.get("url") or "").strip()
        if url and url in seen_urls:
            continue
        if url:
            seen_urls.add(url)
        merged.append(item)
    return merged[:8]
