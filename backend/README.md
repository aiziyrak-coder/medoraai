# MEDORA AI Backend API

Django REST Framework bilan yaratilgan professional backend API.

## O'rnatish

### 1. Virtual environment yaratish

```bash
python -m venv venv
```

### 2. Virtual environmentni faollashtirish

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Dependencies o'rnatish

```bash
pip install -r requirements.txt
```

### 4. Environment variables sozlash

`.env.example` faylini `.env` ga nusxalang va sozlang:

```bash
cp .env.example .env
```

`.env` faylida quyidagilarni o'zgartiring:
- `SECRET_KEY` - Django secret key
- `GEMINI_API_KEY` - Google Gemini API kaliti
- `DEBUG` - Development uchun `True`, production uchun `False`

### 5. Database migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Superuser yaratish

```bash
python manage.py createsuperuser
```

### 7. Development serverni ishga tushirish

```bash
python manage.py runserver
```

Server `http://localhost:8000` da ishga tushadi.

## API Dokumentatsiya

- Swagger UI: `http://localhost:8000/swagger/`
- ReDoc: `http://localhost:8000/redoc/`
- API Docs: `http://localhost:8000/api/docs/`

## API Endpoints

### Authentication
- `POST /api/auth/register/` - Ro'yxatdan o'tish
- `POST /api/auth/login/` - Kirish (JWT token olish)
- `POST /api/auth/token/refresh/` - Token yangilash
- `GET /api/auth/profile/` - Profil ma'lumotlari
- `PUT /api/auth/profile/` - Profil yangilash
- `POST /api/auth/change-password/` - Parol o'zgartirish

### Patients
- `GET /api/patients/` - Bemorlar ro'yxati
- `POST /api/patients/` - Yangi bemor yaratish
- `GET /api/patients/{id}/` - Bemor ma'lumotlari
- `PUT /api/patients/{id}/` - Bemor yangilash
- `DELETE /api/patients/{id}/` - Bemor o'chirish
- `POST /api/patients/{id}/upload-attachment/` - Fayl yuklash

### Analyses
- `GET /api/analyses/` - Tahlillar ro'yxati
- `POST /api/analyses/` - Yangi tahlil yaratish
- `GET /api/analyses/{id}/` - Tahlil ma'lumotlari
- `PUT /api/analyses/{id}/` - Tahlil yangilash
- `POST /api/analyses/{id}/add-feedback/` - Tashxis fikri qo'shish
- `GET /api/analyses/stats/` - Statistika

### AI Services
- `POST /api/ai/clarifying-questions/` - Tushuntirish savollari
- `POST /api/ai/recommend-specialists/` - Mutaxassislar tavsiyasi
- `POST /api/ai/generate-diagnoses/` - Diferensial tashxis
- `POST /api/ai/council-debate/` - Konsilium munozarasi

## Authentication

API JWT (JSON Web Token) authentication ishlatadi.

### Token olish

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"phone": "+998901234567", "password": "your_password"}'
```

### Token bilan so'rov yuborish

```bash
curl -X GET http://localhost:8000/api/auth/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Production Deployment

1. `DEBUG=False` qiling
2. `SECRET_KEY` ni xavfsiz o'zgartiring
3. PostgreSQL database ishlating
4. `ALLOWED_HOSTS` ni sozlang
5. Static files to'plang: `python manage.py collectstatic`
6. Gunicorn yoki uWSGI bilan deploy qiling

## Struktura

```
backend/
├── accounts/          # Foydalanuvchilar va autentifikatsiya
├── patients/          # Bemorlar
├── analyses/          # Tahlillar
├── ai_services/       # AI xizmatlar
├── medoraai_backend/  # Asosiy sozlamalar
├── manage.py
└── requirements.txt
```
