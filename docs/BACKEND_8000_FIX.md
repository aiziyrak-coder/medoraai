# Backend 404 muammosi (api/monitoring/... topilmadi)

## Sabab

**8000 portda boshqa Django loyihasi ("config") ishlashi mumkin.** Ushbu loyiha `api/v1/auth/`, `api/v1/articles/` kabi URL larga ega, **api/monitoring/** emas. Shuning uchun frontend 404 oladi.

## Yechim: Backend 8001 da

MedoraAI backend va frontend **8001** portdan foydalanadi (8000 dan farqli).

### 1. Backend ni ishga tushiring (8001)

**PowerShell:**
```powershell
cd E:\medoraai\backend
.\run_backend.ps1
```

**Yoki CMD:**
```cmd
cd E:\medoraai\backend
run_backend.bat
```

**Yoki qo'lda:**
```powershell
cd E:\medoraai\backend
$env:DJANGO_SETTINGS_MODULE = 'medoraai_backend.settings'
python manage.py runserver 0.0.0.0:8001
```

### 2. Tekshiring

- http://localhost:8001/ → `{"message": "MedoraAI Backend API", ...}`
- http://localhost:8001/health/ → `{"status": "ok", ...}`

Frontend (Vite) development rejimida avtomatik **http://localhost:8001/api** ga so'rov yuboradi.

### 3. 8000 ni ishlatmoqchi bo'lsangiz

8000 portni boshqa dastur band qilmasa, backend ni 8000 da ishga tushiring va frontend `.env` da `VITE_API_BASE_URL=http://localhost:8000/api` qiling; keyin Vite ni qayta ishga tushiring.
