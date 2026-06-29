"""SSV 210-buyruq API serializers."""
from rest_framework import serializers

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
    ScreeningResult,
)
from .primary_care_service import (
    after_primary_care_activity,
    compute_bmi,
    ensure_brigade_network_plans,
    enroll_screening_for_population,
    next_checkup_date_for_group,
    record_screening_result,
    sync_dispensary_from_checkup,
    sync_population_from_checkup,
)
from .form30_schema import validate_form30_data


class MedicalBrigadeSerializer(serializers.ModelSerializer):
    leader_name = serializers.SerializerMethodField()
    assigned_count = serializers.SerializerMethodField()

    class Meta:
        model = MedicalBrigade
        fields = [
            'id', 'name', 'code', 'clinic_group', 'region_id', 'district_id',
            'leader', 'leader_name', 'target_population_size', 'assigned_count',
            'notes', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_leader_name(self, obj):
        if not obj.leader:
            return ''
        return obj.leader.get_full_name() or obj.leader.username

    def get_assigned_count(self, obj):
        return obj.assigned_population.count()


class FamilyPassportMemberSerializer(serializers.ModelSerializer):
    population_name = serializers.SerializerMethodField()

    class Meta:
        model = FamilyPassportMember
        fields = ['id', 'family', 'population', 'population_name', 'relation', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_population_name(self, obj):
        p = obj.population
        return f'{p.last_name} {p.first_name}'


class FamilyPassportSerializer(serializers.ModelSerializer):
    members = FamilyPassportMemberSerializer(many=True, read_only=True)
    head_name = serializers.SerializerMethodField()

    class Meta:
        model = FamilyPassport
        fields = [
            'id', 'passport_number', 'address', 'region_id', 'district_id',
            'head', 'head_name', 'notes', 'members', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_head_name(self, obj):
        if not obj.head:
            return ''
        h = obj.head
        return f'{h.last_name} {h.first_name}'


class PreventiveCheckupSerializer(serializers.ModelSerializer):
    population_name = serializers.SerializerMethodField()
    brigade_name = serializers.SerializerMethodField()

    class Meta:
        model = PreventiveCheckup
        fields = [
            'id', 'population', 'population_name', 'brigade', 'brigade_name',
            'checkup_type', 'checkup_date', 'health_group', 'location',
            'height_cm', 'weight_kg', 'waist_cm', 'bmi', 'blood_pressure',
            'risk_factors', 'new_diagnoses', 'existing_diagnoses',
            'recommendations', 'tactics', 'next_checkup_date',
            'performed_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'bmi', 'created_at', 'updated_at', 'performed_by']

    def get_population_name(self, obj):
        p = obj.population
        return f'{p.last_name} {p.first_name} ({p.registry_number})'

    def get_brigade_name(self, obj):
        return obj.brigade.name if obj.brigade else ''

    def validate(self, attrs):
        h = attrs.get('height_cm')
        w = attrs.get('weight_kg')
        if h and w:
            attrs['bmi'] = compute_bmi(h, w)
        hg = attrs.get('health_group') or (self.instance.health_group if self.instance else '')
        if hg and not attrs.get('next_checkup_date'):
            base = attrs.get('checkup_date') or (self.instance.checkup_date if self.instance else None)
            attrs['next_checkup_date'] = next_checkup_date_for_group(hg, base)
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['performed_by'] = user
        if not validated_data.get('brigade') and validated_data.get('population'):
            pop = validated_data['population']
            if pop.brigade_id:
                validated_data['brigade'] = pop.brigade
        obj = super().create(validated_data)
        sync_population_from_checkup(obj)
        sync_dispensary_from_checkup(obj, user=user)
        after_primary_care_activity(obj.population, obj.brigade)
        return obj

    def update(self, instance, validated_data):
        user = self.context['request'].user
        obj = super().update(instance, validated_data)
        sync_population_from_checkup(obj)
        sync_dispensary_from_checkup(obj, user=user)
        after_primary_care_activity(obj.population, obj.brigade)
        return obj


class ScreeningProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreeningProgram
        fields = [
            'id', 'code', 'name', 'description', 'target_gender',
            'age_min', 'age_max', 'frequency_months', 'is_active',
        ]


class ScreeningResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreeningResult
        fields = [
            'id', 'enrollment', 'result_date', 'result_status',
            'lab_data', 'referral_specialist', 'notes', 'performed_by', 'created_at',
        ]
        read_only_fields = ['id', 'performed_by', 'created_at']


class ScreeningEnrollmentSerializer(serializers.ModelSerializer):
    population_name = serializers.SerializerMethodField()
    program_name = serializers.SerializerMethodField()
    result = ScreeningResultSerializer(read_only=True)

    class Meta:
        model = ScreeningEnrollment
        fields = [
            'id', 'population', 'population_name', 'program', 'program_name',
            'brigade', 'status', 'planned_date', 'exclude_reason',
            'result', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_population_name(self, obj):
        p = obj.population
        return f'{p.last_name} {p.first_name}'

    def get_program_name(self, obj):
        return obj.program.name


class ScreeningResultWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreeningResult
        fields = ['result_date', 'result_status', 'lab_data', 'referral_specialist', 'notes']


class PatronageVisitSerializer(serializers.ModelSerializer):
    population_name = serializers.SerializerMethodField()

    class Meta:
        model = PatronageVisit
        fields = [
            'id', 'population', 'population_name', 'brigade', 'visit_date',
            'visit_type', 'purpose', 'findings', 'recommendations',
            'performed_by', 'created_at',
        ]
        read_only_fields = ['id', 'performed_by', 'created_at']

    def get_population_name(self, obj):
        p = obj.population
        return f'{p.last_name} {p.first_name}'

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['performed_by'] = user
        if not validated_data.get('brigade') and validated_data.get('population'):
            pop = validated_data['population']
            if pop.brigade_id:
                validated_data['brigade'] = pop.brigade
        obj = super().create(validated_data)
        after_primary_care_activity(obj.population, obj.brigade)
        return obj


class NetworkPlanSerializer(serializers.ModelSerializer):
    brigade_name = serializers.SerializerMethodField()

    class Meta:
        model = NetworkPlan
        fields = [
            'id', 'brigade', 'brigade_name', 'plan_level', 'year', 'month',
            'week_number', 'title', 'targets', 'completed', 'notes',
            'approved_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_brigade_name(self, obj):
        return obj.brigade.name if obj.brigade else ''


class DispensaryRecordSerializer(serializers.ModelSerializer):
    population_name = serializers.SerializerMethodField()

    class Meta:
        model = DispensaryRecord
        fields = [
            'id', 'population', 'population_name', 'brigade', 'diagnosis',
            'icd10_code', 'registered_date', 'health_improvement_plan',
            'form30_data', 'visit_frequency', 'next_visit_date',
            'is_active', 'registered_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'registered_by', 'created_at', 'updated_at']

    def get_population_name(self, obj):
        p = obj.population
        return f'{p.last_name} {p.first_name}'

    def validate_form30_data(self, value):
        return validate_form30_data(value or {})

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['registered_by'] = user
        pop = validated_data.get('population')
        if pop and not validated_data.get('brigade') and pop.brigade_id:
            validated_data['brigade'] = pop.brigade
        if pop and not validated_data.get('form30_data'):
            validated_data['form30_data'] = validate_form30_data({}, diagnosis=validated_data.get('diagnosis', ''))
        obj = super().create(validated_data)
        pop = obj.population
        pop.dispensary_registered = True
        pop.risk_chronic = True
        pop.save(update_fields=['dispensary_registered', 'risk_chronic', 'updated_at'])
        enroll_screening_for_population(pop)
        return obj

    def update(self, instance, validated_data):
        if 'form30_data' in validated_data:
            validated_data['form30_data'] = validate_form30_data(validated_data['form30_data'])
        return super().update(instance, validated_data)


class PopulationPrimaryCareSerializer(serializers.ModelSerializer):
    brigade_name = serializers.SerializerMethodField()

    class Meta:
        model = PopulationRecord
        fields = [
            'id', 'registry_number', 'first_name', 'last_name', 'father_name',
            'age', 'gender', 'birth_date', 'health_group', 'brigade', 'brigade_name',
            'next_checkup_date', 'last_checkup_date', 'dispensary_registered',
            'risk_pregnant', 'risk_disabled', 'risk_chronic',
            'risk_social_vulnerable', 'risk_lone_elderly', 'risk_needs_care',
        ]

    def get_brigade_name(self, obj):
        return obj.brigade.name if obj.brigade else ''
