# Generated migration for ActiveSession (obuna sessiya limiti)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ActiveSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('refresh_jti', models.CharField(db_index=True, max_length=255, unique=True, verbose_name='Refresh token JTI')),
                ('device_info', models.CharField(blank=True, max_length=255, verbose_name='Qurilma (ixtiyoriy)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='active_sessions', to=settings.AUTH_USER_MODEL, verbose_name='Foydalanuvchi')),
            ],
            options={
                'verbose_name': 'Faol sessiya',
                'verbose_name_plural': 'Faol sessiyalar',
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='activesession',
            index=models.Index(fields=['user', 'created_at'], name='accounts_act_user_id_8a0f0d_idx'),
        ),
    ]
