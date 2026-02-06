"""
Analysis Serializers
"""
from rest_framework import serializers
from .models import AnalysisRecord, DiagnosisFeedback
from patients.serializers import PatientSerializer
from accounts.serializers import UserSerializer


class DiagnosisFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for diagnosis feedback"""
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = DiagnosisFeedback
        fields = ['id', 'diagnosis_name', 'feedback', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']


class AnalysisRecordSerializer(serializers.ModelSerializer):
    """Analysis record serializer"""
    patient = PatientSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    diagnosis_feedbacks = DiagnosisFeedbackSerializer(many=True, read_only=True)
    
    class Meta:
        model = AnalysisRecord
        fields = [
            'id', 'patient', 'external_patient_id', 'patient_data',
            'debate_history', 'final_report', 'follow_up_history',
            'selected_specialists', 'detected_medications',
            'diagnosis_feedbacks', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class AnalysisRecordCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating analysis record"""
    
    class Meta:
        model = AnalysisRecord
        fields = [
            'patient', 'external_patient_id', 'patient_data',
            'debate_history', 'final_report', 'follow_up_history',
            'selected_specialists', 'detected_medications'
        ]
    
    def create(self, validated_data):
        from accounts.utils import check_usage_limit, increment_usage
        
        user = self.context['request'].user
        
        # Check usage limit
        can_proceed, remaining = check_usage_limit(user, 'analyses')
        if not can_proceed:
            raise serializers.ValidationError({
                'non_field_errors': [
                    "Oylik tahlil limitiga yetdingiz. Keyingi oyda qayta urinib ko'ring."
                ]
            })
        
        validated_data['created_by'] = user
        instance = super().create(validated_data)
        
        # Increment usage counter
        increment_usage(user, 'analyses')
        
        return instance


class AnalysisRecordUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating analysis record"""
    
    class Meta:
        model = AnalysisRecord
        fields = [
            'patient_data', 'debate_history', 'final_report',
            'follow_up_history', 'selected_specialists', 'detected_medications'
        ]
