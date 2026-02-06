"""
Admin configuration for analyses app
"""
from django.contrib import admin
from .models import AnalysisRecord, DiagnosisFeedback


@admin.register(AnalysisRecord)
class AnalysisRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'patient', 'created_by', 'created_at']
    list_filter = ['created_at', 'created_by']
    search_fields = ['patient__first_name', 'patient__last_name', 'external_patient_id']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'


@admin.register(DiagnosisFeedback)
class DiagnosisFeedbackAdmin(admin.ModelAdmin):
    list_display = ['diagnosis_name', 'feedback', 'analysis', 'created_by', 'created_at']
    list_filter = ['feedback', 'created_at']
    search_fields = ['diagnosis_name', 'analysis__patient__first_name']
