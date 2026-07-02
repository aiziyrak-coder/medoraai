"""
Tez xalqaro dalil manbalari — LLM chaqiruvisiz PubMed/Cochrane/jurnal qidiruvlari.
SSV protokollari citation_enrichment orqali birinchi navbatda qo'shiladi.
"""
from __future__ import annotations

from urllib.parse import quote
from typing import Any

from .citation_enrichment import pubmed_search_url


def _pubmed(term: str) -> str:
    return pubmed_search_url(term)


def _international_research_rows(term: str, language: str) -> list[tuple[str, str, str]]:
    """Faqat xalqaro jurnal/guideline qidiruvlari (SSV alohida qo'shiladi)."""
    intl = f"{term} systematic review"
    cochrane = f"{term} Cochrane"
    lancet = f"{term} Lancet"
    nejm = f"{term} NEJM JAMA"
    esc = f"{term} ESC WHO NICE guideline"

    by_lang: dict[str, list[tuple[str, str, str]]] = {
        "uz-L": [
            ("PubMed — tizimli sharhlar va RCT", _pubmed(intl), f"«{term}» bo'yicha xalqaro maqolalar"),
            ("Cochrane Library — meta-tahlil", f"https://www.cochranelibrary.com/search?q={quote(cochrane)}", "Tizimli ko'rib chiqishlar"),
            ("The Lancet", _pubmed(lancet), "Yuqori impakt faktorli klinik tadqiqotlar"),
            ("NEJM / JAMA", _pubmed(nejm), "Dalillarga asoslangan terapiya maqolalari"),
            ("WHO / ESC / NICE — xalqaro qo'llanmalar", _pubmed(esc), "Global klinik guideline qidiruvi"),
        ],
        "ru": [
            ("PubMed — систематические обзоры", _pubmed(intl), f"Международные статьи по «{term}»"),
            ("Cochrane Library", f"https://www.cochranelibrary.com/search?q={quote(cochrane)}", "Систематические обзоры"),
            ("The Lancet", _pubmed(lancet), "Клинические исследования высокого уровня"),
            ("NEJM / JAMA", _pubmed(nejm), "Доказательная терапия"),
            ("WHO / ESC / NICE", _pubmed(esc), "Международные руководства"),
        ],
        "en": [
            ("PubMed — systematic reviews", _pubmed(intl), f"International evidence for {term}"),
            ("Cochrane Library", f"https://www.cochranelibrary.com/search?q={quote(cochrane)}", "Systematic reviews"),
            ("The Lancet", _pubmed(lancet), "High-impact clinical research"),
            ("NEJM / JAMA", _pubmed(nejm), "Evidence-based therapy"),
            ("WHO / ESC / NICE guidelines", _pubmed(esc), "International clinical guidelines"),
        ],
        "kaa": [
            ("PubMed — sistemalıq sholıwlar", _pubmed(intl), f"«{term}» boyınsha xalıqaralıq maqala"),
            ("Cochrane Library", f"https://www.cochranelibrary.com/search?q={quote(cochrane)}", "Meta-tahlil"),
            ("The Lancet", _pubmed(lancet), "Joqarı impakt faktorlı tadqiqotlar"),
            ("NEJM / JAMA", _pubmed(nejm), "Dalilge tiykarlanǵan terapiya"),
            ("WHO / ESC / NICE", _pubmed(esc), "Xalıqaralıq qollanmalar"),
        ],
    }
    return by_lang.get(language) or by_lang.get("uz-L", [])


def build_fast_research_sources(
    diagnosis: str,
    language: str = "uz-L",
    complaints: str = "",
) -> list[dict[str, str]]:
    from .citation_enrichment import build_verified_research_sources
    return build_verified_research_sources(diagnosis, complaints, language)
