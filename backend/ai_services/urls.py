"""
AI Services URLs
"""
from django.urls import path
from .views import (
    generate_clarifying_questions,
    recommend_specialists,
    generate_diagnoses,
    run_council_debate,
    generate_autonomous_protocol,
    make_clinical_decision,
    start_monitoring,
    record_vital_signs,
    stop_monitoring,
    record_treatment_outcome,
    get_improved_protocol,
)

app_name = 'ai_services'

urlpatterns = [
    path('clarifying-questions/', generate_clarifying_questions, name='clarifying_questions'),
    path('recommend-specialists/', recommend_specialists, name='recommend_specialists'),
    path('generate-diagnoses/', generate_diagnoses, name='generate_diagnoses'),
    path('council-debate/', run_council_debate, name='council_debate'),
    
    # Autonomous treatment endpoints
    path('autonomous-protocol/', generate_autonomous_protocol, name='autonomous_protocol'),
    path('clinical-decision/', make_clinical_decision, name='clinical_decision'),
    path('monitoring/start/', start_monitoring, name='start_monitoring'),
    path('monitoring/record/', record_vital_signs, name='record_vital_signs'),
    path('monitoring/stop/<str:session_id>/', stop_monitoring, name='stop_monitoring'),
    path('learning/outcome/', record_treatment_outcome, name='record_treatment_outcome'),
    path('learning/improve/', get_improved_protocol, name='get_improved_protocol'),
]
