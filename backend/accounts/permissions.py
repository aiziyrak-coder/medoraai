"""
Custom permissions for subscription and usage limits
"""
from rest_framework import permissions
from django.utils import timezone


class HasActiveSubscription(permissions.BasePermission):
    """
    Permission to check if user has active subscription (trial or paid).
    Staff inherits from linked doctor.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        user = request.user
        
        # Staff inherits subscription from linked doctor
        if user.role == 'staff' and user.linked_doctor:
            user = user.linked_doctor
        
        # Check subscription status
        if user.subscription_status != 'active':
            return False
        
        # Check trial expiry
        if user.trial_ends_at and timezone.now() >= user.trial_ends_at:
            if not user.subscription_expiry or timezone.now() >= user.subscription_expiry:
                return False
        
        # Check paid subscription expiry
        if user.subscription_expiry and timezone.now() >= user.subscription_expiry:
            if not user.trial_ends_at or timezone.now() >= user.trial_ends_at:
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
