"""
Health Check Endpoints (CORS-safe for frontend health checks).
"""
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.conf import settings
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import logging

logger = logging.getLogger(__name__)


def _add_cors(response, request=None):
    """Ensure CORS headers so frontend never gets blocked (fallback)."""
    origin = '*'
    if request:
        req_origin = request.META.get('HTTP_ORIGIN', '').strip()
        origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', None)
        if req_origin and origins and req_origin in origins:
            origin = req_origin
        elif origins:
            origin = origins[0] if isinstance(origins, (list, tuple)) else str(origins)
    else:
        origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', None)
        if origins:
            origin = origins[0] if isinstance(origins, (list, tuple)) else str(origins)
    response['Access-Control-Allow-Origin'] = origin
    response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response['Access-Control-Max-Age'] = '86400'
    return response


@require_http_methods(['GET', 'OPTIONS'])
@csrf_exempt
def health_check(request):
    """Basic health check; OPTIONS allowed for CORS preflight."""
    if request.method == 'OPTIONS':
        r = JsonResponse({})
        return _add_cors(r, request)
    r = JsonResponse({
        'status': 'healthy',
        'service': 'Farg\'ona JSTI backend',
    })
    return _add_cors(r, request)


@require_http_methods(['GET', 'OPTIONS'])
@csrf_exempt
def health_detailed(request):
    """Detailed health check with database and cache."""
    if request.method == 'OPTIONS':
        r = JsonResponse({})
        return _add_cors(r, request)
    checks = {
        'status': 'healthy',
        'service': 'Farg\'ona JSTI backend',
        'checks': {}
    }
    
    # Database check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            checks['checks']['database'] = 'ok'
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        checks['checks']['database'] = 'error'
        checks['status'] = 'unhealthy'
    
    # Cache check
    try:
        cache.set('health_check', 'ok', 10)
        if cache.get('health_check') == 'ok':
            checks['checks']['cache'] = 'ok'
        else:
            checks['checks']['cache'] = 'error'
            checks['status'] = 'unhealthy'
    except Exception as e:
        logger.error(f"Cache health check failed: {e}")
        checks['checks']['cache'] = 'error'
        checks['status'] = 'unhealthy'
    
    # AI configured (only whether key is set, no value)
    try:
        key = (getattr(settings, 'GEMINI_API_KEY', None) or '').strip()
        checks['checks']['ai_configured'] = bool(key)
    except Exception:
        checks['checks']['ai_configured'] = False

    # Settings check (avoid leaking config in production)
    if getattr(settings, 'DEBUG', False):
        checks['checks']['debug'] = settings.DEBUG
        checks['checks']['allowed_hosts'] = len(settings.ALLOWED_HOSTS) > 0

    status_code = 200 if checks['status'] == 'healthy' else 503
    r = JsonResponse(checks, status=status_code)
    return _add_cors(r, request)