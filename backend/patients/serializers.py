"""
Patient Serializers
"""
from rest_framework import serializers
from .models import Patient, PatientAttachment
from .access import user_can_view_clinical, strip_clinical_payload, CLINICAL_FIELDS
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
            'id', 'first_name', 'last_name', 'father_name', 'age', 'gender',
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
            'id',
            'first_name', 'last_name', 'father_name', 'age', 'gender',
            'phone', 'address', 'region_id', 'district_id',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if not (attrs.get('first_name') or '').strip():
            raise serializers.ValidationError({'first_name': 'Ism kiritilishi shart.'})
        if not (attrs.get('last_name') or '').strip():
            raise serializers.ValidationError({'last_name': 'Familiya kiritilishi shart.'})
        if not (attrs.get('age') or '').strip():
            raise serializers.ValidationError({'age': 'Yosh kiritilishi shart.'})
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data.setdefault('complaints', '')
        if user.clinic_group_id:
            validated_data['home_clinic_group_id'] = user.clinic_group_id
        return super().create(validated_data)

    def update(self, instance, validated_data):
        clinical_keys = set(CLINICAL_FIELDS) - {'attachments'}
        for key in clinical_keys:
            validated_data.pop(key, None)
        return super().update(instance, validated_data)


class PatientSerializer(serializers.ModelSerializer):
    """Patient serializer — klinik maydonlar faqat o'z guruhi uchun."""
    attachments = PatientAttachmentSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    region_name = serializers.SerializerMethodField()
    district_name = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'first_name', 'last_name', 'father_name', 'age', 'gender',
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
        read_only_fields = ['id', 'created_by', 'home_clinic_group', 'created_at', 'updated_at']

    def get_region_name(self, obj):
        return PatientPassportSerializer().get_region_name(obj)

    def get_district_name(self, obj):
        return PatientPassportSerializer().get_district_name(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and not user_can_view_clinical(request.user, instance):
            return strip_clinical_payload(data)
        return data


class PatientCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating patient. id is read_only so it appears in create response."""
    
    class Meta:
        model = Patient
        fields = [
            'id',
            'first_name', 'last_name', 'father_name', 'age', 'gender',
            'phone', 'address', 'region_id', 'district_id',
            'complaints', 'history',
            'objective_data', 'lab_results', 'allergies',
            'current_medications', 'family_history', 'additional_info',
            'structured_lab_results', 'pharmacogenomics_report',
            'symptom_timeline', 'mental_health_scores',
        ]
        read_only_fields = ['id']
    
    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        if user.clinic_group_id:
            validated_data['home_clinic_group_id'] = user.clinic_group_id
        validated_data.setdefault('complaints', validated_data.get('complaints') or '')
        return super().create(validated_data)


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
