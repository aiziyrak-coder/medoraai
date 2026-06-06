"""
Klinika guruhiga bulk foydalanuvchilar yaratish.

  python manage.py create_fjsti_bulk_users
  python manage.py create_fjsti_bulk_users --start 300 --end 315 --group-name "Oybek raddom" --password raddom123 --days 30
  python manage.py create_fjsti_bulk_users --dry-run
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import ClinicGroup, SubscriptionPlan, User


class Command(BaseCommand):
    help = "Klinika guruhi uchun telefon raqamlari orqali bulk foydalanuvchilar yaratadi"

    def add_arguments(self, parser):
        parser.add_argument('--start', type=int, default=0, help='Raqam suffiksi boshlanishi (default 0)')
        parser.add_argument('--end', type=int, default=250, help='Raqam suffiksi tugashi (default 250)')
        parser.add_argument('--prefix', type=str, default='+998900000', help='Telefon prefiksi')
        parser.add_argument('--password', type=str, default='fjsti123')
        parser.add_argument('--group-name', type=str, default='FJSTI', help='Klinika guruhi nomi')
        parser.add_argument('--days', type=int, default=365, help='Obuna davri (kun)')
        parser.add_argument('--user-prefix', type=str, default='', help='Foydalanuvchi ismi prefiksi (bo\'sh = guruh nomi)')
        parser.add_argument('--dry-run', action='store_true')

    def _resolve_group(self, group_name: str) -> ClinicGroup:
        if group_name.strip().upper() == 'FJSTI':
            return ClinicGroup.get_default_fjsti_group()
        group, _ = ClinicGroup.objects.get_or_create(
            name=group_name.strip(),
            defaults={'is_active': True},
        )
        return group

    def handle(self, *args, **options):
        start = options['start']
        end = options['end']
        prefix = options['prefix']
        password = options['password']
        group_name = options['group_name']
        days = max(1, int(options['days']))
        user_prefix = (options['user_prefix'] or group_name).strip()
        dry = options['dry_run']

        if start > end:
            self.stderr.write(self.style.ERROR('start end dan katta bo\'lmasligi kerak'))
            return

        group = self._resolve_group(group_name)
        plan = SubscriptionPlan.objects.filter(slug='clinic').first()
        expiry = timezone.now() + timedelta(days=days)

        created = 0
        updated = 0
        skipped = 0

        for n in range(start, end + 1):
            phone = f'{prefix}{n:03d}'
            name = f'{user_prefix} {n:03d}'

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
                f'Guruh: {group.name}, obuna: {days} kun (gacha {expiry.date()}), parol: {password}'
            )
        )
