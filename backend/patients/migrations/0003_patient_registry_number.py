from django.db import migrations, models


def backfill_registry_numbers(apps, schema_editor):
    Patient = apps.get_model('patients', 'Patient')
    Counter = apps.get_model('patients', 'PatientRegistryCounter')
    n = 0
    for patient in Patient.objects.order_by('created_at', 'id'):
        n += 1
        patient.registry_number = f'{n:08d}'
        patient.save(update_fields=['registry_number'])
    Counter.objects.update_or_create(pk=1, defaults={'last_value': n})


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0002_patient_registry_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='PatientRegistryCounter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_value', models.PositiveIntegerField(default=0, verbose_name='Oxirgi raqam')),
            ],
            options={
                'verbose_name': 'Bemor raqam hisoblagichi',
                'verbose_name_plural': 'Bemor raqam hisoblagichi',
            },
        ),
        migrations.AddField(
            model_name='patient',
            name='registry_number',
            field=models.CharField(
                db_index=True,
                editable=False,
                max_length=8,
                null=True,
                unique=True,
                verbose_name="Ro'yxat raqami (8 xona)",
            ),
        ),
        migrations.RunPython(backfill_registry_numbers, noop_reverse),
        migrations.AlterField(
            model_name='patient',
            name='registry_number',
            field=models.CharField(
                db_index=True,
                editable=False,
                max_length=8,
                unique=True,
                verbose_name="Ro'yxat raqami (8 xona)",
            ),
        ),
    ]
