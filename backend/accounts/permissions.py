"""
Custom permissions for subscription and usage limits
"""
from rest_framework import permissions


class IsAuthenticatedWithSubscription(permissions.BasePermission):
    """Autentifikatsiya + faol obuna (staff/superuser ham ruxsat)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(request.user.has_active_subscription)


class HasActiveSubscription(permissions.BasePermission):
    """
    Permission to check if user has active paid subscription (trial yo'q).
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(request.user.has_active_subscription)


class IsClinicGroupAdmin(permissions.BasePermission):
    """Faqat klinika guruhi admini (yoki superuser/staff)."""

    message = 'Ushbu bo\'lim faqat klinika guruhi administratori uchun.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        from .clinic_admin import is_clinic_group_admin
        return is_clinic_group_admin(request.user)


class IsRegionalStatsViewer(permissions.BasePermission):
    """Viloyat sog'liqni saqlash boshqarmasi — faqat statistika."""

    message = 'Ushbu bo\'lim faqat viloyat statistika ko\'ruvchilari uchun.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return getattr(request.user, 'role', '') == 'regional_stats'


class DenyRegionalStatsWrite(permissions.BasePermission):
    """Viloyat statistikasi foydalanuvchilari yozish amallarini bajara olmaydi."""

    message = 'Viloyat statistikasi hisobi faqat ko\'rish uchun.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return True
        if request.method in permissions.SAFE_METHODS:
            return True
        if getattr(request.user, 'role', '') == 'regional_stats':
            return False
        return True


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Permission to allow owners to edit their own objects"""
    
    def has_object_permission(self, request, view, obj):
        # Read permissions for safe methods
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only to owner
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False