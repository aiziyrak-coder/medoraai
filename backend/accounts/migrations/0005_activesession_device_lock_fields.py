from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_create_monitoring_demo_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='activesession',
            name='device_id',
            field=models.CharField(blank=True, db_index=True, max_length=128, verbose_name='Qurilma ID'),
        ),
        migrations.AddField(
            model_name='activesession',
            name='last_seen',
            field=models.DateTimeField(auto_now=True, verbose_name='Oxirgi faollik'),
        ),
        migrations.AddIndex(
            model_name='activesession',
            index=models.Index(fields=['user', 'device_id'], name='accounts_act_user_id_2f13ea_idx'),
        ),
    ]
