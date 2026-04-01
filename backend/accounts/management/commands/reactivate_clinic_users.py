"""
Klinika foydalanuvchilariga qayta kirish: obunasi bo‘lmagan / tugaganlar uchun
active + trial (yoki faqat statusni tiklash).
Bir marta serverda: python manage.py reactivate_clinic_users
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User


class Command(BaseCommand):
    help = "Faol klinika akkauntlarida has_active_subscription False bo‘lsa — tiklaydi"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Faqat sonini ko‘rsatadi',
        )

    def handle(self, *args, **options):
        dry = options['dry_run']
        now = timezone.now()
        to_fix = []
        for u in User.objects.filter(is_active=True, role='clinic').iterator():
            if not u.has_active_subscription:
                to_fix.append(u)

        self.stdout.write(self.style.WARNING(f"Tuzatish kerak: {len(to_fix)} ta"))
        if dry:
            for u in to_fix[:25]:
                self.stdout.write(f"  - {u.phone} status={u.subscription_status}")
            if len(to_fix) > 25:
                self.stdout.write('  ...')
            return

        updated = 0
        for u in to_fix:
            u.subscription_status = 'active'
            paid_ok = u.subscription_expiry and u.subscription_expiry > now
            if paid_ok:
                u.save(update_fields=['subscription_status'])
            else:
                u.trial_ends_at = now + timedelta(days=365)
                u.save(update_fields=['subscription_status', 'trial_ends_at'])
            updated += 1
        self.stdout.write(self.style.SUCCESS(f"Yangilandi: {updated} ta"))
