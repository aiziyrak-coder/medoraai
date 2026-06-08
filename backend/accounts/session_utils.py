"""
JWT refresh va ActiveSession boshqaruvi (logout, barcha qurilmalardan chiqarish).
"""
from __future__ import annotations

import logging

from .models import ActiveSession

logger = logging.getLogger(__name__)


def _blacklist_outstanding_tokens_for_user(user) -> int:
    """Foydalanuvchining barcha refresh tokenlarini blacklist qiladi."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    except ImportError:
        return 0

    count = 0
    for ot in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=ot)
        if created:
            count += 1
    return count


def revoke_single_session(session: ActiveSession) -> bool:
    """Bitta qurilma sessiyasini bekor qiladi (JWT blacklist + ActiveSession o'chirish)."""
    if session is None:
        return False
    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    except ImportError:
        session.delete()
        return True

    ot = OutstandingToken.objects.filter(jti=session.refresh_jti).first()
    if ot:
        BlacklistedToken.objects.get_or_create(token=ot)
    session.delete()
    return True


def revoke_all_sessions_for_user(user) -> int:
    """
    Foydalanuvchini BARCHA qurilmalardan chiqaradi:
    - barcha OutstandingToken → blacklist
    - barcha ActiveSession → o'chirish
    Keyin yangi qurilmadan login qila oladi (bitta qurilma qoidasi saqlanadi).
    """
    _blacklist_outstanding_tokens_for_user(user)
    deleted, _ = ActiveSession.objects.filter(user=user).delete()
    logger.info(
        "User logout all devices: user_id=%s phone=%s sessions_removed=%s",
        user.pk,
        getattr(user, 'phone', ''),
        deleted,
    )
    return deleted


def revoke_sessions_for_users(users) -> int:
    """Tanlangan foydalanuvchilarni barcha qurilmalardan chiqaradi."""
    total = 0
    for user in users:
        total += revoke_all_sessions_for_user(user)
    return total


def revoke_all_sessions_globally() -> int:
    """Barcha foydalanuvchilarni barcha qurilmalardan chiqaradi."""
    from .models import User

    total = 0
    for user in User.objects.filter(active_sessions__isnull=False).distinct():
        total += revoke_all_sessions_for_user(user)
    total += ActiveSession.objects.all().delete()[0]
    logger.info("Global logout: %s ta sessiya bekor qilindi", total)
    return total
