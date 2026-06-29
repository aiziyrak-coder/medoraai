"""SSV 210-buyruq API views."""
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAuthenticatedWithSubscription

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
)
from .primary_care_serializers import (
    DispensaryRecordSerializer,
    FamilyPassportMemberSerializer,
    FamilyPassportSerializer,
    MedicalBrigadeSerializer,
    NetworkPlanSerializer,
    PatronageVisitSerializer,
    PopulationPrimaryCareSerializer,
    PreventiveCheckupSerializer,
    ScreeningEnrollmentSerializer,
    ScreeningProgramSerializer,
    ScreeningResultWriteSerializer,
)
from .primary_care_service import (
    build_primary_care_stats,
    enroll_screening_for_population,
    ensure_brigade_network_plans,
    ensure_default_screening_programs,
    record_screening_result,
    sync_network_plan_completed,
)


class _PrimaryCareMixin:
    permission_classes = [IsAuthenticated, IsAuthenticatedWithSubscription]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]


class MedicalBrigadeViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = MedicalBrigade.objects.all()
    serializer_class = MedicalBrigadeSerializer
    search_fields = ['name', 'code']
    filterset_fields = ['region_id', 'district_id', 'is_active']
    ordering = ['name']

    def perform_create(self, serializer):
        brigade = serializer.save()
        ensure_brigade_network_plans(brigade)


class FamilyPassportViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = FamilyPassport.objects.prefetch_related('members__population')
    serializer_class = FamilyPassportSerializer
    search_fields = ['passport_number', 'address']
    filterset_fields = ['region_id', 'district_id']
    ordering = ['passport_number']


class FamilyPassportMemberViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = FamilyPassportMember.objects.select_related('population', 'family')
    serializer_class = FamilyPassportMemberSerializer
    filterset_fields = ['family', 'population', 'relation']


class PreventiveCheckupViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = PreventiveCheckup.objects.select_related('population', 'brigade')
    serializer_class = PreventiveCheckupSerializer
    filterset_fields = ['population', 'brigade', 'checkup_type', 'health_group', 'checkup_date']
    search_fields = ['population__last_name', 'population__first_name', 'population__registry_number']
    ordering = ['-checkup_date']


class ScreeningProgramViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = ScreeningProgram.objects.all()
    serializer_class = ScreeningProgramSerializer
    search_fields = ['name', 'code']
    filterset_fields = ['is_active']
    ordering = ['name']

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        ensure_default_screening_programs()
        return Response({'success': True, 'count': ScreeningProgram.objects.count()})


class ScreeningEnrollmentViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = ScreeningEnrollment.objects.select_related('population', 'program').prefetch_related('result')
    serializer_class = ScreeningEnrollmentSerializer
    filterset_fields = ['population', 'program', 'brigade', 'status']
    ordering = ['-planned_date']

    @action(detail=False, methods=['post'], url_path='auto-enroll')
    def auto_enroll(self, request):
        population_id = request.data.get('population_id')
        if not population_id:
            return Response({'success': False, 'error': 'population_id kerak'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            pop = PopulationRecord.objects.get(pk=population_id)
        except PopulationRecord.DoesNotExist:
            return Response({'success': False, 'error': 'Aholi topilmadi'}, status=status.HTTP_404_NOT_FOUND)
        created = enroll_screening_for_population(pop)
        return Response({'success': True, 'created': created})

    @action(detail=True, methods=['post'], url_path='record-result')
    def record_result(self, request, pk=None):
        enrollment = self.get_object()
        ser = ScreeningResultWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        result = record_screening_result(enrollment, ser.validated_data, user=request.user)
        from .primary_care_serializers import ScreeningResultSerializer
        return Response({
            'success': True,
            'data': ScreeningResultSerializer(result).data,
            'enrollment': ScreeningEnrollmentSerializer(enrollment).data,
        })


class PatronageVisitViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = PatronageVisit.objects.select_related('population', 'brigade')
    serializer_class = PatronageVisitSerializer
    filterset_fields = ['population', 'brigade', 'visit_type', 'visit_date']
    ordering = ['-visit_date']


class NetworkPlanViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = NetworkPlan.objects.select_related('brigade')
    serializer_class = NetworkPlanSerializer
    filterset_fields = ['brigade', 'plan_level', 'year', 'month']
    ordering = ['-year', '-month', '-week_number']

    @action(detail=True, methods=['post'], url_path='refresh-completed')
    def refresh_completed(self, request, pk=None):
        plan = self.get_object()
        completed = sync_network_plan_completed(plan.brigade, year=plan.year)
        plan.refresh_from_db()
        return Response({
            'success': True,
            'data': NetworkPlanSerializer(plan).data,
            'completed': completed,
        })


class DispensaryRecordViewSet(_PrimaryCareMixin, viewsets.ModelViewSet):
    queryset = DispensaryRecord.objects.select_related('population', 'brigade')
    serializer_class = DispensaryRecordSerializer
    filterset_fields = ['population', 'brigade', 'is_active']
    search_fields = ['diagnosis', 'icd10_code', 'population__last_name']
    ordering = ['-registered_date']


class PrimaryCareStatsViewSet(_PrimaryCareMixin, viewsets.ViewSet):
    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        ensure_default_screening_programs()
        region_id = request.query_params.get('region_id', '')
        district_id = request.query_params.get('district_id', '')
        brigade_id = request.query_params.get('brigade_id')
        bid = int(brigade_id) if brigade_id and str(brigade_id).isdigit() else None
        data = build_primary_care_stats(region_id=region_id, district_id=district_id, brigade_id=bid)
        return Response({'success': True, 'data': data})

    @action(detail=False, methods=['get'], url_path='overdue-checkups')
    def overdue_checkups(self, request):
        from django.utils import timezone
        qs = PopulationRecord.objects.filter(
            next_checkup_date__lt=timezone.now().date(),
        ).exclude(next_checkup_date__isnull=True).select_related('brigade')[:200]
        region_id = request.query_params.get('region_id', '')
        district_id = request.query_params.get('district_id', '')
        if region_id:
            qs = qs.filter(region_id=region_id)
        if district_id:
            qs = qs.filter(district_id=district_id)
        ser = PopulationPrimaryCareSerializer(qs, many=True)
        return Response({'success': True, 'data': ser.data})
