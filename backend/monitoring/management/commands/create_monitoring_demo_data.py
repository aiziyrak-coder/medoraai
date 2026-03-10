"""
Faqat tuzilma: qanot, xona, qurilma, bemor monitori. Demo/mock vitals YARATILMAYDI — faqat haqiqiy qurilma ma'lumoti ko'rsatiladi.
Ishlatish: python manage.py create_monitoring_demo_data
Gateway (K12/HL7) device_id = K12_01 bo'lsa, shu qurilma orqali kelgan haqiqiy ma'lumotlar shu kartochkada chiqadi.
"""
from django.core.management.base import BaseCommand
from monitoring.models import Ward, Room, Device, PatientMonitor


DEMO_WARD_CODE = "DEMO"
DEMO_ROOM_CODE = "101"
DEMO_DEVICE_SERIAL = "K12_01"  # Gateway HL7 default device_id bilan mos
DEMO_BED = "1"
DEMO_PATIENT_NAME = "Demo bemor"


class Command(BaseCommand):
    help = "Bemor monitoring tuzilmasi: qanot, xona, qurilma, bemor (demo vitals yo'q — faqat haqiqiy ma'lumot)"

    def handle(self, *args, **options):
        ward, _ = Ward.objects.get_or_create(
            code=DEMO_WARD_CODE,
            defaults={"name": "Demo qanot", "description": "Platforma ko'rinishi uchun", "is_active": True},
        )
        if _:
            self.stdout.write(self.style.SUCCESS(f"Qanot yaratildi: {ward.name}"))

        room, _ = Room.objects.get_or_create(
            code=DEMO_ROOM_CODE,
            defaults={"ward": ward, "name": "101-xona", "description": "Demo xona", "is_active": True},
        )
        if _:
            self.stdout.write(self.style.SUCCESS(f"Xona yaratildi: {room.name}"))

        device, created = Device.objects.get_or_create(
            serial_number=DEMO_DEVICE_SERIAL,
            defaults={
                "model": "creative_k12",
                "room": room,
                "status": "offline",
                "host": "",
                "port": None,
                "is_active": True,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Qurilma yaratildi: {device.serial_number}"))
        else:
            device.room = room
            device.is_active = True
            device.save(update_fields=["room", "is_active"])

        pm, pm_created = PatientMonitor.objects.get_or_create(
            device=device,
            defaults={
                "room": room,
                "bed_label": DEMO_BED,
                "patient_name": DEMO_PATIENT_NAME,
                "bed_status": "occupied",
                "is_active": True,
            },
        )
        if pm_created:
            self.stdout.write(self.style.SUCCESS(f"Bemor monitori yaratildi: {pm.patient_name} @ {room.name}"))
        else:
            pm.room = room
            pm.bed_label = DEMO_BED
            pm.patient_name = DEMO_PATIENT_NAME
            pm.is_active = True
            pm.save(update_fields=["room", "bed_label", "patient_name", "is_active"])

        self.stdout.write("")
        self.stdout.write("Demo/mock vitals yaratilmaydi — faqat haqiqiy qurilma ma'lumoti ko'rsatiladi.")
        self.stdout.write("K12 ulanish: Gateway ishlashi kerak; K12 da Server IP = server manzili, Port = 6006 sozlang.")
