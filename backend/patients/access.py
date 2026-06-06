"""Bemor ma'lumotlariga kirish: pasport (global) va klinik (guruh bo'yicha)."""
from __future__ import annotations

from accounts.group_scope import clinic_peer_user_ids
from analyses.models import AnalysisRecord

CLINICAL_FIELDS = (
    'complaints',
    'history',
    'objective_data',
    'lab_results',
    'allergies',
    'current_medications',
    'family_history',
    'additional_info',
    'structured_lab_results',
    'pharmacogenomics_report',
    'symptom_timeline',
    'mental_health_scores',
    'attachments',
)


def user_can_view_clinical(user, patient) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    peer_ids = set(clinic_peer_user_ids(user))
    if patient.created_by_id and patient.created_by_id in peer_ids:
        return True
    if getattr(patient, 'home_clinic_group_id', None) and user.clinic_group_id:
        if patient.home_clinic_group_id == user.clinic_group_id:
            return True
    return AnalysisRecord.objects.filter(
        patient=patient,
        created_by_id__in=peer_ids,
    ).exists()


def strip_clinical_payload(data: dict) -> dict:
    out = dict(data)
    for field in CLINICAL_FIELDS:
        if field in out:
            if field in ('structured_lab_results', 'mental_health_scores'):
                out[field] = {}
            elif field in ('symptom_timeline', 'attachments'):
                out[field] = []
            else:
                out[field] = ''
    return out
