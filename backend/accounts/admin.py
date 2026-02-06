"""
Admin configuration for accounts app
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone
from .models import User, SubscriptionPlan, SubscriptionPayment, ActiveSession


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'plan_type', 'price_monthly', 'price_currency', 'duration_days', 'sort_order', 'is_active']
    list_filter = ['is_active', 'plan_type']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(ActiveSession)
class ActiveSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'refresh_jti', 'device_info', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__phone', 'refresh_jti']
    raw_id_fields = ['user']
    readonly_fields = ['created_at']


@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'amount', 'status', 'created_at', 'reviewed_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__phone', 'user__name']
    raw_id_fields = ['user', 'plan', 'reviewed_by']
    actions = ['approve_payments', 'reject_payments']

    def approve_payments(self, request, queryset):
        from django.utils import timezone
        for p in queryset.filter(status='pending'):
            p.status = 'approved'
            p.reviewed_at = timezone.now()
            p.reviewed_by = request.user
            p.save()
            u = p.user
            u.subscription_status = 'active'
            u.subscription_plan = p.plan
            if p.plan:
                from datetime import timedelta
                u.subscription_expiry = timezone.now() + timedelta(days=p.plan.duration_days)
            u.trial_ends_at = None
            u.save()
        self.message_user(request, f'{queryset.count()} ta to\'lov tasdiqlandi.')
    approve_payments.short_description = "Tanlangan to'lovlarni tasdiqlash"

    def reject_payments(self, request, queryset):
        for p in queryset.filter(status='pending'):
            p.status = 'rejected'
            p.reviewed_at = timezone.now()
            p.reviewed_by = request.user
            p.save()
        self.message_user(request, f'{queryset.count()} ta to\'lov rad etildi.')
    reject_payments.short_description = "Tanlangan to'lovlarni rad etish"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom User Admin"""
    list_display = ['phone', 'name', 'role', 'subscription_status', 'subscription_expiry', 'is_active', 'date_joined']
    list_filter = ['role', 'subscription_status', 'is_active', 'is_staff', 'date_joined']
    search_fields = ['phone', 'name']
    ordering = ['-date_joined']
    
    fieldsets = (
        (None, {'fields': ('phone', 'password')}),
        ('Shaxsiy ma\'lumotlar', {'fields': ('name', 'role', 'specialties')}),
        ('Bog\'lanishlar', {'fields': ('linked_doctor',)}),
        ('Obuna', {'fields': ('subscription_plan', 'subscription_status', 'subscription_expiry', 'trial_ends_at')}),
        ('Ruxsatlar', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Muhim sanalar', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone', 'name', 'password1', 'password2', 'role'),
        }),
    )
