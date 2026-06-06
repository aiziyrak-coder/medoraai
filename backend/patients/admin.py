"""
Admin configuration for patients app
"""
from django.contrib import admin
from .models import Patient, PatientAttachment, PatientRegistryCounter


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ['registry_number', 'first_name', 'last_name', 'age', 'gender', 'created_by', 'created_at']
    list_filter = ['gender', 'created_at', 'created_by']
    search_fields = ['registry_number', 'first_name', 'last_name', 'phone', 'complaints']
    readonly_fields = ['registry_number', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'


@admin.register(PatientRegistryCounter)
class PatientRegistryCounterAdmin(admin.ModelAdmin):
    list_display = ['last_value']


@admin.register(PatientAttachment)
class PatientAttachmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'patient', 'mime_type', 'uploaded_at']
    list_filter = ['mime_type', 'uploaded_at']
    search_fields = ['name', 'patient__first_name', 'patient__last_name']