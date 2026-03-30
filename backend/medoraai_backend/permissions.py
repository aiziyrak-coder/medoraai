"""
Custom Permissions
"""
from rest_framework import permissions


class IsClinicOrReadOnly(permissions.BasePermission):
    """Only clinic users can modify"""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_clinic or request.user.is_superuser


class IsDoctorOrStaff(permissions.BasePermission):
    """Legacy name; clinic-only access now."""
    
    def has_permission(self, request, view):
        return request.user.is_clinic or request.user.is_superuser


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Only owner can modify"""
    
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Check if user created the object
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False