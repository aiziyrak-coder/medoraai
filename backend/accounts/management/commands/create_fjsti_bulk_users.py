"""
FJSTI guruhiga bulk foydalanuvchilar: +998900000000 … +998900000250
Parol: fjsti123, 1 yillik faol obuna.

  python manage.py create_fjsti_bulk_users
  python manage.py create_fjsti_bulk_users --dry-run
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import ClinicGroup, SubscriptionPlan, User


class Command(BaseCommand):
    help = "FJSTI guruhi uchun telefon raqamlari orqali bulk foydalanuvchilar yaratadi"

    def add_arguments(self, parser):
        parser.add_argument('--start', type=int, default=0, help='Raqam suffiksi boshlanishi (default 0)')
        parser.add_argument('--end', type=int, default=250, help='Raqam suffiksi tugashi (default 250)')
        parser.add_argument('--prefix', type=str, default='+998900000', help='Telefon prefiksi')
        parser.add_argument('--password', type=str, default='fjsti123')
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        start = options['start']
        end = options['end']
        prefix = options['prefix']
        password = options['password']
        dry = options['dry_run']

        if start > end:
            self.stderr.write(self.style.ERROR('start end dan katta bo\'lmasligi kerak'))
            return

        group = ClinicGroup.get_default_fjsti_group()
        plan = SubscriptionPlan.objects.filter(slug='clinic').first()
        expiry = timezone.now() + timedelta(days=365)

        created = 0
        updated = 0
        skipped = 0

        for n in range(start, end + 1):
            phone = f'{prefix}{n:03d}'
            name = f'FJSTI Foydalanuvchi {n:03d}'

            if dry:
                self.stdout.write(f'[dry-run] {phone} / {name}')
                continue

            user, is_new = User.objects.get_or_create(
                phone=phone,
                defaults={
                    'name': name,
                    'role': 'clinic',
                    'clinic_group': group,
                    'subscription_plan': plan,
                    'subscription_status': 'active',
                    'subscription_expiry': expiry,
                    'is_active': True,
                },
            )

            if is_new:
                user.set_password(password)
                user.save()
                created += 1
            else:
                user.name = name
                user.role = 'clinic'
                user.clinic_group = group
                user.subscription_plan = plan
                user.subscription_status = 'active'
                user.subscription_expiry = expiry
                user.is_active = True
                user.set_password(password)
                user.save()
                updated += 1

        total = end - start + 1
        if dry:
            self.stdout.write(self.style.WARNING(f'Dry-run: {total} ta foydalanuvchi yaratiladi edi'))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f'Tayyor: {created} yangi, {updated} yangilandi, jami {total} ta. '
                f'Guruh: {group.name}, obuna: 365 kun (gacha {expiry.date()}), parol: {password}'
            )
        )
