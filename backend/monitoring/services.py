"""
Monitoring business logic: alarm evaluation on vital ingest.
Default clinical rules + per-patient AlarmThreshold; creates Alarm records.
"""
import logging
from django.utils import timezone

from .models import VitalReading, Alarm, AlarmThreshold

logger = logging.getLogger(__name__)

# Default critical thresholds (hospital-grade)
DEFAULT_SPO2_CRITICAL_MIN = 90
DEFAULT_HR_CRITICAL_HIGH = 130
DEFAULT_HR_CRITICAL_LOW = 40
DEFAULT_NIBP_SYS_CRITICAL_HIGH = 180
DEFAULT_NIBP_SYS_CRITICAL_LOW = 90
DEFAULT_NIBP_DIA_CRITICAL_HIGH = 120
DEFAULT_NIBP_DIA_CRITICAL_LOW = 60


def get_vital_status(v: dict) -> str:
    """
    Return 'normal'|'warning'|'critical' from vital dict (heart_rate, spo2, nibp_systolic, nibp_diastolic).
    Matches frontend getVitalStatus logic for dashboard filter and summary.
    """
    hr = v.get('heart_rate')
    spo2 = v.get('spo2')
    sys_val = v.get('nibp_systolic')
    dia_val = v.get('nibp_diastolic')
    if spo2 is not None and spo2 < 90:
        return 'critical'
    if hr is not None and (hr > 130 or hr < 40):
        return 'critical'
    if sys_val is not None and (sys_val > 180 or sys_val < 90):
        return 'critical'
    if dia_val is not None and (dia_val > 120 or dia_val < 60):
        return 'critical'
    if spo2 is not None and 90 <= spo2 < 95:
        return 'warning'
    if hr is not None and ((100 <= hr <= 130) or (40 <= hr < 50)):
        return 'warning'
    return 'normal'


def _get_threshold_value(patient_monitor, param: str, min_or_max: str) -> int | None:
    """Return custom threshold for patient_monitor if set."""
    try:
        t = AlarmThreshold.objects.filter(
            patient_monitor=patient_monitor,
            param=param,
            is_active=True,
        ).first()
        if not t:
            return None
        return t.min_value if min_or_max == 'min' else t.max_value
    except Exception:
        return None


def evaluate_vital_alarms(reading: VitalReading) -> list[Alarm]:
    """
    Evaluate vital reading against default and per-patient thresholds.
    Creates Alarm records for critical/urgent violations.
    Returns list of newly created alarms.
    """
    pm = reading.patient_monitor
    created: list[Alarm] = []

    # SpO2 < 90 (critical)
    if reading.spo2 is not None:
        thr_min = _get_threshold_value(pm, 'spo2', 'min') or DEFAULT_SPO2_CRITICAL_MIN
        if reading.spo2 < thr_min:
            if not Alarm.objects.filter(
                patient_monitor=pm, param='spo2', severity='critical', acknowledged_at__isnull=True
            ).exists():
                alarm = Alarm.objects.create(
                    patient_monitor=pm,
                    param='spo2',
                    severity='critical',
                    value=float(reading.spo2),
                    message=f'SpO2 {reading.spo2}% below {thr_min}',
                )
                created.append(alarm)
                logger.info('Alarm created: SpO2 critical pm_id=%s value=%s', pm.id, reading.spo2)

    # Heart rate > 130 or < 40 (critical)
    if reading.heart_rate is not None:
        hr_high = _get_threshold_value(pm, 'heart_rate', 'max') or DEFAULT_HR_CRITICAL_HIGH
        hr_low = _get_threshold_value(pm, 'heart_rate', 'min') or DEFAULT_HR_CRITICAL_LOW
        if reading.heart_rate > hr_high:
            if not Alarm.objects.filter(
                patient_monitor=pm, param='heart_rate', severity='critical', acknowledged_at__isnull=True
            ).exists():
                alarm = Alarm.objects.create(
                    patient_monitor=pm,
                    param='heart_rate',
                    severity='critical',
                    value=float(reading.heart_rate),
                    message=f'Heart rate {reading.heart_rate} above {hr_high}',
                )
                created.append(alarm)
        elif reading.heart_rate < hr_low:
            if not Alarm.objects.filter(
                patient_monitor=pm, param='heart_rate', severity='critical', acknowledged_at__isnull=True
            ).exists():
                alarm = Alarm.objects.create(
                    patient_monitor=pm,
                    param='heart_rate',
                    severity='critical',
                    value=float(reading.heart_rate),
                    message=f'Heart rate {reading.heart_rate} below {hr_low}',
                )
                created.append(alarm)

    # Critical BP: systolic/diastolic
    sys_val = reading.nibp_systolic
    dia_val = reading.nibp_diastolic
    if sys_val is not None:
        sys_high = _get_threshold_value(pm, 'nibp_systolic', 'max') or DEFAULT_NIBP_SYS_CRITICAL_HIGH
        sys_low = _get_threshold_value(pm, 'nibp_systolic', 'min') or DEFAULT_NIBP_SYS_CRITICAL_LOW
        if sys_val > sys_high:
            if not Alarm.objects.filter(
                patient_monitor=pm, param='nibp_systolic', severity='critical', acknowledged_at__isnull=True
            ).exists():
                alarm = Alarm.objects.create(
                    patient_monitor=pm,
                    param='nibp_systolic',
                    severity='critical',
                    value=float(sys_val),
                    message=f'BP systolic {sys_val} above {sys_high}',
                )
                created.append(alarm)
        elif sys_val < sys_low:
            if not Alarm.objects.filter(
                patient_monitor=pm, param='nibp_systolic', severity='critical', acknowledged_at__isnull=True
            ).exists():
                alarm = Alarm.objects.create(
                    patient_monitor=pm,
                    param='nibp_systolic',
                    severity='critical',
                    value=float(sys_val),
                    message=f'BP systolic {sys_val} below {sys_low}',
                )
                created.append(alarm)
    if dia_val is not None:
        dia_high = _get_threshold_value(pm, 'nibp_diastolic', 'max') or DEFAULT_NIBP_DIA_CRITICAL_HIGH
        dia_low = _get_threshold_value(pm, 'nibp_diastolic', 'min') or DEFAULT_NIBP_DIA_CRITICAL_LOW
        if dia_val > dia_high:
            if not Alarm.objects.filter(
                patient_monitor=pm, param='nibp_diastolic', severity='critical', acknowledged_at__isnull=True
            ).exists():
                alarm = Alarm.objects.create(
                    patient_monitor=pm,
                    param='nibp_diastolic',
                    severity='critical',
                    value=float(dia_val),
                    message=f'BP diastolic {dia_val} above {dia_high}',
                )
                created.append(alarm)
        elif dia_val < dia_low:
            if not Alarm.objects.filter(
                patient_monitor=pm, param='nibp_diastolic', severity='critical', acknowledged_at__isnull=True
            ).exists():
                alarm = Alarm.objects.create(
                    patient_monitor=pm,
                    param='nibp_diastolic',
                    severity='critical',
                    value=float(dia_val),
                    message=f'BP diastolic {dia_val} below {dia_low}',
                )
                created.append(alarm)

    return created


def escalate_unacknowledged_alarms(minutes: int = 5) -> int:
    """
    Escalate unacknowledged alarms older than `minutes`: warning/urgent -> critical.
    Returns count of alarms escalated.
    """
    from .models import Alarm
    from django.utils import timezone
    from datetime import timedelta
    threshold = timezone.now() - timedelta(minutes=minutes)
    to_escalate = Alarm.objects.filter(
        acknowledged_at__isnull=True,
        created_at__lt=threshold,
        severity__in=('warning', 'urgent'),
    )
    count = to_escalate.update(severity='critical')
    if count:
        logger.info('Escalated %d unacknowledged alarms to critical (older than %s min)', count, minutes)
    return count
