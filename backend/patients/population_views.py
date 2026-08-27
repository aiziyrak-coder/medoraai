"""Aholi bazasi API."""
from django.db.models import Q
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import DenyRegionalStatsWrite, IsAuthenticatedWithSubscription

from .models import PopulationRecord
from .population_serializers import PopulationSerializer, PopulationWriteSerializer
from .population_service import (
    export_population_excel,
    export_population_template_excel,
    import_population_excel,
    population_to_dict,
    search_population,
)
from .population_statistics import build_patient_statistics, export_patient_statistics_excel
from .primary_care_service import build_population_primary_care_profile, on_population_saved


def _int_param(request, name: str) -> int | None:
    raw = (request.query_params.get(name) or '').strip()
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _statistics_params(request) -> dict:
    """Bemorlar statistikasi uchun so'rov parametrlari."""
    q = request.query_params
    lang = (q.get('lang') or 'uz').strip().lower()
    if lang.startswith('uz'):
        lang = 'uz'
    elif not lang.startswith(('ru', 'en')):
        lang = 'uz'
    else:
        lang = lang[:2]
    return {
        'region_id': (q.get('region_id') or '').strip(),
        'district_id': (q.get('district_id') or '').strip(),
        'icd_chapter': (q.get('icd_chapter') or '').strip(),
        'icd_code': (q.get('icd_code') or '').strip(),
        'age_min': _int_param(request, 'age_min'),
        'age_max': _int_param(request, 'age_max'),
        'age_group': (q.get('age_group') or '').strip(),
        'disability': (q.get('disability') or '').strip().lower(),
        'disability_group': (q.get('disability_group') or '').strip(),
        'dispensary': (q.get('dispensary') or '').strip().lower(),
        'health_group': (q.get('health_group') or '').strip(),
        'gender': (q.get('gender') or '').strip(),
        'search': (q.get('search') or '').strip(),
        'language': lang,
    }


class PopulationViewSet(viewsets.ModelViewSet):
    queryset = PopulationRecord.objects.select_related('brigade').all()
    permission_classes = [IsAuthenticated, IsAuthenticatedWithSubscription, DenyRegionalStatsWrite]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'gender', 'region_id', 'district_id', 'health_group', 'brigade',
        'risk_pregnant', 'risk_chronic', 'risk_disabled', 'dispensary_registered',
        'disability_group', 'dispensary_icd_code',
    ]
    search_fields = [
        'first_name', 'last_name', 'father_name', 'phone',
        'registry_number', 'address', 'anamnesis', 'medical_card_number',
    ]
    ordering_fields = ['last_name', 'first_name', 'created_at', 'updated_at']
    ordering = ['-updated_at']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return PopulationWriteSerializer
        return PopulationSerializer

    def get_queryset(self):
        from .primary_care_access import population_for_user
        qs = population_for_user(self.request.user)
        overdue = (self.request.query_params.get('overdue') or '').lower()
        if overdue in ('1', 'true', 'yes'):
            from django.utils import timezone
            today = timezone.now().date()
            qs = qs.filter(next_checkup_date__isnull=False, next_checkup_date__lt=today)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='search')
    def population_search(self, request):
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 1:
            return Response({'success': True, 'data': []})
        records = search_population(q, user=request.user)
        return Response({
            'success': True,
            'data': [population_to_dict(r) for r in records],
        })

    @action(detail=False, methods=['post'], url_path='import-excel')
    def import_excel(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({
                'success': False,
                'error': {'message': 'Excel fayl tanlanmagan'},
            }, status=status.HTTP_400_BAD_REQUEST)
        name = (file_obj.name or '').lower()
        if not (name.endswith('.xlsx') or name.endswith('.xls')):
            return Response({
                'success': False,
                'error': {'message': 'Faqat .xlsx yoki .xls fayl qabul qilinadi'},
            }, status=status.HTTP_400_BAD_REQUEST)
        stats = import_population_excel(
            file_obj,
            user=request.user,
            region_id=request.data.get('region_id') or request.query_params.get('region_id') or '',
            district_id=request.data.get('district_id') or request.query_params.get('district_id') or '',
        )
        return Response({'success': True, 'data': stats})

    @action(detail=False, methods=['get'], url_path='statistics')
    def statistics(self, request):
        data = build_patient_statistics(user=request.user, **_statistics_params(request))
        return Response({'success': True, 'data': data})

    @action(detail=False, methods=['get'], url_path='statistics/export')
    def statistics_export(self, request):
        params = _statistics_params(request)
        data = build_patient_statistics(user=request.user, **params)
        content = export_patient_statistics_excel(data, language=params['language'])
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="bemorlar_statistikasi.xlsx"'
        return response

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request):
        content = export_population_excel(user=request.user)
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="aholi.xlsx"'
        return response

    @action(detail=False, methods=['get'], url_path='export-template')
    def export_template(self, request):
        content = export_population_template_excel()
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="aholi_shablon.xlsx"'
        return response

    @action(detail=True, methods=['get'], url_path='primary-care-profile')
    def primary_care_profile(self, request, pk=None):
        pop = self.get_object()
        profile = build_population_primary_care_profile(pop.id)
        if not profile:
            return Response({'success': False, 'error': {'message': 'Aholi topilmadi'}}, status=status.HTTP_404_NOT_FOUND)
        return Response({'success': True, 'data': profile})

    @action(detail=True, methods=['post'], url_path='sync-primary-care')
    def sync_primary_care(self, request, pk=None):
        try:
            pop = self.get_object()
        except PopulationRecord.DoesNotExist:
            return Response({'success': False, 'error': {'message': 'Aholi topilmadi'}}, status=status.HTTP_404_NOT_FOUND)
        meta = on_population_saved(pop, is_new=False)
        profile = build_population_primary_care_profile(pop.id)
        return Response({'success': True, 'data': {'sync': meta, 'profile': profile}})
