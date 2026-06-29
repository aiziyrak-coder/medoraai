"""SSV 210-buyruq biznes logikasi — chuqur integratsiya."""
from __future__ import annotations

import re
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Q
from django.utils import timezone

from .form30_schema import form30_from_checkup, normalize_form30_data, validate_form30_data
from .models import PopulationRecord
from .primary_care_models import (
    DispensaryRecord,
    FamilyPassport,
    FamilyPassportMember,
    MedicalBrigade,
    NetworkPlan,
    PatronageVisit,
    PreventiveCheckup,
    ScreeningEnrollment,
    ScreeningProgram,
    ScreeningResult,
)

DEFAULT_SCREENING_PROGRAMS = [
    {
        'code': 'helminths-2-10',
        'name': 'Gelmintoz skriningi (2–10 yosh)',
        'target_gender': '',
        'age_min': 2,
        'age_max': 10,
        'frequency_months': 12,
    },
    {
        'code': 'hemato-onco-3-18',
        'name': 'Gemato-onkologiya skriningi (3–18 yosh)',
        'target_gender': '',
        'age_min': 3,
        'age_max': 18,
        'frequency_months': 12,
    },
    {
        'code': 'ncd-40plus',
        'name': 'NCD skriningi (40+ yosh, WHO PEN)',
        'target_gender': '',
        'age_min': 40,
        'age_max': 120,
        'frequency_months': 12,
    },
    {
        'code': 'cervical-35-55',
        'name': 'Bachadon bo\'yni rak skriningi (35–55 yosh)',
        'target_gender': 'female',
        'age_min': 35,
        'age_max': 55,
        'frequency_months': 36,
    },
    {
        'code': 'breast-45-65',
        'name': 'Ko\'krak bezi rak skriningi (45–65 yosh)',
        'target_gender': 'female',
        'age_min': 45,
        'age_max': 65,
        'frequency_months': 24,
    },
]

HEALTH_GROUP_LABELS = {
    '1': 'I — Tayanch',
    '2': 'II — Past xavf',
    '3': 'III — O\'rta xavf',
    '4': 'IV — Yuqori xavf',
    'child_1': 'Bola I',
    'child_2': 'Bola II',
    'child_3': 'Bola III',
}


def parse_age_years(age_raw: str, birth_date: date | None = None) -> int | None:
    if birth_date:
        today = timezone.now().date()
        years = today.year - birth_date.year
        if (today.month, today.day) < (birth_date.month, birth_date.day):
            years -= 1
        return max(0, years)
    if not age_raw:
        return None
    m = re.search(r'\d+', str(age_raw))
    return int(m.group()) if m else None


def default_health_group_for_age(age_years: int | None) -> str:
    if age_years is None:
        return '2'
    if age_years < 18:
        return 'child_1'
    return '2'


def required_checkups_per_year(age_years: int | None) -> int:
    if age_years is None:
        return 1
    if age_years < 1:
        return 14
    if age_years < 3:
        return 4
    if age_years < 6:
        return 2
    if age_years <= 18:
        return 1
    return 1


def next_checkup_date_for_group(health_group: str, from_date: date | None = None) -> date | None:
    base = from_date or timezone.now().date()
    mapping = {
        '1': 365,
        'child_1': 365,
        '2': 180,
        'child_2': 90,
        '3': 90,
        'child_3': 60,
        '4': 30,
    }
    days = mapping.get(health_group)
    if not days:
        return None
    return base + timedelta(days=days)


def compute_initial_checkup_schedule(pop: PopulationRecord) -> None:
    """Yosh va sog'liq guruhiga qarab keyingi ko'rik sanasini hisoblash."""
    age = parse_age_years(pop.age, pop.birth_date)
    if not pop.health_group:
        pop.health_group = default_health_group_for_age(age)
    if not pop.next_checkup_date:
        pop.next_checkup_date = next_checkup_date_for_group(pop.health_group)
    pop.save(update_fields=['health_group', 'next_checkup_date', 'updated_at'])


def compute_bmi(height_cm, weight_kg) -> Decimal | None:
    try:
        h = float(height_cm) / 100
        w = float(weight_kg)
        if h <= 0 or w <= 0:
            return None
        return Decimal(str(round(w / (h * h), 1)))
    except (TypeError, ValueError):
        return None


def ensure_default_screening_programs() -> None:
    for item in DEFAULT_SCREENING_PROGRAMS:
        ScreeningProgram.objects.get_or_create(code=item['code'], defaults=item)


def assign_brigade_for_population(pop: PopulationRecord, *, user=None) -> MedicalBrigade | None:
    """Viloyat/tuman va klinika guruhi bo'yicha eng kam yuklangan brigadaga biriktirish."""
    if pop.brigade_id:
        return pop.brigade
    qs = MedicalBrigade.objects.filter(is_active=True)
    cg_id = None
    if pop.created_by_id and getattr(pop.created_by, 'clinic_group_id', None):
        cg_id = pop.created_by.clinic_group_id
    elif user and getattr(user, 'clinic_group_id', None):
        cg_id = user.clinic_group_id
    if cg_id:
        qs = qs.filter(Q(clinic_group_id=cg_id) | Q(clinic_group__isnull=True))
    if pop.region_id:
        qs = qs.filter(region_id=pop.region_id)
    if pop.district_id:
        qs = qs.filter(district_id=pop.district_id)
    brigades = list(qs.annotate(assigned=Count('assigned_population')).order_by('assigned', 'id'))
    if not brigades:
        brigades = list(
            MedicalBrigade.objects.filter(is_active=True)
            .annotate(assigned=Count('assigned_population'))
            .order_by('assigned', 'id')[:1],
        )
    for b in brigades:
        if b.assigned < b.target_population_size:
            pop.brigade = b
            pop.save(update_fields=['brigade', 'updated_at'])
            ensure_brigade_network_plans(b)
            return b
    if brigades:
        pop.brigade = brigades[0]
        pop.save(update_fields=['brigade', 'updated_at'])
        ensure_brigade_network_plans(brigades[0])
        return brigades[0]
    return None


def enroll_screening_for_population(pop: PopulationRecord) -> int:
    ensure_default_screening_programs()
    created = 0
    for prog in eligible_programs_for_population(pop):
        _, was_created = ScreeningEnrollment.objects.get_or_create(
            population=pop,
            program=prog,
            defaults={'status': 'planned', 'brigade': pop.brigade, 'planned_date': timezone.now().date()},
        )
        if was_created:
            created += 1
    return created


def sync_risk_flags_from_population(pop: PopulationRecord) -> None:
    """Xavf toifalarini dispanser va yosh bo'yicha yangilash."""
    age = parse_age_years(pop.age, pop.birth_date)
    updates: list[str] = []
    has_chronic = DispensaryRecord.objects.filter(population=pop, is_active=True).exists()
    if has_chronic and not pop.risk_chronic:
        pop.risk_chronic = True
        updates.append('risk_chronic')
    if age is not None and age >= 70 and not pop.risk_lone_elderly:
        pop.risk_lone_elderly = True
        updates.append('risk_lone_elderly')
    if updates:
        pop.save(update_fields=updates + ['updated_at'])


def on_population_saved(pop: PopulationRecord, *, is_new: bool = False, user=None) -> dict:
    """Aholi saqlanganda barcha modullarni sinxronlash."""
    sync_risk_flags_from_population(pop)
    brigade = assign_brigade_for_population(
        pop,
        user=user or getattr(pop, 'updated_by', None) or getattr(pop, 'created_by', None),
    )
    compute_initial_checkup_schedule(pop)
    screening_created = enroll_screening_for_population(pop)
    if brigade:
        sync_network_plan_completed(brigade)
    return {
        'brigade_assigned': brigade.id if brigade else None,
        'brigade_name': brigade.name if brigade else '',
        'screening_enrolled': screening_created,
        'next_checkup_date': pop.next_checkup_date.isoformat() if pop.next_checkup_date else None,
        'health_group': pop.health_group,
    }


def eligible_programs_for_population(pop: PopulationRecord) -> list[ScreeningProgram]:
    age = parse_age_years(pop.age, pop.birth_date)
    if age is None:
        return []
    qs = ScreeningProgram.objects.filter(is_active=True, age_min__lte=age, age_max__gte=age)
    if pop.gender:
        qs = qs.filter(Q(target_gender='') | Q(target_gender=pop.gender))
    active_diagnoses = DispensaryRecord.objects.filter(
        population=pop, is_active=True,
    ).values_list('diagnosis', flat=True)
    programs = list(qs)
    if not programs:
        return []
    excluded_codes: set[str] = set()
    diag_text = ' '.join(active_diagnoses).lower()
    if 'gelmint' in diag_text or 'gelmintoz' in diag_text:
        excluded_codes.add('helminths-2-10')
    if 'diabet' in diag_text or 'qand' in diag_text:
        excluded_codes.add('ncd-40plus')
    return [p for p in programs if p.code not in excluded_codes]


def sync_population_from_checkup(checkup: PreventiveCheckup) -> None:
    pop = checkup.population
    if checkup.health_group:
        pop.health_group = checkup.health_group
    if checkup.next_checkup_date:
        pop.next_checkup_date = checkup.next_checkup_date
    elif checkup.health_group:
        pop.next_checkup_date = next_checkup_date_for_group(checkup.health_group, checkup.checkup_date)
    pop.last_checkup_date = checkup.checkup_date
    pop.save(update_fields=['health_group', 'next_checkup_date', 'last_checkup_date', 'updated_at'])


def sync_dispensary_from_checkup(checkup: PreventiveCheckup, *, user=None) -> DispensaryRecord | None:
    """Yangi tashxis yoki dispanser ko'rigidan dispanser yozuvi yaratish/yangilash."""
    if checkup.checkup_type != 'dispensary' and not (checkup.new_diagnoses or '').strip():
        return None
    diagnosis = (checkup.new_diagnoses or checkup.existing_diagnoses or '').strip()
    if not diagnosis:
        return None
    first_line = diagnosis.split('\n')[0].strip()[:500]
    existing = DispensaryRecord.objects.filter(
        population=checkup.population, diagnosis__iexact=first_line, is_active=True,
    ).first()
    form30 = form30_from_checkup(checkup)
    if existing:
        existing.form30_data = validate_form30_data({**existing.form30_data, **form30})
        existing.health_improvement_plan = checkup.tactics or existing.health_improvement_plan
        existing.next_visit_date = checkup.next_checkup_date or existing.next_visit_date
        existing.save()
        return existing
    rec = DispensaryRecord.objects.create(
        population=checkup.population,
        brigade=checkup.brigade or checkup.population.brigade,
        diagnosis=first_line,
        registered_date=checkup.checkup_date,
        health_improvement_plan=checkup.tactics or checkup.recommendations or '',
        form30_data=validate_form30_data(form30),
        visit_frequency='Oyiga 1 marta' if checkup.health_group in ('3', '4', 'child_3') else 'Yiliga 2 marta',
        next_visit_date=checkup.next_checkup_date,
        registered_by=user,
    )
    checkup.population.dispensary_registered = True
    checkup.population.risk_chronic = True
    checkup.population.save(update_fields=['dispensary_registered', 'risk_chronic', 'updated_at'])
    return rec


def record_screening_result(enrollment: ScreeningEnrollment, data: dict, *, user=None) -> ScreeningResult:
    result_date = data.get('result_date') or timezone.now().date()
    result_status = data.get('result_status', 'negative')
    defaults = {
        'result_date': result_date,
        'result_status': result_status,
        'lab_data': data.get('lab_data') or {},
        'referral_specialist': data.get('referral_specialist', ''),
        'notes': data.get('notes', ''),
        'performed_by': user,
    }
    result, _ = ScreeningResult.objects.update_or_create(
        enrollment=enrollment,
        defaults=defaults,
    )
    enrollment.status = 'completed'
    enrollment.save(update_fields=['status', 'updated_at'])
    if result_status in ('positive', 'suspected') and enrollment.population_id:
        pop = enrollment.population
        if not pop.risk_chronic:
            pop.risk_chronic = True
            pop.save(update_fields=['risk_chronic', 'updated_at'])
    if enrollment.brigade_id:
        sync_network_plan_completed(enrollment.brigade)
    return result


def ensure_brigade_network_plans(brigade: MedicalBrigade, year: int | None = None) -> NetworkPlan:
    """Brigada uchun yillik tarmoq rejasini yaratish/yangilash."""
    y = year or timezone.now().year
    assigned = brigade.assigned_population.count()
    age_buckets = {'infant': 0, 'child': 0, 'adult': 0, 'elderly': 0}
    for pop in brigade.assigned_population.only('age', 'birth_date'):
        age = parse_age_years(pop.age, pop.birth_date)
        if age is None:
            age_buckets['adult'] += 1
        elif age < 1:
            age_buckets['infant'] += 1
        elif age < 18:
            age_buckets['child'] += 1
        elif age >= 60:
            age_buckets['elderly'] += 1
        else:
            age_buckets['adult'] += 1
    checkup_target = sum(
        required_checkups_per_year(parse_age_years(p.age, p.birth_date))
        for p in brigade.assigned_population.only('age', 'birth_date')
    )
    targets = {
        'population': assigned,
        'checkups': max(checkup_target, assigned),
        'patronage': max(assigned // 10, pop_patronage_target(brigade)),
        'screening': ScreeningEnrollment.objects.filter(brigade=brigade, status__in=['planned', 'invited']).count(),
        **age_buckets,
    }
    plan, created = NetworkPlan.objects.get_or_create(
        brigade=brigade,
        plan_level='annual',
        year=y,
        month=None,
        week_number=None,
        defaults={'title': f'{y} yil tarmoq rejasi', 'targets': targets, 'completed': {}},
    )
    if not created:
        plan.targets = {**plan.targets, **targets}
        plan.save(update_fields=['targets', 'updated_at'])
    sync_network_plan_completed(brigade, year=y)
    return plan


def pop_patronage_target(brigade: MedicalBrigade) -> int:
    return PopulationRecord.objects.filter(
        brigade=brigade,
    ).filter(
        Q(risk_pregnant=True) | Q(risk_disabled=True) | Q(risk_chronic=True)
        | Q(risk_social_vulnerable=True) | Q(risk_lone_elderly=True) | Q(risk_needs_care=True),
    ).count()


def sync_network_plan_completed(brigade: MedicalBrigade, year: int | None = None) -> dict:
    """Haqiqiy faoliyatni tarmoq rejasiga yozish."""
    y = year or timezone.now().year
    year_start = date(y, 1, 1)
    year_end = date(y, 12, 31)
    pop_ids = list(brigade.assigned_population.values_list('id', flat=True))
    checkup_ids = PreventiveCheckup.objects.filter(
        Q(brigade=brigade) | Q(population_id__in=pop_ids),
        checkup_date__gte=year_start,
        checkup_date__lte=year_end,
    ).values_list('id', flat=True).distinct()
    completed = {
        'checkups': len(list(checkup_ids)),
        'patronage': PatronageVisit.objects.filter(
            brigade=brigade, visit_date__gte=year_start, visit_date__lte=year_end,
        ).count(),
        'screening': ScreeningEnrollment.objects.filter(
            brigade=brigade,
            status='completed',
            result__result_date__gte=year_start,
            result__result_date__lte=year_end,
        ).count(),
        'dispensary_visits': DispensaryRecord.objects.filter(
            brigade=brigade, is_active=True,
        ).count(),
    }
    plans = NetworkPlan.objects.filter(brigade=brigade, year=y)
    for plan in plans:
        plan.completed = {**plan.completed, **completed}
        plan.save(update_fields=['completed', 'updated_at'])
    return completed


def after_primary_care_activity(pop: PopulationRecord | None, brigade: MedicalBrigade | None = None) -> None:
    """Ko'rik/patronaj/skriningdan keyin tarmoq rejasini yangilash."""
    b = brigade or (pop.brigade if pop else None)
    if b:
        sync_network_plan_completed(b)


def _serialize_checkup(c: PreventiveCheckup) -> dict:
    return {
        'id': c.id,
        'checkup_type': c.checkup_type,
        'checkup_date': c.checkup_date.isoformat(),
        'health_group': c.health_group,
        'health_group_label': HEALTH_GROUP_LABELS.get(c.health_group, c.health_group),
        'location': c.location,
        'blood_pressure': c.blood_pressure,
        'bmi': str(c.bmi) if c.bmi else None,
        'new_diagnoses': c.new_diagnoses,
        'recommendations': c.recommendations,
        'next_checkup_date': c.next_checkup_date.isoformat() if c.next_checkup_date else None,
        'brigade_name': c.brigade.name if c.brigade else '',
    }


def _serialize_enrollment(e: ScreeningEnrollment) -> dict:
    data = {
        'id': e.id,
        'program_id': e.program_id,
        'program_name': e.program.name,
        'program_code': e.program.code,
        'status': e.status,
        'planned_date': e.planned_date.isoformat() if e.planned_date else None,
        'exclude_reason': e.exclude_reason,
    }
    if hasattr(e, 'result') and e.result:
        r = e.result
        data['result'] = {
            'result_date': r.result_date.isoformat(),
            'result_status': r.result_status,
            'lab_data': r.lab_data,
            'referral_specialist': r.referral_specialist,
            'notes': r.notes,
        }
    return data


def build_population_primary_care_profile(pop_id: int) -> dict | None:
    """Bitta fuqaro uchun barcha modullar — yagona profil."""
    try:
        pop = PopulationRecord.objects.select_related('brigade').get(pk=pop_id)
    except PopulationRecord.DoesNotExist:
        return None

    today = timezone.now().date()
    age = parse_age_years(pop.age, pop.birth_date)
    checkups = PreventiveCheckup.objects.filter(population=pop).select_related('brigade').order_by('-checkup_date')[:20]
    enrollments = ScreeningEnrollment.objects.filter(population=pop).select_related('program').prefetch_related('result')
    patronage = PatronageVisit.objects.filter(population=pop).select_related('brigade').order_by('-visit_date')[:20]
    dispensary = DispensaryRecord.objects.filter(population=pop).select_related('brigade').order_by('-registered_date')
    family_memberships = FamilyPassportMember.objects.filter(population=pop).select_related('family')
    families = []
    for fm in family_memberships:
        fam = fm.family
        members = [
            {
                'population_id': m.population_id,
                'name': f'{m.population.last_name} {m.population.first_name}',
                'relation': m.relation,
            }
            for m in fam.members.select_related('population').all()
        ]
        families.append({
            'id': fam.id,
            'passport_number': fam.passport_number,
            'relation': fm.relation,
            'members': members,
        })

    overdue = bool(pop.next_checkup_date and pop.next_checkup_date < today)
    checkups_due_year = required_checkups_per_year(age)
    checkups_done_year = PreventiveCheckup.objects.filter(
        population=pop,
        checkup_date__year=today.year,
    ).count()

    brigade_plan = None
    if pop.brigade_id:
        plan = NetworkPlan.objects.filter(brigade=pop.brigade, plan_level='annual', year=today.year).first()
        if plan:
            brigade_plan = {
                'id': plan.id,
                'title': plan.title,
                'targets': plan.targets,
                'completed': plan.completed,
                'completion_pct': _plan_completion_pct(plan),
            }

    return {
        'population': {
            'id': pop.id,
            'registry_number': pop.registry_number,
            'first_name': pop.first_name,
            'last_name': pop.last_name,
            'father_name': pop.father_name,
            'age': pop.age,
            'age_years': age,
            'birth_date': pop.birth_date.isoformat() if pop.birth_date else None,
            'gender': pop.gender,
            'phone': pop.phone,
            'address': pop.address,
            'region_id': pop.region_id,
            'district_id': pop.district_id,
            'health_group': pop.health_group,
            'health_group_label': HEALTH_GROUP_LABELS.get(pop.health_group, pop.health_group or '—'),
            'next_checkup_date': pop.next_checkup_date.isoformat() if pop.next_checkup_date else None,
            'last_checkup_date': pop.last_checkup_date.isoformat() if pop.last_checkup_date else None,
            'dispensary_registered': pop.dispensary_registered,
            'overdue_checkup': overdue,
            'checkups_required_year': checkups_due_year,
            'checkups_done_year': checkups_done_year,
            'risk_pregnant': pop.risk_pregnant,
            'risk_disabled': pop.risk_disabled,
            'risk_chronic': pop.risk_chronic,
            'risk_social_vulnerable': pop.risk_social_vulnerable,
            'risk_lone_elderly': pop.risk_lone_elderly,
            'risk_needs_care': pop.risk_needs_care,
            'brigade': {
                'id': pop.brigade_id,
                'name': pop.brigade.name if pop.brigade else '',
            },
        },
        'checkups': [_serialize_checkup(c) for c in checkups],
        'screening': [_serialize_enrollment(e) for e in enrollments],
        'patronage': [
            {
                'id': v.id,
                'visit_date': v.visit_date.isoformat(),
                'visit_type': v.visit_type,
                'purpose': v.purpose,
                'findings': v.findings,
                'recommendations': v.recommendations,
            }
            for v in patronage
        ],
        'dispensary': [
            {
                'id': d.id,
                'diagnosis': d.diagnosis,
                'icd10_code': d.icd10_code,
                'registered_date': d.registered_date.isoformat(),
                'is_active': d.is_active,
                'next_visit_date': d.next_visit_date.isoformat() if d.next_visit_date else None,
                'visit_frequency': d.visit_frequency,
                'form30_data': d.form30_data,
            }
            for d in dispensary
        ],
        'families': families,
        'network_plan': brigade_plan,
        'eligible_screening_programs': [
            {'id': p.id, 'code': p.code, 'name': p.name}
            for p in eligible_programs_for_population(pop)
        ],
        'generated_at': timezone.now().isoformat(),
    }


def _plan_completion_pct(plan: NetworkPlan) -> int:
    targets = plan.targets or {}
    completed = plan.completed or {}
    keys = ['checkups', 'patronage', 'screening']
    ratios = []
    for k in keys:
        t = targets.get(k, 0)
        c = completed.get(k, 0)
        if t > 0:
            ratios.append(min(100, int(c / t * 100)))
    return int(sum(ratios) / len(ratios)) if ratios else 0


def setup_primary_care_system(user=None) -> dict:
    """Birinchi marta: brigada, skrining dasturlari, aholi sinxronlash."""
    ensure_default_screening_programs()
    brigade_qs = MedicalBrigade.objects.filter(is_active=True)
    if user:
        from .primary_care_access import brigades_for_user, population_for_user
        brigade_qs = brigades_for_user(user).filter(is_active=True)
    created_brigade = None
    if not brigade_qs.exists():
        region_id = ''
        district_id = ''
        clinic_name = 'Poliklinika'
        if user and getattr(user, 'clinic_group_id', None):
            cg = user.clinic_group
            if cg:
                clinic_name = cg.name or clinic_name
        created_brigade = MedicalBrigade.objects.create(
            name=f'{clinic_name} — 1-tibbiyot brigadasi',
            code='BR-01',
            target_population_size=3000,
            region_id=region_id,
            district_id=district_id,
            clinic_group_id=getattr(user, 'clinic_group_id', None) if user else None,
            leader=user if user and getattr(user, 'role', '') == 'clinic' else None,
            is_active=True,
        )
        ensure_brigade_network_plans(created_brigade)

    population_synced = 0
    pop_qs = PopulationRecord.objects.all()
    if user:
        from .primary_care_access import population_for_user
        pop_qs = population_for_user(user)
    for pop in pop_qs:
        if not pop.brigade_id or not pop.next_checkup_date:
            on_population_saved(pop, is_new=False)
            population_synced += 1

    stats = build_primary_care_stats(user=user)
    return {
        'brigade_created': created_brigade.id if created_brigade else None,
        'brigade_name': created_brigade.name if created_brigade else '',
        'population_synced': population_synced,
        'screening_programs': ScreeningProgram.objects.filter(is_active=True).count(),
        'stats': stats,
    }


def primary_care_workflow_guide() -> list[dict]:
    """SSV 210-buyruq bo'yicha ish tartibi — frontend qo'llanma."""
    return [
        {
            'step': 1,
            'title': 'Tibbiyot brigadasini yarating',
            'description': 'Har ~3000 aholi uchun oilaviy shifokor brigadasi (210-buyruq). Tizim avtomatik yaratishi mumkin.',
            'action': 'brigades',
        },
        {
            'step': 2,
            'title': 'Aholi bazasiga fuqaro qo\'shing',
            'description': 'Pasport, yosh, jins, manzil. Saqlanganda brigadaga biriktiriladi va skrining rejasi tuziladi.',
            'action': 'population',
        },
        {
            'step': 3,
            'title': 'Fuqaro profilida ko\'rik o\'tkazing',
            'description': 'Profilaktik ko\'rik, sog\'liq guruhi (I–IV), keyingi ko\'rik sanasi avtomatik hisoblanadi.',
            'action': 'profile',
        },
        {
            'step': 4,
            'title': 'Skrining va patronaj',
            'description': 'Yosh bo\'yicha: gelmintoz, gemato-onkologiya, NCD, rak skriningi. Xavf guruhiga patronaj.',
            'action': 'profile',
        },
        {
            'step': 5,
            'title': 'Dispanser nazorati',
            'description': 'Surunkali kasallik — Forma-30, individual reja, tashrif chastotasi.',
            'action': 'profile',
        },
        {
            'step': 6,
            'title': 'Tarmoq rejasi nazorati',
            'description': 'Yillik/oylik reja — ko\'riklar, patronaj, skrining bajarilishi avtomatik hisoblanadi.',
            'action': 'plans',
        },
    ]


def build_primary_care_stats(*, region_id: str = '', district_id: str = '', brigade_id: int | None = None, user=None) -> dict:
    pop_qs = PopulationRecord.objects.all()
    if user:
        from .primary_care_access import population_for_user
        pop_qs = population_for_user(user)
    if region_id:
        pop_qs = pop_qs.filter(region_id=region_id)
    if district_id:
        pop_qs = pop_qs.filter(district_id=district_id)
    if brigade_id:
        pop_qs = pop_qs.filter(brigade_id=brigade_id)

    pop_ids = list(pop_qs.values_list('id', flat=True))
    today = timezone.now().date()
    year_start = date(today.year, 1, 1)

    checkups_ytd = PreventiveCheckup.objects.filter(
        population_id__in=pop_ids,
        checkup_date__gte=year_start,
    )
    patronage_ytd = PatronageVisit.objects.filter(
        population_id__in=pop_ids,
        visit_date__gte=year_start,
    )
    screening_completed = ScreeningEnrollment.objects.filter(
        population_id__in=pop_ids,
        status='completed',
    )
    screening_planned = ScreeningEnrollment.objects.filter(
        population_id__in=pop_ids,
        status__in=['planned', 'invited'],
    )
    dispensary_active = DispensaryRecord.objects.filter(population_id__in=pop_ids, is_active=True)

    health_groups = (
        pop_qs.exclude(health_group='')
        .values('health_group')
        .annotate(count=Count('id'))
        .order_by('health_group')
    )
    overdue = pop_qs.filter(next_checkup_date__lt=today).exclude(next_checkup_date__isnull=True).count()

    brigade_stats = []
    brigade_qs = MedicalBrigade.objects.filter(is_active=True)
    if user:
        from .primary_care_access import brigades_for_user
        brigade_qs = brigades_for_user(user).filter(is_active=True)
    for b in brigade_qs:
        if region_id and b.region_id != region_id:
            continue
        if district_id and b.district_id != district_id:
            continue
        assigned = pop_qs.filter(brigade=b).count()
        plan = NetworkPlan.objects.filter(brigade=b, plan_level='annual', year=today.year).first()
        brigade_stats.append({
            'id': b.id,
            'name': b.name,
            'assigned_population': assigned,
            'target': b.target_population_size,
            'plans_count': NetworkPlan.objects.filter(brigade=b, year=today.year).count(),
            'plan_completion_pct': _plan_completion_pct(plan) if plan else 0,
            'targets': plan.targets if plan else {},
            'completed': plan.completed if plan else {},
        })

    overdue_list = list(
        pop_qs.filter(next_checkup_date__lt=today)
        .exclude(next_checkup_date__isnull=True)
        .select_related('brigade')
        .order_by('next_checkup_date')[:30]
        .values('id', 'last_name', 'first_name', 'registry_number', 'next_checkup_date', 'brigade__name'),
    )

    return {
        'population_total': pop_qs.count(),
        'with_brigade': pop_qs.exclude(brigade__isnull=True).count(),
        'checkups_ytd': checkups_ytd.count(),
        'patronage_visits_ytd': patronage_ytd.count(),
        'screening_completed': screening_completed.count(),
        'screening_planned': screening_planned.count(),
        'dispensary_active': dispensary_active.count(),
        'overdue_checkups': overdue,
        'overdue_population': overdue_list,
        'health_groups': list(health_groups),
        'risk_groups': {
            'pregnant': pop_qs.filter(risk_pregnant=True).count(),
            'disabled': pop_qs.filter(risk_disabled=True).count(),
            'chronic': pop_qs.filter(risk_chronic=True).count(),
            'social_vulnerable': pop_qs.filter(risk_social_vulnerable=True).count(),
            'lone_elderly': pop_qs.filter(risk_lone_elderly=True).count(),
            'needs_care': pop_qs.filter(risk_needs_care=True).count(),
        },
        'brigades': brigade_stats,
        'generated_at': timezone.now().isoformat(),
    }
