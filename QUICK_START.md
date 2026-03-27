# 🚀 Tezkor Boshlash - AiDoktor

## Backend va Frontendni Ishga Tushirish

### 1️⃣ Backend Setup (Django REST Framework)

```bash
# Backend papkasiga kiring
cd backend

# Virtual environment yaratish
python -m venv venv

# Virtual environmentni faollashtirish (Windows)
venv\Scripts\activate

# Dependencies o'rnatish
pip install -r requirements.txt

# Environment variables sozlash
cp .env.example .env
# .env faylini tahrirlang va GEMINI_API_KEY ni kiriting

# Database migrations
python manage.py makemigrations
python manage.py migrate

# Superuser yaratish
python manage.py createsuperuser

# Server ishga tushirish
python manage.py runserver
```

Backend `http://localhost:8000` da ishga tushadi.

### 2️⃣ Frontend Setup (React + Vite)

```bash
# Frontend papkasiga kiring
cd frontend

# Dependencies o'rnatish
npm install

# Environment variables sozlash
cp .env.example .env.local
# .env.local faylini tahrirlang:
# VITE_API_BASE_URL=http://localhost:8000/api
# VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Development serverni ishga tushirish
npm run dev
```

Frontend `http://localhost:3000` da ishga tushadi.

## ✅ API Connection

Frontend va backend avtomatik ravishda bog'langan:

- ✅ **Authentication**: JWT token bilan
- ✅ **Auto token refresh**: Token muddati tugasa avtomatik yangilanadi
- ✅ **Fallback**: API mavjud bo'lmasa, localStorage ishlatiladi
- ✅ **Error handling**: User-friendly xabarlar

## 🧪 Test Qilish

1. Frontend'da ro'yxatdan o'ting yoki kiring
2. Bemor ma'lumotlarini kiriting
3. Tahlilni boshlang
4. Barcha ma'lumotlar backend'ga saqlanadi

## 📚 API Dokumentatsiya

- **Swagger**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/

## 🔧 Troubleshooting

### Backend ishlamayapti?
- Virtual environment faollashtirilganini tekshiring
- `python manage.py migrate` ni qayta ishga tushiring
- Port 8000 band bo'lishi mumkin

### Frontend API'ga ulanmayapti?
- `.env.local` faylida `VITE_API_BASE_URL` to'g'ri ekanligini tekshiring
- Backend server ishlayotganini tekshiring
- Browser console'da xatoliklarni ko'ring

### CORS xatolik?
- Backend'da `CORS_ALLOWED_ORIGINS` ga frontend URL qo'shing
- Backend'ni qayta ishga tushiring

## 🎉 Tayyor!

Endi sizning dasturingiz to'liq ishlaydi:
- ✅ Frontend React bilan
- ✅ Backend Django REST Framework bilan
- ✅ API orqali mukammal bog'langan
- ✅ JWT authentication
- ✅ Real-time data sync
-NoNewline
