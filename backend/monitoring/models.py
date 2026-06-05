"""Markazlashgan bemor monitoringi — vitallar va alarmlar."""
from django.conf import settings
from django.db import models
from django.utils import timezone


class MonitoringRoom(models.Model):
    name = models.CharField(max_length=120, verbose_name='Xona')
    ward = models.CharField(max_length=120, blank=True, verbose_name='Bo\'lim')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Monitoring xonasi'
        verbose_name_plural = 'Monitoring xonalari'

    def __str__(self):
        return self.name


class MonitoringDevice(models.Model):
    serial_number = models.CharField(max_length=64, unique=True, verbose_name='Seriya raqami')
    model_name = models.CharField(max_length=120, blank=True, verbose_name='Model')
    is_online = models.BooleanField(default=False, verbose_name='Onlayn')
    last_seen = models.DateTimeField(null=True, blank=True, verbose_name='Oxirgi signal')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Monitoring qurilmasi'
        verbose_name_plural = 'Monitoring qurilmalari'

    def __str__(self):
        return self.serial_number


class PatientMonitor(models.Model):
    patient_label = models.CharField(max_length=200, verbose_name='Bemor')
    external_patient_id = models.CharField(max_length=64, blank=True)
    room = models.ForeignKey(
        MonitoringRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='monitors',
    )
    device = models.ForeignKey(
        MonitoringDevice, on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments',
    )
    bed_label = models.CharField(max_length=32, blank=True, verbose_name='Karavot')
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Bemor monitori'
        verbose_name_plural = 'Bemor monitorlari'
        indexes = [models.Index(fields=['active'], name='pm_active_idx')]

    def __str__(self):
        return f"{self.patient_label} ({self.bed_label or '-'})"


class VitalReading(models.Model):
    patient_monitor = models.ForeignKey(
        PatientMonitor, on_delete=models.CASCADE, related_name='readings',
    )
    heart_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    spo2 = models.PositiveSmallIntegerField(null=True, blank=True)
    bp_sys = models.PositiveSmallIntegerField(null=True, blank=True)
    bp_dia = models.PositiveSmallIntegerField(null=True, blank=True)
    respiration = models.PositiveSmallIntegerField(null=True, blank=True)
    temperature = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    recorded_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name = 'Vital o\'qish'
        verbose_name_plural = 'Vital o\'qishlar'
        ordering = ['-recorded_at']


class MonitoringAlarm(models.Model):
    SEVERITY = [('info', 'Info'), ('warning', 'Warning'), ('critical', 'Critical')]
    patient_monitor = models.ForeignKey(
        PatientMonitor, on_delete=models.CASCADE, related_name='alarms',
    )
    severity = models.CharField(max_length=16, choices=SEVERITY, default='warning')
    code = models.CharField(max_length=64)
    message = models.TextField()
    acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Monitoring alarmi'
        verbose_name_plural = 'Monitoring alarmlari'
        ordering = ['-created_at']
