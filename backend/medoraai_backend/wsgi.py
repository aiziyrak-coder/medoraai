"""
WSGI config — standart Django. Host tekshiruvi ALLOWED_HOSTS orqali (xavfsiz).
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
