# Generated manually for monitoring app
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MonitoringRoom',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, verbose_name='Xona')),
                ('ward', models.CharField(blank=True, max_length=120, verbose_name="Bo'lim")),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Monitoring xonasi',
                'verbose_name_plural': 'Monitoring xonalari',
            },
        ),
        migrations.CreateModel(
            name='MonitoringDevice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('serial_number', models.CharField(max_length=64, unique=True, verbose_name='Seriya raqami')),
                ('model_name', models.CharField(blank=True, max_length=120, verbose_name='Model')),
                ('is_online', models.BooleanField(default=False, verbose_name='Onlayn')),
                ('last_seen', models.DateTimeField(blank=True, null=True, verbose_name='Oxirgi signal')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Monitoring qurilmasi',
                'verbose_name_plural': 'Monitoring qurilmalari',
            },
        ),
        migrations.CreateModel(
            name='PatientMonitor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('patient_label', models.CharField(max_length=200, verbose_name='Bemor')),
                ('external_patient_id', models.CharField(blank=True, max_length=64)),
                ('bed_label', models.CharField(blank=True, max_length=32, verbose_name='Karavot')),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('device', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assignments', to='monitoring.monitoringdevice')),
                ('room', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='monitors', to='monitoring.monitoringroom')),
            ],
            options={
                'verbose_name': 'Bemor monitori',
                'verbose_name_plural': 'Bemor monitorlari',
            },
        ),
        migrations.CreateModel(
            name='VitalReading',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('heart_rate', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('spo2', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('bp_sys', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('bp_dia', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('respiration', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('temperature', models.DecimalField(blank=True, decimal_places=1, max_digits=4, null=True)),
                ('recorded_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('patient_monitor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='readings', to='monitoring.patientmonitor')),
            ],
            options={
                'verbose_name': "Vital o'qish",
                'verbose_name_plural': "Vital o'qishlar",
                'ordering': ['-recorded_at'],
            },
        ),
        migrations.CreateModel(
            name='MonitoringAlarm',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('severity', models.CharField(choices=[('info', 'Info'), ('warning', 'Warning'), ('critical', 'Critical')], default='warning', max_length=16)),
                ('code', models.CharField(max_length=64)),
                ('message', models.TextField()),
                ('acknowledged', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('acknowledged_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('patient_monitor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alarms', to='monitoring.patientmonitor')),
            ],
            options={
                'verbose_name': 'Monitoring alarmi',
                'verbose_name_plural': 'Monitoring alarmlari',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='patientmonitor',
            index=models.Index(fields=['active'], name='pm_active_idx'),
        ),
    ]
