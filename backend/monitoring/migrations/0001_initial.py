# Generated manually for Bemor Monitoring Platform

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
            name='Room',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Xona nomi')),
                ('code', models.CharField(blank=True, max_length=20, unique=True, verbose_name='Kod')),
                ('description', models.TextField(blank=True, verbose_name='Tavsif')),
                ('is_active', models.BooleanField(default=True, verbose_name='Faol')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Xona',
                'verbose_name_plural': 'Xonalar',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Device',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('model', models.CharField(choices=[('creative_k12', 'Creative Medical K12'), ('hl7_generic', 'HL7 Generic'), ('other', 'Boshqa')], default='creative_k12', max_length=50, verbose_name='Model')),
                ('serial_number', models.CharField(max_length=100, unique=True, verbose_name='Seriya raqami')),
                ('status', models.CharField(choices=[('online', 'Onlayn'), ('offline', 'Offlayn'), ('maintenance', 'Texnik xizmat')], db_index=True, default='offline', max_length=20)),
                ('last_seen_at', models.DateTimeField(blank=True, null=True, verbose_name='Oxirgi ulanish')),
                ('meta', models.JSONField(blank=True, default=dict, verbose_name="Qo'shimcha ma'lumot")),
                ('is_active', models.BooleanField(default=True, verbose_name='Faol')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('room', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='devices', to='monitoring.room', verbose_name='Xona')),
            ],
            options={
                'verbose_name': 'Qurilma',
                'verbose_name_plural': 'Qurilmalar',
                'ordering': ['room', 'serial_number'],
            },
        ),
        migrations.CreateModel(
            name='PatientMonitor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bed_label', models.CharField(blank=True, max_length=50, verbose_name='Kravat/joy')),
                ('patient_name', models.CharField(blank=True, max_length=255, verbose_name='Bemor ismi')),
                ('patient_identifier', models.CharField(blank=True, db_index=True, max_length=100, verbose_name='Bemor ID')),
                ('is_active', models.BooleanField(default=True, verbose_name='Faol')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('device', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='patient_monitor', to='monitoring.device', verbose_name='Qurilma')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='patient_monitors', to='monitoring.room', verbose_name='Xona')),
            ],
            options={
                'verbose_name': 'Bemor monitor',
                'verbose_name_plural': 'Bemor monitorlar',
                'ordering': ['room', 'bed_label'],
            },
        ),
        migrations.CreateModel(
            name='AlarmThreshold',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('param', models.CharField(choices=[('heart_rate', 'Puls'), ('spo2', 'SpO2'), ('nibp_systolic', 'NIBP sistolik'), ('nibp_diastolic', 'NIBP diastolik'), ('respiration_rate', 'Nafas')], max_length=30, verbose_name='Parametr')),
                ('min_value', models.SmallIntegerField(blank=True, null=True, verbose_name='Min')),
                ('max_value', models.SmallIntegerField(blank=True, null=True, verbose_name='Max')),
                ('severity', models.CharField(choices=[('critical', 'Kritik'), ('urgent', 'Shoshilinch'), ('warning', 'Ogohlantirish')], default='urgent', max_length=20)),
                ('is_active', models.BooleanField(default=True, verbose_name='Faol')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('patient_monitor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alarm_thresholds', to='monitoring.patientmonitor', verbose_name='Bemor monitor')),
            ],
            options={
                'verbose_name': 'Alarm chegarasi',
                'verbose_name_plural': 'Alarm chegaralari',
                'ordering': ['patient_monitor', 'param'],
                'unique_together': {('patient_monitor', 'param')},
            },
        ),
        migrations.CreateModel(
            name='VitalReading',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp', models.DateTimeField(db_index=True, verbose_name='Vaqt')),
                ('heart_rate', models.SmallIntegerField(blank=True, null=True, verbose_name='HR (bpm)')),
                ('spo2', models.SmallIntegerField(blank=True, null=True, verbose_name='SpO2 (%)')),
                ('nibp_systolic', models.SmallIntegerField(blank=True, null=True, verbose_name='NIBP sistolik')),
                ('nibp_diastolic', models.SmallIntegerField(blank=True, null=True, verbose_name='NIBP diastolik')),
                ('respiration_rate', models.SmallIntegerField(blank=True, null=True, verbose_name='Nafas (/min)')),
                ('temperature', models.DecimalField(blank=True, decimal_places=1, max_digits=4, null=True, verbose_name='Temp')),
                ('raw_payload', models.JSONField(blank=True, default=dict, verbose_name="Xom ma'lumot (debug)")),
                ('patient_monitor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vital_readings', to='monitoring.patientmonitor', verbose_name='Bemor monitor')),
            ],
            options={
                'verbose_name': 'Vital o\'qish',
                'verbose_name_plural': 'Vital o\'qishlar',
                'ordering': ['-timestamp'],
                'get_latest_by': 'timestamp',
            },
        ),
        migrations.CreateModel(
            name='Alarm',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('param', models.CharField(max_length=30, verbose_name='Parametr')),
                ('value', models.FloatField(verbose_name='Qiymat')),
                ('severity', models.CharField(choices=[('critical', 'Kritik'), ('urgent', 'Shoshilinch'), ('warning', 'Ogohlantirish')], db_index=True, max_length=20)),
                ('message', models.CharField(blank=True, max_length=255, verbose_name='Xabar')),
                ('acknowledged_at', models.DateTimeField(blank=True, null=True, verbose_name='Qabul qilingan')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('acknowledged_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='acknowledged_alarms', to=settings.AUTH_USER_MODEL, verbose_name='Qabul qilgan')),
                ('patient_monitor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alarms', to='monitoring.patientmonitor', verbose_name='Bemor monitor')),
                ('threshold', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='alarms', to='monitoring.alarmthreshold', verbose_name='Chegara')),
            ],
            options={
                'verbose_name': 'Alarm',
                'verbose_name_plural': 'Alarmlar',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='vitalreading',
            index=models.Index(fields=['patient_monitor', '-timestamp'], name='monitoring_v_patient_6a0a0d_idx'),
        ),
        migrations.AddIndex(
            model_name='vitalreading',
            index=models.Index(fields=['-timestamp'], name='monitoring_v_timesta_2b0b1c_idx'),
        ),
        migrations.AddIndex(
            model_name='patientmonitor',
            index=models.Index(fields=['room', 'is_active'], name='monitoring_p_room_id_3c0d2e_idx'),
        ),
        migrations.AddIndex(
            model_name='device',
            index=models.Index(fields=['status'], name='monitoring_d_status_4d0e3f_idx'),
        ),
        migrations.AddIndex(
            model_name='device',
            index=models.Index(fields=['room', 'status'], name='monitoring_d_room_id_5e0f4g_idx'),
        ),
        migrations.AddIndex(
            model_name='alarm',
            index=models.Index(fields=['patient_monitor', '-created_at'], name='monitoring_a_patient_7a1b2c_idx'),
        ),
        migrations.AddIndex(
            model_name='alarm',
            index=models.Index(fields=['severity', 'acknowledged_at'], name='monitoring_a_severit_8b2c3d_idx'),
        ),
    ]
