"""
Klinika akkauntlarida subscription_expiry hali yaroqli bo'lsa statusni active qilish.
Bepul trial berilmaydi — qolganlar qo'lda admin orqali.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User


class Command(BaseCommand):
    help = "Yaroqli subscription_expiry bo‘lgan klinika akkauntlarida statusni active qiladi"

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
            paid_ok = u.subscription_expiry and u.subscription_expiry > now
            if not paid_ok:
                continue
            u.subscription_status = 'active'
            u.save(update_fields=['subscription_status'])
            updated += 1
        self.stdout.write(self.style.SUCCESS(f"Yangilandi: {updated} ta"))
