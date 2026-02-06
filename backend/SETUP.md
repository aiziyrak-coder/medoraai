# Backend Setup Guide

## Tezkor Boshlash

### 1. Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate  # Windows
# yoki
source venv/bin/activate  # Linux/Mac
```

### 2. Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Variables

`.env.example` ni `.env` ga nusxalang:

```bash
cp .env.example .env
```

`.env` faylini tahrirlang va quyidagilarni to'ldiring:
- `SECRET_KEY` - Django secret key (yangi yarating)
- `GEMINI_API_KEY` - Google Gemini API kaliti
- `DEBUG=True` - Development uchun

### 4. Database Setup

```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Superuser yaratish

```bash
python manage.py createsuperuser
```

Telefon raqam, ism va parol kiriting.

### 6. Server ishga tushirish

```bash
python manage.py runserver
```

Yoki:

```bash
.\runserver.bat  # Windows
./runserver.sh   # Linux/Mac
```

## API Test

### 1. Ro'yxatdan o'tish

```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "name": "Test User",
    "password": "testpass123",
    "password_confirm": "testpass123",
    "role": "clinic"
  }'
```

### 2. Kirish

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "password": "testpass123"
  }'
```

### 3. Profil olish

```bash
curl -X GET http://localhost:8000/api/auth/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Admin Panel

Admin panelga kirish: `http://localhost:8000/admin/`

Superuser bilan kirishingiz mumkin.

## API Dokumentatsiya

- Swagger: `http://localhost:8000/swagger/`
- ReDoc: `http://localhost:8000/redoc/`

## Production Deployment

1. `DEBUG=False`
2. `SECRET_KEY` ni xavfsiz o'zgartiring
3. PostgreSQL database ishlating
4. `ALLOWED_HOSTS` ni sozlang
5. `python manage.py collectstatic`
6. Gunicorn yoki uWSGI bilan deploy qiling
