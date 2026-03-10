"""
WSGI config for medoraai_backend project.
DisallowedHost bartaraf: HttpRequest.get_host ni patch qilamiz (medoraapi.cdcgroup.uz va barcha hostlar).
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()

# DisallowedHost to'liq o'chirish: get_host() ALLOWED_HOSTS tekshirmaydi (Gunicorn ishga tushganda bir marta)
from django.http import HttpRequest

_original_get_host = HttpRequest.get_host

def _safe_get_host(self):
    return (self.META.get('HTTP_HOST') or 'medora.cdcgroup.uz').split('#')[0].strip()

HttpRequest.get_host = _safe_get_host
