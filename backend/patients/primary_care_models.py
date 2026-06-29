"""SSV 210-buyruq: birlamchi tibbiy-sanitariya yordami modullari."""
from django.conf import settings
from django.db import models

from .models import PopulationRecord


class MedicalBrigade(models.Model):
    """Tibbiyot brigadasi (oilaviy shifokor + hamshiralar)."""

    name = models.CharField(max_length=255, verbose_name='Brigada nomi')
    code = models.CharField(max_length=50, blank=True, db_index=True)
    clinic_group = models.ForeignKey(
        'accounts.ClinicGroup',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='medical_brigades',
    )
    region_id = models.CharField(max_length=10, blank=True, db_index=True)
    district_id = models.CharField(max_length=10, blank=True, db_index=True)
    leader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='led_brigades',
        verbose_name='Oilaviy shifokor',
    )
    target_population_size = models.PositiveIntegerField(default=3000)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tibbiyot brigadasi'
        verbose_name_plural = 'Tibbiyot brigadalari'
        ordering = ['name']

    def __str__(self):
        return self.name


class FamilyPassport(models.Model):
    """Oila pasporti."""

    passport_number = models.CharField(max_length=30, unique=True, db_index=True)
    address = models.TextField(blank=True)
    region_id = models.CharField(max_length=10, blank=True, db_index=True)
    district_id = models.CharField(max_length=10, blank=True, db_index=True)
    head = models.ForeignKey(
        PopulationRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_families',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Oila pasporti'
        verbose_name_plural = 'Oila pasportlari'
        ordering = ['passport_number']

    def __str__(self):
        return self.passport_number


class FamilyPassportMember(models.Model):
    RELATION_CHOICES = [
        ('head', 'Boshliq'),
        ('spouse', 'Turmush o\'rtog\'i'),
        ('child', 'Farzand'),
        ('parent', 'Ota-ona'),
        ('other', 'Boshqa'),
    ]

    family = models.ForeignKey(FamilyPassport, on_delete=models.CASCADE, related_name='members')
    population = models.ForeignKey(PopulationRecord, on_delete=models.CASCADE, related_name='family_memberships')
    relation = models.CharField(max_length=20, choices=RELATION_CHOICES, default='other')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('family', 'population')]
        verbose_name = 'Oila a\'zosi'
        verbose_name_plural = 'Oila a\'zolari'


class PreventiveCheckup(models.Model):
    CHECKUP_TYPES = [
        ('preventive', 'Profilaktik ko\'rik'),
        ('in_depth', 'Chuqurlashtirilgan ko\'rik'),
        ('targeted', 'Maqsadli ko\'rik'),
        ('dispensary', 'Dispanser ko\'rik'),
    ]
    HEALTH_GROUPS = [
        ('1', 'I — Tayanch'),
        ('2', 'II — Past xavf'),
        ('3', 'III — O\'rta xavf'),
        ('4', 'IV — Yuqori xavf'),
        ('child_1', 'Bola I'),
        ('child_2', 'Bola II'),
        ('child_3', 'Bola III'),
    ]
    LOCATION_CHOICES = [
        ('clinic', 'Poliklinika'),
        ('home', 'Uyda'),
        ('school', 'Maktab/MTT'),
    ]

    population = models.ForeignKey(PopulationRecord, on_delete=models.CASCADE, related_name='checkups')
    brigade = models.ForeignKey(MedicalBrigade, on_delete=models.SET_NULL, null=True, blank=True, related_name='checkups')
    checkup_type = models.CharField(max_length=20, choices=CHECKUP_TYPES, default='preventive')
    checkup_date = models.DateField(db_index=True)
    health_group = models.CharField(max_length=10, choices=HEALTH_GROUPS, blank=True)
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, default='clinic')
    height_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    waist_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    bmi = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    blood_pressure = models.CharField(max_length=20, blank=True)
    risk_factors = models.JSONField(default=dict, blank=True)
    new_diagnoses = models.TextField(blank=True)
    existing_diagnoses = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)
    tactics = models.TextField(blank=True)
    next_checkup_date = models.DateField(null=True, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='performed_checkups',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Profilaktik ko\'rik'
        verbose_name_plural = 'Profilaktik ko\'riklar'
        ordering = ['-checkup_date']
        indexes = [
            models.Index(fields=['checkup_date', 'health_group']),
            models.Index(fields=['population', 'checkup_date']),
        ]


class ScreeningProgram(models.Model):
    code = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    target_gender = models.CharField(max_length=10, blank=True, help_text='male/female yoki bo\'sh')
    age_min = models.PositiveSmallIntegerField(default=0)
    age_max = models.PositiveSmallIntegerField(default=120)
    frequency_months = models.PositiveSmallIntegerField(default=12)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Skrining dasturi'
        verbose_name_plural = 'Skrining dasturlari'
        ordering = ['name']

    def __str__(self):
        return self.name


class ScreeningEnrollment(models.Model):
    STATUS_CHOICES = [
        ('planned', 'Rejada'),
        ('invited', 'Taklif qilingan'),
        ('completed', 'Bajarilgan'),
        ('excluded', 'Chiqarilgan'),
    ]

    population = models.ForeignKey(PopulationRecord, on_delete=models.CASCADE, related_name='screening_enrollments')
    program = models.ForeignKey(ScreeningProgram, on_delete=models.CASCADE, related_name='enrollments')
    brigade = models.ForeignKey(MedicalBrigade, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    planned_date = models.DateField(null=True, blank=True)
    exclude_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Skrining ro\'yxati'
        verbose_name_plural = 'Skrining ro\'yxatlari'
        unique_together = [('population', 'program')]
        ordering = ['-planned_date']


class ScreeningResult(models.Model):
    RESULT_CHOICES = [
        ('negative', 'Salbiy'),
        ('suspected', 'Shubha'),
        ('positive', 'Ijobiy'),
    ]

    enrollment = models.OneToOneField(ScreeningEnrollment, on_delete=models.CASCADE, related_name='result')
    result_date = models.DateField()
    result_status = models.CharField(max_length=20, choices=RESULT_CHOICES, default='negative')
    lab_data = models.JSONField(default=dict, blank=True)
    referral_specialist = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='screening_results',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Skrining natijasi'
        verbose_name_plural = 'Skrining natijalari'


class PatronageVisit(models.Model):
    VISIT_TYPES = [
        ('universal_progressive', 'Universal-progressiv patronaj'),
        ('routine', 'Rejadagi patronaj'),
        ('high_risk', 'Yuqori xavf guruhi'),
        ('home_hospital', 'Uy shifoxonasi'),
    ]

    population = models.ForeignKey(PopulationRecord, on_delete=models.CASCADE, related_name='patronage_visits')
    brigade = models.ForeignKey(MedicalBrigade, on_delete=models.SET_NULL, null=True, blank=True, related_name='patronage_visits')
    visit_date = models.DateField(db_index=True)
    visit_type = models.CharField(max_length=30, choices=VISIT_TYPES, default='routine')
    purpose = models.TextField(blank=True)
    findings = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='patronage_visits',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Patronaj tashrifi'
        verbose_name_plural = 'Patronaj tashriflari'
        ordering = ['-visit_date']


class NetworkPlan(models.Model):
    PLAN_LEVELS = [
        ('annual', 'Yillik tarmoq rejasi'),
        ('monthly', 'Oylik reja'),
        ('weekly', 'Haftalik reja'),
    ]

    brigade = models.ForeignKey(MedicalBrigade, on_delete=models.CASCADE, related_name='network_plans')
    plan_level = models.CharField(max_length=10, choices=PLAN_LEVELS, default='annual')
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField(null=True, blank=True)
    week_number = models.PositiveSmallIntegerField(null=True, blank=True)
    title = models.CharField(max_length=255, blank=True)
    targets = models.JSONField(default=dict, blank=True, help_text='Reja ko\'rsatkichlari')
    completed = models.JSONField(default=dict, blank=True, help_text='Bajarilgan')
    notes = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_network_plans',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tarmoq rejasi'
        verbose_name_plural = 'Tarmoq rejalari'
        ordering = ['-year', '-month', '-week_number']


class DispensaryRecord(models.Model):
    population = models.ForeignKey(PopulationRecord, on_delete=models.CASCADE, related_name='dispensary_records')
    brigade = models.ForeignKey(MedicalBrigade, on_delete=models.SET_NULL, null=True, blank=True)
    diagnosis = models.CharField(max_length=500)
    icd10_code = models.CharField(max_length=20, blank=True)
    registered_date = models.DateField()
    health_improvement_plan = models.TextField(blank=True)
    form30_data = models.JSONField(default=dict, blank=True)
    visit_frequency = models.CharField(max_length=100, blank=True, help_text='Masalan: oyiga 1 marta')
    next_visit_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registered_dispensary',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Dispanser nazorati'
        verbose_name_plural = 'Dispanser nazorati'
        ordering = ['-registered_date']
