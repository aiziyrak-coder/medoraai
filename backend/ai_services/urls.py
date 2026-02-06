"""
AI Services URLs
"""
from django.urls import path
from .views import (
    generate_clarifying_questions,
    recommend_specialists,
    generate_diagnoses,
    run_council_debate,
)

app_name = 'ai_services'

urlpatterns = [
    path('clarifying-questions/', generate_clarifying_questions, name='clarifying_questions'),
    path('recommend-specialists/', recommend_specialists, name='recommend_specialists'),
    path('generate-diagnoses/', generate_diagnoses, name='generate_diagnoses'),
    path('council-debate/', run_council_debate, name='council_debate'),
]
