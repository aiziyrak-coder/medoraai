"""
WSGI config for medoraai_backend project.
Serverni .env yoki eski settings override qilsa ham: ALLOWED_HOSTS va get_host() bu yerda majburan o'rnatiladi.
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')

import django
django.setup()

# Serverni .env ALLOWED_HOSTS ni e'tiborsiz qoldirish — har doim barcha hostlar
from django.conf import settings as _s
_s.ALLOWED_HOSTS = ['*']

# get_host() hech qachon DisallowedHost ko'tarmasligi uchun
from django.http import HttpRequest
HttpRequest.get_host = lambda self: (
    (self.META.get('HTTP_HOST') or 'medora.cdcgroup.uz').split('#')[0].strip()
)

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
