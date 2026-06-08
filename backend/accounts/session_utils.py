"""
JWT refresh va ActiveSession boshqaruvi (logout, barcha qurilmalardan chiqarish).
"""
from __future__ import annotations

import logging

from .models import ActiveSession

logger = logging.getLogger(__name__)


def revoke_all_sessions_for_user(user) -> int:
    """
    Foydalanuvchining barcha refresh-sessiyalarini bekor qiladi (JWT blacklist + ActiveSession).
    Qaytaradi: o'chirilgan sessiyalar soni.
    """
    sessions = list(ActiveSession.objects.filter(user=user))
    if not sessions:
        return 0
    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    except ImportError:
        return ActiveSession.objects.filter(user=user).delete()[0]

    removed = 0
    for session in sessions:
        ot = OutstandingToken.objects.filter(jti=session.refresh_jti).first()
        if ot:
            BlacklistedToken.objects.get_or_create(token=ot)
        session.delete()
        removed += 1
    return removed


def revoke_sessions_for_users(users) -> int:
    """Tanlangan foydalanuvchilarni barcha qurilmalardan chiqaradi."""
    total = 0
    for user in users:
        total += revoke_all_sessions_for_user(user)
    return total


def revoke_all_sessions_globally() -> int:
    """Barcha foydalanuvchilarni barcha qurilmalardan chiqaradi."""
    user_ids = (
        ActiveSession.objects.values_list('user_id', flat=True).distinct()
    )
    from .models import User

    total = 0
    for user in User.objects.filter(pk__in=user_ids):
        total += revoke_all_sessions_for_user(user)
    # Qolgan "osilgan" yozuvlar (user o'chirilgan bo'lsa)
    total += ActiveSession.objects.all().delete()[0]
    logger.info("Global logout: %s ta sessiya bekor qilindi", total)
    return total
