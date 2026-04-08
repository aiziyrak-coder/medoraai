"""
Barcha (yoki faqat guruhsiz) foydalanuvchilarni FJSTI klinika guruhiga biriktirish.
Deploy yoki admin keyinroq qo‘shgan akkauntlar uchun.
"""
from django.core.management.base import BaseCommand

from accounts.models import ClinicGroup, User


class Command(BaseCommand):
    help = "FJSTI klinika guruhiga foydalanuvchilarni biriktirish"

    def add_arguments(self, parser):
        parser.add_argument(
            '--only-null',
            action='store_true',
            help="Faqat clinic_group bo'sh bo'lganlar",
        )

    def handle(self, *args, **options):
        group = ClinicGroup.get_default_fjsti_group()
        qs = User.objects.filter(clinic_group__isnull=True) if options['only_null'] else User.objects.all()
        n = qs.update(clinic_group=group)
        self.stdout.write(
            self.style.SUCCESS(f"FJSTI guruhiga yangilandi: {n} ta (guruh: {group.name}, id={group.pk})")
        )
