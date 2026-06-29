from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_user_is_clinic_group_admin'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='scoped_region_id',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Viloyat sog'liqni saqlash boshqarmasi — faqat shu viloyat bo'yicha statistika.",
                max_length=10,
                verbose_name="Viloyat ID (statistika ko'rinishi)",
            ),
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('clinic', 'Klinika'),
                    ('staff', 'Registrator'),
                    ('regional_stats', 'Viloyat statistikasi'),
                ],
                default='clinic',
                max_length=20,
                verbose_name='Rol',
            ),
        ),
    ]
