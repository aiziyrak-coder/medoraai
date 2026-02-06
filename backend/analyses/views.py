"""
Analysis Views
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import AnalysisRecord, DiagnosisFeedback
from .serializers import (
    AnalysisRecordSerializer, AnalysisRecordCreateSerializer,
    AnalysisRecordUpdateSerializer, DiagnosisFeedbackSerializer
)


class AnalysisRecordViewSet(viewsets.ModelViewSet):
    """Analysis Record CRUD operations"""
    queryset = AnalysisRecord.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['patient', 'created_by']
    search_fields = ['patient__first_name', 'patient__last_name', 'external_patient_id']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AnalysisRecordCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return AnalysisRecordUpdateSerializer
        return AnalysisRecordSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = AnalysisRecord.objects.select_related('patient', 'created_by', 'patient__created_by')
        if user.is_clinic or user.is_superuser:
            return queryset.all()
        elif user.is_doctor:
            return queryset.filter(created_by=user)
        elif user.is_staff_member and user.linked_doctor:
            return queryset.filter(created_by=user.linked_doctor)
        return queryset.none()
    
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
        from django.core.cache import cache
        
        user = request.user
        cache_key = f'analysis_stats:{user.id}'
        
        # Try cache first (5 minutes)
        cached = cache.get(cache_key)
        if cached:
            return Response({'success': True, 'data': cached})
        
        queryset = self.get_queryset()
        total_analyses = queryset.count()
        
        # Get common diagnoses (limit to last 100 for performance)
        common_diagnoses = {}
        for analysis in queryset[:100]:
            final_report = analysis.final_report or {}
            diagnoses = final_report.get('consensusDiagnosis', [])
            for diag in diagnoses[:1]:  # Top diagnosis
                name = diag.get('name', 'Noma\'lum')
                common_diagnoses[name] = common_diagnoses.get(name, 0) + 1
        
        common_diagnoses_list = [
            {'name': name, 'count': count}
            for name, count in sorted(common_diagnoses.items(), key=lambda x: x[1], reverse=True)[:3]
        ]
        
        data = {
            'total_analyses': total_analyses,
            'common_diagnoses': common_diagnoses_list,
            'feedback_accuracy': 0.85  # TODO: Calculate actual accuracy
        }
        
        # Cache for 5 minutes
        cache.set(cache_key, data, 300)
        
        return Response({
            'success': True,
            'data': data
        })
