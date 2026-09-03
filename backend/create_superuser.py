#!/usr/bin/env python
"""
Django admin uchun superuser yaratish.
Loyihada USERNAME_FIELD = 'phone'  -  admin panelda "Username" o'rnida TELEFON raqam kiritiladi.

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

# Environment vars — default YO'Q (parol HECH QACHON print qilinmaydi va kodda saqlanmaydi)
ADMIN_PHONE = (os.environ.get('ADMIN_PHONE') or '').strip()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD') or ''
ADMIN_NAME = (os.environ.get('ADMIN_NAME') or 'Admin').strip()

if not ADMIN_PHONE or not ADMIN_PASSWORD:
    print(
        "Xatolik: ADMIN_PHONE va ADMIN_PASSWORD env orqali berilishi shart "
        "(kodda default qiymat yo'q).\n"
        "Masalan: ADMIN_PHONE=+998... ADMIN_PASSWORD=... python create_superuser.py"
    )
    sys.exit(1)

if len(ADMIN_PASSWORD) < 12:
    print("Xatolik: ADMIN_PASSWORD kamida 12 ta belgidan iborat bo'lishi kerak.")
    sys.exit(1)

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