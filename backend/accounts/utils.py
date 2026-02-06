"""
Utility functions for subscription and usage limits
"""
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache


def check_usage_limit(user, limit_type='analyses'):
    """
    Check if user has reached usage limit for current month.
    Returns (can_proceed, remaining_count)
    """
    if not user.subscription_plan:
        return False, 0
    
    plan = user.subscription_plan
    
    # No limit
    if limit_type == 'analyses' and plan.max_analyses_per_month is None:
        return True, -1  # -1 means unlimited
    
    # Get current month start
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    cache_key = f'usage:{user.id}:{limit_type}:{month_start.strftime("%Y-%m")}'
    current_usage = cache.get(cache_key, 0)
    
    if limit_type == 'analyses':
        limit = plan.max_analyses_per_month
        if limit and current_usage >= limit:
            return False, 0
        remaining = limit - current_usage if limit else -1
        return True, remaining
    
    return True, -1


def increment_usage(user, limit_type='analyses'):
    """Increment usage counter for current month"""
    if not user.subscription_plan:
        return
    
    plan = user.subscription_plan
    if limit_type == 'analyses' and plan.max_analyses_per_month is None:
        return  # No limit, no need to track
    
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    cache_key = f'usage:{user.id}:{limit_type}:{month_start.strftime("%Y-%m")}'
    current = cache.get(cache_key, 0)
    cache.set(cache_key, current + 1, 86400 * 32)  # Cache for 32 days (covers month)


def get_subscription_status(user):
    """Get detailed subscription status"""
    if user.role == 'staff' and user.linked_doctor:
        user = user.linked_doctor
    
    now = timezone.now()
    is_active = user.subscription_status == 'active'
    
    days_remaining = None
    if user.trial_ends_at and user.trial_ends_at > now:
        days_remaining = (user.trial_ends_at - now).days
    elif user.subscription_expiry and user.subscription_expiry > now:
        days_remaining = (user.subscription_expiry - now).days
    
    return {
        'is_active': is_active and (days_remaining is None or days_remaining > 0),
        'status': user.subscription_status,
        'days_remaining': days_remaining,
        'plan': user.subscription_plan.name if user.subscription_plan else None,
        'is_trial': user.trial_ends_at and user.trial_ends_at > now,
    }
