#!/usr/bin/env python
"""
Django admin uchun superuser yaratish.
Loyihada USERNAME_FIELD = 'phone' — admin panelda "Username" o'rnida TELEFON raqam kiritiladi.

Ishlatish:
  ADMIN_PHONE=+998... ADMIN_PASSWORD=... python create_superuser.py
"""
import os
import sys
import django
import logging

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')
django.setup()

from accounts.models import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment vars (parol HECH QACHON print qilinmaydi)
ADMIN_PHONE = os.environ.get('ADMIN_PHONE', '+998901234567')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin2026!')
ADMIN_NAME = os.environ.get('ADMIN_NAME', 'Admin')

try:
    if User.objects.filter(phone=ADMIN_PHONE).exists():
        user = User.objects.get(phone=ADMIN_PHONE)
        user.set_password(ADMIN_PASSWORD)
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.save()
        logger.info("Superuser yangilandi: %s", ADMIN_PHONE)
    else:
        User.objects.create_superuser(
            phone=ADMIN_PHONE,
            password=ADMIN_PASSWORD,
            name=ADMIN_NAME,
        )
        logger.info("Superuser yaratildi: %s", ADMIN_PHONE)

    # Faqat minimal xabar (parol va telefon log/chiqishda ko'rsatilmasin)
    print("OK: Superuser tayyor. Admin panelga .env dagi ADMIN_PHONE va ADMIN_PASSWORD bilan kiring.")
except Exception as e:
    logger.exception("Superuser yaratishda xatolik")
    print(f"Xatolik: {e}")
    sys.exit(1)
