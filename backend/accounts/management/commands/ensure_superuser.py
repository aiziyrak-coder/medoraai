"""
Telefon bo‘yicha Django admin superuser yaratish yoki parol/huquqlarni tiklash.
Odatda admin paneldan akkaunt o‘chib ketganda serverda bir marta ishga tushiriladi.
"""
import os

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = "Telefon bo‘yicha superuser yaratish yoki parol va staff/superuser holatini tiklash"

    def add_arguments(self, parser):
        parser.add_argument(
            "--phone",
            type=str,
            default="",
            help="USERNAME_FIELD (telefon). Bo‘sh bo‘lsa ADMIN_PHONE env dan olinadi. Default yo‘q.",
        )
        parser.add_argument(
            "--password",
            type=str,
            default="",
            help="ESKIRGAN: parolni ADMIN_PASSWORD env orqali bering (shell tarixida ko‘rinmasin). Default yo‘q.",
        )
        parser.add_argument(
            "--name",
            type=str,
            default="Admin",
            help="To‘liq ism (majburiy model maydoni)",
        )

    def handle(self, *args, **options):
        # Parol uchun kodda default YO‘Q. Tavsiya: ADMIN_PASSWORD env
        # (--password shell tarixi va process ro‘yxatida ko‘rinib qoladi).
        phone = (options["phone"] or os.environ.get("ADMIN_PHONE") or "").strip()
        password = os.environ.get("ADMIN_PASSWORD") or options["password"] or ""
        name = (options["name"] or "Admin").strip()

        if not phone:
            raise CommandError("--phone yoki ADMIN_PHONE env berilishi shart (default yo‘q).")
        if not password:
            raise CommandError(
                "Parol berilmadi (kodda default parol yo‘q). "
                "Masalan: ADMIN_PASSWORD=... python manage.py ensure_superuser --phone +998..."
            )
        if len(password) < 12:
            raise CommandError("ADMIN_PASSWORD kamida 12 ta belgidan iborat bo‘lishi kerak.")

        user = User.objects.filter(phone=phone).first()
        if user:
            user.name = name or user.name
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.role = "clinic"
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f"Tiklandi / yangilandi: {phone} — is_staff va is_superuser yoqildi")
            )
        else:
            User.objects.create_superuser(phone=phone, password=password, name=name)
            self.stdout.write(self.style.SUCCESS(f"Yangi superuser yaratildi: {phone}"))
