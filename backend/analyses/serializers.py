"""
Analysis Serializers
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import AnalysisRecord, DiagnosisFeedback
from patients.models import Patient
from patients.serializers import PatientSerializer
from accounts.serializers import UserSerializer

User = get_user_model()


class PatientSummarySerializer(serializers.ModelSerializer):
    """Light patient payload for analysis list (avoids nested heavy fields)."""

    class Meta:
        model = Patient
        fields = ['id', 'first_name', 'last_name', 'age', 'gender']


class UserNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name']


class DiagnosisFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for diagnosis feedback"""
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = DiagnosisFeedback
        fields = ['id', 'diagnosis_name', 'feedback', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']


class AnalysisRecordListSerializer(serializers.ModelSerializer):
    """
    Minimal fields for list endpoint — keeps responses small (HTTP/2 + nginx safe).
    Full debate/follow-up and nested feedbacks: use retrieve.
    """

    patient = PatientSummarySerializer(read_only=True)
    patient_id = serializers.SerializerMethodField(read_only=True)
    created_by = UserNameSerializer(read_only=True)
    debate_history = serializers.SerializerMethodField()
    follow_up_history = serializers.SerializerMethodField()
    final_report = serializers.SerializerMethodField()
    diagnosis_feedbacks = serializers.SerializerMethodField()

    @staticmethod
    def get_patient_id(obj):
        pid = getattr(obj, 'patient_id', None) or (getattr(obj.patient, 'id', None) if getattr(obj, 'patient', None) else None)
        return str(pid) if pid is not None else ''

    @staticmethod
    def get_debate_history(_obj):
        return []

    @staticmethod
    def get_follow_up_history(_obj):
        return []

    @staticmethod
    def get_diagnosis_feedbacks(_obj):
        return []

    def get_final_report(self, obj):
        fr = obj.final_report if isinstance(obj.final_report, dict) else {}
        slim = {}
        for key in (
            'consensusDiagnosis',
            'chiefComplaint',
            'summary',
            'overview',
            'recommendations',
            'criticalFindings',
        ):
            if key in fr:
                slim[key] = fr[key]
        return slim

    class Meta:
        model = AnalysisRecord
        fields = [
            'id', 'patient', 'patient_id', 'external_patient_id', 'patient_data',
            'debate_history', 'final_report', 'follow_up_history',
            'selected_specialists', 'detected_medications',
            'diagnosis_feedbacks', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = fields


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

    def validate_patient(self, patient):
        user = self.context['request'].user
        if user.is_superuser or user.is_staff:
            return patient
        owner_id = patient.created_by_id
        if owner_id is not None and owner_id != user.id:
            raise serializers.ValidationError("Bemor boshqa hisobga tegishli.")
        if owner_id is None:
            raise serializers.ValidationError(
                "Bemor yozuvi to'liq emas yoki boshqa hisobga tegishli. Iltimos, bemorlarni ro'yxatdan qayta tanlang."
            )
        return patient
    
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