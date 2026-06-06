"""Registratorlarni shifokordan ajratib, klinika guruhiga bog'lash."""

from django.db import migrations


def staff_to_clinic_group(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    for registrar in User.objects.filter(role='staff'):
        updates = []
        if registrar.linked_doctor_id:
            doctor = User.objects.filter(pk=registrar.linked_doctor_id).first()
            if doctor and doctor.clinic_group_id and not registrar.clinic_group_id:
                registrar.clinic_group_id = doctor.clinic_group_id
                updates.append('clinic_group_id')
            registrar.linked_doctor_id = None
            updates.append('linked_doctor_id')
        if updates:
            registrar.save(update_fields=list(dict.fromkeys(updates)))


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_patient_registry_fields'),
    ]

    operations = [
        migrations.RunPython(staff_to_clinic_group, migrations.RunPython.noop),
    ]
