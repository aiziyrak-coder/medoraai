"""
Admin configuration for accounts app
"""
import logging
from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils import timezone
from .models import User, SubscriptionPlan, SubscriptionPayment, ActiveSession, ClinicGroup
from .session_utils import (
    revoke_all_sessions_for_user,
    revoke_all_sessions_globally,
    revoke_sessions_for_users,
    revoke_single_session,
)

logger = logging.getLogger(__name__)


@admin.register(ClinicGroup)
class ClinicGroupAdmin(admin.ModelAdmin):
    """Klinika guruhi: a'zolar User admin orqali shu guruhga biriktiriladi."""
    list_display = ['name', 'slug', 'is_active', 'member_count', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'slug', 'notes']
    readonly_fields = ['created_at']
    prepopulated_fields = {'slug': ('name',)}

    @admin.display(description="A'zolar soni")
    def member_count(self, obj):
        return obj.members.count()


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'plan_type', 'price_monthly', 'price_currency', 'duration_days', 'sort_order', 'is_active']
    list_filter = ['is_active', 'plan_type']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(ActiveSession)
class ActiveSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'device_id', 'refresh_jti', 'device_info', 'last_seen', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__phone', 'refresh_jti', 'device_id']
    raw_id_fields = ['user']
    readonly_fields = ['created_at', 'last_seen']
    actions = ['logout_selected_sessions']

    @admin.action(description="Tanlangan qurilmalardan chiqarish (faqat shu sessiya)")
    def logout_selected_sessions(self, request, queryset):
        count = sum(1 for s in queryset if revoke_single_session(s))
        self.message_user(
            request,
            f"{count} ta qurilma sessiyasi bekor qilindi.",
            level=messages.SUCCESS,
        )


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
    """Custom User Admin  -  safe delete: clear JWT tokens first to avoid 500."""
    list_display = [
        'phone', 'name', 'role', 'clinic_group', 'is_clinic_group_admin',
        'subscription_status', 'subscription_expiry', 'active_session_count', 'is_active', 'date_joined',
    ]
    list_filter = ['role', 'subscription_status', 'is_active', 'is_staff', 'is_clinic_group_admin', 'clinic_group', 'date_joined']
    search_fields = ['phone', 'name']
    ordering = ['-date_joined']
    list_select_related = ['clinic_group', 'subscription_plan']
    list_per_page = 30
    show_full_result_count = False
    actions = ['logout_users_from_all_devices', 'make_clinic_group_admin', 'remove_clinic_group_admin']
    
    fieldsets = (
        (None, {'fields': ('phone', 'password')}),
        ('Shaxsiy ma\'lumotlar', {'fields': ('name', 'role', 'specialties')}),
        ('Klinika guruhi', {
            'fields': ('clinic_group',),
            'description': (
                "Shifokor va registratorlar shu guruhga biriktiriladi. "
                "Registrator uchun majburiy — klinikada 2-3 ta registrator bo'lishi mumkin, "
                "ular alohida shifokorga bog'lanmaydi."
            ),
        }),
        ('Obuna', {'fields': ('subscription_plan', 'subscription_status', 'subscription_expiry', 'trial_ends_at')}),
        ('Klinika boshqaruvi', {
            'fields': ('is_clinic_group_admin',),
            'description': (
                'Klinika guruhi admini — o\'z guruhidagi barcha foydalanuvchilarni, '
                'obunalar va to\'lovlarni /klinika-admin panel orqali boshqaradi.'
            ),
        }),
        ('Ruxsatlar', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Muhim sanalar', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone', 'name', 'password1', 'password2', 'role', 'clinic_group'),
        }),
    )

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                'logout-all-devices/',
                self.admin_site.admin_view(self.logout_all_devices_view),
                name='accounts_user_logout_all_devices',
            ),
            path(
                '<path:object_id>/logout-all-devices/',
                self.admin_site.admin_view(self.logout_user_devices_view),
                name='accounts_user_logout_user_devices',
            ),
            path(
                '<path:object_id>/logout-session/<int:session_id>/',
                self.admin_site.admin_view(self.logout_one_session_view),
                name='accounts_user_logout_one_session',
            ),
        ]
        return custom + urls

    def change_view(self, request, object_id, form_url='', extra_context=None):
        extra_context = extra_context or {}
        obj = self.get_object(request, object_id)
        if obj is not None:
            sessions = list(
                ActiveSession.objects.filter(user=obj).order_by('-last_seen', '-created_at')
            )
            extra_context['user_active_sessions'] = sessions
            extra_context['logout_user_all_url'] = reverse(
                'admin:accounts_user_logout_user_devices', args=[object_id]
            )
        return super().change_view(request, object_id, form_url, extra_context=extra_context)

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['logout_all_devices_url'] = reverse('admin:accounts_user_logout_all_devices')
        extra_context['active_sessions_total'] = ActiveSession.objects.count()
        return super().changelist_view(request, extra_context=extra_context)

    @admin.display(description='Faol sessiyalar')
    def active_session_count(self, obj):
        return obj.active_sessions.count()

    @admin.action(description="Tanlangan foydalanuvchilarni barcha qurilmalardan chiqarish")
    def logout_users_from_all_devices(self, request, queryset):
        count = revoke_sessions_for_users(queryset)
        self.message_user(
            request,
            f"{queryset.count()} ta foydalanuvchi uchun {count} ta sessiya bekor qilindi. "
            "Endi ular qayta login qila oladi.",
            level=messages.SUCCESS,
        )

    @admin.action(description="Klinika guruhi admini qilib tayinlash")
    def make_clinic_group_admin(self, request, queryset):
        updated = 0
        for u in queryset:
            if u.clinic_group_id and not u.is_clinic_group_admin:
                u.is_clinic_group_admin = True
                u.save(update_fields=['is_clinic_group_admin'])
                updated += 1
        self.message_user(request, f"{updated} ta foydalanuvchi guruh admini qilindi.", level=messages.SUCCESS)

    @admin.action(description="Klinika guruhi admini huquqini olib tashlash")
    def remove_clinic_group_admin(self, request, queryset):
        updated = queryset.filter(is_clinic_group_admin=True).update(is_clinic_group_admin=False)
        self.message_user(request, f"{updated} ta foydalanuvchidan admin huquqi olib tashlandi.", level=messages.SUCCESS)

    def logout_all_devices_view(self, request):
        """Barcha foydalanuvchilarni barcha qurilmalardan chiqarish (global logout)."""
        total_sessions = ActiveSession.objects.count()
        if request.method == 'POST':
            if 'confirm' not in request.POST:
                self.message_user(request, 'Tasdiqlash belgisi yo\'q.', level=messages.ERROR)
                return HttpResponseRedirect(reverse('admin:accounts_user_changelist'))
            count = revoke_all_sessions_globally()
            self.message_user(
                request,
                f"Barcha foydalanuvchilar barcha qurilmalardan chiqarildi ({count} ta sessiya bekor qilindi).",
                level=messages.SUCCESS,
            )
            return HttpResponseRedirect(reverse('admin:accounts_user_changelist'))

        context = {
            **self.admin_site.each_context(request),
            'title': 'Barcha qurilmalardan chiqarish',
            'total_sessions': total_sessions,
            'opts': self.model._meta,
        }
        return TemplateResponse(
            request,
            'admin/accounts/user/logout_all_devices.html',
            context,
        )

    def logout_user_devices_view(self, request, object_id):
        """Bitta foydalanuvchini barcha qurilmalardan chiqarish."""
        from django.contrib.admin.utils import unquote
        obj = self.get_object(request, unquote(object_id))
        if obj is None:
            self.message_user(request, 'Foydalanuvchi topilmadi.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:accounts_user_changelist'))
        if not self.has_change_permission(request, obj):
            self.message_user(request, 'Ruxsat yo\'q.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:accounts_user_changelist'))
        if request.method == 'POST':
            count = revoke_all_sessions_for_user(obj)
            self.message_user(
                request,
                f"{obj.phone} barcha qurilmalardan chiqarildi ({count} ta sessiya). "
                "Endi faqat bitta yangi qurilmadan kira oladi.",
                level=messages.SUCCESS,
            )
        return HttpResponseRedirect(reverse('admin:accounts_user_change', args=[object_id]))

    def logout_one_session_view(self, request, object_id, session_id):
        """Foydalanuvchining bitta qurilmasidan chiqarish."""
        from django.contrib.admin.utils import unquote
        obj = self.get_object(request, unquote(object_id))
        if obj is None or not self.has_change_permission(request, obj):
            self.message_user(request, 'Ruxsat yo\'q.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:accounts_user_changelist'))
        if request.method == 'POST':
            session = ActiveSession.objects.filter(pk=session_id, user=obj).first()
            if session and revoke_single_session(session):
                label = (session.device_info or session.device_id or str(session.pk))[:80]
                self.message_user(
                    request,
                    f"Qurilma chiqarildi: {label}",
                    level=messages.SUCCESS,
                )
            else:
                self.message_user(request, 'Sessiya topilmadi yoki allaqachon bekor qilingan.', level=messages.WARNING)
        return HttpResponseRedirect(reverse('admin:accounts_user_change', args=[object_id]))

    def save_model(self, request, obj, form, change):
        if obj.role == 'staff':
            obj.linked_doctor = None
            if not obj.clinic_group_id:
                self.message_user(
                    request,
                    'Registrator uchun klinika guruhi tanlanishi shart.',
                    level=messages.ERROR,
                )
                return
        super().save_model(request, obj, form, change)

    def _clear_user_tokens(self, user_ids):
        """Remove JWT outstanding/blacklisted tokens for given user IDs so user delete does not fail."""
        if not user_ids:
            return
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            for uid in user_ids:
                # BlacklistedToken references OutstandingToken  -  delete blacklist first to avoid FK issues
                qs_ot = OutstandingToken.objects.filter(user_id=uid)
                BlacklistedToken.objects.filter(token__in=qs_ot).delete()
                qs_ot.delete()
        except Exception as e:
            logger.warning("Token cleanup before user delete: %s", e)

    def delete_queryset(self, request, queryset):
        """Bulk delete: clear JWT tokens first, then delete users. Never 500  -  show message on error."""
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