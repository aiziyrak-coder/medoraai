"""
ai_services Django modellari.

Diqqat: modellar SHU faylda turishi shart. Ilgari ProtocolOutcome
self_learning_system.py da e'lon qilingan edi — makemigrations uni ko'rmagan,
natijada jadval hech qachon yaratilmagan va POST /api/ai/learning/outcome/
"no such table" bilan yiqilgan.
"""
from django.db import models


class ProtocolOutcome(models.Model):
    """Track outcomes of autonomous protocols for learning"""

    protocol_id = models.CharField(max_length=255, verbose_name='Protokol ID')
    patient_data_hash = models.CharField(max_length=64, verbose_name='Bemor ma\'lumotlari xeshi')

    # Protocol details
    protocol_details = models.JSONField(default=dict, verbose_name='Protokol tafsilotlari')

    # Bemor kesimi (agregatsiya uchun; shaxsni aniqlovchi maydonlarsiz)
    patient_snapshot = models.JSONField(default=dict, blank=True, verbose_name='Bemor kesimi')

    # Outcome tracking
    treatment_success = models.BooleanField(null=True, blank=True, verbose_name='Davolash muvaffaqiyati')
    patient_satisfaction = models.IntegerField(null=True, blank=True, verbose_name='Bemor qoniqishi (1-10)')
    complication_occurred = models.BooleanField(default=False, verbose_name='Asoratlar yuz bergan')
    complication_details = models.TextField(blank=True, verbose_name='Asorat tafsilotlari')

    # Time tracking
    recovery_time_days = models.IntegerField(null=True, blank=True, verbose_name='Tiklanish vaqti (kun)')
    follow_up_required = models.BooleanField(default=True, verbose_name='Keyingi kuzatuv kerak')

    # Learning metrics
    effectiveness_score = models.FloatField(default=0.0, verbose_name='Samaradorlik balli')
    safety_score = models.FloatField(default=0.0, verbose_name='Xavfsizlik balli')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Yaratilgan sana')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Yangilangan sana')

    class Meta:
        verbose_name = 'Protokol natijasi'
        verbose_name_plural = 'Protokol natijalari'
        indexes = [
            models.Index(fields=['protocol_id'], name='po_protocol_id_idx'),
            models.Index(fields=['treatment_success'], name='po_success_idx'),
            models.Index(fields=['effectiveness_score'], name='po_effectiveness_idx'),
            models.Index(fields=['created_at'], name='po_created_at_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.protocol_id} ({self.patient_data_hash[:12]})"

    def calculate_scores(self):
        """Calculate effectiveness and safety scores"""
        # Base scores
        effectiveness = 0.5
        safety = 0.5

        # Treatment success impact
        if self.treatment_success is True:
            effectiveness += 0.3
            safety += 0.2
        elif self.treatment_success is False:
            effectiveness -= 0.3
            safety -= 0.2

        # Complications impact
        if self.complication_occurred:
            effectiveness -= 0.2
            safety -= 0.4

        # Patient satisfaction impact
        if self.patient_satisfaction:
            satisfaction_factor = (self.patient_satisfaction - 5) / 5  # -1 to 1
            effectiveness += satisfaction_factor * 0.1
            safety += satisfaction_factor * 0.05

        # Recovery time impact (faster is better)
        if self.recovery_time_days:
            if self.recovery_time_days <= 3:
                effectiveness += 0.1
            elif self.recovery_time_days <= 7:
                effectiveness += 0.05
            elif self.recovery_time_days > 14:
                effectiveness -= 0.1

        # Normalize scores
        self.effectiveness_score = max(0.0, min(1.0, effectiveness))
        self.safety_score = max(0.0, min(1.0, safety))

        self.save(update_fields=['effectiveness_score', 'safety_score', 'updated_at'])
