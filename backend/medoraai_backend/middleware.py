"""
Custom Middleware for Security and Performance
"""
import time
import logging
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Add security headers to all responses"""
    
    def process_response(self, request, response):
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        if not getattr(settings, 'DEBUG', True):
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        return response


class RateLimitMiddleware(MiddlewareMixin):
    """Simple rate limiting middleware"""
    
    def process_request(self, request):
        # Skip rate limiting for admin and static files
        if request.path.startswith('/admin/') or request.path.startswith('/static/'):
            return None
        
        # Get client IP
        ip = self.get_client_ip(request)
        cache_key = f'rate_limit:{ip}'
        
        # Check rate limit (100 requests per minute)
        requests = cache.get(cache_key, 0)
        if requests >= 100:
            return JsonResponse({
                'success': False,
                'error': {
                    'code': 429,
                    'message': 'Juda ko\'p so\'rovlar. Iltimos, birozdan so\'ng qayta urinib ko\'ring.'
                }
            }, status=429)
        
        # Increment counter
        cache.set(cache_key, requests + 1, 60)  # 60 seconds
        return None
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class RequestLoggingMiddleware(MiddlewareMixin):
    """Log all requests for monitoring"""
    
    def process_request(self, request):
        request.start_time = time.time()
        return None
    
    def process_response(self, request, response):
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
            # Log slow requests (> 1 second)
            if duration > 1.0:
                logger.warning(
                    f"Slow request: {request.method} {request.path} took {duration:.2f}s",
                    extra={
                        'method': request.method,
                        'path': request.path,
                        'duration': duration,
                        'status': response.status_code,
                    }
                )
        return response
