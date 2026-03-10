from django.contrib import admin
from .models import Ward, Room, Device, PatientMonitor, VitalReading, AlarmThreshold, Alarm, MonitoringAuditLog, MonitoringNote


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'code']


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'ward', 'is_active', 'created_at']
    list_filter = ['ward', 'is_active']
    search_fields = ['name', 'code']


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ['serial_number', 'model', 'room', 'status', 'last_seen_at', 'is_active']
    list_filter = ['model', 'status', 'is_active']
    search_fields = ['serial_number']


@admin.register(PatientMonitor)
class PatientMonitorAdmin(admin.ModelAdmin):
    list_display = ['patient_name', 'bed_label', 'room', 'device', 'bed_status', 'assigned_to', 'is_active']
    list_filter = ['room', 'bed_status', 'is_active']
    search_fields = ['patient_name', 'bed_label', 'patient_identifier']


@admin.register(VitalReading)
class VitalReadingAdmin(admin.ModelAdmin):
    list_display = ['patient_monitor', 'timestamp', 'heart_rate', 'spo2', 'nibp_systolic', 'nibp_diastolic']
    list_filter = ['timestamp']
    date_hierarchy = 'timestamp'


@admin.register(AlarmThreshold)
class AlarmThresholdAdmin(admin.ModelAdmin):
    list_display = ['patient_monitor', 'param', 'min_value', 'max_value', 'severity', 'is_active']
    list_filter = ['param', 'severity']


@admin.register(Alarm)
class AlarmAdmin(admin.ModelAdmin):
    list_display = ['patient_monitor', 'param', 'value', 'severity', 'acknowledged_at', 'created_at']
    list_filter = ['severity', 'acknowledged_at']


@admin.register(MonitoringAuditLog)
class MonitoringAuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'patient_monitor', 'user', 'created_at']
    list_filter = ['action']
    date_hierarchy = 'created_at'


@admin.register(MonitoringNote)
class MonitoringNoteAdmin(admin.ModelAdmin):
    list_display = ['patient_monitor', 'created_by', 'created_at']
    date_hierarchy = 'created_at'
