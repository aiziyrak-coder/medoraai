"""
Unacknowledged alarmlarni vaqt o‘tgach critical ga oshiradi.
Cron yoki Celery periodic task sifatida ishlatish mumkin.
"""
from django.core.management.base import BaseCommand
from monitoring.services import escalate_unacknowledged_alarms


class Command(BaseCommand):
    help = "Qabul qilinmagan alarmlarni N daqiqadan keyin critical ga oshiradi"

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutes',
            type=int,
            default=5,
            help='Shu daqiqadan keyin escalate qilish (default: 5)',
        )

    def handle(self, *args, **options):
        minutes = options['minutes']
        count = escalate_unacknowledged_alarms(minutes=minutes)
        self.stdout.write(self.style.SUCCESS(f'Escalated {count} alarm(s) to critical.'))
