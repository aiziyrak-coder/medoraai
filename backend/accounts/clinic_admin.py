"""
Klinika guruhi admini — guruh doirasidagi boshqaruv yordamchilari.
"""
from django.contrib.auth import get_user_model

User = get_user_model()


def is_clinic_group_admin(user) -> bool:
    """Guruh admini: faol, guruhga biriktirilgan va admin belgisi yoqilgan."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    return bool(
        getattr(user, 'is_clinic_group_admin', False)
        and user.clinic_group_id
        and user.is_active
    )


def can_manage_clinic_group(user) -> bool:
    """Guruh a'zolarini boshqarish huquqi (superuser/staff yoki guruh admini)."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return True
    return is_clinic_group_admin(user)


def clinic_group_members_queryset(user):
    """Boshqaruvchi foydalanuvchi ko'ra oladigan guruh a'zolari."""
    qs = User.objects.select_related('subscription_plan', 'clinic_group').order_by('-date_joined')
    if getattr(user, 'is_superuser', False):
        return qs
    if getattr(user, 'is_staff', False) and not user.clinic_group_id:
        return qs
    gid = getattr(user, 'clinic_group_id', None)
    if gid and (is_clinic_group_admin(user) or getattr(user, 'is_staff', False)):
        return qs.filter(clinic_group_id=gid)
    if gid and getattr(user, 'is_clinic', False):
        return qs.filter(clinic_group_id=gid)
    return qs.none()


def assert_same_clinic_group(admin_user, target_user):
    """Target foydalanuvchi admin guruhi ichidami — aks holda False."""
    if getattr(admin_user, 'is_superuser', False):
        return True
    if getattr(admin_user, 'is_staff', False) and not admin_user.clinic_group_id:
        return True
    if not admin_user.clinic_group_id or not target_user.clinic_group_id:
        return False
    return admin_user.clinic_group_id == target_user.clinic_group_id
