"""
Monitoring API URL configuration.
"""
from django.urls import path
from . import views

app_name = 'monitoring'

urlpatterns = [
    path('wards/', views.WardListCreate.as_view(), name='ward-list'),
    path('wards/<int:pk>/', views.WardDetail.as_view(), name='ward-detail'),
    path('rooms/', views.RoomListCreate.as_view(), name='room-list'),
    path('rooms/<int:pk>/', views.RoomDetail.as_view(), name='room-detail'),
    path('devices/', views.DeviceList.as_view(), name='device-list'),
    path('devices/register/', views.DeviceRegister.as_view(), name='device-register'),
    path('devices/status/', views.DeviceStatus.as_view(), name='device-status'),
    path('devices/<int:pk>/', views.DeviceDetail.as_view(), name='device-detail'),
    path('patient-monitors/', views.PatientMonitorListCreate.as_view(), name='patient-monitor-list'),
    path('patient-monitors/<int:pk>/', views.PatientMonitorDetail.as_view(), name='patient-monitor-detail'),
    path('vitals/', views.VitalReadingList.as_view(), name='vital-list'),
    path('vitals/create/', views.VitalReadingCreate.as_view(), name='vital-create'),
    path('gateway-monitors/', views.GatewayMonitors.as_view(), name='gateway-monitors'),
    path('ingest/', views.IngestVitals.as_view(), name='ingest-vitals'),
    path('alarms/', views.AlarmList.as_view(), name='alarm-list'),
    path('alarms/<int:pk>/acknowledge/', views.AlarmAcknowledge.as_view(), name='alarm-acknowledge'),
    path('alarm-thresholds/', views.AlarmThresholdListCreate.as_view(), name='alarm-threshold-list'),
    path('dashboard/', views.DashboardSummary.as_view(), name='dashboard-summary'),
    path('audit-log/', views.AuditLogList.as_view(), name='audit-log-list'),
    path('notes/', views.MonitoringNoteListCreate.as_view(), name='notes-list-create'),
    path('vitals/export/', views.VitalsExport.as_view(), name='vitals-export'),
    path('vitals/compare/', views.VitalsCompare.as_view(), name='vitals-compare'),
    path('staff/', views.MonitoringStaffList.as_view(), name='monitoring-staff-list'),
    # 20 features: quick action, shift report, ward round PDF, medications, lab, stats, heatmap, bed forecast, family view, rapid response
    path('quick-action/', views.QuickActionView.as_view(), name='quick-action'),
    path('shift-report/', views.ShiftReportPDF.as_view(), name='shift-report'),
    path('ward-round-pdf/', views.WardRoundPDF.as_view(), name='ward-round-pdf'),
    path('medications/', views.MedicationListCreate.as_view(), name='medications-list-create'),
    path('medications/<int:pk>/mark-given/', views.MedicationMarkGiven.as_view(), name='medication-mark-given'),
    path('lab-results/', views.LabResultListCreate.as_view(), name='lab-results-list-create'),
    path('alarm-response-stats/', views.AlarmResponseStats.as_view(), name='alarm-response-stats'),
    path('alarm-heatmap/', views.AlarmHeatmap.as_view(), name='alarm-heatmap'),
    path('bed-forecast/', views.BedForecast.as_view(), name='bed-forecast'),
    path('family-view-token/', views.FamilyViewTokenCreate.as_view(), name='family-view-token'),
    path('family-view/', views.FamilyViewRead.as_view(), name='family-view-read'),
    path('rapid-response/', views.RapidResponseView.as_view(), name='rapid-response'),
]
