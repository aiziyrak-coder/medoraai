"""Telefon bo'yicha takrorlangan bemorlarni birlashtirish."""
from django.core.management.base import BaseCommand

from patients.dedup import merge_all_phone_duplicates


class Command(BaseCommand):
    help = "Bir xil telefon raqamli bemorlarni bitta ID ostida birlashtiradi"

    def handle(self, *args, **options):
        merged = merge_all_phone_duplicates()
        if not merged:
            self.stdout.write(self.style.SUCCESS('Dublikat topilmadi'))
            return
        for keep_id, removed_id in merged:
            self.stdout.write(f'Birlashtirildi: saqlangan={keep_id}, o\'chirildi={removed_id}')
        self.stdout.write(self.style.SUCCESS(f'Jami {len(merged)} ta dublikat birlashtirildi'))
