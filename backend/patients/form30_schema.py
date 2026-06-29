"""SSV 210 — Forma-30 (dispanser karta) maydonlari."""
from __future__ import annotations

from datetime import date

FORM30_DEFAULTS: dict = {
    'registration_number': '',
    'workplace': '',
    'disability_group': '',
    'main_diagnosis': '',
    'comorbidities': '',
    'treatment_plan': '',
    'diet_recommendations': '',
    'physical_activity': '',
    'smoking_status': '',
    'alcohol_status': '',
    'last_hospitalization': '',
    'emergency_calls_count': 0,
    'examinations_done': [],
    'consultations_done': [],
    'sanatorium_treatment': '',
    'notes': '',
}


def normalize_form30_data(raw: dict | None, *, diagnosis: str = '') -> dict:
    data = {**FORM30_DEFAULTS}
    if raw:
        for k, v in raw.items():
            if k in FORM30_DEFAULTS:
                data[k] = v
    if diagnosis and not data.get('main_diagnosis'):
        data['main_diagnosis'] = diagnosis
    return data


def form30_from_checkup(checkup) -> dict:
    """Ko'rikdan Forma-30 uchun boshlang'ich ma'lumot."""
    pop = checkup.population
    return normalize_form30_data(
        {
            'main_diagnosis': checkup.new_diagnoses or checkup.existing_diagnoses or '',
            'treatment_plan': checkup.tactics or checkup.recommendations or '',
            'examinations_done': [
                f"Ko'rik {checkup.checkup_date}: BP {checkup.blood_pressure or '—'}, BMI {checkup.bmi or '—'}",
            ],
            'notes': checkup.recommendations or '',
        },
        diagnosis=checkup.new_diagnoses or '',
    )


def validate_form30_data(data: dict) -> dict:
    out = normalize_form30_data(data)
    if out.get('emergency_calls_count') is not None:
        try:
            out['emergency_calls_count'] = int(out['emergency_calls_count'])
        except (TypeError, ValueError):
            out['emergency_calls_count'] = 0
    for list_key in ('examinations_done', 'consultations_done'):
        val = out.get(list_key)
        if isinstance(val, str):
            out[list_key] = [v.strip() for v in val.split('\n') if v.strip()]
        elif not isinstance(val, list):
            out[list_key] = []
    return out
