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
    patient_id = serializers.SerializerMethodField(read_only=True)
    created_by = UserSerializer(read_only=True)
    diagnosis_feedbacks = DiagnosisFeedbackSerializer(many=True, read_only=True)

    @staticmethod
    def get_patient_id(obj):
        pid = getattr(obj, 'patient_id', None) or (getattr(obj.patient, 'id', None) if getattr(obj, 'patient', None) else None)
        return str(pid) if pid is not None else ''

    class Meta:
        model = AnalysisRecord
        fields = [
            'id', 'patient', 'patient_id', 'external_patient_id', 'patient_data',
            'debate_history', 'final_report', 'follow_up_history',
            'selected_specialists', 'detected_medications',
            'diagnosis_feedbacks', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class AnalysisRecordCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating analysis record. id is read_only so create response includes it."""
    
    class Meta:
        model = AnalysisRecord
        fields = [
            'id',
            'patient', 'external_patient_id', 'patient_data',
            'debate_history', 'final_report', 'follow_up_history',
            'selected_specialists', 'detected_medications'
        ]
        read_only_fields = ['id']
    
    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        # Tahlillar har doim bazaga saqlansin — bu yerda limit tekshiruvi o‘chirildi
        return super().create(validated_data)


class AnalysisRecordUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating analysis record"""
    
    class Meta:
        model = AnalysisRecord
        fields = [
            'patient_data', 'debate_history', 'final_report',
            'follow_up_history', 'selected_specialists', 'detected_medications'
        ]