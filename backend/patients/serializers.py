"""
Patient Serializers
"""
import logging

from django.db import IntegrityError
from rest_framework import serializers
from .models import Patient, PatientAttachment
from .access import user_can_view_clinical, strip_clinical_payload, CLINICAL_FIELDS
from .passport_serial import normalize_passport_serial, validate_passport_serial_format, LEGACY_NUMERIC_RE, PASSPORT_SERIAL_RE
from .dedup import find_existing_patient, apply_passport_fields
from .phone import normalize_patient_phone
from .population_service import upsert_population_from_patient, find_population_by_registry
from .primary_care_service import on_population_saved

logger = logging.getLogger(__name__)


def _sync_population_from_patient(patient, user):
    try:
        existing = find_population_by_registry(patient.registry_number)
        is_new = existing is None
        pop = upsert_population_from_patient(patient, user)
        on_population_saved(pop, is_new=is_new)
    except Exception as exc:
        logger.warning("Population sync failed for patient %s: %s", patient.pk, exc)
from accounts.serializers import UserSerializer


class PatientAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for patient attachments"""
    
    class Meta:
        model = PatientAttachment
        fields = ['id', 'name', 'file', 'mime_type', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


class PatientPassportSerializer(serializers.ModelSerializer):
    """Faqat pasport / demografik ma'lumotlar (global)."""
    region_name = serializers.SerializerMethodField()
    district_name = serializers.SerializerMethodField()
    registered_by = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'registry_number', 'first_name', 'last_name', 'father_name', 'age', 'gender',
            'phone', 'address', 'region_id', 'district_id',
            'region_name', 'district_name',
            'registered_by', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_region_name(self, obj):
        from .address_data import load_address_catalog
        catalog = load_address_catalog()
        r = next((x for x in catalog['regions'] if x['id'] == str(obj.region_id or '')), None)
        return r['name_uz'] if r else ''

    def get_district_name(self, obj):
        from .address_data import load_address_catalog
        catalog = load_address_catalog()
        r = next((x for x in catalog['regions'] if x['id'] == str(obj.region_id or '')), None)
        if not r:
            return ''
        d = next((x for x in r['districts'] if x['id'] == str(obj.district_id or '')), None)
        return d['name_uz'] if d else ''

    def get_registered_by(self, obj):
        if obj.created_by:
            return str(getattr(obj.created_by, 'name', '') or obj.created_by)
        return ''


class PatientRegistryWriteSerializer(serializers.ModelSerializer):
    """Registrator yoki shifokor — pasport ma'lumotlarini yaratish/yangilash."""

    class Meta:
        model = Patient
        fields = [
            'id', 'registry_number',
            'first_name', 'last_name', 'father_name', 'age', 'gender',
            'phone', 'address', 'region_id', 'district_id',
        ]
        read_only_fields = ['id']

    def validate_registry_number(self, value):
        if self.instance:
            new_rn = validate_passport_serial_format(value)
            old = normalize_passport_serial(self.instance.registry_number)
            if new_rn == old:
                return old
            if LEGACY_NUMERIC_RE.match(old) and PASSPORT_SERIAL_RE.match(new_rn):
                return new_rn
            if normalize_passport_serial(self.instance.registry_number) == new_rn:
                return new_rn
            raise serializers.ValidationError(
                'Pasport seriya raqamini o\'zgartirish mumkin emas yoki band.'
            )
        return validate_passport_serial_format(value)

    def validate(self, attrs):
        if not (attrs.get('first_name') or '').strip():
            raise serializers.ValidationError({'first_name': 'Ism kiritilishi shart.'})
        if not (attrs.get('last_name') or '').strip():
            raise serializers.ValidationError({'last_name': 'Familiya kiritilishi shart.'})
        if not (attrs.get('age') or '').strip():
            raise serializers.ValidationError({'age': 'Yosh kiritilishi shart.'})
        if not self.instance and not normalize_passport_serial(
            self.initial_data.get('registry_number') or attrs.get('registry_number')
        ):
            raise serializers.ValidationError({
                'registry_number': 'Pasport seriya raqami kiritilishi shart.',
            })
        phone = normalize_patient_phone(attrs.get('phone'))
        if phone:
            attrs['phone'] = phone
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        registry_number = validated_data.pop('registry_number', None)
        if not registry_number:
            raise serializers.ValidationError({
                'registry_number': 'Pasport seriya raqami kiritilishi shart.',
            })
        existing = find_existing_patient(
            registry_number=registry_number,
            phone=validated_data.get('phone'),
            first_name=validated_data.get('first_name'),
            last_name=validated_data.get('last_name'),
            father_name=validated_data.get('father_name'),
            age=validated_data.get('age'),
        )
        if existing:
            patient = apply_passport_fields(existing, validated_data)
            if user.clinic_group_id and not patient.home_clinic_group_id:
                patient.home_clinic_group_id = user.clinic_group_id
                patient.save(update_fields=['home_clinic_group_id', 'updated_at'])
            _sync_population_from_patient(patient, user)
            return patient
        validated_data['created_by'] = user
        validated_data.setdefault('complaints', '')
        if user.clinic_group_id:
            validated_data['home_clinic_group_id'] = user.clinic_group_id
        validated_data['registry_number'] = registry_number
        try:
            patient = super().create(validated_data)
        except IntegrityError:
            dup = find_existing_patient(registry_number=registry_number, phone=validated_data.get('phone'))
            if not dup:
                raise serializers.ValidationError({
                    'registry_number': 'Bu pasport seriya raqami bilan bemor allaqachon mavjud.',
                })
            patient = apply_passport_fields(dup, validated_data)
            if user.clinic_group_id and not patient.home_clinic_group_id:
                patient.home_clinic_group_id = user.clinic_group_id
                patient.save(update_fields=['home_clinic_group_id', 'updated_at'])
        _sync_population_from_patient(patient, user)
        return patient

    def update(self, instance, validated_data):
        user = self.context['request'].user
        new_rn = validated_data.pop('registry_number', None)
        if new_rn and new_rn != instance.registry_number:
            instance.registry_number = new_rn
            instance.save(update_fields=['registry_number', 'updated_at'])
        validated_data.pop('registry_number', None)
        clinical_keys = set(CLINICAL_FIELDS) - {'attachments'}
        for key in clinical_keys:
            validated_data.pop(key, None)
        patient = super().update(instance, validated_data)
        _sync_population_from_patient(patient, user)
        return patient


class PatientSerializer(serializers.ModelSerializer):
    """Patient serializer — klinik maydonlar faqat o'z guruhi uchun."""
    attachments = PatientAttachmentSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    region_name = serializers.SerializerMethodField()
    district_name = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'registry_number', 'first_name', 'last_name', 'father_name', 'age', 'gender',
            'phone', 'address', 'region_id', 'district_id',
            'region_name', 'district_name',
            'complaints', 'history',
            'objective_data', 'lab_results', 'allergies',
            'current_medications', 'family_history', 'additional_info',
            'structured_lab_results', 'pharmacogenomics_report',
            'symptom_timeline', 'mental_health_scores',
            'attachments', 'created_by', 'home_clinic_group',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'registry_number', 'created_by', 'home_clinic_group', 'created_at', 'updated_at']

    def get_region_name(self, obj):
        return PatientPassportSerializer().get_region_name(obj)

    def get_district_name(self, obj):
        return PatientPassportSerializer().get_district_name(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Bemor dosyesi (dossier): pasport ID kiritilganda barcha klinik ma'lumot ochiladi.
        if self.context.get('force_clinical'):
            return data
        request = self.context.get('request')
        if request and not user_can_view_clinical(request.user, instance):
            return strip_clinical_payload(data)
        return data


class PatientCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating patient. id is read_only so it appears in create response."""
    
    class Meta:
        model = Patient
        fields = [
            'id', 'registry_number',
            'first_name', 'last_name', 'father_name', 'age', 'gender',
            'phone', 'address', 'region_id', 'district_id',
            'complaints', 'history',
            'objective_data', 'lab_results', 'allergies',
            'current_medications', 'family_history', 'additional_info',
            'structured_lab_results', 'pharmacogenomics_report',
            'symptom_timeline', 'mental_health_scores',
        ]
        read_only_fields = ['id']
    
    def validate_registry_number(self, value):
        if self.instance:
            return self.instance.registry_number
        return validate_passport_serial_format(value)

    def validate(self, attrs):
        phone = normalize_patient_phone(attrs.get('phone'))
        if phone:
            attrs['phone'] = phone
        if not self.instance and not normalize_passport_serial(
            self.initial_data.get('registry_number') or attrs.get('registry_number')
        ):
            raise serializers.ValidationError({
                'registry_number': 'Pasport seriya raqami kiritilishi shart.',
            })
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        registry_number = validated_data.pop('registry_number', None)
        if not registry_number:
            raise serializers.ValidationError({
                'registry_number': 'Pasport seriya raqami kiritilishi shart.',
            })
        existing = find_existing_patient(
            registry_number=registry_number,
            phone=validated_data.get('phone'),
            first_name=validated_data.get('first_name'),
            last_name=validated_data.get('last_name'),
            father_name=validated_data.get('father_name'),
            age=validated_data.get('age'),
        )
        if existing:
            patient = apply_passport_fields(existing, validated_data)
            if user.clinic_group_id and not patient.home_clinic_group_id:
                patient.home_clinic_group_id = user.clinic_group_id
                patient.save(update_fields=['home_clinic_group_id', 'updated_at'])
            _sync_population_from_patient(patient, user)
            return patient
        validated_data['created_by'] = user
        if user.clinic_group_id:
            validated_data['home_clinic_group_id'] = user.clinic_group_id
        validated_data.setdefault('complaints', validated_data.get('complaints') or '')
        validated_data['registry_number'] = registry_number
        try:
            patient = super().create(validated_data)
        except IntegrityError:
            dup = find_existing_patient(
                registry_number=registry_number,
                phone=validated_data.get('phone'),
                first_name=validated_data.get('first_name'),
                last_name=validated_data.get('last_name'),
                father_name=validated_data.get('father_name'),
                age=validated_data.get('age'),
            )
            if not dup:
                raise serializers.ValidationError({
                    'registry_number': (
                        'Bu pasport seriya raqami bilan bemor allaqachon mavjud. '
                        'Qidiruv orqali mavjud bemorni tanlang.'
                    ),
                })
            patient = apply_passport_fields(dup, validated_data)
            if user.clinic_group_id and not patient.home_clinic_group_id:
                patient.home_clinic_group_id = user.clinic_group_id
                patient.save(update_fields=['home_clinic_group_id', 'updated_at'])
        _sync_population_from_patient(patient, user)
        return patient

    def update(self, instance, validated_data):
        validated_data.pop('registry_number', None)
        return super().update(instance, validated_data)


class PatientUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating patient"""
    
    class Meta:
        model = Patient
        fields = [
            'first_name', 'last_name', 'father_name', 'age', 'gender',
            'phone', 'address', 'region_id', 'district_id',
            'complaints', 'history',
            'objective_data', 'lab_results', 'allergies',
            'current_medications', 'family_history', 'additional_info',
            'structured_lab_results', 'pharmacogenomics_report',
            'symptom_timeline', 'mental_health_scores',
        ]
