"""So'x KTMP Excel bemorlarini aholi + ko'rik + D-hisobga yuklash.

  python manage.py import_sox_excel_patients --file /path/Bemorlar.xlsx
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import ClinicGroup
from patients.models import Patient, PopulationRecord
from patients.primary_care_models import DispensaryRecord, MedicalBrigade, PreventiveCheckup
from patients.primary_care_service import next_checkup_date_for_group, sync_network_plan_completed
from patients.sox_excel_import import (
    DEFAULT_CHECKUP_DATE,
    SOX_DISTRICT_ID,
    SOX_REGION_ID,
    iter_sox_rows,
    summarize_records,
)

User = get_user_model()

SOX_GROUP_SLUG = 'sox-tumani-kop-tarmoqli-klinikasi'
SOX_ORG_PHONE = '+998999076605'
SOX_BRIGADE_CODE = 'sox-ktmp-1'
IMPORT_TAG = 'sox_excel_2026_07_29'


class Command(BaseCommand):
    help = "So'x Excel (Bemorlar) ni AiShifokorga: bemor, aholi, ko'rik, D-hisob"

    def add_arguments(self, parser):
        parser.add_argument('--file', required=True, help='Excel fayl yo\'li')
        parser.add_argument('--user-phone', default=SOX_ORG_PHONE)
        parser.add_argument('--group-slug', default=SOX_GROUP_SLUG)
        parser.add_argument('--checkup-date', default=DEFAULT_CHECKUP_DATE.isoformat())
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        path = Path(options['file'])
        if not path.exists():
            raise CommandError(f'Fayl topilmadi: {path}')

        try:
            checkup_date = datetime.strptime(options['checkup_date'], '%Y-%m-%d').date()
        except ValueError as exc:
            raise CommandError('checkup-date YYYY-MM-DD bo\'lishi kerak') from exc

        records, meta = iter_sox_rows(str(path))
        summary = summarize_records(records)
        self.stdout.write(
            f"Excel: qator={meta['excel_rows']} unique={meta['unique_cards']} "
            f"dublikat_qator={meta['duplicate_extra']}"
        )
        self.stdout.write(
            f"Sog'liq guruhlari={summary['health_groups']} "
            f"D-hisob={summary['dispensary']} nogiron={summary['disabled']}"
        )

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('dry-run — bazaga yozilmadi'))
            return

        group = ClinicGroup.objects.filter(slug=options['group_slug']).first()
        if not group:
            raise CommandError(f'Klinika guruhi topilmadi: {options["group_slug"]}')

        user = User.objects.filter(phone=options['user_phone']).first()
        if not user:
            raise CommandError(f'Foydalanuvchi topilmadi: {options["user_phone"]}')
        if user.clinic_group_id != group.id:
            user.clinic_group = group
            user.save(update_fields=['clinic_group'])

        brigade, _ = MedicalBrigade.objects.get_or_create(
            code=SOX_BRIGADE_CODE,
            defaults={
                'name': "So'x KTMP — 1-brigada",
                'clinic_group': group,
                'region_id': SOX_REGION_ID,
                'district_id': SOX_DISTRICT_ID,
                'leader': user,
                'target_population_size': 0,
                'is_active': True,
            },
        )
        changed = []
        if brigade.clinic_group_id != group.id:
            brigade.clinic_group = group
            changed.append('clinic_group')
        if brigade.region_id != SOX_REGION_ID:
            brigade.region_id = SOX_REGION_ID
            changed.append('region_id')
        if brigade.district_id != SOX_DISTRICT_ID:
            brigade.district_id = SOX_DISTRICT_ID
            changed.append('district_id')
        if changed:
            brigade.save(update_fields=changed + ['updated_at'])

        created_at = timezone.make_aware(datetime.combine(checkup_date, datetime.min.time().replace(hour=12)))

        existing_patients = {
            (p.registry_number or '').upper(): p
            for p in Patient.objects.all().only(
                'id', 'registry_number', 'first_name', 'last_name', 'father_name',
                'age', 'gender', 'region_id', 'district_id', 'address', 'history',
                'additional_info', 'created_by_id', 'home_clinic_group_id',
            )
        }
        existing_pops = {
            (p.registry_number or '').upper(): p
            for p in PopulationRecord.objects.all()
        }

        to_create_patients: list[Patient] = []
        to_update_patients: list[Patient] = []
        to_create_pops: list[PopulationRecord] = []
        to_update_pops: list[PopulationRecord] = []

        for rec in records:
            rn = rec['registry_number']
            next_dt = next_checkup_date_for_group(rec['health_group'], checkup_date) if rec['health_group'] else None
            p = existing_patients.get(rn)
            if p is None:
                to_create_patients.append(Patient(
                    registry_number=rn,
                    first_name=rec['first_name'][:255],
                    last_name=rec['last_name'][:255],
                    father_name=(rec['father_name'] or '')[:255],
                    age=(rec['age'] or '')[:10],
                    gender=rec['gender'] or '',
                    region_id=rec['region_id'],
                    district_id=rec['district_id'],
                    address="Farg'ona viloyati, So'x tumani",
                    history=rec['notes'],
                    additional_info=IMPORT_TAG,
                    created_by=user,
                    home_clinic_group=group,
                ))
            else:
                p.first_name = rec['first_name'][:255]
                p.last_name = rec['last_name'][:255]
                p.father_name = (rec['father_name'] or '')[:255]
                if rec['age']:
                    p.age = rec['age'][:10]
                if rec['gender'] and not p.gender:
                    p.gender = rec['gender']
                p.region_id = rec['region_id']
                p.district_id = rec['district_id']
                if not (p.address or '').strip():
                    p.address = "Farg'ona viloyati, So'x tumani"
                p.history = rec['notes']
                if IMPORT_TAG not in (p.additional_info or ''):
                    p.additional_info = f"{p.additional_info}\n{IMPORT_TAG}".strip()
                if not p.created_by_id:
                    p.created_by = user
                p.home_clinic_group = group
                to_update_patients.append(p)

            pop = existing_pops.get(rn)
            pop_fields = dict(
                first_name=rec['first_name'][:255],
                last_name=rec['last_name'][:255],
                father_name=(rec['father_name'] or '')[:255],
                age=(rec['age'] or '')[:10],
                gender=rec['gender'] or '',
                region_id=rec['region_id'],
                district_id=rec['district_id'],
                address="Farg'ona viloyati, So'x tumani",
                anamnesis=rec['notes'],
                health_group=rec['health_group'],
                medical_card_number=rec['registry_number'][:30],
                disability_group=(rec.get('disability_group') or '')[:20],
                dispensary_icd_code=(rec.get('dispensary_icd_code') or rec['icd10_code'] or '')[:20],
                dispensary_diagnosis=(rec['icd10_code'] or '')[:255],
                risk_disabled=rec['risk_disabled'],
                risk_chronic=rec['risk_chronic'],
                dispensary_registered=rec['dispensary_registered'],
                last_checkup_date=checkup_date,
                next_checkup_date=next_dt,
                brigade=brigade,
                source='excel',
                updated_by=user,
            )
            if pop is None:
                to_create_pops.append(PopulationRecord(
                    registry_number=rn,
                    created_by=user,
                    **pop_fields,
                ))
            else:
                for k, v in pop_fields.items():
                    setattr(pop, k, v)
                if not pop.created_by_id:
                    pop.created_by = user
                to_update_pops.append(pop)

        with transaction.atomic():
            if to_create_patients:
                Patient.objects.bulk_create(to_create_patients, batch_size=400)
            if to_update_patients:
                Patient.objects.bulk_update(
                    to_update_patients,
                    [
                        'first_name', 'last_name', 'father_name', 'age', 'gender',
                        'region_id', 'district_id', 'address', 'history',
                        'additional_info', 'created_by', 'home_clinic_group',
                    ],
                    batch_size=400,
                )
            if to_create_pops:
                PopulationRecord.objects.bulk_create(to_create_pops, batch_size=400)
            if to_update_pops:
                PopulationRecord.objects.bulk_update(
                    to_update_pops,
                    [
                        'first_name', 'last_name', 'father_name', 'age', 'gender',
                        'region_id', 'district_id', 'address', 'anamnesis',
                        'health_group', 'risk_disabled', 'risk_chronic',
                        'medical_card_number', 'disability_group',
                        'dispensary_icd_code', 'dispensary_diagnosis',
                        'dispensary_registered', 'last_checkup_date',
                        'next_checkup_date', 'brigade', 'source',
                        'updated_by', 'created_by',
                    ],
                    batch_size=400,
                )

        if to_create_patients:
            Patient.objects.filter(
                home_clinic_group=group,
                additional_info__contains=IMPORT_TAG,
                created_at__gt=created_at,
            ).update(created_at=created_at, updated_at=created_at)

        pops = {
            (p.registry_number or '').upper(): p
            for p in PopulationRecord.objects.filter(brigade=brigade)
        }

        existing_checkups = set(
            PreventiveCheckup.objects.filter(
                brigade=brigade,
                checkup_date=checkup_date,
            ).values_list('population_id', flat=True)
        )
        existing_disp = set(
            DispensaryRecord.objects.filter(
                brigade=brigade,
                is_active=True,
            ).values_list('population_id', 'icd10_code')
        )

        checkups: list[PreventiveCheckup] = []
        dispensaries: list[DispensaryRecord] = []
        for rec in records:
            pop = pops.get(rec['registry_number'])
            if not pop:
                continue
            next_dt = next_checkup_date_for_group(rec['health_group'], checkup_date) if rec['health_group'] else None
            if pop.id not in existing_checkups:
                diagnoses = rec['icd10_code'] or ''
                checkups.append(PreventiveCheckup(
                    population=pop,
                    brigade=brigade,
                    checkup_type='dispensary' if rec['icd10_code'] else 'preventive',
                    checkup_date=checkup_date,
                    health_group=rec['health_group'],
                    location='clinic',
                    existing_diagnoses=diagnoses,
                    new_diagnoses=diagnoses,
                    recommendations=rec['notes'],
                    next_checkup_date=next_dt,
                    performed_by=user,
                ))
            if rec['icd10_code'] and (pop.id, rec['icd10_code']) not in existing_disp:
                dispensaries.append(DispensaryRecord(
                    population=pop,
                    brigade=brigade,
                    diagnosis=rec['icd10_code'],
                    icd10_code=rec['icd10_code'],
                    registered_date=checkup_date,
                    visit_frequency='Oyiga 1 marta' if rec['health_group'] in ('3', '4') else 'Yiliga 2 marta',
                    next_visit_date=next_dt,
                    is_active=True,
                    registered_by=user,
                ))

        if checkups:
            PreventiveCheckup.objects.bulk_create(checkups, batch_size=400)
        if dispensaries:
            DispensaryRecord.objects.bulk_create(dispensaries, batch_size=400)

        assigned = PopulationRecord.objects.filter(brigade=brigade).count()
        if brigade.target_population_size != assigned:
            brigade.target_population_size = assigned
            brigade.save(update_fields=['target_population_size', 'updated_at'])
        sync_network_plan_completed(brigade)

        self.stdout.write(self.style.SUCCESS(
            f"Yaratildi: bemor={len(to_create_patients)} yangilandi={len(to_update_patients)} "
            f"aholi_yangi={len(to_create_pops)} ko'rik={len(checkups)} D-hisob={len(dispensaries)} "
            f"brigada_maqsad={assigned}"
        ))
