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


def user_has_full_primary_care_access(user) -> bool:
    """Faqat superuser/staff BTShY ma'lumotlarini cheklovsiz ko'radi."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    return bool(getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False))


def brigades_for_user(user):
    qs = MedicalBrigade.objects.all()
    if user_has_full_primary_care_access(user):
        return qs
    cg = user_clinic_group_id(user)
    if not cg:
        # Klinika guruhi yo'q — hech narsa ko'rinmaydi (o'chirilgan guruh xavfi).
        return qs.none()
    assigned_ids = (
        population_for_user(user)
        .exclude(brigade__isnull=True)
        .values_list('brigade_id', flat=True)
        .distinct()
    )
    return qs.filter(Q(clinic_group_id=cg) | Q(pk__in=assigned_ids))


def population_for_user(user):
    qs = PopulationRecord.objects.select_related('brigade', 'created_by')
    if user_has_full_primary_care_access(user):
        return qs
    cg = user_clinic_group_id(user)
    if not cg:
        return qs.none()
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
    if user_has_full_primary_care_access(user):
        return qs
    cg = user_clinic_group_id(user)
    if not cg:
        return qs.none()
    return qs.filter(
        Q(brigade__clinic_group_id=cg) | Q(population__created_by__clinic_group_id=cg),
    ).distinct()


def screening_enrollments_for_user(user):
    qs = ScreeningEnrollment.objects.select_related('population', 'program').prefetch_related('result')
    if user_has_full_primary_care_access(user):
        return qs
    cg = user_clinic_group_id(user)
    if not cg:
        return qs.none()
    return qs.filter(
        Q(brigade__clinic_group_id=cg) | Q(population__created_by__clinic_group_id=cg),
    ).distinct()


def patronage_for_user(user):
    qs = PatronageVisit.objects.select_related('population', 'brigade')
    if user_has_full_primary_care_access(user):
        return qs
    cg = user_clinic_group_id(user)
    if not cg:
        return qs.none()
    return qs.filter(
        Q(brigade__clinic_group_id=cg) | Q(population__created_by__clinic_group_id=cg),
    ).distinct()


def dispensary_for_user(user):
    qs = DispensaryRecord.objects.select_related('population', 'brigade')
    if user_has_full_primary_care_access(user):
        return qs
    cg = user_clinic_group_id(user)
    if not cg:
        return qs.none()
    return qs.filter(
        Q(brigade__clinic_group_id=cg) | Q(population__created_by__clinic_group_id=cg),
    ).distinct()


def network_plans_for_user(user):
    qs = NetworkPlan.objects.select_related('brigade')
    if user_has_full_primary_care_access(user):
        return qs
    cg = user_clinic_group_id(user)
    if not cg:
        return qs.none()
    return qs.filter(brigade__clinic_group_id=cg)


def family_passports_for_user(user):
    qs = FamilyPassport.objects.prefetch_related('members__population')
    if user_has_full_primary_care_access(user):
        return qs
    cg = user_clinic_group_id(user)
    if not cg:
        return qs.none()
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
