"""
Patient Serializers
"""
from rest_framework import serializers
from .models import Patient, PatientAttachment
from accounts.serializers import UserSerializer


class PatientAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for patient attachments"""
    
    class Meta:
        model = PatientAttachment
        fields = ['id', 'name', 'file', 'mime_type', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


class PatientSerializer(serializers.ModelSerializer):
    """Patient serializer"""
    attachments = PatientAttachmentSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = Patient
        fields = [
            'id', 'first_name', 'last_name', 'age', 'gender',
            'phone', 'address', 'complaints', 'history',
            'objective_data', 'lab_results', 'allergies',
            'current_medications', 'family_history', 'additional_info',
            'structured_lab_results', 'pharmacogenomics_report',
            'symptom_timeline', 'mental_health_scores',
            'attachments', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class PatientCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating patient"""
    
    class Meta:
        model = Patient
        fields = [
            'first_name', 'last_name', 'age', 'gender',
            'phone', 'address', 'complaints', 'history',
            'objective_data', 'lab_results', 'allergies',
            'current_medications', 'family_history', 'additional_info',
            'structured_lab_results', 'pharmacogenomics_report',
            'symptom_timeline', 'mental_health_scores',
        ]
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class PatientUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating patient"""
    
    class Meta:
        model = Patient
        fields = [
            'first_name', 'last_name', 'age', 'gender',
            'phone', 'address', 'complaints', 'history',
            'objective_data', 'lab_results', 'allergies',
            'current_medications', 'family_history', 'additional_info',
            'structured_lab_results', 'pharmacogenomics_report',
            'symptom_timeline', 'mental_health_scores',
        ]
