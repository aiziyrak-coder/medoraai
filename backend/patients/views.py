"""
Patient Views
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Patient, PatientAttachment
from .serializers import (
    PatientSerializer, PatientCreateSerializer,
    PatientUpdateSerializer, PatientAttachmentSerializer
)


class PatientViewSet(viewsets.ModelViewSet):
    """Patient CRUD operations"""
    queryset = Patient.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['gender', 'created_by']
    search_fields = ['first_name', 'last_name', 'phone', 'complaints']
    ordering_fields = ['created_at', 'first_name', 'last_name']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PatientCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PatientUpdateSerializer
        return PatientSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = Patient.objects.select_related('created_by')
        if user.is_clinic or user.is_superuser:
            return queryset.all()
        elif user.is_doctor:
            return queryset.filter(created_by=user)
        elif user.is_staff_member and user.linked_doctor:
            return queryset.filter(created_by=user.linked_doctor)
        return queryset.none()
    
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
