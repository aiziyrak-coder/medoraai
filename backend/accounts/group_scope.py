"""
Klinika guruhi bo‘yicha umumiy ko‘rinish: bir guruh a'zolari bir-birining bemor va tahlillarini ko‘radi.
"""
from django.contrib.auth import get_user_model

User = get_user_model()


def clinic_peer_user_ids(user):
    """
    `user` bilan bir xil klinika guruhidagi faol foydalanuvchilar IDlari (o‘zi ham kiradi).
    Staff/superuser uchun None — chaqiruvchi to‘liq kirishni alohida boshqaradi.
    Guruh bo‘lmasa: faqat [user.pk].
    """
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return None
    gid = getattr(user, 'clinic_group_id', None)
    if not gid:
        return [user.pk]
    return list(
        User.objects.filter(
            clinic_group_id=gid,
            is_active=True,
        ).values_list('id', flat=True)
    )
