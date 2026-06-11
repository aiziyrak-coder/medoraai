"""Admin bosh sahifa statistikasi."""
from django.contrib import admin


def _safe_count(model, **filters):
    try:
        return model.objects.filter(**filters).count()
    except Exception:
        return 0


def patch_admin_index():
    """Jazzmin index ga real-time statistik kartalar qo'shadi."""
    original = admin.site.index

    def index(request, extra_context=None):
        extra_context = extra_context or {}
        try:
            from accounts.models import User, ActiveSession, SubscriptionPayment
            from patients.models import Patient
            from analyses.models import AnalysisRecord

            extra_context["aish_stats"] = {
                "users_total": _safe_count(User),
                "users_active_sub": _safe_count(User, subscription_status="active", is_active=True),
                "patients_total": _safe_count(Patient),
                "analyses_total": _safe_count(AnalysisRecord),
                "sessions_active": _safe_count(ActiveSession),
                "payments_pending": _safe_count(SubscriptionPayment, status="pending"),
            }
        except Exception:
            extra_context["aish_stats"] = {
                "users_total": 0,
                "users_active_sub": 0,
                "patients_total": 0,
                "analyses_total": 0,
                "sessions_active": 0,
                "payments_pending": 0,
            }
        return original(request, extra_context)

    admin.site.index = index
