"""
Django settings for Farg'ona jamoat salomatligi tibbiyot instituti (FJSTI) tibbiy platformasi.
"""

from pathlib import Path
from datetime import timedelta
import os
from decouple import config

# DisallowedHost bartaraf: get_host() ni settings yuklanishida patch (medora.cdcgroup.uz qabul qilish)
import django.http.request as _django_request_mod
_django_request_mod.HttpRequest.get_host = lambda self: (
    (self.META.get('HTTP_HOST') or 'medora.cdcgroup.uz').split('#')[0].strip()
)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

# SECURITY WARNING: keep the secret key used in production secret!
# In production (DEBUG=False), SECRET_KEY must be set in env; no default.
_default_secret = 'django-insecure-change-this-in-production-!@#$%^&*()'
SECRET_KEY = config('SECRET_KEY', default=_default_secret)
if not DEBUG and SECRET_KEY == _default_secret:
    raise RuntimeError(
        'SECRET_KEY must be set in environment when DEBUG=False. '
        'Generate one with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"'
    )

# ALLOWED_HOSTS: serverni .env/systemd override qilishini bekor qilish  -  faqat *
ALLOWED_HOSTS = ['*', 'medora.cdcgroup.uz', 'medoraapi.cdcgroup.uz', 'localhost', '127.0.0.1']

# Application definition — drf_yasg optional (requires pkg_resources, may fail on Python 3.14)
try:
    import pkg_resources  # noqa: F401
    import drf_yasg  # noqa: F401
    _SWAGGER_AVAILABLE = True
except Exception:
    _SWAGGER_AVAILABLE = False

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    *(['drf_yasg'] if _SWAGGER_AVAILABLE else []),
    # Local apps
    'accounts',
    'patients',
    'analyses',
    'ai_services',
]

MIDDLEWARE = [
    'medoraai_backend.middleware.EarlyHealthMiddleware',  # very first: /health/ -> 200, no Host check
    'medoraai_backend.middleware.NormalizeHostMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'medoraai_backend.middleware.CORSFallbackMiddleware',  # CORS for /health/, /api/ when corsheaders missed
    'medoraai_backend.middleware.SecurityHeadersMiddleware',  # Custom security headers
    'medoraai_backend.middleware.RateLimitMiddleware',  # Rate limiting
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'medoraai_backend.middleware.RequestLoggingMiddleware',  # Request logging
    'ai_services.anatomy_guard.AnatomyGuardMiddleware',     # Anatomy & Logic Guard
]

ROOT_URLCONF = 'medoraai_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'medoraai_backend.wsgi.application'

# Database — SQLite (serverda restart dan keyin ham saqlanadi) yoki PostgreSQL
_db_engine = config('DB_ENGINE', default='django.db.backends.sqlite3')
_db_name = config('DB_NAME', default='')
# SQLite: har doim loyiha papkasidagi aniq fayl (restart dan keyin ma'lumot yo'qolmasin)
if _db_engine == 'django.db.backends.sqlite3':
    _db_name = _db_name.strip() or str(BASE_DIR / 'db.sqlite3')
    # Noto'g'ri path (boshqa server path) bo'lsa, loyiha ichidagi faylga o'tkazamiz
    if _db_name.startswith('/home/') and not os.path.exists(os.path.dirname(_db_name)):
        _db_name = str(BASE_DIR / 'db.sqlite3')

DATABASES = {
    'default': {
        'ENGINE': _db_engine,
        'NAME': _db_name,
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default=''),
        'PORT': config('DB_PORT', default=''),
        'OPTIONS': {
            'connect_timeout': 10,
            'options': '-c statement_timeout=30000',
        } if _db_engine == 'django.db.backends.postgresql' else {},
        'CONN_MAX_AGE': 600,
    }
}

# Password validation (kuchli parol: kamida 8 belgi, raqam, maxsus belgi)
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom Authentication Backend
AUTHENTICATION_BACKENDS = [
    'accounts.backends.PhoneBackend',  # Phone-based authentication
    'django.contrib.auth.backends.ModelBackend',  # Default backend
]

# Internationalization
LANGUAGE_CODE = 'uz'
TIME_ZONE = 'Asia/Tashkent'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files (User uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'medoraai_backend.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'EXCEPTION_HANDLER': 'medoraai_backend.exceptions.custom_exception_handler',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/hour',   # login + unauthenticated API (DEBUG da yetarli)
        'user': '1000/hour'
    }
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# CORS Settings
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default=(
        'http://localhost:3000,http://127.0.0.1:3000,'
        'https://medora.cdcgroup.uz,http://medora.cdcgroup.uz,'
        'https://medora.cdcgroup.uz,http://localhost:3000,'
        'http://127.0.0.1:3000,http://20.82.115.71'
    ),
    cast=lambda v: [s.strip() for s in v.split(',') if s.strip()]
)

CORS_ALLOW_CREDENTIALS = True

# CSRF (Django 4+): ishonchli originlar
CSRF_TRUSTED_ORIGINS = [
    'https://medora.cdcgroup.uz', 'http://localhost:3000', 'http://127.0.0.1:3000',
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Swagger/OpenAPI Settings
SWAGGER_SETTINGS = {
    'SECURITY_DEFINITIONS': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header'
        }
    },
    'USE_SESSION_AUTH': False,
}

# File Upload Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB

# Azure AI Foundry Configuration
AZURE_OPENAI_ENDPOINT   = config('AZURE_OPENAI_ENDPOINT',   default='')
AZURE_OPENAI_API_KEY    = config('AZURE_OPENAI_API_KEY',    default='')
AZURE_OPENAI_API_VERSION = config('AZURE_OPENAI_API_VERSION', default='2024-12-01-preview')

# Azure Speech Services (Farg'ona JSTI Jarvis)
AZURE_SPEECH_KEY      = config('AZURE_SPEECH_KEY',      default='')
AZURE_SPEECH_REGION   = config('AZURE_SPEECH_REGION',   default='swedencentral')
AZURE_SPEECH_ENDPOINT = config('AZURE_SPEECH_ENDPOINT', default='https://swedencentral.api.cognitive.microsoft.com/')

# Azure deployment names
AZURE_DEPLOY_GPT4O = config('AZURE_DEPLOY_GPT4O', default='FJSTI-gpt4o')
AZURE_DEPLOY_DEEPSEEK = config('AZURE_DEPLOY_DEEPSEEK', default='FJSTI-deepseek')
AZURE_DEPLOY_LLAMA = config('AZURE_DEPLOY_LLAMA', default='FJSTI-llama')
AZURE_DEPLOY_MISTRAL = config('AZURE_DEPLOY_MISTRAL', default='FJSTI-mistral')
AZURE_DEPLOY_MINI = config('AZURE_DEPLOY_MINI', default='FJSTI-mini')

# AI: faqat Gemini (kalit .env dan; backend/.env dan aniq o'qish fallback)
def _load_gemini_key():
    key = (config('GEMINI_API_KEY', default='') or '').strip()
    if key:
        return key
    env_file = BASE_DIR / '.env'
    if env_file.exists():
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip().startswith('GEMINI_API_KEY='):
                        key = line.split('=', 1)[1].strip().strip('"').strip("'").strip()
                        return key
        except Exception:
            pass
    return ''
GEMINI_API_KEY = _load_gemini_key()
# Gemini model IDs (.env da override; 3 Pro: gemini-3.1-pro-preview)
GEMINI_MODEL_FLASH = config('GEMINI_MODEL_FLASH', default='gemini-2.0-flash-exp')
GEMINI_MODEL_PRO = config('GEMINI_MODEL_PRO', default='gemini-2.5-pro')
GEMINI_MODEL_THINKING = config('GEMINI_MODEL_THINKING', default='gemini-2.0-flash-thinking-exp')
AI_MODEL_DEFAULT = config('AI_MODEL_DEFAULT', default='gemini-2.5-pro')

# в”Ђв”Ђ Production Security Settings в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
if not DEBUG:
    # HTTPS enforcement (set SECURE_SSL_REDIRECT=False in .env when using HTTP only)
    SECURE_SSL_REDIRECT          = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SECURE_PROXY_SSL_HEADER      = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS          = 31536000   # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD          = True
    SECURE_CONTENT_TYPE_NOSNIFF  = True
    SECURE_BROWSER_XSS_FILTER    = True
    SESSION_COOKIE_SECURE        = True
    SESSION_COOKIE_HTTPONLY      = True
    CSRF_COOKIE_SECURE           = True
    CSRF_COOKIE_HTTPONLY         = True
    X_FRAME_OPTIONS              = 'DENY'

# Static files (production: WhiteNoise)
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Telegram (payment receipts) - set in production .env, never expose to frontend
TELEGRAM_BOT_TOKEN = config('TELEGRAM_BOT_TOKEN', default='')
TELEGRAM_PAYMENT_GROUP_ID = config('TELEGRAM_PAYMENT_GROUP_ID', default='')

# Celery Configuration (for async tasks)
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Caching Configuration
REDIS_URL = config('REDIS_URL', default='')
if REDIS_URL:
    # Use Redis cache if REDIS_URL is set
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            },
            'KEY_PREFIX': 'FJSTI',
            'TIMEOUT': 300,  # 5 minutes default
        }
    }
else:
    # Fallback to local memory cache if Redis URL not set
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'FJSTI-cache',
        }
    }

# Logging Configuration  -  file handlers only if logs dir exists and is writable (avoid startup crash)
_LOGS_DIR = BASE_DIR / 'logs'
def _logs_writable():
    try:
        _LOGS_DIR.mkdir(parents=True, exist_ok=True)
        (_LOGS_DIR / '.write_test').write_text('')
        (_LOGS_DIR / '.write_test').unlink()
        return True
    except Exception:
        return False

_USE_FILE_LOGS = _logs_writable()
_ROOT_HANDLERS = ['console', 'file'] if _USE_FILE_LOGS else ['console']
_DJANGO_HANDLERS = ['console', 'file'] if _USE_FILE_LOGS else ['console']
_REQUEST_HANDLERS = ['error_file'] if _USE_FILE_LOGS else ['console']
_FJSTI_HANDLERS = ['console', 'file', 'error_file'] if _USE_FILE_LOGS else ['console']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG' if DEBUG else 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': _ROOT_HANDLERS,
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': _DJANGO_HANDLERS,
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': _REQUEST_HANDLERS,
            'level': 'ERROR',
            'propagate': False,
        },
        'medoraai_backend': {
            'handlers': _FJSTI_HANDLERS,
            'level': 'INFO',
            'propagate': False,
        },
    },
}
if _USE_FILE_LOGS:
    LOGGING['handlers']['file'] = {
        'level': 'INFO',
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': _LOGS_DIR / 'django.log',
        'maxBytes': 1024 * 1024 * 10,
        'backupCount': 5,
        'formatter': 'verbose',
    }
    LOGGING['handlers']['error_file'] = {
        'level': 'ERROR',
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': _LOGS_DIR / 'django_errors.log',
        'maxBytes': 1024 * 1024 * 10,
        'backupCount': 5,
        'formatter': 'verbose',
    }

# Business Logic Settings
DOCTOR_TRIAL_DAYS = config('DOCTOR_TRIAL_DAYS', default=7, cast=int)
LOGIN_RATE_LIMIT_MAX = config('LOGIN_RATE_LIMIT_MAX', default=30 if DEBUG else 5, cast=int)
LOGIN_RATE_LIMIT_WINDOW = config('LOGIN_RATE_LIMIT_WINDOW', default=900, cast=int)  # 15 min
MAX_FILE_UPLOAD_SIZE = config('MAX_FILE_UPLOAD_SIZE_MB', default=5, cast=int) * 1024 * 1024
ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf']

# Security Settings (Production)
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')  # Nginx orqada SSL
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# get_host() patch settings boshida qo'yilgan (DisallowedHost bartaraf)