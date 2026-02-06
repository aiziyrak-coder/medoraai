"""
Health Check Endpoints
"""
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def health_check(request):
    """Basic health check"""
    return JsonResponse({
        'status': 'healthy',
        'service': 'medoraai-backend',
    })


def health_detailed(request):
    """Detailed health check with database and cache"""
    checks = {
        'status': 'healthy',
        'service': 'medoraai-backend',
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
    
    # Settings check
    checks['checks']['debug'] = settings.DEBUG
    checks['checks']['allowed_hosts'] = len(settings.ALLOWED_HOSTS) > 0
    
    status_code = 200 if checks['status'] == 'healthy' else 503
    return JsonResponse(checks, status=status_code)
