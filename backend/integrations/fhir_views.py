"""FHIR R4 asosiy eksport — bemor va diagnostik hisobot."""
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from analyses.models import AnalysisRecord
from patients.models import Patient


def _patient_to_fhir(patient: Patient) -> dict:
    name = f"{patient.first_name} {patient.last_name}".strip() or str(patient)
    gender = (patient.gender or 'unknown')[:1]
    return {
        'resourceType': 'Patient',
        'id': str(patient.id),
        'meta': {'lastUpdated': timezone.now().isoformat()},
        'name': [{'text': name}],
        'gender': gender if gender in ('m', 'f') else 'unknown',
    }


def _analysis_to_diagnostic_report(record: AnalysisRecord) -> dict:
    fr = record.final_report or {}
    diagnoses = fr.get('consensusDiagnosis') or fr.get('consensus_diagnosis') or []
    conclusion = '; '.join(
        str(d.get('name', '')) for d in diagnoses if isinstance(d, dict)
    ) or 'Konsilium xulosasi'
    return {
        'resourceType': 'DiagnosticReport',
        'id': f'analysis-{record.id}',
        'status': 'final' if record.final_report else 'preliminary',
        'code': {'text': 'AI Consilium Report'},
        'subject': {'reference': f'Patient/{record.patient_id}'},
        'effectiveDateTime': record.created_at.isoformat(),
        'conclusion': conclusion[:4000],
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fhir_patient(request, patient_id: int):
    patient = Patient.objects.filter(pk=patient_id).first()
    if not patient:
        return Response({'resourceType': 'OperationOutcome', 'issue': [{'severity': 'error'}]}, status=404)
    return Response(_patient_to_fhir(patient))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fhir_analysis_bundle(request, analysis_id: int):
    record = AnalysisRecord.objects.filter(pk=analysis_id).select_related('patient').first()
    if not record:
        return Response({'resourceType': 'OperationOutcome'}, status=404)
    bundle = {
        'resourceType': 'Bundle',
        'type': 'collection',
        'timestamp': timezone.now().isoformat(),
        'entry': [
            {'resource': _patient_to_fhir(record.patient)},
            {'resource': _analysis_to_diagnostic_report(record)},
        ],
    }
    return Response(bundle)
