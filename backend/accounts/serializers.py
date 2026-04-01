"""
User Serializers
"""
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from .models import User, SubscriptionPlan
from .currency import plan_price_monthly_uzs


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

    def get_has_active_subscription(self, obj):
        return bool(obj.has_active_subscription)

    class Meta:
        model = User
        fields = [
            'id', 'phone', 'name', 'role', 'specialties',
            'subscription_plan', 'subscription_plan_detail',
            'subscription_status', 'subscription_expiry', 'trial_ends_at',
            'has_active_subscription', 'is_staff', 'is_superuser',
            'is_active', 'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'is_staff', 'is_superuser']


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
        # Yangi foydalanuvchi darhol tizimga kira olsin (trial); obuna keyin yangilanadi
        from datetime import timedelta
        user.subscription_status = 'active'
        user.trial_ends_at = timezone.now() + timedelta(days=30)
        user.save(update_fields=['subscription_status', 'trial_ends_at'])
        return user


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
