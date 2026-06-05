from django.contrib import admin
from .models import MonitoringRoom, MonitoringDevice, PatientMonitor, VitalReading, MonitoringAlarm

admin.site.register(MonitoringRoom)
admin.site.register(MonitoringDevice)
admin.site.register(PatientMonitor)
admin.site.register(VitalReading)
admin.site.register(MonitoringAlarm)
