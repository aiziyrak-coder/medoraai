"""
Barcha monitoring vitals (demo/mock va haqiqiy) o'chirish — faqat toza holatda haqiqiy qurilma ma'lumotini ko'rish uchun.
Ishlatish: python manage.py clear_monitoring_demo_vitals
Eslatma: Barcha VitalReading yozuvlari o'chiriladi. Keyingi ma'lumot faqat gateway orqali keladi.
"""
from django.core.management.base import BaseCommand
from monitoring.models import VitalReading


class Command(BaseCommand):
    help = "Barcha vitals yozuvlarini o'chirish (demo/mock olib tashlash — faqat haqiqiy ma'lumot qoladi)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Faqat nechta yozuv o'chirilishini ko'rsatish, o'chirmaslik",
        )

    def handle(self, *args, **options):
        qs = VitalReading.objects.all()
        count = qs.count()
        if count == 0:
            self.stdout.write("Vitals yozuvi yo'q.")
            return
        if options['dry_run']:
            self.stdout.write(self.style.WARNING(f"Dry-run: {count} ta vital o'chiriladi (o'chirilmadi)."))
            return
        qs.delete()
        self.stdout.write(self.style.SUCCESS(f"{count} ta vitals yozuvi o'chirildi. Endi faqat haqiqiy qurilma ma'lumoti ko'rinadi."))
