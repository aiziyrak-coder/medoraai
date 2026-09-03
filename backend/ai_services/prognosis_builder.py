"""
Konsilium yakuniy hisobotida kasallik prognozi.

DIQQAT: bu yerda AI chaqiruvi ham, klinik mantiq ham yo'q edi — tashxis nomi qat'iy
gaplarga qo'yilib, doimiy "confidenceScore": 0.55 bilan HAR BIR hisobotga ilinar edi
(oshqozon osti bezi saratoni uchun ham, oddiy shamollash uchun ham bir xil matn).
Soxta prognoz o'rniga endi faqat modelning O'ZI bergan prognoz qaytariladi;
bo'lmasa None — hisobotda "prognosisReport" maydoni umuman bo'lmaydi.
"""
from __future__ import annotations

from typing import Any


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _str_list(val: Any, limit: int = 8) -> list[str]:
    if not isinstance(val, list):
        return []
    return [_s(x) for x in val if _s(x)][:limit]


def build_prognosis_report(
    consensus: dict,
    patient_data: dict | None = None,
    language: str = "uz-L",
) -> dict | None:
    """Model bergan prognozni normallashtiradi; prognoz bo'lmasa None qaytaradi.

    To'qib chiqarilgan matn yoki qat'iy `confidenceScore` QAYTARILMAYDI.
    """
    if not isinstance(consensus, dict):
        return None

    raw = (
        consensus.get("prognosis_report")
        or consensus.get("prognosisReport")
        or consensus.get("prognosis")
    )
    if not isinstance(raw, dict):
        return None

    short = _s(raw.get("short_term_prognosis") or raw.get("shortTermPrognosis"))
    long = _s(raw.get("long_term_prognosis") or raw.get("longTermPrognosis"))
    factors = _str_list(raw.get("key_factors") or raw.get("keyFactors"))

    if not short and not long and not factors:
        return None

    out: dict[str, Any] = {
        "shortTermPrognosis": short,
        "longTermPrognosis": long,
        "keyFactors": factors,
    }

    # Ishonch balli faqat model bergan bo'lsa uzatiladi — standart qiymat yo'q
    conf = raw.get("confidence_score", raw.get("confidenceScore"))
    try:
        if conf is not None:
            out["confidenceScore"] = max(0.0, min(1.0, float(conf)))
    except (TypeError, ValueError):
        pass

    return out
