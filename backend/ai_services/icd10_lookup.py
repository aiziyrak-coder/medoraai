"""
MKB-10 (ICD-10-CM, 10-reviziya) kodlarini tashxis nomi bo'yicha aniqlash.

Ustuvorlik:
  1. O'zbekiston SSV protokollari bazasi (kalit so'z mosligi)
  2. NIH Clinical Tables — tashxis nomi bo'yicha qidiruv
  3. NIH — mavjud kodni tasdiqlash (LLM kodini tekshirish)
  4. LLM + NIH tasdiqlash (faqat mos kelganda)
"""
from __future__ import annotations

import logging
import re
from typing import Any

import requests

logger = logging.getLogger(__name__)

_ICD10_RE = re.compile(r"^[A-TV-Z][0-9][0-9AB](\.[0-9A-Z]{1,4})?$", re.IGNORECASE)

_PLACEHOLDER_CODES = frozenset({
    "X00", "X00.0", "X00.00", "Z00", "Z00.0", "Z00.00",
    "A00", "A00.0", "E00", "E00.0", "I00", "I00.0",
    "J00", "J00.0", "K00", "K00.0", "N00", "N00.0",
    "R00", "R00.0", "S00", "S00.0", "T00", "T00.0",
})

_UNKNOWN_NAMES = frozenset({
    "", "tashxis aniqlanmadi", "aniqlanmadi", "noma'lum", "unknown",
    "xatolik", "tahlil muvaffaqiyatsiz",
})

_NIH_URL = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search"

# O'zbek tashxis nomlarini NIH qidiruvi uchun inglizcha atamaga moslashtirish
_UZ_SEARCH_ALIASES: dict[str, str] = {
    "gipertoniya": "essential hypertension",
    "arterial gipertoniya": "essential hypertension",
    "giperlipidemiya": "hyperlipidemia",
    "dislipidemiya": "hyperlipidemia",
    "gipotiroidizm": "hypothyroidism",
    "gipertireoz": "hyperthyroidism",
    "gastrit": "gastritis",
    "xolecistit": "cholecystitis",
    "pielonefrit": "pyelonephritis",
    "tsistit": "cystitis",
    "artrit": "arthritis",
    "osteoxondroz": "osteochondrosis",
    "migrena": "migraine",
    "epilepsiya": "epilepsy",
    "anemiya": "anemia",
    "gemorroy": "hemorrhoids",
    "varikoz": "varicose veins",
    "ekzema": "eczema",
    "dermatit": "dermatitis",
    "pnevmoniya": "pneumonia",
    "bronxit": "bronchitis",
    "astma": "asthma",
    "diabet": "diabetes mellitus",
    "qandli diabet": "diabetes mellitus",
    "yurak yetishmovchiligi": "heart failure",
    "stendokardiya": "angina pectoris",
    "infarkt": "myocardial infarction",
    "gripp": "influenza",
    "tonzillit": "tonsillitis",
    "faringit": "pharyngitis",
    "sinusit": "sinusitis",
    "appenditsit": "appendicitis",
    "gastroulser": "peptic ulcer",
    "reflyuks": "gastroesophageal reflux",
    "surunkali buyrak yetishmovchiligi": "chronic kidney disease",
}


def is_valid_icd10(code: str) -> bool:
    c = str(code or "").strip().upper()
    if not c or c in _PLACEHOLDER_CODES:
        return False
    return bool(_ICD10_RE.match(c))


def _normalize_diag(text: str) -> str:
    s = str(text or "").strip()
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _token_set(text: str) -> set[str]:
    low = re.sub(r"[^a-z0-9\u0400-\u04ff\s'-]", " ", text.lower())
    return {w for w in low.split() if len(w) >= 4}


def _match_score(diagnosis: str, description: str) -> float:
    d_tokens = _token_set(diagnosis)
    desc_tokens = _token_set(description)
    if not d_tokens or not desc_tokens:
        return 0.0
    overlap = len(d_tokens & desc_tokens)
    return overlap / max(len(d_tokens), 1)


def _search_queries(term: str) -> list[str]:
    queries: list[str] = []
    base = _normalize_diag(term)
    if base:
        queries.append(base)
    lower = base.lower()
    for uz_key, en_term in _UZ_SEARCH_ALIASES.items():
        if uz_key in lower and en_term not in queries:
            queries.append(en_term)
    # Birinchi 3–4 so'z (uzun tashxislar uchun)
    words = base.split()
    if len(words) > 4:
        short = " ".join(words[:4])
        if short not in queries:
            queries.append(short)
    return queries[:4]


def lookup_from_protocol_db(diagnosis: str) -> dict[str, str] | None:
    from .uzbekistan_knowledge_base import find_protocols

    text = _normalize_diag(diagnosis).lower()
    if not text:
        return None
    protos = find_protocols(text)
    if not protos:
        return None
    proto = protos[0]
    codes = proto.get("icd10") or []
    if not codes:
        return None
    code = str(codes[0]).strip().upper()
    if not is_valid_icd10(code):
        return None
    return {
        "code": code,
        "description": str(proto.get("name") or "").strip(),
        "source": "protocol_db",
    }


def _nih_search(query: str, max_list: int = 8) -> list[dict[str, str]]:
    if len(query) < 2:
        return []
    try:
        resp = requests.get(
            _NIH_URL,
            params={"sf": "code,name", "terms": query, "maxList": max_list},
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()
        pairs = data[3] if isinstance(data, list) and len(data) > 3 else []
        out: list[dict[str, str]] = []
        for pair in pairs:
            if not isinstance(pair, (list, tuple)) or len(pair) < 2:
                continue
            code = str(pair[0]).strip().upper()
            desc = str(pair[1]).strip()
            if is_valid_icd10(code):
                out.append({"code": code, "description": desc, "source": "nih"})
        return out
    except Exception as exc:
        logger.warning("NIH ICD-10 lookup failed for %r: %s", query, exc)
        return []


def _best_nih_hit(diagnosis: str, max_list: int = 8) -> dict[str, str] | None:
    best: dict[str, str] | None = None
    best_score = 0.0
    for query in _search_queries(diagnosis):
        for hit in _nih_search(query, max_list):
            score = _match_score(diagnosis, hit["description"])
            if query != diagnosis and query in _UZ_SEARCH_ALIASES.values():
                score += 0.15
            if score > best_score:
                best_score = score
                best = hit
    if best and best_score >= 0.12:
        return best
    # Juda qisqa nomlar uchun birinchi NIH natijasini qabul qilish
    if best and len(_normalize_diag(diagnosis)) <= 24:
        return best
    return None


def _nih_verify_code(code: str, diagnosis: str) -> dict[str, str] | None:
    c = str(code or "").strip().upper()
    if not is_valid_icd10(c):
        return None
    hits = _nih_search(c, max_list=5)
    for hit in hits:
        if hit["code"] == c:
            if _match_score(diagnosis, hit["description"]) >= 0.08:
                return hit
            # Kod to'g'ri formatda, lekin tashxis nomi qisqa bo'lsa ham qabul
            if len(_normalize_diag(diagnosis)) <= 18:
                return hit
    return None


def lookup_nih(term: str, max_list: int = 8) -> dict[str, str] | None:
    return _best_nih_hit(term, max_list)


def lookup_llm(diagnosis: str, language: str) -> dict[str, str] | None:
    from .clinical_tools import _call_json, _lang

    lang = _lang(language)
    name = _normalize_diag(diagnosis)
    if not name:
        return None
    try:
        data = _call_json(
            f'Tibbiy tashxis: "{name}". '
            f"MKB-10 (ICD-10-CM, 10-reviziya) bo'yicha ENG MOS va ANIQ kodni tanlang. "
            f"Til: {lang}. "
            "Namuna/placeholder kodlar (X00.0, Z00.0, R00.0) ISHLATMANG. "
            'FAQAT JSON: {"code":"I10","description":"...","search_term":"english diagnosis term"}',
            max_tokens=500,
        )
    except Exception as exc:
        logger.warning("LLM ICD-10 lookup failed for %r: %s", diagnosis, exc)
        return None
    if not isinstance(data, dict):
        return None
    code = str(data.get("code") or "").strip().upper()
    if not is_valid_icd10(code):
        return None
    desc = str(data.get("description") or "").strip()
    search_term = str(data.get("search_term") or "").strip()
    verified = _nih_verify_code(code, name)
    if verified:
        return verified
    nih = _best_nih_hit(search_term or desc or name)
    if nih:
        return nih
    return None


def resolve_icd10(
    diagnosis: str,
    language: str = "uz-L",
    llm_code: str | None = None,
) -> dict[str, str]:
    """Tashxis uchun MKB-10 kodini qaytaradi: {code, description, source}."""
    name = _normalize_diag(diagnosis)
    if name.lower() in _UNKNOWN_NAMES:
        return {}

    proto = lookup_from_protocol_db(name)
    if proto:
        return proto

    nih = _best_nih_hit(name)
    if nih:
        if llm_code and is_valid_icd10(llm_code):
            llm_c = str(llm_code).strip().upper()
            if llm_c == nih["code"]:
                return nih
        return nih

    if llm_code and is_valid_icd10(llm_code):
        verified = _nih_verify_code(str(llm_code), name)
        if verified:
            return verified

    llm = lookup_llm(name, language)
    if llm:
        return llm

    return {}


def apply_icd10_to_consensus(consensus: dict, language: str = "uz-L") -> dict:
    """Asosiy va differensial tashxislarga MKB-10 kodlarini qo'shadi."""
    if not isinstance(consensus, dict):
        return consensus

    cd = consensus.get("consensus_diagnosis")
    if isinstance(cd, dict):
        diag_name = str(cd.get("name") or "").strip()
        if diag_name:
            hit = resolve_icd10(diag_name, language, cd.get("icd10"))
            if hit.get("code"):
                cd["icd10"] = hit["code"]
                if hit.get("description"):
                    cd["icd10_description"] = hit["description"]
            elif cd.get("icd10") and not is_valid_icd10(str(cd.get("icd10"))):
                cd.pop("icd10", None)
                cd.pop("icd10_description", None)
            consensus["consensus_diagnosis"] = cd

    diffs = consensus.get("differential_diagnoses") or []
    enriched: list[Any] = []
    for item in diffs:
        if not isinstance(item, dict):
            enriched.append(item)
            continue
        d = dict(item)
        d_name = str(d.get("name") or "").strip()
        if d_name and d_name.lower() not in _UNKNOWN_NAMES:
            hit = resolve_icd10(d_name, language, d.get("icd10"))
            if hit.get("code"):
                d["icd10"] = hit["code"]
                if hit.get("description"):
                    d["icd10_description"] = hit["description"]
            elif d.get("icd10") and not is_valid_icd10(str(d.get("icd10"))):
                d.pop("icd10", None)
                d.pop("icd10_description", None)
        enriched.append(d)
    consensus["differential_diagnoses"] = enriched
    return consensus
