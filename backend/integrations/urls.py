from django.urls import path
from . import fhir_views

urlpatterns = [
    path('fhir/Patient/<int:patient_id>/', fhir_views.fhir_patient, name='fhir-patient'),
    path('fhir/Bundle/Analysis/<int:analysis_id>/', fhir_views.fhir_analysis_bundle, name='fhir-analysis-bundle'),
]
