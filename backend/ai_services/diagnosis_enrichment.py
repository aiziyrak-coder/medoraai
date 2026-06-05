"""
Tashxis qo'yilgandan keyin klinik vositalarni ishga tushirish.
Natijalar alohida bo'lim emas — mavjud yakuniy hisobot maydonlariga tushadi.
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _patient_age(patient_data: dict) -> int | None:
    raw = _s(patient_data.get("age"))
    if not raw:
        return None
    m = re.search(r"\d{1,3}", raw)
    if not m:
        return None
    try:
        return int(m.group(0))
    except (TypeError, ValueError):
        return None


def _collect_drug_names(patient_data: dict, consensus: dict) -> list[str]:
    names: list[str] = []
    for key in ("currentMedications", "current_medications"):
        text = _s(patient_data.get(key))
        if text:
            names.extend(p.strip() for p in re.split(r"[,;\n]+", text) if p.strip())
    for m in consensus.get("medications") or []:
        if not isinstance(m, dict):
            continue
        for k in ("name", "generic"):
            v = _s(m.get(k))
            if v:
                names.append(v)
    seen: set[str] = set()
    out: list[str] = []
    for n in names:
        k = n.lower()
        if k not in seen:
            seen.add(k)
            out.append(n[:80])
    return out[:10]


def _merge_research(consensus: dict, items: list[dict]) -> None:
    if not items:
        return
    existing = consensus.get("related_research") or consensus.get("relatedResearch") or []
    if not isinstance(existing, list):
        existing = []
    urls = {str(x.get("url", "")).strip() for x in existing if isinstance(x, dict)}
    for item in items:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        if url and url in urls:
            continue
        if url:
            urls.add(url)
        existing.append({
            "title": title,
            "summary": str(item.get("summary") or item.get("snippet") or "").strip(),
            "url": url,
        })
    if existing:
        consensus["related_research"] = existing[:8]


def enrich_consensus_with_diagnosis_tools(
    consensus: dict,
    patient_data: dict,
    language: str = "uz-L",
) -> dict:
    """Konsensus tayyor bo'lgach — tashxisga mos vositalar (token tejash: faqat keraklilari)."""
    if not isinstance(consensus, dict):
        return consensus

    cd = consensus.get("consensus_diagnosis")
    if not isinstance(cd, dict):
        return consensus

    diag_name = _s(cd.get("name"))
    if not diag_name:
        return consensus

    try:
        from .clinical_tools import (
            icd10_codes,
            guideline_search,
            drug_interactions,
            patient_explain,
            pediatric_dose,
        )
    except ImportError as exc:
        logger.warning("Clinical tools import failed: %s", exc)
        return consensus

    # ICD-10 → konsensus tashxis
    try:
        codes = icd10_codes(diag_name, language)
        if codes and isinstance(codes[0], dict):
            code = _s(codes[0].get("code"))
            desc = _s(codes[0].get("description"))
            if code:
                cd["icd10"] = code
                if desc and not _s(cd.get("justification")).startswith(code):
                    cd["icd10_description"] = desc
                consensus["consensus_diagnosis"] = cd
    except Exception as exc:
        logger.warning("ICD-10 enrichment failed: %s", exc)

    # Qo'llanma → related_research + protokol izohi
    try:
        gl = guideline_search(diag_name, language)
        if isinstance(gl, dict):
            summary = _s(gl.get("summary"))
            if summary and not _s(cd.get("uzbek_protocol_match")):
                cd["uzbek_protocol_match"] = summary[:500]
                consensus["consensus_diagnosis"] = cd
            sources = gl.get("sources") or []
            research_items = []
            if isinstance(sources, list):
                for s in sources[:5]:
                    if isinstance(s, dict):
                        research_items.append({
                            "title": s.get("title"),
                            "summary": s.get("snippet"),
                            "url": s.get("url"),
                        })
            _merge_research(consensus, research_items)
    except Exception as exc:
        logger.warning("Guideline enrichment failed: %s", exc)

    # DDI → farmakologiya ogohlantirishlari
    drugs = _collect_drug_names(patient_data, consensus)
    if len(drugs) >= 2:
        try:
            ddi = drug_interactions(drugs, language)
            if isinstance(ddi, dict):
                desc = _s(ddi.get("description"))
                sev = _s(ddi.get("severity"))
                if desc:
                    note = f"DDI ({sev}): {desc}" if sev else desc
                    warnings = list(consensus.get("pharmacology_warnings") or [])
                    if note not in warnings:
                        warnings.append(note[:400])
                    consensus["pharmacology_warnings"] = warnings[:10]
                for rec in (ddi.get("recommendations") or [])[:3]:
                    r = _s(rec)
                    if r:
                        warnings = list(consensus.get("pharmacology_warnings") or [])
                        if r not in warnings:
                            warnings.append(r[:300])
                        consensus["pharmacology_warnings"] = warnings[:10]
        except Exception as exc:
            logger.warning("DDI enrichment failed: %s", exc)

    # Bemor uchun sodda tushuntirish
    try:
        ctx = f"Tashxis: {diag_name}. { _s(cd.get('justification'))[:600]}"
        text = patient_explain(ctx, language)
        if text:
            consensus["simplified_family_explanation"] = text[:4000]
    except Exception as exc:
        logger.warning("Patient explain enrichment failed: %s", exc)

    # Pediatrik doza (tashxis + yosh asosida)
    age = _patient_age(patient_data)
    if age is not None and age < 18 and drugs:
        ped_notes: list[str] = []
        weight_raw = _s(patient_data.get("weightKg") or patient_data.get("weight_kg"))
        try:
            weight = float(weight_raw) if weight_raw else max(10.0, age * 2.5)
        except (TypeError, ValueError):
            weight = max(10.0, age * 2.5)
        for drug in drugs[:3]:
            try:
                pd = pediatric_dose(drug, weight, language)
                dose = _s(pd.get("dose"))
                if dose:
                    ped_notes.append(f"{drug}: {dose}")
                for w in (pd.get("warnings") or [])[:2]:
                    ped_notes.append(f"{drug}: {_s(w)}")
            except Exception:
                continue
        if ped_notes:
            consensus["pediatric_dosing_notes"] = ped_notes[:6]

    return consensus
