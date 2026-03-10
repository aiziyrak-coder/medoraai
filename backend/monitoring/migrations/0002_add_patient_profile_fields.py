# Generated for hospital-grade patient profile (age, gender, medical_notes)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('monitoring', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='patientmonitor',
            name='age',
            field=models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Yoshi'),
        ),
        migrations.AddField(
            model_name='patientmonitor',
            name='gender',
            field=models.CharField(
                blank=True,
                choices=[('M', 'Erkak'), ('F', 'Ayol'), ('other', 'Boshqa')],
                max_length=10,
                verbose_name='Jinsi',
            ),
        ),
        migrations.AddField(
            model_name='patientmonitor',
            name='medical_notes',
            field=models.TextField(blank=True, verbose_name='Tibbiy eslatma'),
        ),
    ]
