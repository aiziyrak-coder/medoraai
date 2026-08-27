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
        assigned_ids = (
            population_for_user(user)
            .exclude(brigade__isnull=True)
            .values_list('brigade_id', flat=True)
            .distinct()
        )
        qs = qs.filter(Q(clinic_group_id=cg) | Q(pk__in=assigned_ids))
    return qs


def population_for_user(user):
    qs = PopulationRecord.objects.select_related('brigade', 'created_by')
    cg = user_clinic_group_id(user)
    if not cg:
        return qs
    from .models import Patient
    clinic_rns = (
        Patient.objects.filter(home_clinic_group_id=cg)
        .exclude(registry_number='')
        .values('registry_number')
    )
    clause = (
        Q(created_by__clinic_group_id=cg)
        | Q(brigade__clinic_group_id=cg)
        | Q(registry_number__in=clinic_rns)
    )
    return qs.filter(clause).distinct()


def population_queryset_for_user(user):
    """Alias — population_service va views uchun."""
    return population_for_user(user)


def checkups_for_user(user):
    qs = PreventiveCheckup.objects.select_related('population', 'brigade')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(
            Q(brigade__clinic_group_id=cg) | Q(population__created_by__clinic_group_id=cg),
        ).distinct()
    return qs


def screening_enrollments_for_user(user):
    qs = ScreeningEnrollment.objects.select_related('population', 'program').prefetch_related('result')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(
            Q(brigade__clinic_group_id=cg) | Q(population__created_by__clinic_group_id=cg),
        ).distinct()
    return qs


def patronage_for_user(user):
    qs = PatronageVisit.objects.select_related('population', 'brigade')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(
            Q(brigade__clinic_group_id=cg) | Q(population__created_by__clinic_group_id=cg),
        ).distinct()
    return qs


def dispensary_for_user(user):
    qs = DispensaryRecord.objects.select_related('population', 'brigade')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(
            Q(brigade__clinic_group_id=cg) | Q(population__created_by__clinic_group_id=cg),
        ).distinct()
    return qs


def network_plans_for_user(user):
    qs = NetworkPlan.objects.select_related('brigade')
    cg = user_clinic_group_id(user)
    if cg:
        qs = qs.filter(brigade__clinic_group_id=cg)
    return qs


def family_passports_for_user(user):
    qs = FamilyPassport.objects.prefetch_related('members__population')
    cg = user_clinic_group_id(user)
    if not cg:
        return qs
    pop_ids = population_for_user(user).values_list('id', flat=True)
    return qs.filter(
        Q(head_id__in=pop_ids) | Q(members__population_id__in=pop_ids),
    ).distinct()


def user_can_access_population(user, pop_id: int) -> bool:
    if not user or not user.is_authenticated:
        return False
    return population_for_user(user).filter(pk=pop_id).exists()


class ScopedPrimaryCareSerializerMixin:
    """Create/update da boshqa klinika FK larini tanlashni bloklash."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if not request or not getattr(request, 'user', None) or not request.user.is_authenticated:
            return
        user = request.user
        pop_qs = population_for_user(user)
        brig_qs = brigades_for_user(user)
        fam_qs = family_passports_for_user(user)
        for name, qs in (
            ('population', pop_qs),
            ('brigade', brig_qs),
            ('family', fam_qs),
            ('head', pop_qs),
        ):
            field = self.fields.get(name)
            if field is not None and hasattr(field, 'queryset'):
                field.queryset = qs
