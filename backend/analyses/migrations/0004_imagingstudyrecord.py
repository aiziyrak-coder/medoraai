# Generated manually for ImagingStudyRecord

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0002_patient_registry_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('analyses', '0003_physician_signoff'),
    ]

    operations = [
        migrations.CreateModel(
            name='ImagingStudyRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('modality', models.CharField(choices=[('auto', 'Avtomatik'), ('ultrasound', 'UZI / UTT'), ('xray', 'Rengen'), ('mixed', 'Aralash')], default='auto', max_length=20, verbose_name='Modalitet')),
                ('report', models.JSONField(default=dict, verbose_name='AI hisobot')),
                ('summary_text', models.TextField(blank=True, verbose_name='Konsilium uchun xulosa')),
                ('imaging_structured', models.JSONField(blank=True, default=dict, verbose_name='Strukturali tasvir')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Yaratilgan sana')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='imaging_studies', to=settings.AUTH_USER_MODEL, verbose_name='Yaratgan')),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='imaging_studies', to='patients.patient', verbose_name='Bemor')),
            ],
            options={
                'verbose_name': 'Tasvir tahlili',
                'verbose_name_plural': 'Tasvir tahlillari',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='imagingstudyrecord',
            index=models.Index(fields=['patient'], name='img_patient_idx'),
        ),
        migrations.AddIndex(
            model_name='imagingstudyrecord',
            index=models.Index(fields=['created_by'], name='img_created_by_idx'),
        ),
        migrations.AddIndex(
            model_name='imagingstudyrecord',
            index=models.Index(fields=['created_at'], name='img_created_at_idx'),
        ),
        migrations.AddIndex(
            model_name='imagingstudyrecord',
            index=models.Index(fields=['patient', 'created_at'], name='img_patient_created_idx'),
        ),
    ]
