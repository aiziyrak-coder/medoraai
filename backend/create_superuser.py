#!/usr/bin/env python
"""Create superuser for Django admin"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')
django.setup()

from accounts.models import User

# Delete existing user if exists
User.objects.filter(phone='aiproduct').delete()

# Create superuser
user = User.objects.create_superuser(
    phone='aiproduct',
    password='2026',
    name='AI Product Admin'
)

print(f"Superuser yaratildi!")
print(f"Login: aiproduct")
print(f"Parol: 2026")
print(f"Admin URL: http://localhost:8000/admin/")
