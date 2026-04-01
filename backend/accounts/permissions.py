"""
Custom permissions for subscription and usage limits
"""
from rest_framework import permissions


class HasActiveSubscription(permissions.BasePermission):
    """
    Permission to check if user has active subscription (trial or paid).
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(request.user.has_active_subscription)


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