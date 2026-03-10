"""
Eski VitalReading yozuvlarini o‘chiradi (saklash muddati siyosati).
Cron yoki Celery periodic task sifatida ishlatish mumkin.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from monitoring.models import VitalReading


class Command(BaseCommand):
    help = "Berilgan kundan eski vital yozuvlarini o‘chiradi (data retention)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Shu kundan eski yozuvlarni o‘chirish (default: 90)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Faqat nechta qator o‘chirilishini ko‘rsatadi, o‘chirmaydi',
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        threshold = timezone.now() - timedelta(days=days)
        qs = VitalReading.objects.filter(timestamp__lt=threshold)
        count = qs.count()
        if dry_run:
            self.stdout.write(self.style.WARNING(f'Dry run: {count} row(s) would be deleted (older than {days} days).'))
            return
        qs.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} vital reading(s) older than {days} days.'))
