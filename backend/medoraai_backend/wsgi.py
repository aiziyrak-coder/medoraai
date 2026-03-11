"""
WSGI: DisallowedHost bartaraf вЂ” BIRINCHI get_host() patch, keyin Django.
"""

# 0) Eng birinchi: get_host() ni patch (Django import/setup dan OLDIN)
import django.http.request as _req_mod
_req_mod.HttpRequest.get_host = lambda self: (
    (self.META.get('HTTP_HOST') or 'medora.cdcgroup.uz').split('#')[0].strip()
)

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')

import django
django.setup()

from django.conf import settings as _s
_s.ALLOWED_HOSTS = ['*']

from django.core.wsgi import get_wsgi_application
from django.core.exceptions import DisallowedHost

_app = get_wsgi_application()
_SAFE_BODY = b'{"message":"Farg\'ona JSTI Backend API","version":"1.0.0","endpoints":{"health":"/health/","admin":"/admin/","api":"/api/"}}'

def application(environ, start_response):
    try:
        return _app(environ, start_response)
    except DisallowedHost:
        start_response('200 OK', [('Content-Type', 'application/json; charset=utf-8')])
        return [_SAFE_BODY]
