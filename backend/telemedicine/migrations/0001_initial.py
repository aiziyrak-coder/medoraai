import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TeleSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('room_code', models.CharField(db_index=True, max_length=32, unique=True)),
                ('patient_label', models.CharField(blank=True, max_length=200)),
                ('offer_sdp', models.TextField(blank=True)),
                ('answer_sdp', models.TextField(blank=True)),
                ('ice_candidates', models.JSONField(blank=True, default=list)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tele_sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Telemeditsina sessiyasi',
                'verbose_name_plural': 'Telemeditsina sessiyalari',
            },
        ),
    ]
