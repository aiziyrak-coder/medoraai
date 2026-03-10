"""
Platformada qurilma ma'lumotlarini ko'rsatish uchun demo ma'lumot: 1 qanot, 1 xona, 1 qurilma, 1 bemor monitori, demo vitals.
Ishlatish: python manage.py create_monitoring_demo_data
Gateway (K12/HL7) device_id = K12_01 bo'lsa, shu qurilma orqali kelgan ma'lumotlar ham shu kartochkada chiqadi.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from monitoring.models import Ward, Room, Device, PatientMonitor, VitalReading


DEMO_WARD_CODE = "DEMO"
DEMO_ROOM_CODE = "101"
DEMO_DEVICE_SERIAL = "K12_01"  # Gateway HL7 default device_id bilan mos
DEMO_BED = "1"
DEMO_PATIENT_NAME = "Demo bemor"


class Command(BaseCommand):
    help = "Bemor monitoring uchun demo qanot, xona, qurilma, bemor va demo vitals yaratadi (platformada ma'lumot chiqishi uchun)"

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

        # Demo vitals – platformada ko'rinishi uchun (qurilma haqiqiy ma'lumot yubormaguncha)
        count_before = VitalReading.objects.filter(patient_monitor=pm).count()
        if count_before == 0:
            VitalReading.objects.create(
                patient_monitor=pm,
                timestamp=timezone.now(),
                heart_rate=72,
                spo2=98,
                nibp_systolic=120,
                nibp_diastolic=80,
                respiration_rate=16,
                temperature=36.6,
            )
            self.stdout.write(self.style.SUCCESS("Demo vitals yozuvi qo'shildi (HR, SpO2, NIBP, temp)."))
        else:
            self.stdout.write(f"Bemor monitorida allaqachon {count_before} ta vital bor; demo qo'shilmadi.")

        # Barcha boshqa bemor monitorlari (vitals=0) uchun ham bitta demo vital — kartochkada "--" o'rniga raqamlar chiqadi
        for other_pm in PatientMonitor.objects.filter(is_active=True).exclude(pk=pm.pk):
            if VitalReading.objects.filter(patient_monitor=other_pm).exists():
                continue
            VitalReading.objects.create(
                patient_monitor=other_pm,
                timestamp=timezone.now(),
                heart_rate=75,
                spo2=97,
                nibp_systolic=118,
                nibp_diastolic=78,
                respiration_rate=16,
                temperature=36.5,
            )
            self.stdout.write(self.style.SUCCESS(f"Demo vital qo'shildi: {other_pm.patient_name or other_pm.bed_label} (id={other_pm.id})."))

        self.stdout.write("")
        self.stdout.write("Platformada (Monitoring dashboard) endi bitta kartochka ko'rinadi.")
        self.stdout.write("Haqiqiy qurilma ma'lumotlari uchun: Gateway ishga tushiring, Device.serial_number = gateway device_id (masalan K12_01).")
