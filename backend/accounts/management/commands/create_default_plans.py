"""
Default obuna rejalarini yaratish: python manage.py create_default_plans
Ikki tur: Klinika 500$/oy (shartnoma, hisob raqam), Shifokor 10$/oy (chek, 30 kun).
"""
from django.core.management.base import BaseCommand
from accounts.models import SubscriptionPlan


class Command(BaseCommand):
    help = "Default obuna rejalarini yaratadi: Klinika 500$, Shifokor 10$"

    def handle(self, *args, **options):
        if SubscriptionPlan.objects.filter(slug__in=['clinic', 'doctor']).exists():
            self.stdout.write(self.style.WARNING("Klinika/Shifokor rejalari mavjud. Hech narsa qo'shilmadi."))
            return

        plans = [
            {
                'name': 'Klinika (Konsilium)',
                'slug': 'clinic',
                'plan_type': 'clinic',
                'description': 'Shartnoma asosida. Hisob raqamdan o\'tkazma.',
                'price_monthly': 500,
                'price_currency': 'USD',
                'duration_days': 30,
                'features': [
                    'Konsilium – shartnoma asosida',
                    'Cheksiz foydalanuvchilar',
                    'Barcha AI imkoniyatlar',
                ],
                'is_trial': False,
                'trial_days': 0,
                'max_analyses_per_month': None,
                'sort_order': 1,
            },
            {
                'name': 'Shifokor (oylik)',
                'slug': 'doctor',
                'plan_type': 'doctor',
                'description': 'Chek yuborish orqali. Admin tasdiqlagach 30 kun faol.',
                'price_monthly': 10,
                'price_currency': 'USD',
                'duration_days': 30,
                'features': [
                    'Oylik obuna 10$',
                    'Chek yuborish orqali to\'lov',
                    'Admin tasdiqlagach 30 kun faol',
                ],
                'is_trial': False,
                'trial_days': 0,
                'max_analyses_per_month': None,
                'sort_order': 2,
            },
        ]
        for p in plans:
            SubscriptionPlan.objects.create(**p)
        self.stdout.write(self.style.SUCCESS(f"{len(plans)} ta reja yaratildi: Klinika 500$/oy, Shifokor 10$/oy."))
