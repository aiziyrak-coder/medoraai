<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MEDORA AI - Tibbiy Konsilium Tizimi

Bu loyiha tibbiy yordam ko'rsatishda AI texnologiyalaridan foydalanishga qaratilgan professional tizim.

## Loyiha Strukturasi

```
medoraai/
├── frontend/              # Barcha frontend kodlar
├── backend/               # Django REST Framework backend
│   ├── src/              # Source kodlar
│   │   ├── components/   # React komponentlar
│   │   ├── services/    # Business logic servislar
│   │   ├── utils/       # Utility funksiyalar
│   │   ├── hooks/       # Custom React hooks
│   │   ├── i18n/        # Xalqaro qo'llab-quvvatlash
│   │   ├── constants/   # Konstanta fayllar
│   │   ├── App.tsx      # Asosiy komponent
│   │   ├── index.tsx    # Entry point
│   │   └── types.ts     # TypeScript type'lar
│   ├── public/          # Static fayllar
│   │   ├── manifest.json
│   │   ├── metadata.json
│   │   └── service-worker.js
│   ├── index.html       # HTML entry point
│   ├── package.json     # Dependencies
│   ├── vite.config.ts   # Vite konfiguratsiyasi
│   └── tsconfig.json    # TypeScript konfiguratsiyasi
└── README.md            # Bu fayl
```

## Run Locally

**Prerequisites:** Node.js

1. Frontend papkasiga kiring:
   ```bash
   cd frontend
   ```

2. Dependencies o'rnating:
   ```bash
   npm install
   ```

3. Root papkada `.env.local` fayl yarating va `GEMINI_API_KEY` ni o'rnating:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   Yoki `frontend/.env.local` fayl yarating.

4. Development serverni ishga tushiring:
   ```bash
   npm run dev
   ```

5. Browser'da oching: `http://localhost:3000`

## Build

Production build yaratish:

```bash
cd frontend
npm run build
```

Build natijasi `dist/` papkasida yaratiladi.

## Backend

Backend Django REST Framework bilan yaratilgan. Batafsil ma'lumot uchun `backend/README.md` ni ko'ring.

### Backendni ishga tushirish:

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
# .env faylini tahrirlang
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Backend `http://localhost:8000` da ishga tushadi.

## Frontend-Backend Integration

Frontend va backend **mukammal integratsiya qilingan** va API orqali bog'langan.

### Environment Variables

**Frontend** (`frontend/.env.local`):
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

**Backend** (`backend/.env`):
```env
SECRET_KEY=your-secret-key
DEBUG=True
GEMINI_API_KEY=your_gemini_api_key_here
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Batafsil ma'lumot uchun `API_CONNECTION.md` va `INTEGRATION.md` ni ko'ring.

## 🚀 Deploy Qilish

Dasturni production'ga deploy qilish uchun:

1. **Lokal Test**: `.\test-local.ps1` yoki `DEPLOY_LOCAL_TEST.md` ni ko'ring
2. **Deploy Qo'llanmasi**: `DEPLOY_COMPLETE.md` ni batafsil o'qing
3. **Checklist**: `DEPLOYMENT_CHECKLIST.md` dan foydalaning

### Tezkor Deploy
```bash
# 1. Lokal test
.\test-local.ps1

# 2. Backend deploy
cd backend
# .env faylini production uchun sozlang
python manage.py migrate
python manage.py collectstatic --noinput
gunicorn medoraai_backend.wsgi:application

# 3. Frontend build
cd frontend
# .env.local faylini production uchun sozlang
npm run build
# dist/ papkasini hosting'ga yuklang
```

Batafsil: `DEPLOY_COMPLETE.md`

## 📚 Qo'llanmalar

- **QUICK_START.md** - Tezkor boshlash
- **DEPLOY_LOCAL_TEST.md** - Lokal test qo'llanmasi
- **DEPLOY_COMPLETE.md** - To'liq deploy qo'llanmasi
- **DEPLOYMENT_CHECKLIST.md** - Deploy checklist
- **PRODUCTION_READINESS.md** - Production tayyorlik
- **API_CONNECTION.md** - API ulanish
- **INTEGRATION.md** - Frontend-Backend integratsiya

## View your app in AI Studio

https://ai.studio/apps/drive/1-zt55B-N48kYNQKxaM1ATlUjqDwqT0Ma
