"""
Viloyat sog'liqni saqlash boshqarmalari uchun klinika guruhi + faol obuna.

  python manage.py create_regional_health_org_accounts
  python manage.py create_regional_health_org_accounts --days 60 --export-csv /tmp/regional.csv
  python manage.py create_regional_health_org_accounts --dry-run
"""
from __future__ import annotations

import csv
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import SubscriptionPlan
from accounts.org_catalog import REGIONAL_HEALTH_ORG_ACCOUNTS, org_password, org_phone
from accounts.org_provisioning import provision_org_account


class Command(BaseCommand):
    help = "Viloyat sog'liqni saqlash boshqarmalari uchun klinika guruhi va login yaratadi"

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

        for item in REGIONAL_HEALTH_ORG_ACCOUNTS:
            idx = int(item['idx'])
            code = str(item['code'])
            name = str(item['name'])
            phone = org_phone(idx)
            password = org_password(code, idx)
            display_idx = str(idx - 49)

            if dry:
                rows.append({
                    'tartib': display_idx,
                    'tashkilot': name,
                    'klinika_guruhi': name,
                    'kod': code,
                    'login_telefon': phone,
                    'parol': password,
                    'obuna_kun': str(days),
                    'obuna_tugash': expiry.date().isoformat(),
                    'guruh_admin': 'ha',
                })
                continue

            group, user, group_new, user_new, phone, password = provision_org_account(
                idx=idx,
                code=code,
                name=name,
                plan=plan,
                expiry=expiry,
                slug_fallback_prefix='regional',
            )
            if group_new:
                created_groups += 1
            if user_new:
                created_users += 1
            else:
                updated_users += 1

            rows.append({
                'tartib': display_idx,
                'tashkilot': name,
                'klinika_guruhi': group.name,
                'kod': code,
                'login_telefon': phone,
                'parol': password,
                'obuna_kun': str(days),
                'obuna_tugash': expiry.date().isoformat(),
                'guruh_admin': 'ha',
            })

        self._write_csv(export_path, rows)
        self._print_summary(len(rows), created_groups, created_users, updated_users, days, expiry, export_path)
        self._print_logins(rows)

    def _write_csv(self, export_path: str, rows: list[dict[str, str]]) -> None:
        if not export_path:
            return
        path = Path(export_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            'tartib', 'tashkilot', 'klinika_guruhi', 'kod', 'login_telefon', 'parol',
            'obuna_kun', 'obuna_tugash', 'guruh_admin',
        ]
        with path.open('w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def _print_summary(self, total, created_groups, created_users, updated_users, days, expiry, export_path) -> None:
        self.stdout.write(self.style.SUCCESS(
            f"Jami {total} ta tashkilot. "
            f"Guruhlar: +{created_groups} yangi. "
            f"Foydalanuvchilar: {created_users} yangi, {updated_users} yangilandi. "
            f"Obuna: {days} kun (gacha {expiry.date()})."
        ))
        if export_path:
            self.stdout.write(self.style.SUCCESS(f'CSV: {export_path}'))

    def _print_logins(self, rows: list[dict[str, str]]) -> None:
        self.stdout.write('\n--- Login ro\'yxati ---')
        for row in rows:
            self.stdout.write(
                f"{row['tartib']:>2}. {row['login_telefon']} / {row['parol']} — {row['kod']}"
            )
