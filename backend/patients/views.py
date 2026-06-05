"""
Patient Views
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAuthenticatedWithSubscription
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q, Count, Max
from django_filters.rest_framework import DjangoFilterBackend
from accounts.group_scope import clinic_peer_user_ids
from analyses.models import AnalysisRecord
from .models import Patient, PatientAttachment
from .serializers import (
    PatientSerializer, PatientCreateSerializer,
    PatientUpdateSerializer, PatientAttachmentSerializer
)


class PatientViewSet(viewsets.ModelViewSet):
    """Patient CRUD operations"""
    queryset = Patient.objects.all()
    permission_classes = [IsAuthenticated, IsAuthenticatedWithSubscription]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['gender']
    search_fields = ['first_name', 'last_name', 'phone', 'complaints']
    ordering_fields = ['created_at', 'first_name', 'last_name']
    ordering = ['-created_at']

    def filter_queryset(self, queryset):
        """Raqamli qidiruv — bemor ID bo'yicha aniq topish."""
        search = (self.request.query_params.get('search') or '').strip()
        if search.isdigit():
            return queryset.filter(pk=int(search))
        patient_id = (self.request.query_params.get('patient_id') or '').strip()
        if patient_id.isdigit():
            return queryset.filter(pk=int(patient_id))
        return super().filter_queryset(queryset)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PatientCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PatientUpdateSerializer
        return PatientSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = Patient.objects.select_related('created_by', 'created_by__clinic_group')
        if user.is_superuser or user.is_staff:
            return queryset
        ids = clinic_peer_user_ids(user)
        return queryset.filter(created_by_id__in=ids)

    def perform_destroy(self, instance):
        """Bemorni faqat yaratgan shifokor yoki admin o'chira oladi (guruh a'zosi o'chirmasin)."""
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return super().perform_destroy(instance)
        if instance.created_by_id and instance.created_by_id != user.id:
            raise PermissionDenied("Bemorni faqat uni yaratgan shifokor o'chirishi mumkin.")
        return super().perform_destroy(instance)
    
    def _last_analysis_summary(self, patient: Patient) -> dict:
        """Bemorning oxirgi tahlili (klinika guruhi bo'yicha barcha shifokorlar)."""
        rec = (
            AnalysisRecord.objects
            .filter(patient=patient)
            .select_related('created_by')
            .order_by('-created_at')
            .first()
        )
        if not rec:
            return {}
        fr = rec.final_report if isinstance(rec.final_report, dict) else {}
        cd = fr.get('consensusDiagnosis') or fr.get('consensus_diagnosis') or []
        if isinstance(cd, dict):
            cd = [cd]
        dx = ''
        if cd and isinstance(cd[0], dict):
            dx = str(cd[0].get('name') or '')
        physician = ''
        if rec.created_by:
            physician = str(getattr(rec.created_by, 'name', '') or rec.created_by)
        complaints = ''
        if isinstance(rec.patient_data, dict):
            complaints = str(rec.patient_data.get('complaints') or '')
        return {
            'last_analysis_id': rec.id,
            'last_analysis_at': rec.created_at.isoformat() if rec.created_at else '',
            'last_diagnosis': dx,
            'last_complaint': complaints[:200],
            'last_physician': physician,
        }

    @action(detail=False, methods=['get'], url_path='smart-search')
    def smart_search(self, request):
        """
        Aqlli qidiruv — faqat shu klinika guruhi bemorlari.
        Ism, familiya, telefon, shikoyat, ID bo'yicha.
        """
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 1:
            return Response({'success': True, 'data': []})

        qs = self.get_queryset().annotate(
            analysis_count=Count('analyses', distinct=True),
            last_analysis_at=Max('analyses__created_at'),
        )

        if q.isdigit():
            qs = qs.filter(Q(pk=int(q)) | Q(phone__icontains=q))
        else:
            tokens = [t for t in q.split() if t]
            clause = (
                Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(phone__icontains=q)
                | Q(complaints__icontains=q)
            )
            if len(tokens) >= 2:
                clause |= Q(
                    first_name__icontains=tokens[0],
                    last_name__icontains=tokens[-1],
                )
            qs = qs.filter(clause)

        qs = qs.select_related('created_by').order_by(
            '-last_analysis_at', '-updated_at',
        )[:20]

        data = []
        for p in qs:
            last = self._last_analysis_summary(p)
            data.append({
                'id': p.id,
                'first_name': p.first_name,
                'last_name': p.last_name,
                'age': p.age,
                'gender': p.gender,
                'phone': p.phone or '',
                'complaints': (p.complaints or '')[:120],
                'analysis_count': int(getattr(p, 'analysis_count', 0) or 0),
                'last_analysis_at': last.get('last_analysis_at') or (
                    p.last_analysis_at.isoformat() if getattr(p, 'last_analysis_at', None) else ''
                ),
                'last_diagnosis': last.get('last_diagnosis', ''),
                'last_complaint': last.get('last_complaint', ''),
                'last_physician': last.get('last_physician', ''),
                'registered_by': str(getattr(p.created_by, 'name', '') or '') if p.created_by else '',
            })
        return Response({'success': True, 'data': data})

    @action(detail=False, methods=['get'], url_path='match')
    def match_patients(self, request):
        """Ism/familiya/telefon bo'yicha mavjud bemorlarni topish (dublikat oldini olish)."""
        fn = (request.query_params.get('first_name') or '').strip()
        ln = (request.query_params.get('last_name') or '').strip()
        phone = (request.query_params.get('phone') or '').strip()
        if not fn and not ln and not phone:
            return Response({'success': True, 'data': []})
        qs = self.get_queryset()
        if phone:
            qs = qs.filter(phone=phone)
        if fn:
            qs = qs.filter(first_name__icontains=fn)
        if ln:
            qs = qs.filter(last_name__icontains=ln)
        data = PatientSerializer(qs.order_by('-updated_at')[:10], many=True).data
        return Response({'success': True, 'data': data})

    @action(detail=True, methods=['get'], url_path='clinical-timeline')
    def clinical_timeline(self, request, pk=None):
        """Bemorning barcha oldingi tahlillari (klinika guruhi) — yillar bo'yi konsilium konteksti."""
        patient = self.get_object()
        try:
            limit = min(int(request.query_params.get('limit', 200)), 500)
        except (TypeError, ValueError):
            limit = 200

        base_qs = (
            AnalysisRecord.objects
            .filter(patient=patient)
            .select_related('created_by')
            .order_by('-created_at')
        )
        total = base_qs.count()
        records = base_qs.defer('debate_history', 'follow_up_history')[:limit]

        timeline = []
        for rec in records:
            fr = rec.final_report if isinstance(rec.final_report, dict) else {}
            cd = fr.get('consensusDiagnosis') or fr.get('consensus_diagnosis') or []
            if isinstance(cd, dict):
                cd = [cd]
            dx_names = []
            justification = ''
            for item in cd[:4]:
                if isinstance(item, dict) and item.get('name'):
                    dx_names.append(str(item['name']))
                    if not justification:
                        justification = str(item.get('justification') or '')[:400]
            physician = ''
            if rec.created_by:
                physician = str(getattr(rec.created_by, 'name', '') or rec.created_by)
            meds = []
            for m in (fr.get('medicationRecommendations') or fr.get('medications') or [])[:5]:
                if isinstance(m, dict) and m.get('name'):
                    meds.append(str(m['name']))
            timeline.append({
                'id': rec.id,
                'date': rec.created_at.isoformat() if rec.created_at else '',
                'physician': physician,
                'complaints': (rec.patient_data or {}).get('complaints', '') if isinstance(rec.patient_data, dict) else '',
                'consensus_diagnoses': dx_names,
                'justification': justification,
                'treatment_plan': (fr.get('treatmentPlan') or fr.get('treatment_plan') or [])[:8],
                'recommended_tests': (fr.get('recommendedTests') or fr.get('recommended_tests') or [])[:8],
                'medications': meds,
                'follow_up': fr.get('follow_up_plan') or fr.get('followUpPlan') or '',
            })
        return Response({
            'success': True,
            'data': {
                'patient': PatientSerializer(patient).data,
                'analyses': timeline,
                'analysis_count': total,
            },
        })

    @action(detail=True, methods=['post'], url_path='upload-attachment')
    def upload_attachment(self, request, pk=None):
        """Upload file attachment for patient with validation"""
        import os
        from django.core.exceptions import ValidationError
        
        patient = self.get_object()
        file = request.FILES.get('file')
        
        if not file:
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_400_BAD_REQUEST,
                    'message': 'Fayl yuklanmadi'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # File size validation (10MB max)
        max_size = 10 * 1024 * 1024  # 10MB
        if file.size > max_size:
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_400_BAD_REQUEST,
                    'message': f'Fayl hajmi {max_size / 1024 / 1024}MB dan oshmasligi kerak'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # File type validation
        allowed_types = [
            'image/jpeg', 'image/png', 'image/jpg', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]
        if file.content_type not in allowed_types:
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_400_BAD_REQUEST,
                    'message': 'Faqat rasm (JPG, PNG), PDF yoki Word/Excel fayllari qabul qilinadi'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        allowed_extensions = (
            '.jpg', '.jpeg', '.png', '.gif', '.pdf',
            '.doc', '.docx', '.xls', '.xlsx',
        )
        name = getattr(file, 'name', '') or ''
        if not any(name.lower().endswith(ext) for ext in allowed_extensions):
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_400_BAD_REQUEST,
                    'message': 'Faqat rasm (JPG, PNG), PDF yoki Word/Excel fayllari qabul qilinadi'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        # Sanitize filename
        filename = os.path.basename(file.name)
        if len(filename) > 255:
            filename = filename[:255]
        
        try:
            attachment = PatientAttachment.objects.create(
                patient=patient,
                file=file,
                name=filename,
                mime_type=file.content_type
            )
            
            serializer = PatientAttachmentSerializer(attachment)
            return Response({
                'success': True,
                'message': 'Fayl muvaffaqiyatli yuklandi',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"File upload error: {e}", exc_info=True)
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
                    'message': 'Fayl yuklashda xatolik yuz berdi'
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['delete'], url_path='attachments/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Delete patient attachment"""
        try:
            attachment = PatientAttachment.objects.get(id=attachment_id, patient_id=pk)
            attachment.delete()
            return Response({
                'success': True,
                'message': 'Fayl o\'chirildi'
            })
        except PatientAttachment.DoesNotExist:
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_404_NOT_FOUND,
                    'message': 'Fayl topilmadi'
                }
            }, status=status.HTTP_404_NOT_FOUND)