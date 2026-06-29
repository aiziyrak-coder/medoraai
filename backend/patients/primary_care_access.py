"""Klinika guruhi bo'yicha BTShY ma'lumotlarini cheklash."""
from django.db.models import Q

from .models import PopulationRecord
from .primary_care_models import (
    DispensaryRecord,
    FamilyPassport,
    MedicalBrigade,
    NetworkPlan,
    PatronageVisit,
    PreventiveCheckup,
    ScreeningEnrollment,
)


def user_clinic_group_id(user) -> int | None:
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return None
    return getattr(user, 'clinic_group_id', None) or None


def brigades_for_user(user):
    qs = MedicalBrigade.objects.all()
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(Q(clinic_group_id=cg) | Q(clinic_group__isnull=True))
    return qs


def population_for_user(user):
    qs = PopulationRecord.objects.select_related('brigade', 'created_by')
    cg = user_clinic_group_id(user)
    if not cg:
        return qs
    return qs.filter(
        Q(created_by__clinic_group_id=cg)
        | Q(brigade__clinic_group_id=cg)
        | Q(created_by__isnull=True, brigade__isnull=True),
    ).distinct()


def checkups_for_user(user):
    qs = PreventiveCheckup.objects.select_related('population', 'brigade')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(
            Q(brigade__clinic_group_id=cg)
            | Q(population__created_by__clinic_group_id=cg)
            | Q(brigade__isnull=True, population__brigade__isnull=True),
        ).distinct()
    return qs


def screening_enrollments_for_user(user):
    qs = ScreeningEnrollment.objects.select_related('population', 'program')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(
            Q(brigade__clinic_group_id=cg)
            | Q(population__created_by__clinic_group_id=cg)
            | Q(brigade__isnull=True),
        ).distinct()
    return qs


def patronage_for_user(user):
    qs = PatronageVisit.objects.select_related('population', 'brigade')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(
            Q(brigade__clinic_group_id=cg)
            | Q(population__created_by__clinic_group_id=cg),
        ).distinct()
    return qs


def dispensary_for_user(user):
    qs = DispensaryRecord.objects.select_related('population', 'brigade')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(
            Q(brigade__clinic_group_id=cg)
            | Q(population__created_by__clinic_group_id=cg),
        ).distinct()
    return qs


def network_plans_for_user(user):
    qs = NetworkPlan.objects.select_related('brigade')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(Q(brigade__clinic_group_id=cg) | Q(brigade__clinic_group__isnull=True))
    return qs


def family_passports_for_user(user):
    qs = FamilyPassport.objects.prefetch_related('members__population')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(Q(region_id='') | Q(head__created_by__clinic_group_id=cg) | Q(head__brigade__clinic_group_id=cg))
    return qs.distinct()
