import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('analyses', '0002_audit_and_usefulness_feedback'),
    ]

    operations = [
        migrations.AddField(
            model_name='analysisrecord',
            name='physician_signed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Shifokor tasdiqlagan vaqt'),
        ),
        migrations.AddField(
            model_name='analysisrecord',
            name='physician_signed_by',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='signed_analyses', to=settings.AUTH_USER_MODEL,
                verbose_name='Tasdiqlagan shifokor',
            ),
        ),
        migrations.AddField(
            model_name='analysisrecord',
            name='physician_sign_note',
            field=models.TextField(blank=True, verbose_name='Tasdiqlash izohi'),
        ),
    ]
