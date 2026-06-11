"""
Admin configuration for analyses app
"""
from django.contrib import admin
from .models import (
    AnalysisRecord,
    AnalysisAuditLog,
    AnalysisUsefulnessFeedback,
    DiagnosisFeedback,
    ImagingStudyRecord,
)


@admin.register(AnalysisRecord)
class AnalysisRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'patient', 'created_by', 'created_at']
    list_filter = ['created_at', 'created_by']
    search_fields = ['patient__first_name', 'patient__last_name', 'external_patient_id']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
    list_select_related = ['patient', 'created_by']
    list_per_page = 30
    show_full_result_count = False


@admin.register(DiagnosisFeedback)
class DiagnosisFeedbackAdmin(admin.ModelAdmin):
    list_display = ['diagnosis_name', 'feedback', 'analysis', 'created_by', 'created_at']
    list_filter = ['feedback', 'created_at']
    search_fields = ['diagnosis_name', 'analysis__patient__first_name']
    list_select_related = ['analysis', 'created_by']
    list_per_page = 30


@admin.register(ImagingStudyRecord)
class ImagingStudyRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'patient', 'modality', 'created_by', 'created_at']
    list_filter = ['modality', 'created_at']
    search_fields = ['patient__first_name', 'patient__last_name', 'summary_text']
    list_select_related = ['patient', 'created_by']
    list_per_page = 30


@admin.register(AnalysisAuditLog)
class AnalysisAuditLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'analysis', 'action', 'user', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['analysis__patient__first_name', 'user__phone']
    readonly_fields = ['created_at']
    list_select_related = ['analysis', 'user']
    list_per_page = 40


@admin.register(AnalysisUsefulnessFeedback)
class AnalysisUsefulnessFeedbackAdmin(admin.ModelAdmin):
    list_display = ['analysis', 'useful', 'user', 'created_at']
    list_filter = ['useful', 'created_at']
    list_select_related = ['analysis', 'user']