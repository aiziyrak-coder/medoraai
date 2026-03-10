"""
Admin configuration for accounts app
"""
import logging
from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db import transaction
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils import timezone
from .models import User, SubscriptionPlan, SubscriptionPayment, ActiveSession

logger = logging.getLogger(__name__)


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
    """Custom User Admin — safe delete: clear JWT tokens first to avoid 500."""
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

    def _clear_user_tokens(self, user_ids):
        """Remove JWT outstanding/blacklisted tokens for given user IDs so user delete does not fail."""
        if not user_ids:
            return
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            for uid in user_ids:
                # BlacklistedToken references OutstandingToken — delete blacklist first to avoid FK issues
                qs_ot = OutstandingToken.objects.filter(user_id=uid)
                BlacklistedToken.objects.filter(token__in=qs_ot).delete()
                qs_ot.delete()
        except Exception as e:
            logger.warning("Token cleanup before user delete: %s", e)

    def delete_queryset(self, request, queryset):
        """Bulk delete: clear JWT tokens first, then delete users. Never 500 — show message on error."""
        user_ids = list(queryset.values_list('pk', flat=True))
        try:
            with transaction.atomic():
                self._clear_user_tokens(user_ids)
                super().delete_queryset(request, queryset)
            self.message_user(request, f"{len(user_ids)} ta foydalanuvchi o\'chirildi.", level=messages.SUCCESS)
        except Exception as e:
            logger.exception("User admin delete_queryset: %s", e)
            self.message_user(
                request,
                f"Foydalanuvchini o\'chirishda xatolik: {e}",
                level=messages.ERROR,
            )

    def delete_view(self, request, object_id, extra_context=None):
        """Override so any exception during delete shows message and redirect instead of 500."""
        from django.contrib.admin.utils import unquote
        if request.method != "POST":
            return super().delete_view(request, object_id, extra_context)
        obj = self.get_object(request, unquote(object_id))
        if obj is None:
            return super().delete_view(request, object_id, extra_context)
        if not self.has_delete_permission(request, obj):
            return super().delete_view(request, object_id, extra_context)
        try:
            with transaction.atomic():
                self._clear_user_tokens([obj.pk])
                super().delete_model(request, obj)
            self.message_user(request, "Foydalanuvchi muvaffaqiyatli o\'chirildi.", level=messages.SUCCESS)
            return HttpResponseRedirect(reverse("admin:accounts_user_changelist"))
        except Exception as e:
            logger.exception("User admin delete_view: %s", e)
            self.message_user(request, f"Foydalanuvchini o\'chirishda xatolik: {e}", level=messages.ERROR)
            return HttpResponseRedirect(reverse("admin:accounts_user_change", args=[object_id]))

    def delete_model(self, request, obj):
        """Single-object delete: only clear tokens; actual delete done in delete_view to avoid 500."""
        super().delete_model(request, obj)
