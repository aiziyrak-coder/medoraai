# Data migration: ensure monitoring demo user exists (login +998907000001 / monitoring_demo)

from django.db import migrations
from django.contrib.auth.hashers import make_password


def create_demo_user(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    phone = '+998907000001'
    password_hashed = make_password('monitoring_demo')
    defaults = {
        'name': 'Monitoring Operator',
        'role': 'monitoring',
        'subscription_status': 'active',
    }
    user, created = User.objects.get_or_create(
        phone=phone,
        defaults={**defaults, 'password': password_hashed},
    )
    if not created:
        user.password = password_hashed
        user.name = defaults['name']
        user.role = defaults['role']
        user.subscription_status = defaults['subscription_status']
        user.save(update_fields=['password', 'name', 'role', 'subscription_status'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_rename_accounts_act_user_id_8a0f0d_idx_accounts_ac_user_id_ca4948_idx'),
    ]

    operations = [
        migrations.RunPython(create_demo_user, noop),
    ]