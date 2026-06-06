"""
Patient Models
"""
from django.db import models
from django.conf import settings


class Patient(models.Model):
    """Patient Model"""
    
    GENDER_CHOICES = [
        ('male', 'Erkak'),
        ('female', 'Ayol'),
        ('other', 'Boshqa'),
    ]
    
    # Basic Information (pasport ma'lumotlari — barcha klinika guruhlarida ko'rinadi)
    first_name = models.CharField(max_length=255, verbose_name='Ism')
    last_name = models.CharField(max_length=255, verbose_name='Familiya')
    father_name = models.CharField(max_length=255, blank=True, verbose_name='Otasining ismi')
    age = models.CharField(max_length=10, verbose_name='Yosh')
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, verbose_name='Jins')
    
    # Contact Information
    phone = models.CharField(max_length=20, blank=True, verbose_name='Telefon')
    address = models.TextField(blank=True, verbose_name="Manzil (qo'shimcha)")
    region_id = models.CharField(max_length=10, blank=True, db_index=True, verbose_name='Viloyat ID')
    district_id = models.CharField(max_length=10, blank=True, db_index=True, verbose_name='Tuman ID')
    
    # Clinical Information (faqat bemor klinika guruhi uchun)
    complaints = models.TextField(blank=True, default='', verbose_name='Shikoyatlar')
    history = models.TextField(blank=True, verbose_name='Anamnez')
    objective_data = models.TextField(blank=True, verbose_name='Ob\'ektiv ma\'lumotlar')
    lab_results = models.TextField(blank=True, verbose_name='Laboratoriya natijalari')
    allergies = models.CharField(max_length=500, blank=True, verbose_name='Allergiyalar')
    current_medications = models.TextField(blank=True, verbose_name='Hozirgi dori-darmonlar')
    family_history = models.TextField(blank=True, verbose_name='Oilaviy anamnez')
    additional_info = models.TextField(blank=True, verbose_name='Qo\'shimcha ma\'lumotlar')
    
    # Advanced Data
    structured_lab_results = models.JSONField(default=dict, blank=True, verbose_name='Struktur laboratoriya natijalari')
    pharmacogenomics_report = models.TextField(blank=True, verbose_name='Farmakogenomika hisoboti')
    symptom_timeline = models.JSONField(default=list, blank=True, verbose_name='Simptomlar vaqti')
    mental_health_scores = models.JSONField(default=dict, blank=True, verbose_name='Ruhiy salomatlik skorlari')
    
    registry_number = models.CharField(
        max_length=8,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name='Ro\'yxat raqami (8 xona)',
    )

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_patients',
        verbose_name='Yaratgan'
    )
    home_clinic_group = models.ForeignKey(
        'accounts.ClinicGroup',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registered_patients',
        verbose_name='Ro\'yxatdan o\'tgan klinika guruhi',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Yaratilgan sana')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Yangilangan sana')
    
    class Meta:
        verbose_name = 'Bemor'
        verbose_name_plural = 'Bemorlar'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['first_name', 'last_name']),
            models.Index(fields=['created_at']),
            models.Index(fields=['created_by']),
            models.Index(fields=['created_by', 'created_at']),  # Composite for common queries
            models.Index(fields=['phone']),
            models.Index(fields=['region_id', 'district_id']),
            models.Index(fields=['home_clinic_group']),
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.registry_number})"


class PatientRegistryCounter(models.Model):
    """Singleton — keyingi 8 xonali bemor raqami."""
    last_value = models.PositiveIntegerField(default=0, verbose_name='Oxirgi raqam')

    class Meta:
        verbose_name = 'Bemor raqam hisoblagichi'
        verbose_name_plural = 'Bemor raqam hisoblagichi'


class PatientAttachment(models.Model):
    """Patient file attachments"""
    
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Bemor'
    )
    file = models.FileField(upload_to='patient_attachments/%Y/%m/%d/', verbose_name='Fayl')
    name = models.CharField(max_length=255, verbose_name='Fayl nomi')
    mime_type = models.CharField(max_length=100, verbose_name='MIME turi')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='Yuklangan sana')
    
    class Meta:
        verbose_name = 'Bemor fayli'
        verbose_name_plural = 'Bemor fayllari'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.name} - {self.patient}"