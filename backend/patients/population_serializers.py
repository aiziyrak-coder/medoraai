"""Aholi bazasi serializers."""
from rest_framework import serializers

from .models import PopulationRecord
from .passport_serial import normalize_passport_serial, validate_passport_serial_format
from .phone import normalize_patient_phone
from .population_service import _map_gender, apply_population_fields
from .primary_care_service import on_population_saved


class PopulationSerializer(serializers.ModelSerializer):
    region_name = serializers.SerializerMethodField()
    district_name = serializers.SerializerMethodField()
    gender_label = serializers.SerializerMethodField()
    brigade_name = serializers.SerializerMethodField()
    primary_care_sync = serializers.SerializerMethodField()

    class Meta:
        model = PopulationRecord
        fields = [
            'id', 'registry_number', 'first_name', 'last_name', 'father_name',
            'age', 'gender', 'gender_label', 'phone', 'address',
            'region_id', 'district_id', 'region_name', 'district_name',
            'anamnesis', 'birth_date', 'health_group', 'brigade',
            'next_checkup_date', 'last_checkup_date', 'dispensary_registered',
            'risk_pregnant', 'risk_disabled', 'risk_chronic',
            'risk_social_vulnerable', 'risk_lone_elderly', 'risk_needs_care',
            'brigade_name', 'primary_care_sync',
            'source', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'source', 'created_at', 'updated_at']

    def _address_meta(self, obj):
        from .address_data import load_address_catalog
        catalog = load_address_catalog()
        region_name = ''
        district_name = ''
        for r in catalog['regions']:
            if str(r['id']) == str(obj.region_id or ''):
                region_name = r['name_uz']
                for d in r.get('districts', []):
                    if str(d['id']) == str(obj.district_id or ''):
                        district_name = d['name_uz']
                        break
                break
        return region_name, district_name

    def get_region_name(self, obj):
        return self._address_meta(obj)[0]

    def get_district_name(self, obj):
        return self._address_meta(obj)[1]

    def get_gender_label(self, obj):
        return dict(PopulationRecord.GENDER_CHOICES).get(obj.gender, obj.gender or '')

    def get_brigade_name(self, obj):
        return obj.brigade.name if obj.brigade else ''

    def get_primary_care_sync(self, obj):
        return getattr(obj, '_primary_care_sync', None)


class PopulationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PopulationRecord
        fields = [
            'id', 'registry_number', 'first_name', 'last_name', 'father_name',
            'age', 'gender', 'phone', 'address', 'region_id', 'district_id', 'anamnesis',
            'birth_date', 'health_group', 'brigade',
            'next_checkup_date', 'last_checkup_date', 'dispensary_registered',
            'risk_pregnant', 'risk_disabled', 'risk_chronic',
            'risk_social_vulnerable', 'risk_lone_elderly', 'risk_needs_care',
        ]
        read_only_fields = ['id']

    def validate_registry_number(self, value):
        if self.instance:
            return self.instance.registry_number
        return validate_passport_serial_format(value)

    def validate(self, attrs):
        if not (attrs.get('first_name') or '').strip():
            raise serializers.ValidationError({'first_name': 'Ism kiritilishi shart.'})
        if not (attrs.get('last_name') or '').strip():
            raise serializers.ValidationError({'last_name': 'Familiya kiritilishi shart.'})
        if not self.instance and not normalize_passport_serial(
            self.initial_data.get('registry_number') or attrs.get('registry_number')
        ):
            raise serializers.ValidationError({
                'registry_number': 'Pasport seriya raqami kiritilishi shart.',
            })
        phone = normalize_patient_phone(attrs.get('phone'))
        if phone:
            attrs['phone'] = phone
        gender = attrs.get('gender')
        if gender and gender not in ('male', 'female', 'other'):
            attrs['gender'] = _map_gender(str(gender))
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        validated_data['source'] = 'manual'
        instance = super().create(validated_data)
        sync_meta = on_population_saved(instance, is_new=True)
        instance._primary_care_sync = sync_meta
        return instance

    def update(self, instance, validated_data):
        user = self.context['request'].user
        validated_data.pop('registry_number', None)
        validated_data['updated_by'] = user
        for key, val in validated_data.items():
            setattr(instance, key, val)
        instance.save()
        sync_meta = on_population_saved(instance, is_new=False)
        instance._primary_care_sync = sync_meta
        return instance

    def to_representation(self, instance):
        return PopulationSerializer(instance, context=self.context).data
