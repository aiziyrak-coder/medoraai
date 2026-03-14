"""
Analysis Models
"""
from django.db import models
from django.conf import settings
from patients.models import Patient


class AnalysisRecord(models.Model):
    """Medical Analysis Record"""
    
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='analyses',
        verbose_name='Bemor'
    )
    external_patient_id = models.CharField(max_length=255, blank=True, verbose_name='Bemor ID')
    
    # Analysis Data
    patient_data = models.JSONField(default=dict, verbose_name='Bemor ma\'lumotlari')
    debate_history = models.JSONField(default=list, verbose_name='Munozara tarixi')
    final_report = models.JSONField(default=dict, verbose_name='Yakuniy hisobot')
    follow_up_history = models.JSONField(default=list, blank=True, verbose_name='Keyingi kuzatuv tarixi')
    
    # Selected Specialists
    selected_specialists = models.JSONField(default=list, blank=True, verbose_name='Tanlangan mutaxassislar')
    
    # Detected Medications
    detected_medications = models.JSONField(default=list, blank=True, verbose_name='Aniqlangan dori-darmonlar')
    
    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='analyses',
        verbose_name='Yaratgan'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Yaratilgan sana')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Yangilangan sana')
    
    class Meta:
        verbose_name = 'Tahlil yozuvi'
        verbose_name_plural = 'Tahlil yozuvlari'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient'], name='an_patient_idx'),
            models.Index(fields=['created_by'], name='an_created_by_idx'),
            models.Index(fields=['created_at'], name='an_created_at_idx'),
            models.Index(fields=['external_patient_id'], name='an_ext_patient_id_idx'),
            models.Index(fields=['created_by', 'created_at'], name='an_created_by_at_idx'),
            models.Index(fields=['patient', 'created_at'], name='an_patient_created_at_idx'),
        ]
    
    def __str__(self):
        return f"Tahlil #{self.id} - {self.patient} ({self.created_at.strftime('%Y-%m-%d')})"


class AnalysisAuditLog(models.Model):
    """Audit trail: who did what, when (for analysis/consilium)."""
    ACTION_CHOICES = [
        ('created', 'Yaratildi'),
        ('updated', 'Yangilandi'),
        ('viewed', "Ko'rilgan"),
    ]
    analysis = models.ForeignKey(
        AnalysisRecord,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        verbose_name='Tahlil'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='analysis_audit_logs',
        verbose_name='Foydalanuvchi'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name='Amal')
    extra = models.JSONField(default=dict, blank=True, verbose_name='Qo\'shimcha')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Sana')

    class Meta:
        verbose_name = 'Tahlil audit yozuvi'
        verbose_name_plural = 'Tahlil audit yozuvlari'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['analysis'], name='an_audit_analysis_idx'),
            models.Index(fields=['created_at'], name='an_audit_created_idx'),
        ]

    def __str__(self):
        return f"Tahlil #{self.analysis_id} — {self.get_action_display()} ({self.created_at})"


class AnalysisUsefulnessFeedback(models.Model):
    """Shifokor fikri: konsilium natijasi foydali bo'ldimi?"""
    analysis = models.OneToOneField(
        AnalysisRecord,
        on_delete=models.CASCADE,
        related_name='usefulness_feedback',
        verbose_name='Tahlil'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='analysis_usefulness_feedbacks',
        verbose_name='Foydalanuvchi'
    )
    useful = models.BooleanField(verbose_name='Foydali')
    comment = models.TextField(blank=True, verbose_name='Izoh')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Sana')

    class Meta:
        verbose_name = 'Tahlil foydaliligi fikri'
        verbose_name_plural = 'Tahlil foydaliligi fikrlari'

    def __str__(self):
        return f"Tahlil #{self.analysis_id} — {'Foydali' if self.useful else 'Foydali emas'}"


class DiagnosisFeedback(models.Model):
    """User feedback on diagnoses"""
    
    FEEDBACK_CHOICES = [
        ('more-likely', 'Ehtimollik yuqori'),
        ('less-likely', 'Ehtimollik past'),
        ('needs-review', 'Ko\'rib chiqish kerak'),
        ('injected-hypothesis', 'Qo\'shilgan gipoteza'),
    ]
    
    analysis = models.ForeignKey(
        AnalysisRecord,
        on_delete=models.CASCADE,
        related_name='diagnosis_feedbacks',
        verbose_name='Tahlil'
    )
    diagnosis_name = models.CharField(max_length=255, verbose_name='Tashxis nomi')
    feedback = models.CharField(max_length=50, choices=FEEDBACK_CHOICES, verbose_name='Fikr')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Yaratgan'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Yaratilgan sana')
    
    class Meta:
        verbose_name = 'Tashxis fikri'
        verbose_name_plural = 'Tashxis fikrlari'
        unique_together = ['analysis', 'diagnosis_name', 'created_by']
    
    def __str__(self):
        return f"{self.diagnosis_name} - {self.get_feedback_display()}"