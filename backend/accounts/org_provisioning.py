"""Tashkilot hisoblari yaratish/yangilash — respublika va viloyat buyruqlari uchun."""
from __future__ import annotations

from datetime import datetime

from django.utils import timezone
from django.utils.text import slugify

from accounts.models import ClinicGroup, SubscriptionPlan, User
from accounts.org_catalog import org_password, org_phone, org_phone_legacy


def group_notes(code: str, days: int) -> str:
    return (
        f"Kod: {code}. Bepul korporativ muddat ({days} kun). "
        "Tashkilot login — SMS parol tiklash ishlamaydi; klinika admin panelidan boshqaring."
    )


def _days_until(expiry: datetime) -> int:
    delta = expiry - timezone.now()
    return max(1, delta.days)


def provision_org_account(
    *,
    idx: int,
    code: str,
    name: str,
    plan: SubscriptionPlan,
    expiry: datetime,
    slug_fallback_prefix: str,
) -> tuple[ClinicGroup, User, bool, bool, str, str]:
    """
    Klinika guruhi + guruh admini hisobini yaratadi yoki yangilaydi.
    Eski 8-raqamli telefonlarni yangi 9-raqamli formatga ko'chiradi.
    """
    phone = org_phone(idx)
    legacy_phone = org_phone_legacy(idx)
    password = org_password(code, idx)
    slug = slugify(code)[:80] or f'{slug_fallback_prefix}-{idx:04d}'
    days = _days_until(expiry)
    notes = group_notes(code, days)

    group, group_new = ClinicGroup.objects.get_or_create(
        slug=slug,
        defaults={'name': name, 'is_active': True, 'notes': notes},
    )
    if not group_new:
        group.name = name
        group.is_active = True
        group.notes = notes
        group.save()

    user = User.objects.filter(phone=phone).first()
    if user is None and legacy_phone != phone:
        user = User.objects.filter(phone=legacy_phone).first()
        if user is not None:
            user.phone = phone

    user_new = False
    if user is None:
        user = User(
            phone=phone,
            name=name,
            role='clinic',
            clinic_group=group,
            subscription_plan=plan,
            subscription_status='active',
            subscription_expiry=expiry,
            trial_ends_at=None,
            is_active=True,
            is_clinic_group_admin=True,
        )
        user.set_password(password)
        user.save()
        user_new = True
    else:
        user.name = name
        user.role = 'clinic'
        user.clinic_group = group
        user.subscription_plan = plan
        user.subscription_status = 'active'
        user.subscription_expiry = expiry
        user.trial_ends_at = None
        user.is_active = True
        user.is_clinic_group_admin = True
        user.set_password(password)
        user.save()

    return group, user, group_new, user_new, phone, password
