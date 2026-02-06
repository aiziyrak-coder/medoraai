"""
General utility functions
"""
import hashlib
import hmac
from django.conf import settings


def generate_secure_token(data: str) -> str:
    """Generate secure token using HMAC"""
    return hmac.new(
        settings.SECRET_KEY.encode(),
        data.encode(),
        hashlib.sha256
    ).hexdigest()


def validate_request_origin(request):
    """Validate request origin for CSRF protection"""
    origin = request.META.get('HTTP_ORIGIN')
    referer = request.META.get('HTTP_REFERER')
    
    if not origin and not referer:
        return False
    
    allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
    
    if origin:
        return origin in allowed_origins
    
    if referer:
        for allowed in allowed_origins:
            if referer.startswith(allowed):
                return True
    
    return False
