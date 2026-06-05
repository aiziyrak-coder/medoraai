"""WebRTC signaling — offer/answer/ICE."""
from django.conf import settings
from django.db import models


class TeleSession(models.Model):
    room_code = models.CharField(max_length=32, unique=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tele_sessions',
    )
    patient_label = models.CharField(max_length=200, blank=True)
    offer_sdp = models.TextField(blank=True)
    answer_sdp = models.TextField(blank=True)
    ice_candidates = models.JSONField(default=list, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Telemeditsina sessiyasi'
        verbose_name_plural = 'Telemeditsina sessiyalari'
