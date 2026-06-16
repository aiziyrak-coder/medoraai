# Generated manually for clinic group admin feature

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_staff_clinic_group_only'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_clinic_group_admin',
            field=models.BooleanField(
                default=False,
                help_text="Guruhdagi foydalanuvchilar, obuna va to'lovlarni boshqaradi.",
                verbose_name='Klinika guruhi admini',
            ),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(
                fields=['clinic_group', 'is_clinic_group_admin'],
                name='accounts_us_clinic__a1b2c3_idx',
            ),
        ),
    ]
