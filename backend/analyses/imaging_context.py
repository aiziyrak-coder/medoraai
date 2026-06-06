"""UZI/UTT/Rengen AI hisobotidan konsilium kontekstini yig'ish."""
from __future__ import annotations

from typing import Any


def _s(val: Any) -> str:
    return str(val or '').strip()


def _infer_modality_keys(modality: str, report: dict) -> list[str]:
    study = _s(report.get('studyType') or report.get('study_type')).lower()
    keys: list[str] = []
    if modality in ('ultrasound', 'mixed', 'auto'):
        if modality == 'ultrasound' or any(k in study for k in ('uzi', 'utt', 'ultra', 'sono')):
            keys.append('ultrasound')
    if modality in ('xray', 'mixed', 'auto'):
        if modality == 'xray' or any(k in study for k in ('rentgen', 'xray', 'x-ray', 'rg')):
            keys.append('xray')
    if not keys:
        if modality == 'xray':
            keys = ['xray']
        else:
            keys = ['ultrasound']
    return keys


def build_structured_block(report: dict) -> dict:
    findings = report.get('keyFindings') or report.get('key_findings') or []
    if not isinstance(findings, list):
        findings = [str(findings)] if findings else []
    findings = [str(f).strip() for f in findings if str(f).strip()]
    recs = report.get('recommendations') or []
    if not isinstance(recs, list):
        recs = []
    return {
        'summary': _s(report.get('impression') or report.get('clinicalConclusion')),
        'key_findings': findings,
        'clinical_significance': _s(report.get('clinicalConclusion') or report.get('impression')),
        'limitations': _s(report.get('limitations')),
        'recommendations': [str(r) for r in recs if str(r).strip()][:8],
        'study_type': _s(report.get('studyType')),
        'region_or_organ': _s(report.get('regionOrOrgan') or report.get('region_or_organ')),
        'urgency': _s(report.get('urgencyLevel') or report.get('urgency_level')),
    }


def build_summary_text(report: dict, modality: str, study_date: str = '') -> str:
    block = build_structured_block(report)
    label = {
        'ultrasound': 'UZI / UTT',
        'xray': 'RENGEN',
        'mixed': 'UZI / UTT / RENGEN',
        'auto': 'TASVIR',
    }.get(modality, 'TASVIR')
    lines = [f"{label} TAHLILI (klinika guruhi, AI):"]
    if study_date:
        lines.append(f"Sana: {study_date}")
    if block['study_type']:
        lines.append(f"Tadqiqot: {block['study_type']}")
    if block['region_or_organ']:
        lines.append(f"Hudud/organ: {block['region_or_organ']}")
    if block['summary']:
        lines.append(f"Taassurot: {block['summary']}")
    if block['key_findings']:
        lines.append('Asosiy topilmalar:')
        for f in block['key_findings'][:12]:
            lines.append(f"  • {f}")
    meas = _s(report.get('measurements'))
    if meas:
        lines.append(f"O'lchamlar: {meas}")
    diff = _s(report.get('differentialDiagnosis') or report.get('differential_diagnosis'))
    if diff:
        lines.append(f"Differensial: {diff}")
    if block['clinical_significance'] and block['clinical_significance'] != block['summary']:
        lines.append(f"Klinik xulosa: {block['clinical_significance']}")
    if block['recommendations']:
        lines.append('Tavsiyalar: ' + '; '.join(block['recommendations'][:5]))
    if block['limitations']:
        lines.append(f"Cheklovlar: {block['limitations']}")
    if block['urgency'] and block['urgency'] not in ('routine', ''):
        lines.append(f"Shoshilinchlik: {block['urgency']}")
    return '\n'.join(lines)


def build_imaging_context_from_report(report: dict, modality: str = 'auto', study_date: str = '') -> tuple[str, dict]:
    """(summary_text, imaging_structured) qaytaradi."""
    if not isinstance(report, dict):
        report = {}
    summary = build_summary_text(report, modality, study_date)
    structured: dict[str, dict] = {}
    block = build_structured_block(report)
    for key in _infer_modality_keys(modality, report):
        structured[key] = dict(block)
    return summary, structured


def merge_imaging_structured(existing: dict | None, new: dict) -> dict:
    out = dict(existing or {})
    for key, block in (new or {}).items():
        if key not in out or not out[key]:
            out[key] = block
            continue
        prev = out[key]
        if not isinstance(prev, dict):
            out[key] = block
            continue
        merged = dict(prev)
        for field in ('summary', 'clinical_significance', 'limitations'):
            a = _s(prev.get(field))
            b = _s(block.get(field))
            if b and b not in a:
                merged[field] = f"{a}\n{b}".strip() if a else b
        pf = prev.get('key_findings') or []
        bf = block.get('key_findings') or []
        if isinstance(pf, list) and isinstance(bf, list):
            seen = {str(x) for x in pf}
            merged['key_findings'] = pf + [x for x in bf if str(x) not in seen]
        out[key] = merged
    return out
