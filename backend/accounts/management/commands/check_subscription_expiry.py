"""
Obuna muddatini tekshirish va tugagan obunalarni inactive qilish.
Cron job yoki celery periodic task sifatida ishlatish mumkin.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import User
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Tugagan obunalarni tekshirish va inactive qilish"

    def handle(self, *args, **options):
        now = timezone.now()
        expired_count = 0
        
        # Tugagan obunalarni topish
        expired_users = User.objects.filter(
            subscription_status='active'
        ).exclude(
            subscription_expiry__isnull=True
        ).filter(
            subscription_expiry__lt=now
        )
        
        for user in expired_users:
            # Trial ham tugagan bo'lsa
            if user.trial_ends_at and user.trial_ends_at < now:
                user.subscription_status = 'inactive'
                user.subscription_expiry = None
                user.trial_ends_at = None
                user.save(update_fields=['subscription_status', 'subscription_expiry', 'trial_ends_at'])
                expired_count += 1
                logger.info(f"User {user.phone} obunasi tugadi (trial va paid)")
            # Faqat paid obuna tugagan
            elif not user.trial_ends_at or user.trial_ends_at < now:
                user.subscription_status = 'inactive'
                user.subscription_expiry = None
                user.save(update_fields=['subscription_status', 'subscription_expiry'])
                expired_count += 1
                logger.info(f"User {user.phone} obunasi tugadi")
        
        self.stdout.write(self.style.SUCCESS(f"{expired_count} ta foydalanuvchi obunasi tugadi va inactive qilindi."))
        
        # Tugashga 3 kun qolgan obunalarni ogohlantirish (ixtiyoriy)
        warning_date = now + timezone.timedelta(days=3)
        warning_users = User.objects.filter(
            subscription_status='active',
            subscription_expiry__lte=warning_date,
            subscription_expiry__gt=now
        )
        warning_count = warning_users.count()
        if warning_count > 0:
            self.stdout.write(self.style.WARNING(f"{warning_count} ta foydalanuvchi obunasi 3 kundan kam qoldi."))
