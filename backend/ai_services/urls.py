"""
AI Services URLs  -  Azure AI Foundry
"""
from django.urls import path
from .views import (
    test_gemini,
    # New
    run_consilium_view,
    doctor_support_view,
    doctor_support_stream_view,
    # Legacy
    run_council_debate,
    generate_clarifying_questions,
    recommend_specialists,
    generate_diagnoses,
    generate_autonomous_protocol,
    make_clinical_decision,
    start_monitoring,
    record_vital_signs,
    stop_monitoring,
    record_treatment_outcome,
    get_improved_protocol,
)

app_name = "ai_services"

urlpatterns = [
    path("test-gemini/", test_gemini, name="test_gemini"),
    # в”Ђв”Ђ Multi-Agent Consilium в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    path("consilium/",          run_consilium_view,         name="consilium"),
    path("council-debate/",     run_council_debate,         name="council_debate"),  # backwards-compat

    # в”Ђв”Ђ Doctor Support Mode в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    path("doctor-support/",     doctor_support_view,        name="doctor_support"),
    path("doctor-stream/",      doctor_support_stream_view, name="doctor_stream"),

    # в”Ђв”Ђ Basic AI в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    path("clarifying-questions/",  generate_clarifying_questions, name="clarifying_questions"),
    path("recommend-specialists/", recommend_specialists,          name="recommend_specialists"),
    path("generate-diagnoses/",    generate_diagnoses,             name="generate_diagnoses"),

    # в”Ђв”Ђ Autonomous Protocol в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    path("autonomous-protocol/",   generate_autonomous_protocol,  name="autonomous_protocol"),
    path("clinical-decision/",     make_clinical_decision,        name="clinical_decision"),

    # в”Ђв”Ђ Monitoring в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    path("monitoring/start/",                 start_monitoring,   name="start_monitoring"),
    path("monitoring/record/",                record_vital_signs, name="record_vital_signs"),
    path("monitoring/stop/<str:session_id>/", stop_monitoring,    name="stop_monitoring"),

    # в”Ђв”Ђ Learning в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    path("learning/outcome/", record_treatment_outcome, name="record_treatment_outcome"),
    path("learning/improve/", get_improved_protocol,    name="get_improved_protocol"),

]