"""
Analysis Views
"""
import logging
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAuthenticatedWithSubscription
from django.db import transaction
from django.db.models import Count, Min, Q
from django_filters.rest_framework import DjangoFilterBackend
from accounts.group_scope import clinic_peer_user_ids
from .models import AnalysisRecord, DiagnosisFeedback, AnalysisAuditLog, AnalysisUsefulnessFeedback
from .serializers import (
    AnalysisRecordSerializer,
    AnalysisRecordListSerializer,
    AnalysisRecordCreateSerializer,
    AnalysisRecordUpdateSerializer,
    DiagnosisFeedbackSerializer,
)

logger = logging.getLogger(__name__)


class AnalysisRecordViewSet(viewsets.ModelViewSet):
    """Analysis Record CRUD operations"""
    queryset = AnalysisRecord.objects.all()
    permission_classes = [IsAuthenticated, IsAuthenticatedWithSubscription]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['patient']
    search_fields = ['patient__first_name', 'patient__last_name', 'external_patient_id']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return AnalysisRecordListSerializer
        if self.action == 'create':
            return AnalysisRecordCreateSerializer
        if self.action in ('update', 'partial_update'):
            return AnalysisRecordUpdateSerializer
        return AnalysisRecordSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = AnalysisRecord.objects.select_related(
            'patient', 'created_by', 'patient__created_by', 'patient__created_by__clinic_group'
        )
        # Superuser / staff: barcha tahlillar (admin)
        if not (user.is_superuser or user.is_staff):
            ids = clinic_peer_user_ids(user)
            queryset = queryset.filter(
                Q(patient__created_by_id__in=ids)
                | Q(patient__created_by__isnull=True, created_by_id__in=ids)
            )
        # List: skip loading huge JSON columns (serializer does not expose them)
        if getattr(self, 'action', None) == 'list':
            queryset = queryset.defer('debate_history', 'follow_up_history')
        return queryset

    def _log_audit(self, analysis, action, extra=None):
        """
        Tibbiy audit izi — xatoni yutmaydi.
        Yozuvni ochiq-oydin log qiladi va xatoni yuqoriga uzatadi: chaqiruvchilar buni
        transaction.atomic() ichida bajaradi, shuning uchun audit yozilmasa asosiy yozuv
        ham rollback bo'ladi. Qayd etilmagan o'zgarish — qayd etilgan xatolikdan yomonroq;
        mijoz so'rovni qayta yuborishi mumkin, lekin "sassiz" audit teshigi qolmaydi.
        """
        try:
            AnalysisAuditLog.objects.create(
                analysis=analysis,
                user=getattr(self.request, 'user', None),
                action=action,
                extra=extra or {}
            )
        except Exception:
            logger.exception(
                'AUDIT WRITE FAILED: analysis_id=%s action=%s user_id=%s',
                getattr(analysis, 'id', None),
                action,
                getattr(getattr(self.request, 'user', None), 'id', None),
            )
            raise

    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)
            self._log_audit(serializer.instance, 'created')

    def perform_update(self, serializer):
        with transaction.atomic():
            super().perform_update(serializer)
            self._log_audit(serializer.instance, 'updated')

    @action(detail=True, methods=['get'], url_path='audit')
    def audit_log(self, request, pk=None):
        """Get audit trail for this analysis (kim, nima, qachon)."""
        analysis = self.get_object()
        logs = AnalysisAuditLog.objects.filter(analysis=analysis).select_related('user').order_by('-created_at')[:50]
        data = []
        for log in logs:
            u = log.user
            user_display = getattr(u, 'name', None) or getattr(u, 'email', None) or (str(u) if u else '-')
            data.append({
                'action': log.action,
                'user': user_display,
                'created_at': log.created_at.isoformat(),
                'extra': log.extra,
            })
        return Response({'success': True, 'data': data})

    @action(detail=True, methods=['post'], url_path='physician-sign')
    def physician_sign(self, request, pk=None):
        """Shifokor yakuniy hisobotni klinik jihatdan tasdiqlaydi."""
        from django.utils import timezone as dj_tz
        analysis = self.get_object()
        note = (request.data.get('note') or '').strip()[:2000]
        with transaction.atomic():
            analysis.physician_signed_at = dj_tz.now()
            analysis.physician_signed_by = request.user
            analysis.physician_sign_note = note
            analysis.save(update_fields=['physician_signed_at', 'physician_signed_by', 'physician_sign_note', 'updated_at'])
            self._log_audit(analysis, 'updated', extra={'physician_sign': True, 'note': note[:200]})
        return Response({
            'success': True,
            'message': 'Hisobot tasdiqlandi',
            'data': {
                'signed_at': analysis.physician_signed_at.isoformat(),
                'signed_by': getattr(request.user, 'name', None) or str(request.user),
            },
        })

    @action(detail=True, methods=['post'], url_path='usefulness-feedback')
    def usefulness_feedback(self, request, pk=None):
        """Shifokor fikri: konsilium natijasi foydali bo'ldimi? (foydali/foydali emas + ixtiyoriy izoh)."""
        analysis = self.get_object()
        useful = request.data.get('useful')
        if useful is None:
            return Response({
                'success': False,
                'error': {'code': 400, 'message': "useful (true/false) majburiy"}
            }, status=status.HTTP_400_BAD_REQUEST)
        comment = (request.data.get('comment') or '').strip()[:2000]
        # Har bir shifokor faqat o'z bahosini yangilaydi (boshqasinikini ustiga yozmaydi)
        obj, created = AnalysisUsefulnessFeedback.objects.update_or_create(
            analysis=analysis,
            user=request.user,
            defaults={'useful': bool(useful), 'comment': comment}
        )
        return Response({
            'success': True,
            'message': 'Fikr saqlandi',
            'data': {'useful': obj.useful, 'comment': obj.comment, 'created': created}
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-feedback')
    def add_feedback(self, request, pk=None):
        """Add diagnosis feedback"""
        analysis = self.get_object()
        serializer = DiagnosisFeedbackSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            serializer.save(
                analysis=analysis,
                created_by=request.user
            )
            return Response({
                'success': True,
                'message': 'Fikr qo\'shildi',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_400_BAD_REQUEST,
                'message': 'Ma\'lumotlar noto\'g\'ri',
                'details': serializer.errors
            }
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Get analysis statistics for current user"""
        from datetime import timedelta
        from django.core.cache import cache
        from django.utils import timezone as dj_tz

        user = request.user
        cache_key = f'analysis_stats_v6:{user.id}'

        try:
            cached = cache.get(cache_key)
            if cached is not None:
                return Response({'success': True, 'data': cached})
        except Exception:
            pass

        from django.conf import settings as dj_settings
        baseline = max(0, int(getattr(dj_settings, 'STATS_HISTORICAL_BASELINE', 0) or 0))

        empty_payload = {
            'total_analyses': baseline,
            'count_last_24h': 0,
            'count_last_7d': 0,
            'count_last_30d': 0,
            'new_patients_30d': 0,
            'return_patients_30d': 0,
            'common_diagnoses': [],
            'feedback_accuracy': None,
        }

        try:
            queryset = self.get_queryset()
            total_analyses = queryset.count()

            now = dj_tz.now()
            one_day_ago = now - timedelta(days=1)
            seven_days_ago = now - timedelta(days=7)
            thirty_days_ago = now - timedelta(days=30)
            count_last_24h = queryset.filter(created_at__gte=one_day_ago).count()
            count_last_7d = queryset.filter(created_at__gte=seven_days_ago).count()
            count_last_30d = queryset.filter(created_at__gte=thirty_days_ago).count()

            from patients.primary_care_access import checkups_for_user, dispensary_for_user

            checkup_qs = checkups_for_user(user)
            thirty_days_ago_date = thirty_days_ago.date()
            seven_days_ago_date = seven_days_ago.date()
            one_day_ago_date = one_day_ago.date()
            total_analyses += checkup_qs.count()
            count_last_24h += checkup_qs.filter(checkup_date__gte=one_day_ago_date).count()
            count_last_7d += checkup_qs.filter(checkup_date__gte=seven_days_ago_date).count()
            count_last_30d += checkup_qs.filter(checkup_date__gte=thirty_days_ago_date).count()

            first_by_patient = list(
                queryset.exclude(patient_id__isnull=True)
                .values('patient_id')
                .annotate(first_at=Min('created_at'))
            )
            new_patients_30d = sum(
                1 for row in first_by_patient
                if row.get('first_at') and row['first_at'] >= thirty_days_ago
            )
            first_by_pop = list(
                checkup_qs.values('population_id').annotate(first_at=Min('checkup_date'))
            )
            new_patients_30d += sum(
                1 for row in first_by_pop
                if row.get('first_at') and row['first_at'] >= thirty_days_ago_date
            )
            return_patients_30d = (
                queryset.filter(created_at__gte=thirty_days_ago, patient_id__isnull=False)
                .values('patient_id')
                .annotate(n=Count('id'))
                .filter(n__gt=1)
                .count()
            )
            return_patients_30d += (
                checkup_qs.filter(checkup_date__gte=thirty_days_ago_date)
                .values('population_id')
                .annotate(n=Count('id'))
                .filter(n__gt=1)
                .count()
            )

            # values_list: .only() + select_related() ba'zi DB/ORM kombinatsiyalarida 500 beradi
            common_diagnoses = {}
            for row in (
                dispensary_for_user(user)
                .filter(is_active=True)
                .exclude(icd10_code='')
                .values('icd10_code')
                .annotate(c=Count('id'))
            ):
                name = str(row.get('icd10_code') or '').strip()
                if name:
                    common_diagnoses[name] = common_diagnoses.get(name, 0) + int(row['c'])

            reports = queryset.order_by('-created_at').values_list('final_report', flat=True)[:300]
            for final_report in reports:
                if not isinstance(final_report, dict):
                    continue
                raw = final_report.get('consensusDiagnosis')
                if raw is None:
                    continue
                diagnoses = raw if isinstance(raw, list) else []
                for diag in diagnoses[:1]:
                    if isinstance(diag, dict):
                        name = (diag.get('name') or "Noma'lum")
                        name = str(name).strip() or "Noma'lum"
                    else:
                        name = str(diag).strip() or "Noma'lum"
                    common_diagnoses[name] = common_diagnoses.get(name, 0) + 1

            common_diagnoses_list = [
                {'name': name, 'count': count}
                for name, count in sorted(
                    common_diagnoses.items(), key=lambda x: x[1], reverse=True
                )[:8]
            ]

            # Har bir shifokorning alohida ovozi hisobga olinadi (bitta so'rovda)
            from .models import AnalysisUsefulnessFeedback
            fb = AnalysisUsefulnessFeedback.objects.filter(
                analysis__in=queryset.values('id'),
            ).aggregate(
                total=Count('id'),
                positive=Count('id', filter=Q(useful=True)),
            )
            fb_total = fb['total'] or 0
            fb_positive = fb['positive'] or 0
            feedback_accuracy = round(fb_positive / fb_total, 3) if fb_total > 0 else None

            data = {
                'total_analyses': total_analyses + baseline,
                'count_last_24h': count_last_24h,
                'count_last_7d': count_last_7d,
                'count_last_30d': count_last_30d,
                'new_patients_30d': new_patients_30d,
                'return_patients_30d': return_patients_30d,
                'common_diagnoses': common_diagnoses_list,
                'feedback_accuracy': feedback_accuracy,
            }

            try:
                cache.set(cache_key, data, 5)
            except Exception:
                pass

            return Response({'success': True, 'data': data})
        except Exception:
            logger.exception('analysis stats failed for user_id=%s', getattr(user, 'id', None))
            return Response({'success': True, 'data': empty_payload})