"""
Custom Middleware for Security and Performance
"""
import time
import logging
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse, HttpResponse
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)

# Health uchun minimal javob (Host/ALLOWED_HOSTS tekshirilmaydi)
HEALTH_BODY = b'{"status":"healthy","service":"Farg\'ona JSTI backend"}'


class EarlyHealthMiddleware(MiddlewareMixin):
    """
    Birinchi qatlam: GET /health tez javob (Gunicorn/Django yukisiz tekshiruv).
    Eski fargana.uz domenini medora.cdcgroup.uz ga normalize qiladi (ALLOWED_HOSTS bilan mos).
    """
    def process_request(self, request):
        _meta = request.META
        host_raw = (_meta.get('HTTP_HOST') or '').strip().split(':')[0].lower()
        if host_raw and 'fargana.uz' in host_raw:
            _meta['HTTP_HOST'] = 'medora.cdcgroup.uz'
        if request.method in ('GET', 'OPTIONS') and request.path.rstrip('/') == '/health':
            r = HttpResponse(HEALTH_BODY, content_type='application/json', status=200)
            r['Access-Control-Allow-Origin'] = '*'
            r['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            r['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            return r
        return None


class NormalizeHostMiddleware(MiddlewareMixin):
    """
    Run first: normalize Host for fargana.uz so ALLOWED_HOSTS check never returns 400.
    Barcha so'rovlar (login, health, api) uchun Host ni medora.cdcgroup.uz qiladi.
    """
    def process_request(self, request):
        host = (request.META.get('HTTP_HOST') or '').strip().split(':')[0].lower()
        if host and 'fargana.uz' in host:
            request.META['HTTP_HOST'] = 'medora.cdcgroup.uz'
        return None


class CORSFallbackMiddleware(MiddlewareMixin):
    """Add CORS header for /health/ and /api/ if missing (xatolik chiqmasligi uchun try/except)."""
    def process_response(self, request, response):
        try:
            if response is None or (not request.path.startswith('/api/') and not request.path.startswith('/health')):
                return response
            origin = None
            req_origin = request.META.get('HTTP_ORIGIN', '').strip()
            origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', None)
            if req_origin and origins and req_origin in origins:
                origin = req_origin
            elif not req_origin and origins:
                origin = origins[0] if isinstance(origins, (list, tuple)) else str(origins)
            if origin is None and request.path.startswith('/health'):
                try:
                    origin = request.build_absolute_uri('/').rstrip('/')
                except Exception:
                    origin = 'https://fjsti.ziyrak.org'
            if origin is None:
                return response
            if getattr(response, 'headers', None):
                if response.headers.get('Access-Control-Allow-Origin'):
                    return response
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Methods'] = 'DELETE, GET, OPTIONS, PATCH, POST, PUT'
                response.headers['Access-Control-Allow-Headers'] = (
                    'accept, authorization, content-type, x-device-id, x-device-info'
                )
                response.headers['Access-Control-Allow-Credentials'] = 'true'
            else:
                if response.get('Access-Control-Allow-Origin'):
                    return response
                response['Access-Control-Allow-Origin'] = origin
                response['Access-Control-Allow-Methods'] = 'DELETE, GET, OPTIONS, PATCH, POST, PUT'
                response['Access-Control-Allow-Headers'] = (
                    'accept, authorization, content-type, x-device-id, x-device-info'
                )
                response['Access-Control-Allow-Credentials'] = 'true'
        except Exception as e:
            logger.warning("CORSFallbackMiddleware: %s", e)
        return response


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Add security headers to all responses (xatolik chiqmasligi uchun try/except)."""
    def process_response(self, request, response):
        try:
            if response is None:
                return response
            response['X-Content-Type-Options'] = 'nosniff'
            response['X-Frame-Options'] = 'DENY'
            response['X-XSS-Protection'] = '1; mode=block'
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
            response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
            if not getattr(settings, 'DEBUG', True):
                response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        except Exception as e:
            logger.warning("SecurityHeadersMiddleware: %s", e)
        return response


class RateLimitMiddleware(MiddlewareMixin):
    """Simple rate limiting (xatolik bo'lsa limit o'tkazib yuboriladi)."""
    def process_request(self, request):
        try:
            if (request.path.startswith('/admin/') or request.path.startswith('/static/')
                    or request.path.startswith('/health/')
                    or request.path.startswith('/api/auth/')):
                return None
            ip = self.get_client_ip(request)
            cache_key = f'rate_limit:{ip}'
            limit = 500 if getattr(settings, 'DEBUG', False) else 100
            requests = cache.get(cache_key, 0)
            if requests >= limit:
                return JsonResponse({
                    'success': False,
                    'error': {'code': 429, 'message': "Juda ko'p so'rovlar. Iltimos, birozdan so'ng qayta urinib ko'ring."}
                }, status=429, content_type='application/json; charset=utf-8')
            cache.set(cache_key, requests + 1, 60)
        except Exception as e:
            logger.warning("RateLimitMiddleware: %s", e)
        return None
    
    def get_client_ip(self, request):
        try:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
            return ip or '0.0.0.0'
        except Exception:
            return '0.0.0.0'


class RequestLoggingMiddleware(MiddlewareMixin):
    """Log all requests for monitoring (xatolik chiqmasligi uchun try/except)."""
    def process_request(self, request):
        try:
            request.start_time = time.time()
        except Exception:
            pass
        return None

    def process_response(self, request, response):
        try:
            if hasattr(request, 'start_time') and response is not None:
                duration = time.time() - request.start_time
                if duration > 1.0:
                    logger.warning(
                        "Slow request: %s %s took %.2fs",
                        request.method, request.path, duration,
                        extra={'status': getattr(response, 'status_code', None)}
                    )
        except Exception:
            pass
        return response