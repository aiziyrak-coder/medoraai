"""Monitoring API — dashboard, ingest, alarmlar."""
import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import MonitoringDevice, MonitoringRoom, PatientMonitor, VitalReading, MonitoringAlarm

logger = logging.getLogger(__name__)


def _check_ingest_key(request) -> bool:
    key = getattr(settings, 'MONITORING_INGEST_API_KEY', '') or ''
    if not key:
        return False
    return request.headers.get('X-API-Key') == key


def _evaluate_alarms(pm: PatientMonitor, reading: VitalReading) -> list[MonitoringAlarm]:
    alarms: list[MonitoringAlarm] = []
    if reading.spo2 is not None and reading.spo2 < 90:
        alarms.append(MonitoringAlarm.objects.create(
            patient_monitor=pm, severity='critical', code='HYPOXIA',
            message=f'SpO2 {reading.spo2}% — gipoksiya',
        ))
    if reading.heart_rate is not None and (reading.heart_rate < 40 or reading.heart_rate > 150):
        alarms.append(MonitoringAlarm.objects.create(
            patient_monitor=pm, severity='warning', code='HR_ABNORMAL',
            message=f'Puls {reading.heart_rate} bpm',
        ))
    if reading.bp_sys is not None and reading.bp_sys >= 180:
        alarms.append(MonitoringAlarm.objects.create(
            patient_monitor=pm, severity='warning',
            code='HTN', message=f'Qon bosimi SYS {reading.bp_sys}',
        ))
    return alarms


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """GET /api/monitoring/dashboard/"""
    monitors = PatientMonitor.objects.filter(active=True).select_related('room', 'device')[:24]
    cards = []
    for pm in monitors:
        last = pm.readings.first()
        open_alarms = pm.alarms.filter(acknowledged=False).count()
        cards.append({
            'id': pm.id,
            'patient_label': pm.patient_label,
            'bed_label': pm.bed_label,
            'room': pm.room.name if pm.room else '',
            'device_online': pm.device.is_online if pm.device else False,
            'vitals': {
                'heartRate': last.heart_rate if last else None,
                'spO2': last.spo2 if last else None,
                'bpSystolic': last.bp_sys if last else None,
                'bpDiastolic': last.bp_dia if last else None,
                'respirationRate': last.respiration if last else None,
                'temperature': float(last.temperature) if last and last.temperature else None,
            } if last else None,
            'open_alarms': open_alarms,
            'last_reading_at': last.recorded_at.isoformat() if last else None,
        })
    return Response({'success': True, 'data': {'patients': cards}})


@api_view(['POST'])
@permission_classes([AllowAny])
def ingest(request):
    """POST /api/monitoring/ingest/ — gateway yoki simulyator."""
    if not _check_ingest_key(request) and not request.user.is_authenticated:
        return Response({'success': False, 'error': 'Unauthorized'}, status=401)

    device_id = request.data.get('device_id') or request.data.get('serial_number')
    patient_monitor_id = request.data.get('patient_monitor_id')
    if not device_id and not patient_monitor_id:
        return Response({'success': False, 'error': 'device_id yoki patient_monitor_id kerak'}, status=400)

    device, _ = MonitoringDevice.objects.get_or_create(
        serial_number=str(device_id or 'SIM-001'),
        defaults={'model_name': request.data.get('model', 'Simulator')},
    )
    device.is_online = True
    device.last_seen = timezone.now()
    device.save(update_fields=['is_online', 'last_seen'])

    if patient_monitor_id:
        pm = PatientMonitor.objects.filter(pk=patient_monitor_id, active=True).first()
    else:
        pm = PatientMonitor.objects.filter(device=device, active=True).first()
    if not pm:
        room, _ = MonitoringRoom.objects.get_or_create(name='Palata 1', defaults={'ward': 'Terapiya'})
        pm = PatientMonitor.objects.create(
            patient_label=request.data.get('patient_label', 'Nawqas'),
            device=device,
            room=room,
            bed_label=request.data.get('bed_label', '1'),
        )

    reading = VitalReading.objects.create(
        patient_monitor=pm,
        heart_rate=request.data.get('heart_rate') or request.data.get('heartRate'),
        spo2=request.data.get('spo2') or request.data.get('spO2'),
        bp_sys=request.data.get('bp_sys') or request.data.get('bpSys'),
        bp_dia=request.data.get('bp_dia') or request.data.get('bpDia'),
        respiration=request.data.get('respiration') or request.data.get('respirationRate'),
        temperature=request.data.get('temperature'),
    )
    alarms = _evaluate_alarms(pm, reading)
    return Response({
        'success': True,
        'data': {'reading_id': reading.id, 'alarms': len(alarms)},
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alarms_list(request):
    qs = MonitoringAlarm.objects.filter(acknowledged=False).select_related('patient_monitor')[:50]
    return Response({
        'success': True,
        'data': [
            {
                'id': a.id,
                'severity': a.severity,
                'code': a.code,
                'message': a.message,
                'patient': a.patient_monitor.patient_label,
                'created_at': a.created_at.isoformat(),
            }
            for a in qs
        ],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def acknowledge_alarm(request, alarm_id: int):
    alarm = MonitoringAlarm.objects.filter(pk=alarm_id).first()
    if not alarm:
        return Response({'success': False}, status=404)
    alarm.acknowledged = True
    alarm.acknowledged_by = request.user
    alarm.save(update_fields=['acknowledged', 'acknowledged_by'])
    return Response({'success': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def simulate_vitals(request):
    """Dev/demo: autentifikatsiyalangan foydalanuvchi uchun simulyatsiya."""
    import random
    pm = PatientMonitor.objects.filter(active=True).first()
    if not pm:
        room, _ = MonitoringRoom.objects.get_or_create(name='Demo palata')
        dev, _ = MonitoringDevice.objects.get_or_create(serial_number='DEMO-001')
        pm = PatientMonitor.objects.create(patient_label='Demo nawqas', room=room, device=dev, bed_label='A1')
    reading = VitalReading.objects.create(
        patient_monitor=pm,
        heart_rate=random.randint(62, 98),
        spo2=random.randint(94, 99),
        bp_sys=random.randint(110, 145),
        bp_dia=random.randint(70, 90),
        respiration=random.randint(14, 20),
        temperature=36.6,
    )
    _evaluate_alarms(pm, reading)
    return Response({'success': True, 'data': {'patient_monitor_id': pm.id}})
