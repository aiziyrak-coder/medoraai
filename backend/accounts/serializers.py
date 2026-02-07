"""
User Serializers
"""
from datetime import timedelta
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from django.utils import timezone
from .models import User, SubscriptionPlan, SubscriptionPayment


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Obuna rejasi - faqat o'qish"""
    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'slug', 'plan_type', 'description', 'price_monthly',
            'price_currency', 'duration_days', 'features', 'is_trial', 'trial_days',
            'max_analyses_per_month', 'sort_order'
        ]


class UserSerializer(serializers.ModelSerializer):
    """User serializer for read operations"""
    subscription_plan_detail = SubscriptionPlanSerializer(source='subscription_plan', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'phone', 'name', 'role', 'specialties',
            'linked_doctor', 'subscription_plan', 'subscription_plan_detail',
            'subscription_status', 'subscription_expiry', 'trial_ends_at',
            'is_active', 'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    linked_doctor = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'phone', 'name', 'password', 'password_confirm',
            'role', 'specialties', 'linked_doctor'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Parollar mos kelmadi"})
        if len(attrs['password']) < 8:
            raise serializers.ValidationError({"password": "Parol kamida 8 ta belgidan iborat bo'lishi kerak"})
        return attrs
    
    def validate_phone(self, value):
        # Basic phone validation - allow any format for flexibility
        if not value or len(value) < 9:
            raise serializers.ValidationError("Telefon raqami to'liq kiritilishi kerak")
        # Normalize phone number
        cleaned = value.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if not cleaned.startswith('+'):
            if cleaned.startswith('998'):
                cleaned = '+' + cleaned
            else:
                cleaned = '+998' + cleaned
        return cleaned
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        # linked_doctor ni phone/ID dan User instance ga o'girish
        linked_doctor_raw = validated_data.pop('linked_doctor', None)
        linked_doctor_obj = None
        if linked_doctor_raw:
            # Try as ID first
            if str(linked_doctor_raw).isdigit():
                linked_doctor_obj = User.objects.filter(pk=int(linked_doctor_raw)).first()
            # Try as phone - NORMALIZE qilish
            if not linked_doctor_obj:
                cleaned_phone = str(linked_doctor_raw).replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                if not cleaned_phone.startswith('+'):
                    if cleaned_phone.startswith('998'):
                        cleaned_phone = '+' + cleaned_phone
                    else:
                        cleaned_phone = '+998' + cleaned_phone
                linked_doctor_obj = User.objects.filter(phone=cleaned_phone).first()
        validated_data['linked_doctor'] = linked_doctor_obj
        user = User.objects.create_user(password=password, **validated_data)
        # Shifokorlar uchun trial period
        if user.role == 'doctor':
            from django.conf import settings
            trial_days = getattr(settings, 'DOCTOR_TRIAL_DAYS', 7)
            user.subscription_status = 'active'
            user.trial_ends_at = timezone.now() + timedelta(days=trial_days)
            user.save(update_fields=['subscription_status', 'trial_ends_at'])
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user"""
    
    class Meta:
        model = User
        fields = ['name', 'specialties', 'linked_doctor']
    
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
