"""
Respublika tibbiyot tashkilotlari uchun klinika guruhi + faol obuna (2 oy).

  python manage.py create_republic_org_accounts
  python manage.py create_republic_org_accounts --days 60 --export-csv /tmp/orgs.csv
  python manage.py create_republic_org_accounts --dry-run
"""
from __future__ import annotations

import csv
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import ClinicGroup, SubscriptionPlan, User
from accounts.org_catalog import REPUBLIC_ORG_ACCOUNTS, org_password, org_phone


class Command(BaseCommand):
    help = "Respublika tibbiyot tashkilotlari uchun klinika guruhi va login yaratadi"

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=60, help='Obuna davri (kun), default 60 = 2 oy')
        parser.add_argument('--export-csv', type=str, default='', help='Natijani CSV ga yozish')
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        days = max(1, int(options['days']))
        dry = options['dry_run']
        export_path = (options['export_csv'] or '').strip()
        expiry = timezone.now() + timedelta(days=days)
        plan = SubscriptionPlan.objects.filter(slug='clinic').first()
        if not plan and not dry:
            self.stderr.write(self.style.ERROR('Klinika obuna rejasi topilmadi. Avval: python manage.py create_default_plans'))
            return

        rows: list[dict[str, str]] = []
        created_groups = 0
        created_users = 0
        updated_users = 0

        for item in REPUBLIC_ORG_ACCOUNTS:
            idx = int(item['idx'])
            code = str(item['code'])
            name = str(item['name'])
            phone = org_phone(idx)
            password = org_password(code)
            slug = slugify(code)[:80] or f'org-{idx:04d}'

            if dry:
                rows.append({
                    'tartib': str(idx),
                    'tashkilot': name,
                    'klinika_guruhi': name,
                    'kod': code,
                    'login_telefon': phone,
                    'parol': password,
                    'obuna_kun': str(days),
                    'obuna_tugash': expiry.date().isoformat(),
                })
                continue

            group, group_new = ClinicGroup.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'is_active': True, 'notes': f'Kod: {code}'},
            )
            if not group_new:
                group.name = name
                group.is_active = True
                if not group.notes:
                    group.notes = f'Kod: {code}'
                group.save()
            else:
                created_groups += 1

            user, user_new = User.objects.get_or_create(
                phone=phone,
                defaults={
                    'name': name,
                    'role': 'clinic',
                    'clinic_group': group,
                    'subscription_plan': plan,
                    'subscription_status': 'active',
                    'subscription_expiry': expiry,
                    'trial_ends_at': None,
                    'is_active': True,
                },
            )
            if user_new:
                user.set_password(password)
                user.save()
                created_users += 1
            else:
                user.name = name
                user.role = 'clinic'
                user.clinic_group = group
                user.subscription_plan = plan
                user.subscription_status = 'active'
                user.subscription_expiry = expiry
                user.trial_ends_at = None
                user.is_active = True
                user.set_password(password)
                user.save()
                updated_users += 1

            rows.append({
                'tartib': str(idx),
                'tashkilot': name,
                'klinika_guruhi': group.name,
                'kod': code,
                'login_telefon': phone,
                'parol': password,
                'obuna_kun': str(days),
                'obuna_tugash': expiry.date().isoformat(),
            })

        if export_path:
            path = Path(export_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=['tartib', 'tashkilot', 'klinika_guruhi', 'kod', 'login_telefon', 'parol', 'obuna_kun', 'obuna_tugash'],
                )
                writer.writeheader()
                writer.writerows(rows)

        self.stdout.write(self.style.SUCCESS(
            f"Jami {len(rows)} ta tashkilot. "
            f"Guruhlar: +{created_groups} yangi. "
            f"Foydalanuvchilar: {created_users} yangi, {updated_users} yangilandi. "
            f"Obuna: {days} kun (gacha {expiry.date()})."
        ))
        if export_path:
            self.stdout.write(self.style.SUCCESS(f'CSV: {export_path}'))

        self.stdout.write('\n--- Login ro\'yxati ---')
        for row in rows:
            self.stdout.write(
                f"{row['tartib']:>2}. {row['login_telefon']} / {row['parol']} — {row['kod']}"
            )
