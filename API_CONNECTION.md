# Frontend-Backend API Connection Guide

## ✅ Mukammal Integratsiya Tugallandi!

Frontend va backend endi to'liq integratsiya qilingan.

## 📋 O'rnatish

### 1. Backend Setup

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

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# .env.local faylini tahrirlang
npm run dev
```

Frontend `http://localhost:3000` da ishga tushadi.

### 3. Environment Variables

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

## 🔄 API Integration Features

### ✅ Authentication Flow
- **Register**: Frontend → Backend API → JWT tokens
- **Login**: Frontend → Backend API → JWT tokens
- **Auto token refresh**: Token muddati tugasa avtomatik yangilanadi
- **Fallback**: API mavjud bo'lmasa, localStorage ishlatiladi

### ✅ Patient Management
- **Create**: Frontend → `POST /api/patients/` → Backend
- **List**: Frontend → `GET /api/patients/` → Backend
- **Update**: Frontend → `PATCH /api/patients/{id}/` → Backend
- **Delete**: Frontend → `DELETE /api/patients/{id}/` → Backend
- **File Upload**: Frontend → `POST /api/patients/{id}/upload-attachment/` → Backend

### ✅ Analysis Management
- **Create**: Frontend → `POST /api/analyses/` → Backend
- **List**: Frontend → `GET /api/analyses/` → Backend
- **Update**: Frontend → `PATCH /api/analyses/{id}/` → Backend
- **Stats**: Frontend → `GET /api/analyses/stats/` → Backend
- **Feedback**: Frontend → `POST /api/analyses/{id}/add-feedback/` → Backend

### ✅ AI Services
- **Clarifying Questions**: Frontend → `POST /api/ai/clarifying-questions/` → Backend → Gemini AI
- **Recommend Specialists**: Frontend → `POST /api/ai/recommend-specialists/` → Backend → Gemini AI
- **Generate Diagnoses**: Frontend → `POST /api/ai/generate-diagnoses/` → Backend → Gemini AI
- **Council Debate**: Frontend → `POST /api/ai/council-debate/` → Backend → Gemini AI

## 🛡️ Error Handling

- **Network errors**: User-friendly xabarlar
- **401 Unauthorized**: Avtomatik token yangilash
- **API unavailable**: Fallback to localStorage
- **Validation errors**: Real-time feedback

## 🔐 Security Features

- JWT token authentication
- Automatic token refresh
- CORS protection
- Input validation
- XSS protection

## 📊 Data Flow

```
Frontend Component
    ↓
API Service (api.ts)
    ↓
Backend API (Django REST)
    ↓
Database (SQLite/PostgreSQL)
    ↓
Response → Frontend
```

## 🧪 Testing

### Test Registration
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "name": "Test User",
    "password": "test123",
    "password_confirm": "test123",
    "role": "clinic"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "password": "test123"
  }'
```

### Test Protected Endpoint
```bash
curl -X GET http://localhost:8000/api/auth/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📝 API Documentation

- **Swagger UI**: `http://localhost:8000/swagger/`
- **ReDoc**: `http://localhost:8000/redoc/`
- **API Docs**: `http://localhost:8000/api/docs/`

## 🚀 Production Deployment

1. Backend'ni production serverga deploy qiling
2. Frontend'da `VITE_API_BASE_URL` ni production URL'ga o'zgartiring
3. CORS sozlamalarini production domain'lar uchun yangilang
4. HTTPS ishlating
5. Environment variables'ni xavfsiz saqlang

## ✨ Features

- ✅ Automatic API fallback to localStorage
- ✅ Token refresh on 401 errors
- ✅ Real-time error handling
- ✅ Loading states
- ✅ Type-safe API calls
- ✅ Pagination support
- ✅ File upload support
- ✅ Search and filtering

Barcha API integratsiyalar mukammal ishlaydi! 🎉
