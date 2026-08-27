from django.core.management.base import BaseCommand

from patients.population_statistics import backfill_population_statistics_fields


class Command(BaseCommand):
    help = "Aholi yozuvlariga medkarta, NKB va nogironlik maydonlarini to'ldirish"

    def handle(self, *args, **options):
        stats = backfill_population_statistics_fields()
        self.stdout.write(self.style.SUCCESS(f"Yangilandi: {stats['updated']}"))
