from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('patients', '0004_passport_serial_registry'),
    ]

    operations = [
        migrations.CreateModel(
            name='PopulationRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('registry_number', models.CharField(db_index=True, max_length=20, unique=True, verbose_name='Pasport seriya raqami')),
                ('first_name', models.CharField(max_length=255, verbose_name='Ism')),
                ('last_name', models.CharField(max_length=255, verbose_name='Familiya')),
                ('father_name', models.CharField(blank=True, max_length=255, verbose_name='Otasining ismi')),
                ('age', models.CharField(blank=True, max_length=10, verbose_name='Yosh')),
                ('gender', models.CharField(blank=True, choices=[('male', 'Erkak'), ('female', 'Ayol'), ('other', 'Boshqa')], max_length=10, verbose_name='Jins')),
                ('phone', models.CharField(blank=True, db_index=True, max_length=20, verbose_name='Telefon')),
                ('address', models.TextField(blank=True, verbose_name='Manzil')),
                ('region_id', models.CharField(blank=True, db_index=True, max_length=10, verbose_name='Viloyat ID')),
                ('district_id', models.CharField(blank=True, db_index=True, max_length=10, verbose_name='Tuman ID')),
                ('anamnesis', models.TextField(blank=True, verbose_name='Anamnez vitae / shikoyatlar')),
                ('source', models.CharField(choices=[('manual', "Qo'lda"), ('excel', 'Excel import'), ('patient_auto', 'Bemor yaratilganda')], default='manual', max_length=20, verbose_name='Manba')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_population_records', to=settings.AUTH_USER_MODEL, verbose_name='Yaratgan')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_population_records', to=settings.AUTH_USER_MODEL, verbose_name='Yangilagan')),
            ],
            options={
                'verbose_name': 'Aholi yozuvi',
                'verbose_name_plural': 'Aholi bazasi',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='populationrecord',
            index=models.Index(fields=['last_name', 'first_name'], name='patients_po_last_na_idx'),
        ),
        migrations.AddIndex(
            model_name='populationrecord',
            index=models.Index(fields=['phone'], name='patients_po_phone_idx'),
        ),
        migrations.AddIndex(
            model_name='populationrecord',
            index=models.Index(fields=['region_id', 'district_id'], name='patients_po_region_idx'),
        ),
    ]
