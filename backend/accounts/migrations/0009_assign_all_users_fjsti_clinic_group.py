# Generated manually: barcha User yozuvlarini FJSTI klinika guruhiga biriktirish.

from django.db import migrations


def assign_fjsti_group(apps, schema_editor):
    ClinicGroup = apps.get_model('accounts', 'ClinicGroup')
    User = apps.get_model('accounts', 'User')

    group = (
        ClinicGroup.objects.filter(name__iexact='FJSTI').first()
        or ClinicGroup.objects.filter(slug__iexact='fjsti').first()
    )
    if group is None:
        group = ClinicGroup.objects.create(name='FJSTI', is_active=True, slug='fjsti')

    User.objects.all().update(clinic_group_id=group.pk)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_clinic_group'),
    ]

    operations = [
        migrations.RunPython(assign_fjsti_group, noop_reverse),
    ]
