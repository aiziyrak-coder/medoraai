"""
User and Authentication Models
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models import Q
from django.utils import timezone


class SubscriptionPlan(models.Model):
    """Obuna rejasi: klinika (shartnoma, 500$/oy) yoki shifokor (chek, 10$/oy)"""
    PLAN_TYPE_CHOICES = [
        ('clinic', 'Klinika (shartnoma)'),
        ('doctor', 'Shifokor (chek)'),
    ]
    name = models.CharField(max_length=100, verbose_name='Reja nomi')
    slug = models.SlugField(max_length=50, unique=True, verbose_name='Slug')
    plan_type = models.CharField(
        max_length=20,
        choices=PLAN_TYPE_CHOICES,
        default='doctor',
        verbose_name='Obuna turi'
    )
    description = models.TextField(blank=True, verbose_name='Tavsif')
    price_monthly = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        verbose_name='Oylik narx'
    )
    price_currency = models.CharField(max_length=10, default='USD', verbose_name='Valyuta')
    duration_days = models.PositiveIntegerField(
        default=30,
        help_text='Obuna davri (kun)',
        verbose_name='Davr (kun)'
    )
    features = models.JSONField(
        default=list,
        blank=True,
        help_text='Imkoniyatlar ro\'yxati, masalan: ["Cheksiz tahlil", "AI Chat"]',
        verbose_name='Imkoniyatlar'
    )
    is_trial = models.BooleanField(default=False, verbose_name='Trial reja')
    trial_days = models.PositiveIntegerField(default=0, verbose_name='Trial kun')
    max_analyses_per_month = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Null = cheksiz',
        verbose_name='Oyiga maksimal tahlillar'
    )
    sort_order = models.PositiveIntegerField(default=0, verbose_name='Tartib')
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Obuna rejasi'
        verbose_name_plural = 'Obuna rejalari'
        ordering = ['sort_order', 'price_monthly']

    def __str__(self):
        return self.name


class ClinicGroup(models.Model):
    """
    Klinika jamoasi (guruh). Admin panelda yaratiladi; foydalanuvchilar User yozuvida shu guruhga biriktiriladi.
    Bir guruh a'zolari bemorlar ro'yxati va tahlillar (arxiv) bo'yicha bir-biriga ko'rinish huquqiga ega.
    """
    name = models.CharField(max_length=200, verbose_name='Guruh nomi')
    slug = models.SlugField(max_length=80, unique=True, blank=True, help_text='Bo\'sh qoldirilsa, nomdan avtomatik')
    notes = models.TextField(blank=True, verbose_name='Izoh (faqat admin)')
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Klinika guruhi'
        verbose_name_plural = 'Klinika guruhlari'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not (self.slug and str(self.slug).strip()):
            import uuid
            from django.utils.text import slugify
            base = slugify(self.name)[:80] or f'g-{uuid.uuid4().hex[:10]}'
            self.slug = base
            n = 2
            while ClinicGroup.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
                self.slug = f'{base}-{n}'
                n += 1
        super().save(*args, **kwargs)

    @classmethod
    def get_default_fjsti_group(cls):
        """Barcha foydalanuvchilar uchun standart klinika guruhi (admin panelda yaratilgan bo‘lishi mumkin)."""
        g = cls.objects.filter(Q(name__iexact='FJSTI') | Q(slug__iexact='fjsti')).first()
        if g:
            return g
        return cls.objects.create(name='FJSTI', is_active=True)


class SubscriptionPayment(models.Model):
    """To'lov/obuna so'rovi - chek yuborilganda yoki keyinroq admin tasdiqlaganda"""
    STATUS_CHOICES = [
        ('pending', 'Kutilmoqda'),
        ('approved', 'Tasdiqlangan'),
        ('rejected', 'Rad etilgan'),
    ]
    user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='subscription_payments',
        verbose_name='Foydalanuvchi'
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name='Reja'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='Summa (so\'m)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    receipt_note = models.CharField(max_length=255, blank=True, verbose_name='Chek haqida qisqa eslatma')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_payments',
        verbose_name='Tekshiruvchi'
    )

    class Meta:
        verbose_name = 'Obuna to\'lovi'
        verbose_name_plural = 'Obuna to\'lovlari'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.phone} - {self.amount} - {self.status}"


class UserManager(BaseUserManager):
    """Custom user manager"""
    
    def create_user(self, phone, password=None, **extra_fields):
        """Create and save a regular user"""
        if not phone:
            raise ValueError('Telefon raqami kiritilishi shart')

        if 'clinic_group' not in extra_fields and 'clinic_group_id' not in extra_fields:
            extra_fields['clinic_group'] = ClinicGroup.get_default_fjsti_group()

        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, phone, password=None, **extra_fields):
        """Create and save a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'clinic')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(phone, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User Model"""
    
    ROLE_CHOICES = [
        ('clinic', 'Klinika'),
    ]
    
    SUBSCRIPTION_STATUS_CHOICES = [
        ('active', 'Faol'),
        ('inactive', 'Nofaol'),
        ('pending', 'Kutilmoqda'),
    ]
    
    phone = models.CharField(max_length=20, unique=True, verbose_name='Telefon raqami')
    name = models.CharField(max_length=255, verbose_name='To\'liq ism')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='clinic', verbose_name='Rol')
    
    # Doctor specific fields
    specialties = models.JSONField(default=list, blank=True, verbose_name='Mutaxassisliklar')
    
    # Staff specific fields
    linked_doctor = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assistants',
        verbose_name='Bog\'langan shifokor'
    )

    clinic_group = models.ForeignKey(
        'ClinicGroup',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='members',
        verbose_name='Klinika guruhi',
        help_text='Bir guruhdagi foydalanuvchilar bemor va tahlillarni bir-biriga ko\'radi.',
    )
    
    # Subscription fields
    subscription_plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subscribers',
        verbose_name='Obuna rejasi'
    )
    subscription_status = models.CharField(
        max_length=20,
        choices=SUBSCRIPTION_STATUS_CHOICES,
        default='inactive',
        verbose_name='Obuna holati'
    )
    subscription_expiry = models.DateTimeField(null=True, blank=True, verbose_name='Obuna muddati')
    trial_ends_at = models.DateTimeField(null=True, blank=True, verbose_name='Trial tugash sanasi')
    
    # Django auth fields
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    is_staff = models.BooleanField(default=False, verbose_name='Xodim')
    is_superuser = models.BooleanField(default=False, verbose_name='Superuser')
    date_joined = models.DateTimeField(default=timezone.now, verbose_name='Ro\'yxatdan o\'tgan sana')
    last_login = models.DateTimeField(null=True, blank=True, verbose_name='Oxirgi kirish')
    
    objects = UserManager()
    
    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = ['name']
    
    class Meta:
        verbose_name = 'Foydalanuvchi'
        verbose_name_plural = 'Foydalanuvchilar'
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['phone']),  # Unique phone lookup
            models.Index(fields=['subscription_status', 'subscription_expiry']),  # Subscription queries
            models.Index(fields=['role', 'subscription_status']),  # Role-based queries
            models.Index(fields=['linked_doctor']),  # Staff-doctor relationship
            models.Index(fields=['clinic_group']),
            models.Index(fields=['date_joined']),  # User listing
        ]
    
    def __str__(self):
        return f"{self.name} ({self.phone})"

    def save(self, *args, **kwargs):
        # Admin yoki to'g'ridan-to'g'ri Model.save() — create_user dan tashqari yo'llarda ham FJSTI
        if self._state.adding and self.clinic_group_id is None:
            self.clinic_group = ClinicGroup.get_default_fjsti_group()
        super().save(*args, **kwargs)

    @property
    def is_clinic(self):
        return self.role == 'clinic'
    
    @property
    def has_active_subscription(self):
        if not self.is_active:
            return False
        if self.is_superuser or self.is_staff:
            return True
        # Chek yuborilgan, admin tasdiqlamaguncha to'liq platforma yo'q
        if self.subscription_status == 'pending':
            return False
        if self.subscription_status != 'active':
            return False
        now = timezone.now()
        if self.subscription_expiry and now < self.subscription_expiry:
            return True
        # Admin qo'lda "active" qilgan, muddat kiritilmagan (trial emas)
        if not self.subscription_expiry and not self.trial_ends_at:
            return True
        return False

    def max_concurrent_sessions(self):
        """Barcha rollar uchun qat'iy bitta faol sessiya."""
        return 1


class ActiveSession(models.Model):
    """
    Faol sessiyalar - bitta obunani bir nechta qurilma/odam ishlatishini cheklash.
    Har bir login yangi sessiya; limitdan ortiq bo'lsa eng eski sessiya bekor qilinadi.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='active_sessions',
        verbose_name='Foydalanuvchi'
    )
    refresh_jti = models.CharField(max_length=255, unique=True, db_index=True, verbose_name='Refresh token JTI')
    device_id = models.CharField(max_length=128, blank=True, db_index=True, verbose_name='Qurilma ID')
    device_info = models.CharField(max_length=255, blank=True, verbose_name='Qurilma (ixtiyoriy)')
    last_seen = models.DateTimeField(auto_now=True, verbose_name='Oxirgi faollik')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Faol sessiya'
        verbose_name_plural = 'Faol sessiyalar'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['user', 'device_id']),
        ]

    def __str__(self):
        return f"{self.user.phone} @ {self.created_at}"


class QueueItem(models.Model):
    """
    Shifokor navbati  -  barcha qurilmalarda bir xil (telefon/kompyuter sinxron).
    Registrator yoki shifokor qo'shadi; shifokor ko'radi va boshqaradi.
    """
    STATUS_CHOICES = [
        ('waiting', 'Kutilmoqda'),
        ('in-progress', 'Jarayonda'),
        ('hold', 'Kutish'),
        ('completed', 'Tugallangan'),
    ]
    doctor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='queue_items',
        verbose_name='Shifokor'
    )
    first_name = models.CharField(max_length=255, verbose_name='Ism')
    last_name = models.CharField(max_length=255, verbose_name='Familiya')
    age = models.CharField(max_length=20, verbose_name='Yosh')
    address = models.TextField(blank=True, verbose_name='Manzil')
    complaints = models.TextField(blank=True, verbose_name='Shikoyatlar')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting', db_index=True)
    ticket_number = models.PositiveIntegerField(verbose_name='Navbat raqami')
    arrival_time = models.CharField(max_length=20, blank=True, verbose_name='Kelish vaqti')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Navbat elementi'
        verbose_name_plural = 'Navbat elementlari'
        ordering = ['ticket_number', 'created_at']
        indexes = [models.Index(fields=['doctor', 'status'])]

    def __str__(self):
        return f"#{self.ticket_number} {self.last_name} {self.first_name}"