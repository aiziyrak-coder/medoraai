# Extended monitoring: Ward, bed_status, assigned_to, MonitoringAuditLog, MonitoringNote

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('monitoring', '0002_add_patient_profile_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='Ward',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Nomi')),
                ('code', models.CharField(blank=True, max_length=20, unique=True, verbose_name='Kod')),
                ('description', models.TextField(blank=True, verbose_name='Tavsif')),
                ('is_active', models.BooleanField(default=True, verbose_name='Faol')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Qanot',
                'verbose_name_plural': 'Qanotlar',
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='room',
            name='ward',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='rooms',
                to='monitoring.ward',
                verbose_name='Qanot',
            ),
        ),
        migrations.AddField(
            model_name='patientmonitor',
            name='bed_status',
            field=models.CharField(
                choices=[
                    ('occupied', 'Band'),
                    ('empty', "Bo'sh"),
                    ('reserved', 'Band qilingan'),
                    ('cleaning', 'Tozalanmoqda'),
                ],
                db_index=True,
                default='occupied',
                max_length=20,
                verbose_name='Kravat holati',
            ),
        ),
        migrations.AddField(
            model_name='patientmonitor',
            name='assigned_to',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assigned_patient_monitors',
                to=settings.AUTH_USER_MODEL,
                verbose_name="Mas'ul hamshira/xodim",
            ),
        ),
        migrations.CreateModel(
            name='MonitoringNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('note', models.TextField(verbose_name='Eslatma')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='monitoring_notes',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Yozgan',
                )),
                ('patient_monitor', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notes',
                    to='monitoring.patientmonitor',
                    verbose_name='Bemor monitor',
                )),
            ],
            options={
                'verbose_name': 'Monitoring eslatma',
                'verbose_name_plural': 'Monitoring eslatmalar',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='MonitoringAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(
                    choices=[
                        ('alarm_created', 'Alarm yaratildi'),
                        ('alarm_ack', 'Alarm qabul qilindi'),
                        ('patient_admit', 'Bemor qabul qilindi'),
                        ('patient_discharge', 'Bemor chiqarildi'),
                        ('note_added', 'Eslatma qo\'shildi'),
                        ('threshold_changed', 'Chegara o\'zgartirildi'),
                        ('device_assigned', 'Qurilma biriktirildi'),
                    ],
                    db_index=True,
                    max_length=30,
                    verbose_name='Amal',
                )),
                ('details', models.JSONField(blank=True, default=dict, verbose_name='Tafsilot')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('patient_monitor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='audit_logs',
                    to='monitoring.patientmonitor',
                    verbose_name='Bemor monitor',
                )),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='monitoring_audit_logs',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Foydalanuvchi',
                )),
            ],
            options={
                'verbose_name': 'Monitoring audit',
                'verbose_name_plural': 'Monitoring auditlar',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='monitoringnote',
            index=models.Index(fields=['patient_monitor', '-created_at'], name='mon_note_pm_created_idx'),
        ),
        migrations.AddIndex(
            model_name='monitoringauditlog',
            index=models.Index(fields=['patient_monitor', '-created_at'], name='mon_audit_pm_created_idx'),
        ),
        migrations.AddIndex(
            model_name='monitoringauditlog',
            index=models.Index(fields=['action', '-created_at'], name='mon_audit_action_created_idx'),
        ),
    ]
