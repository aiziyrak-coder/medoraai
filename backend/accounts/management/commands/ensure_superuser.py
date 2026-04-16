"""
Telefon bo‘yicha Django admin superuser yaratish yoki parol/huquqlarni tiklash.
Odatda admin paneldan akkaunt o‘chib ketganda serverda bir marta ishga tushiriladi.
"""
from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = "Telefon bo‘yicha superuser yaratish yoki parol va staff/superuser holatini tiklash"

    def add_arguments(self, parser):
        parser.add_argument(
            "--phone",
            type=str,
            default="+998995751111",
            help="USERNAME_FIELD (telefon), masalan +998995751111",
        )
        parser.add_argument(
            "--password",
            type=str,
            required=True,
            help="Yangi parol (buyruq tarixida ko‘rinmasligi uchun env orqali berish tavsiya etiladi)",
        )
        parser.add_argument(
            "--name",
            type=str,
            default="FJSTI Admin",
            help="To‘liq ism (majburiy model maydoni)",
        )

    def handle(self, *args, **options):
        phone = (options["phone"] or "").strip()
        password = options["password"]
        name = (options["name"] or "Admin").strip()

        if not phone:
            self.stderr.write(self.style.ERROR("phone bo‘sh bo‘lmasligi kerak"))
            return

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
