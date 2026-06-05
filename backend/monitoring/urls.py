from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard, name='monitoring-dashboard'),
    path('ingest/', views.ingest, name='monitoring-ingest'),
    path('alarms/', views.alarms_list, name='monitoring-alarms'),
    path('alarms/<int:alarm_id>/acknowledge/', views.acknowledge_alarm, name='monitoring-alarm-ack'),
    path('simulate/', views.simulate_vitals, name='monitoring-simulate'),
]
