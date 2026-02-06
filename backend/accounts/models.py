"""
User and Authentication Models
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
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
        ('doctor', 'Shifokor'),
        ('staff', 'Registrator'),
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
            models.Index(fields=['date_joined']),  # User listing
        ]
    
    def __str__(self):
        return f"{self.name} ({self.phone})"
    
    @property
    def is_doctor(self):
        return self.role == 'doctor'
    
    @property
    def is_clinic(self):
        return self.role == 'clinic'
    
    @property
    def is_staff_member(self):
        return self.role == 'staff'
    
    @property
    def has_active_subscription(self):
        if self.role == 'staff':
            if self.linked_doctor:
                return self.linked_doctor.has_active_subscription
            return False
        if self.subscription_status != 'active':
            return False
        # Trial: active until trial_ends_at
        if self.trial_ends_at and timezone.now() < self.trial_ends_at:
            return True
        # Paid: active until subscription_expiry
        if self.subscription_expiry and timezone.now() < self.subscription_expiry:
            return True
        if not self.subscription_expiry and not self.trial_ends_at:
            return True  # legacy: no expiry set
        return False

    def max_concurrent_sessions(self):
        """Bitta obunani bir nechta odam ishlatishini oldini olish: shifokor 1, klinika 2, staff 1."""
        if self.role == 'doctor':
            return 1
        if self.role == 'clinic':
            return 2
        return 1  # staff


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
    device_info = models.CharField(max_length=255, blank=True, verbose_name='Qurilma (ixtiyoriy)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Faol sessiya'
        verbose_name_plural = 'Faol sessiyalar'
        ordering = ['created_at']
        indexes = [models.Index(fields=['user', 'created_at'])]

    def __str__(self):
        return f"{self.user.phone} @ {self.created_at}"
