"""
MKB-10 (ICD-10-CM, 10-reviziya) kodlarini tashxis nomi bo'yicha aniqlash.

Ustuvorlik:
  1. O'zbekiston SSV protokollari bazasi (kalit so'z mosligi)
  2. NIH Clinical Tables ICD-10-CM API
  3. LLM (faqat tekshirilgan, haqiqiy formatdagi kodlar)
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


def _nih_search(query: str, max_list: int = 8) -> dict[str, str] | None:
    if len(query) < 2:
        return None
    try:
        resp = requests.get(
            _NIH_URL,
            params={"sf": "code,name", "terms": query, "maxList": max_list},
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()
        pairs = data[3] if isinstance(data, list) and len(data) > 3 else []
        if not pairs:
            return None
        code = str(pairs[0][0]).strip().upper()
        desc = str(pairs[0][1]).strip() if len(pairs[0]) > 1 else ""
        if not is_valid_icd10(code):
            return None
        return {"code": code, "description": desc, "source": "nih"}
    except Exception as exc:
        logger.warning("NIH ICD-10 lookup failed for %r: %s", query, exc)
        return None


def lookup_nih(term: str, max_list: int = 8) -> dict[str, str] | None:
    query = _normalize_diag(term)
    hit = _nih_search(query, max_list)
    if hit:
        return hit
    lower = query.lower()
    for uz_key, en_term in _UZ_SEARCH_ALIASES.items():
        if uz_key in lower:
            return _nih_search(en_term, max_list)
    return None


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
            "Namuna/placeholder kodlar (X00.0, Z00.0) ISHLATMANG. "
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
    nih = lookup_nih(search_term or desc or name)
    if nih:
        return nih
    return {"code": code, "description": desc, "source": "llm"}


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

    if llm_code and is_valid_icd10(llm_code):
        nih = lookup_nih(name)
        if nih:
            return nih
        nih_code = lookup_nih(llm_code)
        if nih_code:
            return nih_code
        return {
            "code": str(llm_code).strip().upper(),
            "description": "",
            "source": "consensus",
        }

    nih = lookup_nih(name)
    if nih:
        return nih

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
        enriched.append(d)
    consensus["differential_diagnoses"] = enriched
    return consensus
