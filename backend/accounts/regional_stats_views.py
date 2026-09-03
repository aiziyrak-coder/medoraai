"""
Viloyat sog'liqni saqlash boshqarmasi — faqat statistika API.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta

from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from analyses.models import AnalysisRecord, AnalysisUsefulnessFeedback
from patients.address_data import load_address_catalog
from patients.models import Patient
from patients.primary_care_service import build_primary_care_stats, ensure_default_screening_programs

from .permissions import IsRegionalStatsViewer

# Viloyat statistikasi og'ir (o'nlab agregat so'rov) — qisqa muddatli kesh
REGIONAL_STATS_CACHE_TTL = 120


def _region_meta(region_id: str) -> dict:
    catalog = load_address_catalog()
    for r in catalog['regions']:
        if str(r['id']) == str(region_id):
            districts = {
                str(d['id']): d['name_uz']
                for d in r.get('districts', [])
            }
            return {
                'region_id': str(r['id']),
                'region_name': r['name_uz'],
                'districts': districts,
            }
    return {'region_id': region_id, 'region_name': region_id, 'districts': {}}


def _parse_age(age_raw: str) -> int | None:
    if not age_raw:
        return None
    m = re.search(r'\d+', str(age_raw))
    if not m:
        return None
    val = int(m.group())
    return val if 0 < val < 130 else None


def _age_group(age: int) -> str:
    if age < 18:
        return '0-17'
    if age < 30:
        return '18-29'
    if age < 45:
        return '30-44'
    if age < 60:
        return '45-59'
    return '60+'


def _build_regional_stats(user, district_id: str | None = None) -> dict:
    region_id = str(user.scoped_region_id or '').strip()
    if not region_id:
        return {}

    meta = _region_meta(region_id)
    patients_qs = Patient.objects.filter(region_id=region_id)
    analyses_qs = AnalysisRecord.objects.filter(patient__region_id=region_id)

    if district_id:
        patients_qs = patients_qs.filter(district_id=district_id)
        analyses_qs = analyses_qs.filter(patient__district_id=district_id)

    now = timezone.now()
    one_day = now - timedelta(days=1)
    seven_days = now - timedelta(days=7)
    thirty_days = now - timedelta(days=30)

    total_patients = patients_qs.count()
    total_analyses = analyses_qs.count()
    count_24h = analyses_qs.filter(created_at__gte=one_day).count()
    count_7d = analyses_qs.filter(created_at__gte=seven_days).count()
    count_30d = analyses_qs.filter(created_at__gte=thirty_days).count()
    new_patients_30d = patients_qs.filter(created_at__gte=thirty_days).count()

    # Barcha kesimlar DB agregatlari orqali — ilgari butun ustunlar Python ga o'qilardi
    gender_counts: Counter[str] = Counter({
        row['gender']: row['c']
        for row in patients_qs.exclude(gender='').order_by().values('gender').annotate(c=Count('id'))
    })
    gender_breakdown = [
        {'gender': g, 'label': dict(Patient.GENDER_CHOICES).get(g, g), 'count': c}
        for g, c in gender_counts.most_common()
    ]

    age_groups: Counter[str] = Counter()
    # Turli yosh qiymatlari kam (0..130) — guruhlab olamiz, keyin Python da yig'amiz
    for row in patients_qs.order_by().values('age').annotate(c=Count('id')):
        age = _parse_age(row['age'])
        if age is not None:
            age_groups[_age_group(age)] += row['c']
    age_breakdown = [
        {'group': label, 'count': age_groups[label]}
        for label in ['0-17', '18-29', '30-44', '45-59', '60+']
        if age_groups[label] > 0
    ]

    district_patient_counts: Counter[str] = Counter({
        row['district_id']: row['c']
        for row in Patient.objects.filter(region_id=region_id)
        .exclude(district_id='')
        .order_by()
        .values('district_id')
        .annotate(c=Count('id'))
    })
    district_analysis_counts: Counter[str] = Counter({
        row['patient__district_id']: row['c']
        for row in AnalysisRecord.objects.filter(patient__region_id=region_id)
        .exclude(patient__district_id='')
        .order_by()
        .values('patient__district_id')
        .annotate(c=Count('id'))
    })
    districts = []
    for did, pcount in district_patient_counts.most_common():
        districts.append({
            'district_id': did,
            'district_name': meta['districts'].get(str(did), str(did)),
            'patient_count': pcount,
            'analysis_count': district_analysis_counts.get(did, 0),
        })

    common_diagnoses: Counter[str] = Counter()
    reports = analyses_qs.order_by('-created_at').values_list('final_report', flat=True)[:500]
    for final_report in reports:
        if not isinstance(final_report, dict):
            continue
        raw = final_report.get('consensusDiagnosis')
        if raw is None:
            continue
        diagnoses = raw if isinstance(raw, list) else []
        for diag in diagnoses[:1]:
            if isinstance(diag, dict):
                name = (diag.get('name') or "Noma'lum").strip() or "Noma'lum"
            else:
                name = str(diag).strip() or "Noma'lum"
            common_diagnoses[name] += 1

    # Har bir shifokorning alohida ovozi (analysis+user bo'yicha yagona) — bitta so'rov
    fb = AnalysisUsefulnessFeedback.objects.filter(
        analysis__in=analyses_qs.values('id'),
    ).aggregate(
        total=Count('id'),
        positive=Count('id', filter=Q(useful=True)),
    )
    fb_total = fb['total'] or 0
    fb_positive = fb['positive'] or 0
    feedback_accuracy = round(fb_positive / fb_total, 3) if fb_total > 0 else None

    weekly_activity = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        weekly_activity.append({
            'date': day_start.date().isoformat(),
            'count': analyses_qs.filter(created_at__gte=day_start, created_at__lt=day_end).count(),
        })

    monthly_trend = []
    today = now.date()
    for i in range(5, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0:
            m += 12
            y -= 1
        month_start = timezone.make_aware(datetime(y, m, 1))
        if m == 12:
            month_end = timezone.make_aware(datetime(y + 1, 1, 1))
        else:
            month_end = timezone.make_aware(datetime(y, m + 1, 1))
        monthly_trend.append({
            'month': month_start.strftime('%Y-%m'),
            'count': analyses_qs.filter(
                created_at__gte=month_start, created_at__lt=month_end,
            ).count(),
        })

    clinic_stats = (
        Patient.objects.filter(region_id=region_id)
        .exclude(home_clinic_group__isnull=True)
        .values('home_clinic_group__name')
        .annotate(patient_count=Count('id'))
        .order_by('-patient_count')[:15]
    )
    # Har bir klinika uchun alohida COUNT o'rniga — bitta agregat so'rov
    clinic_analysis_counts = {
        row['patient__home_clinic_group__name']: row['c']
        for row in AnalysisRecord.objects.filter(patient__region_id=region_id)
        .exclude(patient__home_clinic_group__isnull=True)
        .order_by()
        .values('patient__home_clinic_group__name')
        .annotate(c=Count('id'))
    }
    clinics = []
    for row in clinic_stats:
        name = row['home_clinic_group__name'] or "Noma'lum"
        clinics.append({
            'clinic_name': name,
            'patient_count': row['patient_count'],
            'analysis_count': clinic_analysis_counts.get(row['home_clinic_group__name'], 0),
        })

    return {
        'region_id': region_id,
        'region_name': meta['region_name'],
        'filter_district_id': district_id or '',
        'summary': {
            'total_patients': total_patients,
            'total_analyses': total_analyses,
            'count_last_24h': count_24h,
            'count_last_7d': count_7d,
            'count_last_30d': count_30d,
            'new_patients_30d': new_patients_30d,
            'feedback_accuracy': feedback_accuracy,
            'feedback_count': fb_total,
        },
        'gender_breakdown': gender_breakdown,
        'age_breakdown': age_breakdown,
        'districts': districts,
        'common_diagnoses': [
            {'name': name, 'count': count}
            for name, count in common_diagnoses.most_common(12)
        ],
        'weekly_activity': weekly_activity,
        'monthly_trend': monthly_trend,
        'clinics': clinics,
        'primary_care_210': _build_primary_care_210(region_id, district_id),
        'generated_at': now.isoformat(),
    }


def _build_primary_care_210(region_id: str, district_id: str | None) -> dict:
    ensure_default_screening_programs()
    return build_primary_care_stats(
        region_id=region_id,
        district_id=district_id or '',
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRegionalStatsViewer])
def regional_stats_overview(request):
    """Viloyat bo'yicha to'liq statistika (tuman filtri ixtiyoriy)."""
    district_id = (request.query_params.get('district_id') or '').strip() or None
    region_id = str(getattr(request.user, 'scoped_region_id', '') or '').strip()
    cache_key = f'regional_stats_v1:{region_id}:{district_id or "-"}'
    try:
        data = cache.get(cache_key)
    except Exception:
        data = None
    if data is None:
        data = _build_regional_stats(request.user, district_id=district_id)
        if data:
            try:
                cache.set(cache_key, data, REGIONAL_STATS_CACHE_TTL)
            except Exception:
                pass
    if not data:
        return Response({
            'success': False,
            'error': {'message': 'Viloyat ko\'rinishi sozlanmagan.'},
        }, status=403)
    return Response({'success': True, 'data': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRegionalStatsViewer])
def regional_stats_me(request):
    """Joriy viloyat statistika foydalanuvchisi profili."""
    user = request.user
    meta = _region_meta(str(user.scoped_region_id or ''))
    return Response({
        'success': True,
        'data': {
            'name': user.name,
            'phone': user.phone,
            'role': user.role,
            'region_id': user.scoped_region_id,
            'region_name': meta.get('region_name', ''),
        },
    })
