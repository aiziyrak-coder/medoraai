"""
Create demo user for Bemor Monitoring Platform.
Usage: python manage.py create_monitoring_demo_user
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

DEMO_PHONE = '+998907000001'
DEMO_PASSWORD = 'monitoring_demo'
DEMO_NAME = 'Monitoring Operator'


class Command(BaseCommand):
    help = 'Create demo monitoring user (+998907000001 / monitoring_demo) for Bemor Monitoring Platform'

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            phone=DEMO_PHONE,
            defaults={
                'name': DEMO_NAME,
                'role': 'monitoring',
                'subscription_status': 'active',
            },
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save(update_fields=['password'])
            self.stdout.write(self.style.SUCCESS(f'Created monitoring demo user: {DEMO_PHONE}'))
        else:
            user.set_password(DEMO_PASSWORD)
            user.role = 'monitoring'
            user.name = DEMO_NAME
            user.save(update_fields=['password', 'role', 'name'])
            self.stdout.write(self.style.SUCCESS(f'Updated monitoring demo user: {DEMO_PHONE}'))
        self.stdout.write(f'  Login: {DEMO_PHONE} / {DEMO_PASSWORD}')
