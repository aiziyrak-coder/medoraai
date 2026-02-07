#!/usr/bin/env python
"""
Django admin uchun superuser yaratish.
Loyihada USERNAME_FIELD = 'phone' — admin panelda "Username" o‘rnida TELEFON raqam kiritiladi.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')
django.setup()

from accounts.models import User

# Superuser telefon va parol (o‘zgartirishingiz mumkin)
ADMIN_PHONE = os.environ.get('ADMIN_PHONE', '+998901234567')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin2026!')
ADMIN_NAME = os.environ.get('ADMIN_NAME', 'Admin')

if User.objects.filter(phone=ADMIN_PHONE).exists():
    user = User.objects.get(phone=ADMIN_PHONE)
    user.set_password(ADMIN_PASSWORD)
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.save()
    print(f"Mavjud foydalanuvchi yangilandi: {ADMIN_PHONE}")
else:
    user = User.objects.create_superuser(
        phone=ADMIN_PHONE,
        password=ADMIN_PASSWORD,
        name=ADMIN_NAME,
    )
    print(f"Superuser yaratildi: {ADMIN_PHONE}")

print(f"  Admin panel: https://medoraapi.cdcgroup.uz/admin/  (yoki http://localhost:8000/admin/)")
print(f"  Login (telefon): {ADMIN_PHONE}")
print(f"  Parol: {ADMIN_PASSWORD}")
