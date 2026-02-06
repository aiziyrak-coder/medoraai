# Frontend-Backend Integration Guide

## API Connection Setup

### 1. Environment Variables

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

### 2. Start Backend Server

```bash
cd backend
python manage.py runserver
```

Backend `http://localhost:8000` da ishga tushadi.

### 3. Start Frontend Server

```bash
cd frontend
npm run dev
```

Frontend `http://localhost:3000` da ishga tushadi.

## API Integration Points

### Authentication Flow

1. **Register** → `POST /api/auth/register/`
2. **Login** → `POST /api/auth/login/` → JWT tokens olinadi
3. Tokens localStorage'ga saqlanadi
4. Har bir API so'rovida `Authorization: Bearer <token>` header qo'shiladi
5. Token muddati tugasa, avtomatik yangilanadi

### Data Flow

#### Patients
- **Create**: Frontend → `POST /api/patients/` → Backend saves → Returns patient
- **List**: Frontend → `GET /api/patients/` → Backend returns list
- **Update**: Frontend → `PATCH /api/patients/{id}/` → Backend updates
- **Delete**: Frontend → `DELETE /api/patients/{id}/` → Backend deletes

#### Analyses
- **Create**: Frontend → `POST /api/analyses/` → Backend saves → Returns analysis
- **List**: Frontend → `GET /api/analyses/` → Backend returns list
- **Update**: Frontend → `PATCH /api/analyses/{id}/` → Backend updates
- **Stats**: Frontend → `GET /api/analyses/stats/` → Backend returns statistics

#### AI Services
- **Clarifying Questions**: Frontend → `POST /api/ai/clarifying-questions/` → Backend calls Gemini → Returns questions
- **Recommend Specialists**: Frontend → `POST /api/ai/recommend-specialists/` → Backend analyzes → Returns recommendations
- **Generate Diagnoses**: Frontend → `POST /api/ai/generate-diagnoses/` → Backend calls Gemini → Returns diagnoses
- **Council Debate**: Frontend → `POST /api/ai/council-debate/` → Backend orchestrates → Returns debate results

## Error Handling

Frontend avtomatik ravishda:
- Network xatoliklarni tutadi
- 401 (Unauthorized) holatida token yangilaydi
- User-friendly error messages ko'rsatadi
- Fallback to local services (agar API mavjud bo'lmasa)

## Testing API Connection

### 1. Test Registration

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

### 2. Test Login

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "password": "testpass123"
  }'
```

### 3. Test Protected Endpoint

```bash
curl -X GET http://localhost:8000/api/auth/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Migration from LocalStorage to API

Frontend avtomatik ravishda:
1. API mavjud bo'lsa, API'dan ma'lumotlarni oladi
2. API mavjud bo'lmasa, localStorage'dan o'qiydi (fallback)
3. Har doim API'ga saqlashga harakat qiladi
4. Muvaffaqiyatsiz bo'lsa, localStorage'ga saqlaydi

## Troubleshooting

### CORS Errors
- Backend'da `CORS_ALLOWED_ORIGINS` ni tekshiring
- Frontend URL backend sozlamalarida bo'lishi kerak

### Authentication Errors
- Token localStorage'da mavjudligini tekshiring
- Token muddati tugagan bo'lishi mumkin - yangilashga harakat qiling
- Backend'da JWT sozlamalarini tekshiring

### Network Errors
- Backend server ishlayotganini tekshiring
- `VITE_API_BASE_URL` to'g'ri sozlanganini tekshiring
- Firewall yoki proxy muammolari bo'lishi mumkin

## Production Deployment

1. Backend'ni production serverga deploy qiling
2. Frontend'da `VITE_API_BASE_URL` ni production URL'ga o'zgartiring
3. CORS sozlamalarini production domain'lar uchun yangilang
4. HTTPS ishlating
5. Environment variables'ni xavfsiz saqlang
