"""
Bemor Monitoring Platform – Device, Room, Vitals, Alarms.
Unified with main backend (single DB design).
"""
from django.db import models
from django.conf import settings


class Ward(models.Model):
    """Qanot/bino – palatalar guruhi (xalqaro: unit/ward hierarchy)."""
    name = models.CharField(max_length=100, verbose_name='Nomi')
    code = models.CharField(max_length=20, unique=True, blank=True, verbose_name='Kod')
    description = models.TextField(blank=True, verbose_name='Tavsif')
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Qanot'
        verbose_name_plural = 'Qanotlar'
        ordering = ['name']

    def __str__(self):
        return self.name or self.code or str(self.pk)


class Room(models.Model):
    """Xona/palata – monitorlar va bemorlar biriktiriladi."""
    ward = models.ForeignKey(
        'Ward',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rooms',
        verbose_name='Qanot'
    )
    name = models.CharField(max_length=100, verbose_name='Xona nomi')
    code = models.CharField(max_length=20, unique=True, blank=True, verbose_name='Kod')
    description = models.TextField(blank=True, verbose_name='Tavsif')
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Xona'
        verbose_name_plural = 'Xonalar'
        ordering = ['name']

    def __str__(self):
        return self.name or self.code or str(self.pk)


class Device(models.Model):
    """Monitor qurilmasi (Creative K12, HL7 va boshqalar)."""
    MODEL_CHOICES = [
        ('creative_k12', 'Creative Medical K12'),
        ('hl7_generic', 'HL7 Generic'),
        ('other', 'Boshqa'),
    ]
    STATUS_CHOICES = [
        ('online', 'Onlayn'),
        ('offline', 'Offlayn'),
        ('maintenance', 'Texnik xizmat'),
    ]
    model = models.CharField(max_length=50, choices=MODEL_CHOICES, default='creative_k12', verbose_name='Model')
    serial_number = models.CharField(max_length=100, unique=True, verbose_name='Seriya raqami')
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='devices',
        verbose_name='Xona'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='offline', db_index=True)
    last_seen_at = models.DateTimeField(null=True, blank=True, verbose_name='Oxirgi ulanish')
    host = models.CharField(max_length=255, blank=True, default='', verbose_name='IP manzil (TCP ulanish)')
    port = models.PositiveIntegerField(null=True, blank=True, verbose_name='Port (TCP)')
    meta = models.JSONField(default=dict, blank=True, verbose_name='Qoʻshimcha maʼlumot')
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Qurilma'
        verbose_name_plural = 'Qurilmalar'
        ordering = ['room', 'serial_number']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['room', 'status']),
        ]

    def __str__(self):
        return f"{self.get_model_display()} ({self.serial_number})"


class PatientMonitor(models.Model):
    """Bemor – qurilma va xonaga biriktirish (bitta qurilma = bitta bemor/bed)."""
    device = models.OneToOneField(
        Device,
        on_delete=models.CASCADE,
        related_name='patient_monitor',
        verbose_name='Qurilma'
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='patient_monitors',
        verbose_name='Xona'
    )
    bed_label = models.CharField(max_length=50, blank=True, verbose_name='Kravat/joy')
    patient_name = models.CharField(max_length=255, blank=True, verbose_name='Bemor ismi')
    patient_identifier = models.CharField(max_length=100, blank=True, db_index=True, verbose_name='Bemor ID')
    age = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Yoshi')
    GENDER_CHOICES = [
        ('M', 'Erkak'),
        ('F', 'Ayol'),
        ('other', 'Boshqa'),
    ]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, verbose_name='Jinsi')
    medical_notes = models.TextField(blank=True, verbose_name='Tibbiy eslatma')
    BED_STATUS_CHOICES = [
        ('occupied', 'Band'),
        ('empty', 'Bo\'sh'),
        ('reserved', 'Band qilingan'),
        ('cleaning', 'Tozalanmoqda'),
    ]
    bed_status = models.CharField(
        max_length=20, choices=BED_STATUS_CHOICES, default='occupied', db_index=True, verbose_name='Kravat holati'
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_patient_monitors',
        verbose_name='Mas\'ul hamshira/xodim'
    )
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Bemor monitor'
        verbose_name_plural = 'Bemor monitorlar'
        ordering = ['room', 'bed_label']
        indexes = [models.Index(fields=['room', 'is_active']), models.Index(fields=['bed_status'])]

    def __str__(self):
        return f"{self.patient_name or self.bed_label or self.device.serial_number} @ {self.room.name}"


class VitalReading(models.Model):
    """Hayotiy koʻrsatkichlar – vaqt boʻyicha (time-series style, PostgreSQL)."""
    patient_monitor = models.ForeignKey(
        PatientMonitor,
        on_delete=models.CASCADE,
        related_name='vital_readings',
        verbose_name='Bemor monitor'
    )
    timestamp = models.DateTimeField(db_index=True, verbose_name='Vaqt')
    heart_rate = models.SmallIntegerField(null=True, blank=True, verbose_name='HR (bpm)')
    spo2 = models.SmallIntegerField(null=True, blank=True, verbose_name='SpO2 (%)')
    nibp_systolic = models.SmallIntegerField(null=True, blank=True, verbose_name='NIBP sistolik')
    nibp_diastolic = models.SmallIntegerField(null=True, blank=True, verbose_name='NIBP diastolik')
    respiration_rate = models.SmallIntegerField(null=True, blank=True, verbose_name='Nafas (/min)')
    temperature = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True, verbose_name='Temp')
    raw_payload = models.JSONField(default=dict, blank=True, verbose_name='Xom maʼlumot (debug)')

    class Meta:
        verbose_name = 'Vital oʻqish'
        verbose_name_plural = 'Vital oʻqishlar'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['patient_monitor', '-timestamp']),
            models.Index(fields=['-timestamp']),
        ]
        get_latest_by = 'timestamp'

    def __str__(self):
        return f"{self.patient_monitor_id} @ {self.timestamp} HR={self.heart_rate} SpO2={self.spo2}"


class AlarmThreshold(models.Model):
    """Bemor uchun individual chegaralar (alarm trigger)."""
    PARAM_CHOICES = [
        ('heart_rate', 'Puls'),
        ('spo2', 'SpO2'),
        ('nibp_systolic', 'NIBP sistolik'),
        ('nibp_diastolic', 'NIBP diastolik'),
        ('respiration_rate', 'Nafas'),
    ]
    SEVERITY_CHOICES = [
        ('critical', 'Kritik'),
        ('urgent', 'Shoshilinch'),
        ('warning', 'Ogohlantirish'),
    ]
    patient_monitor = models.ForeignKey(
        PatientMonitor,
        on_delete=models.CASCADE,
        related_name='alarm_thresholds',
        verbose_name='Bemor monitor'
    )
    param = models.CharField(max_length=30, choices=PARAM_CHOICES, verbose_name='Parametr')
    min_value = models.SmallIntegerField(null=True, blank=True, verbose_name='Min')
    max_value = models.SmallIntegerField(null=True, blank=True, verbose_name='Max')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='urgent')
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Alarm chegarasi'
        verbose_name_plural = 'Alarm chegaralari'
        unique_together = [['patient_monitor', 'param']]
        ordering = ['patient_monitor', 'param']

    def __str__(self):
        return f"{self.patient_monitor} {self.param} [{self.min_value}-{self.max_value}]"


class Alarm(models.Model):
    """Yuzaga kelgan alarm – latching (oʻchirilmaguncha koʻrinadi)."""
    SEVERITY_CHOICES = [
        ('critical', 'Kritik'),
        ('urgent', 'Shoshilinch'),
        ('warning', 'Ogohlantirish'),
    ]
    patient_monitor = models.ForeignKey(
        PatientMonitor,
        on_delete=models.CASCADE,
        related_name='alarms',
        verbose_name='Bemor monitor'
    )
    threshold = models.ForeignKey(
        AlarmThreshold,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alarms',
        verbose_name='Chegara'
    )
    param = models.CharField(max_length=30, verbose_name='Parametr')
    value = models.FloatField(verbose_name='Qiymat')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, db_index=True)
    message = models.CharField(max_length=255, blank=True, verbose_name='Xabar')
    acknowledged_at = models.DateTimeField(null=True, blank=True, verbose_name='Qabul qilingan')
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_alarms',
        verbose_name='Qabul qilgan'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Alarm'
        verbose_name_plural = 'Alarmlar'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient_monitor', '-created_at']),
            models.Index(fields=['severity', 'acknowledged_at']),
        ]

    def __str__(self):
        return f"{self.patient_monitor} {self.param}={self.value} ({self.severity})"


class MonitoringAuditLog(models.Model):
    """Audit log – alarmlar, ack, kirish/chiqish (xalqaro: event log)."""
    ACTION_CHOICES = [
        ('alarm_created', 'Alarm yaratildi'),
        ('alarm_ack', 'Alarm qabul qilindi'),
        ('patient_admit', 'Bemor qabul qilindi'),
        ('patient_discharge', 'Bemor chiqarildi'),
        ('note_added', 'Eslatma qo\'shildi'),
        ('threshold_changed', 'Chegara o\'zgartirildi'),
        ('device_assigned', 'Qurilma biriktirildi'),
        ('quick_action', 'Tez harakat'),
        ('rapid_response', 'Rapid response'),
    ]
    patient_monitor = models.ForeignKey(
        PatientMonitor,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='audit_logs',
        verbose_name='Bemor monitor'
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True, verbose_name='Amal')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monitoring_audit_logs',
        verbose_name='Foydalanuvchi'
    )
    details = models.JSONField(default=dict, blank=True, verbose_name='Tafsilot')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Monitoring audit'
        verbose_name_plural = 'Monitoring auditlar'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['patient_monitor', '-created_at']), models.Index(fields=['action', '-created_at'])]


class MonitoringNote(models.Model):
    """Bemor vaqt chizigʻidagi eslatma/annotatsiya."""
    patient_monitor = models.ForeignKey(
        PatientMonitor,
        on_delete=models.CASCADE,
        related_name='notes',
        verbose_name='Bemor monitor'
    )
    note = models.TextField(verbose_name='Eslatma')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monitoring_notes',
        verbose_name='Yozgan'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Monitoring eslatma'
        verbose_name_plural = 'Monitoring eslatmalar'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['patient_monitor', '-created_at'])]


class MonitoringMedication(models.Model):
    """Dori vaqtida eslatma – bemor uchun reja."""
    patient_monitor = models.ForeignKey(
        PatientMonitor,
        on_delete=models.CASCADE,
        related_name='medications',
        verbose_name='Bemor monitor'
    )
    name = models.CharField(max_length=255, verbose_name='Dori nomi')
    dose = models.CharField(max_length=100, blank=True, verbose_name='Doza')
    scheduled_at = models.DateTimeField(db_index=True, verbose_name='Vaqt')
    given_at = models.DateTimeField(null=True, blank=True, verbose_name='Bajarilgan vaqt')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monitoring_medications_created',
        verbose_name='Yozgan'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dori eslatma'
        verbose_name_plural = 'Dori eslatmalar'
        ordering = ['scheduled_at']


class MonitoringLabResult(models.Model):
    """Lab natijalari – bemor uchun (Hb, WBC, kreatinin va b.)."""
    patient_monitor = models.ForeignKey(
        PatientMonitor,
        on_delete=models.CASCADE,
        related_name='lab_results',
        verbose_name='Bemor monitor'
    )
    param = models.CharField(max_length=80, db_index=True, verbose_name='Parametr (Hb, WBC, ...)')
    value = models.CharField(max_length=100, verbose_name='Qiymat')
    unit = models.CharField(max_length=30, blank=True, verbose_name='Birlik')
    timestamp = models.DateTimeField(db_index=True, verbose_name='Vaqt')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Lab natija'
        verbose_name_plural = 'Lab natijalar'
        ordering = ['-timestamp']


class FamilyViewToken(models.Model):
    """Oilaviy ko'rinish – maxfiy link (faqat o'qish)."""
    patient_monitor = models.ForeignKey(
        PatientMonitor,
        on_delete=models.CASCADE,
        related_name='family_tokens',
        verbose_name='Bemor monitor'
    )
    token = models.CharField(max_length=64, unique=True, db_index=True, verbose_name='Token')
    expires_at = models.DateTimeField(verbose_name='Amal qilish muddati')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Oilaviy ko\'rinish token'
        verbose_name_plural = 'Oilaviy ko\'rinish tokenlar'
        ordering = ['-created_at']
