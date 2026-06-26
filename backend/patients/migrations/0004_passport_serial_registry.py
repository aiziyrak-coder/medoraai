from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0003_patient_registry_number'),
    ]

    operations = [
        migrations.AlterField(
            model_name='patient',
            name='registry_number',
            field=models.CharField(
                db_index=True,
                max_length=20,
                unique=True,
                verbose_name='Pasport seriya raqami (bemor ID)',
            ),
        ),
    ]
