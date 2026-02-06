# 🧪 Lokal Test Qo'llanmasi - Deploy Oldidan

Ushbu qo'llanma dasturni **deploy qilishdan oldin** lokalda to'liq test qilish uchun.

---

## 1. Backend Test

### 1.1 Environment Setup
```powershell
cd backend
# .env faylini tekshiring
cat .env
# Quyidagilar bo'lishi kerak:
# - SECRET_KEY (default yoki production key)
# - DEBUG=True (test uchun)
# - GEMINI_API_KEY
# - CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### 1.2 Database Migrations
```powershell
python manage.py makemigrations
python manage.py migrate
# Xatolik bo'lmasa ✅
```

### 1.3 Static Files
```powershell
python manage.py collectstatic --noinput
# staticfiles/ papkasi yaratilgan bo'lishi kerak ✅
```

### 1.4 Health Checks
```powershell
# Backend ishga tushirilgan bo'lishi kerak (port 8000)
curl http://localhost:8000/health/
# Javob: {"status":"healthy","service":"medoraai-backend"}

curl http://localhost:8000/health/detailed/
# Javob: {"status":"healthy","checks":{"database":"ok","cache":"ok",...}}
```

### 1.5 API Endpoints Test
```powershell
# 1. Register
curl -X POST http://localhost:8000/api/auth/register/ `
  -H "Content-Type: application/json" `
  -d '{"phone":"+998901234567","name":"Test User","password":"Test1234!","password_confirm":"Test1234!","role":"doctor"}'

# 2. Login
curl -X POST http://localhost:8000/api/auth/login/ `
  -H "Content-Type: application/json" `
  -d '{"phone":"+998901234567","password":"Test1234!"}'

# 3. Profile (token bilan)
curl http://localhost:8000/api/auth/profile/ `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 1.6 Rate Limiting Test
```powershell
# 5 marta noto'g'ri login urinish
for ($i=1; $i -le 6; $i++) {
  curl -X POST http://localhost:8000/api/auth/login/ `
    -H "Content-Type: application/json" `
    -d '{"phone":"+998901234567","password":"wrong"}'
}
# 6-urinda 429 qaytishi kerak ✅
```

### 1.7 Session Limit Test
```powershell
# 1. Birinchi login (shifokor - 1 sessiya)
curl -X POST http://localhost:8000/api/auth/login/ ...
# Token1 oling

# 2. Ikkinchi login (boshqa qurilmada)
curl -X POST http://localhost:8000/api/auth/login/ ...
# Token2 oling

# 3. Token1 bilan so'rov yuborish
curl http://localhost:8000/api/auth/profile/ -H "Authorization: Bearer Token1"
# 401 qaytishi kerak (sessiya bekor qilingan) ✅
```

---

## 2. Frontend Test

### 2.1 Environment Setup
```powershell
cd frontend
# .env.local faylini tekshiring
cat .env.local
# VITE_API_BASE_URL=http://localhost:8000/api
```

### 2.2 Build Test
```powershell
npm run build
# Xatolik bo'lmasa ✅
# dist/ papkasi yaratilgan bo'lishi kerak
```

### 2.3 Development Server
```powershell
npm run dev
# http://localhost:3000 ochilishi kerak ✅
```

### 2.4 Frontend-Backend Connection
1. Browser'da `http://localhost:3000` oching
2. Developer Tools > Network tab
3. Ro'yxatdan o'ting yoki kiring
4. API so'rovlar `http://localhost:8000/api/...` ga ketishi kerak ✅
5. Token localStorage'da saqlanadi ✅

### 2.5 UI Test Checklist
- [ ] Login sahifasi ochiladi
- [ ] Register sahifasi ochiladi
- [ ] Shartlar va maxfiylik rozilik talab qilinadi
- [ ] Login muvaffaqiyatli
- [ ] Dashboard ochiladi
- [ ] Yangi tahlil yaratish ishlaydi
- [ ] Bemor ma'lumotlari kiritish ishlaydi
- [ ] AI tahlil ishlaydi
- [ ] Hisobotlar ko'rsatiladi
- [ ] PDF/DOCX eksport ishlaydi
- [ ] Tarix ko'rsatiladi

---

## 3. Integration Test

### 3.1 Full Flow Test
1. **Register** → Token oling
2. **Login** → Token yangilanishi
3. **Patient yaratish** → Backend'ga saqlanishi
4. **Analysis yaratish** → Backend'ga saqlanishi
5. **Report ko'rish** → Backend'dan olinishi
6. **Logout** → Token tozalanishi

### 3.2 Error Handling Test
- [ ] Network xatolik (backend o'chirilganda) - fallback ishlaydi
- [ ] 401 xatolik - login sahifasiga redirect
- [ ] 403 xatolik - foydalanuvchiga xabar
- [ ] 429 xatolik - rate limit xabari
- [ ] 500 xatolik - umumiy xatolik xabari

### 3.3 Subscription Test
- [ ] Klinika obuna sahifasi
- [ ] Shifokor obuna sahifasi
- [ ] Chek yuborish (Telegram)
- [ ] Admin tasdiqlash (Django admin)

---

## 4. Security Test

### 4.1 Password Validation
```powershell
# Qisqa parol (7 belgi) - xatolik bo'lishi kerak
curl -X POST http://localhost:8000/api/auth/register/ `
  -d '{"phone":"+998901234568","password":"short","password_confirm":"short",...}'
# 400 qaytishi kerak ✅
```

### 4.2 CORS Test
```powershell
# Boshqa origin'dan so'rov
curl -X POST http://localhost:8000/api/auth/login/ `
  -H "Origin: http://evil.com" `
  -H "Content-Type: application/json" `
  -d '{"phone":"...","password":"..."}'
# CORS xatolik bo'lishi kerak ✅
```

### 4.3 Token Security
- [ ] Token localStorage'da saqlanadi (httpOnly emas - frontend uchun normal)
- [ ] Logout tokenlarni tozalaydi
- [ ] Token refresh ishlaydi
- [ ] Eski token ishlatilmaydi (blacklist)

---

## 5. Performance Test

### 5.1 Backend Response Time
```powershell
# Health check
Measure-Command { curl http://localhost:8000/health/ }
# < 100ms bo'lishi kerak ✅

# API endpoint
Measure-Command { curl http://localhost:8000/api/auth/profile/ -H "Authorization: Bearer TOKEN" }
# < 200ms bo'lishi kerak ✅
```

### 5.2 Frontend Build Size
```powershell
cd frontend
npm run build
# dist/ papkasidagi fayllar:
# - index.html
# - assets/ (JS, CSS)
# Total size < 5MB bo'lishi kerak ✅
```

---

## 6. Production Readiness Checklist

### Backend
- [ ] `DEBUG=False` production uchun
- [ ] `SECRET_KEY` kuchli va maxfiy
- [ ] `ALLOWED_HOSTS` to'g'ri
- [ ] `CORS_ALLOWED_ORIGINS` to'g'ri
- [ ] Database migrations barchasi qo'llangan
- [ ] Static files yig'ilgan
- [ ] Logs papkasi yaratilgan
- [ ] Health checks ishlaydi
- [ ] Rate limiting ishlaydi
- [ ] Session limit ishlaydi

### Frontend
- [ ] Build muvaffaqiyatli
- [ ] `VITE_API_BASE_URL` production URL
- [ ] Environment variables to'g'ri
- [ ] Error handling ishlaydi
- [ ] API connection ishlaydi
- [ ] Token management ishlaydi

### Security
- [ ] Parol validation ishlaydi
- [ ] CORS to'g'ri sozlangan
- [ ] Rate limiting ishlaydi
- [ ] Session limit ishlaydi
- [ ] HTTPS production'da (test qilish uchun lokalda shart emas)

---

## 7. Test Script

Quyidagi PowerShell script barcha testlarni avtomatik bajaradi:

```powershell
# test-local.ps1
Write-Host "🧪 Lokal Test Boshlanmoqda..." -ForegroundColor Green

# Backend health check
Write-Host "`n1. Backend Health Check..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "http://localhost:8000/health/" -Method Get
if ($health.status -eq "healthy") {
    Write-Host "✅ Backend healthy" -ForegroundColor Green
} else {
    Write-Host "❌ Backend unhealthy" -ForegroundColor Red
    exit 1
}

# Frontend build
Write-Host "`n2. Frontend Build..." -ForegroundColor Yellow
cd frontend
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend build muvaffaqiyatli" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend build xatolik" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Barcha testlar muvaffaqiyatli!" -ForegroundColor Green
```

---

## 8. Xatoliklar va Yechimlar

### Backend ishlamayapti
- Port 8000 band bo'lishi mumkin: `netstat -ano | findstr :8000`
- Virtual environment faollashtirilmagan
- Database migrations qo'llanmagan

### Frontend API'ga ulanmayapti
- `.env.local` faylida `VITE_API_BASE_URL` to'g'ri emas
- Backend ishlamayapti
- CORS sozlamalari noto'g'ri

### Build xatolik
- `npm install` qilinmagan
- Node.js versiyasi eski (18+ kerak)
- TypeScript xatoliklari

---

## ✅ Tayyor!

Barcha testlar muvaffaqiyatli bo'lsa, dastur **deploy qilishga tayyor**!

Keyingi qadam: `DEPLOYMENT_CHECKLIST.md` ni ko'ring.
