"""
User Serializers
"""
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, SubscriptionPlan
from .currency import plan_price_monthly_uzs


def normalize_phone(value: str) -> str:
    if not value or len(value) < 9:
        raise serializers.ValidationError("Telefon raqami to'liq kiritilishi kerak")
    cleaned = value.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if not cleaned.startswith('+'):
        if cleaned.startswith('998'):
            cleaned = '+' + cleaned
        else:
            cleaned = '+998' + cleaned
    return cleaned


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Obuna rejasi - faqat o'qish"""
    price_monthly_uzs = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'slug', 'plan_type', 'description', 'price_monthly',
            'price_monthly_uzs', 'price_currency', 'duration_days', 'features', 'is_trial', 'trial_days',
            'max_analyses_per_month', 'sort_order'
        ]

    def get_price_monthly_uzs(self, obj):
        return plan_price_monthly_uzs(obj)


class UserSerializer(serializers.ModelSerializer):
    """User serializer for read operations"""
    subscription_plan_detail = SubscriptionPlanSerializer(source='subscription_plan', read_only=True)
    has_active_subscription = serializers.SerializerMethodField()
    clinic_group_name = serializers.SerializerMethodField()

    def get_has_active_subscription(self, obj):
        return bool(obj.has_active_subscription)

    @staticmethod
    def get_clinic_group_name(obj):
        g = getattr(obj, 'clinic_group', None)
        return g.name if g else None

    class Meta:
        model = User
        fields = [
            'id', 'phone', 'name', 'role', 'specialties',
            'clinic_group', 'clinic_group_name', 'scoped_region_id',
            'subscription_plan', 'subscription_plan_detail',
            'subscription_status', 'subscription_expiry', 'trial_ends_at',
            'has_active_subscription', 'is_staff', 'is_superuser',
            'is_clinic_group_admin', 'is_active', 'date_joined', 'last_login'
        ]
        read_only_fields = [
            'id', 'date_joined', 'last_login', 'is_staff', 'is_superuser',
            'clinic_group', 'clinic_group_name', 'scoped_region_id',
        ]


def _validate_password_length(value):
    """Ro'yxatdan o'tishda faqat uzunlik (Django validate_password 400 kamroq)."""
    if len(value) < 8:
        raise serializers.ValidationError("Parol kamida 8 ta belgidan iborat bo'lishi kerak.")


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for clinic registration."""
    password = serializers.CharField(write_only=True, required=True, validators=[_validate_password_length])
    password_confirm = serializers.CharField(write_only=True, required=True)
    specialties = serializers.ListField(
        child=serializers.CharField(allow_blank=True),
        required=False,
        allow_empty=True,
        default=list,
    )

    class Meta:
        model = User
        fields = [
            'phone', 'name', 'password', 'password_confirm',
            'role', 'specialties'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Parollar mos kelmadi"})
        if len(attrs['password']) < 8:
            raise serializers.ValidationError({"password": "Parol kamida 8 ta belgidan iborat bo'lishi kerak"})
        return attrs

    def validate_role(self, value):
        if value != 'clinic':
            raise serializers.ValidationError("Faqat 'clinic' roli ruxsat etiladi.")
        return 'clinic'

    def validate_phone(self, value):
        if not value or len(value) < 9:
            raise serializers.ValidationError("Telefon raqami to'liq kiritilishi kerak")
        cleaned = value.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if not cleaned.startswith('+'):
            if cleaned.startswith('998'):
                cleaned = '+' + cleaned
            else:
                cleaned = '+998' + cleaned
        if User.objects.filter(phone=cleaned).exists():
            raise serializers.ValidationError("Bu telefon raqami allaqachon ro'yxatdan o'tgan.")
        return cleaned
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        validated_data['role'] = 'clinic'
        user = User.objects.create_user(password=password, **validated_data)
        # Bepul sinov oyi yo'q — obuna admin to'lovdan keyin faollashadi
        user.subscription_status = 'inactive'
        user.trial_ends_at = None
        user.save(update_fields=['subscription_status', 'trial_ends_at'])
        return user


class StaffRegistrarCreateSerializer(serializers.ModelSerializer):
    """Klinika hisobi o'z guruhi uchun registrator qo'shadi (shifokorga bog'lanmaydi)."""

    password = serializers.CharField(write_only=True, required=True, validators=[_validate_password_length])

    class Meta:
        model = User
        fields = ['phone', 'name', 'password']

    def validate_phone(self, value):
        cleaned = normalize_phone(value)
        if User.objects.filter(phone=cleaned).exists():
            raise serializers.ValidationError("Bu telefon raqami allaqachon ro'yxatdan o'tgan.")
        return cleaned

    def create(self, validated_data):
        request = self.context['request']
        owner = request.user
        password = validated_data.pop('password')
        if not owner.clinic_group_id:
            raise serializers.ValidationError({'clinic_group': 'Klinika guruhi topilmadi.'})
        return User.objects.create_user(
            password=password,
            role='staff',
            clinic_group_id=owner.clinic_group_id,
            linked_doctor=None,
            subscription_status='inactive',
            **validated_data,
        )


class ClinicAdminUserSerializer(serializers.ModelSerializer):
    """Klinika guruhi admini uchun kengaytirilgan foydalanuvchi ma'lumoti."""
    subscription_plan_detail = SubscriptionPlanSerializer(source='subscription_plan', read_only=True)
    has_active_subscription = serializers.SerializerMethodField()
    clinic_group_name = serializers.SerializerMethodField()
    active_session_count = serializers.SerializerMethodField()

    def get_has_active_subscription(self, obj):
        return bool(obj.has_active_subscription)

    @staticmethod
    def get_clinic_group_name(obj):
        g = getattr(obj, 'clinic_group', None)
        return g.name if g else None

    def get_active_session_count(self, obj):
        return obj.active_sessions.count()

    class Meta:
        model = User
        fields = [
            'id', 'phone', 'name', 'role', 'specialties',
            'clinic_group', 'clinic_group_name',
            'subscription_plan', 'subscription_plan_detail',
            'subscription_status', 'subscription_expiry', 'trial_ends_at',
            'has_active_subscription', 'is_clinic_group_admin', 'is_active',
            'active_session_count', 'date_joined', 'last_login',
        ]
        read_only_fields = ['id', 'clinic_group', 'clinic_group_name', 'date_joined', 'last_login']


class ClinicAdminUserCreateSerializer(serializers.ModelSerializer):
    """Guruh admini yangi shifokor yoki registrator qo'shadi."""
    password = serializers.CharField(write_only=True, required=True, validators=[_validate_password_length])
    role = serializers.ChoiceField(choices=[('clinic', 'Klinika'), ('staff', 'Registrator')], default='clinic')

    class Meta:
        model = User
        fields = ['phone', 'name', 'password', 'role', 'specialties']

    def validate_phone(self, value):
        cleaned = normalize_phone(value)
        if User.objects.filter(phone=cleaned).exists():
            raise serializers.ValidationError("Bu telefon raqami allaqachon ro'yxatdan o'tgan.")
        return cleaned

    def create(self, validated_data):
        admin = self.context['request'].user
        password = validated_data.pop('password')
        role = validated_data.pop('role', 'clinic')
        if not admin.clinic_group_id:
            raise serializers.ValidationError({'clinic_group': 'Klinika guruhi topilmadi.'})
        user = User.objects.create_user(
            password=password,
            role=role,
            clinic_group_id=admin.clinic_group_id,
            linked_doctor=None,
            subscription_status='inactive' if role == 'clinic' else 'inactive',
            **validated_data,
        )
        return user


class ClinicAdminUserUpdateSerializer(serializers.ModelSerializer):
    """Guruh admini foydalanuvchini yangilaydi."""
    subscription_plan = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            'name', 'role', 'specialties', 'is_active', 'is_clinic_group_admin',
            'subscription_status', 'subscription_expiry', 'subscription_plan', 'trial_ends_at',
        ]

    def validate_role(self, value):
        if value not in ('clinic', 'staff'):
            raise serializers.ValidationError("Faqat 'clinic' yoki 'staff' rollari ruxsat etiladi.")
        return value

    def validate_is_clinic_group_admin(self, value):
        if value and self.instance and self.instance.pk == self.context['request'].user.pk and not value:
            admins_left = User.objects.filter(
                clinic_group_id=self.instance.clinic_group_id,
                is_clinic_group_admin=True,
                is_active=True,
            ).exclude(pk=self.instance.pk).count()
            if admins_left == 0:
                raise serializers.ValidationError(
                    "Oxirgi guruh adminini o'chirib bo'lmaydi. Avval boshqa admin tayinlang."
                )
        return value

    def update(self, instance, validated_data):
        if validated_data.get('role') == 'staff':
            instance.linked_doctor = None
        return super().update(instance, validated_data)


class ClinicAdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, required=True, validators=[_validate_password_length])


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user"""
    
    class Meta:
        model = User
        fields = ['name', 'specialties']
    
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change"""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Yangi parollar mos kelmadi"})
        return attrs
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Eski parol noto'g'ri")
        return value


class CustomTokenObtainPairSerializer(serializers.Serializer):
    """Custom serializer for phone-based JWT authentication"""
    phone = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        phone = attrs.get('phone')
        password = attrs.get('password')
        
        if phone and password:
            # Normalize phone number
            cleaned_phone = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
            if not cleaned_phone.startswith('+'):
                if cleaned_phone.startswith('998'):
                    cleaned_phone = '+' + cleaned_phone
                else:
                    cleaned_phone = '+998' + cleaned_phone
            
            user = authenticate(request=self.context.get('request'), username=cleaned_phone, password=password)
            
            if not user:
                raise serializers.ValidationError('Telefon raqami yoki parol noto\'g\'ri')
            
            if not user.is_active:
                raise serializers.ValidationError('Foydalanuvchi hisobi faol emas')
            
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError('Telefon raqami va parol kiritilishi shart')
