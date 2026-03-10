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
    monitoring_ai_risk_score,
    monitoring_ai_explain_alarm,
    monitoring_ai_daily_summary,
    monitoring_ai_draft_note,
    monitoring_ai_trend_prediction,
    monitoring_ai_early_warning,
    monitoring_ai_suggest_thresholds,
    monitoring_ai_mortality_prediction,
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

    # Monitoring AI (vitals/alarms asosida Gemini tahlil)
    path('monitoring/risk-score/', monitoring_ai_risk_score, name='monitoring_ai_risk_score'),
    path('monitoring/explain-alarm/', monitoring_ai_explain_alarm, name='monitoring_ai_explain_alarm'),
    path('monitoring/daily-summary/', monitoring_ai_daily_summary, name='monitoring_ai_daily_summary'),
    path('monitoring/draft-note/', monitoring_ai_draft_note, name='monitoring_ai_draft_note'),
    path('monitoring/trend-prediction/', monitoring_ai_trend_prediction, name='monitoring_ai_trend_prediction'),
    path('monitoring/early-warning/', monitoring_ai_early_warning, name='monitoring_ai_early_warning'),
    path('monitoring/suggest-thresholds/', monitoring_ai_suggest_thresholds, name='monitoring_ai_suggest_thresholds'),
    path('monitoring/mortality-prediction/', monitoring_ai_mortality_prediction, name='monitoring_ai_mortality_prediction'),
]
