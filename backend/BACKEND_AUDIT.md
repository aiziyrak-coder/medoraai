# Backend — xavfsizlik va ishlash (yangilangan)

## Settings (`medoraai_backend/settings.py`)

- **ALLOWED_HOSTS:** `*` ishlatilmaydi. `.env` dagi `ALLOWED_HOSTS` (vergul bilan) yoki kod ichidagi default ro‘yxat (fjsti/medora domenlari, localhost).
- **Host tekshiruvi:** `get_host` patch yo‘q — noto‘g‘ri `Host` uchun Django `DisallowedHost` qaytarishi mumkin (to‘g‘ri nginx + ALLOWED_HOSTS bilan bo‘lmaydi).
- **DEBUG=False:** `SECRET_KEY` majburiy (default kalit bilan ishlamaydi). DRF faqat **JSON** renderer (Browsable API o‘chiq).
- **CORS / CSRF:** `.env` yoki default originlar; IP asosidagi default CORS olib tashlangan — kerak bo‘lsa `.env` orqali qo‘shing.

## WSGI (`wsgi.py`)

- Standart `get_wsgi_application()` — maxsus `DisallowedHost` yashirish yo‘q.

## Middleware (`middleware.py`)

- **EarlyHealthMiddleware:** `GET/OPTIONS /health` tez javob; `fargana.uz` → `medora.cdcgroup.uz` normalizatsiya. `ALLOWED_HOSTS` mutatsiyasi yo‘q.
- Boshqa middlewarelar: CORS fallback, security headers, rate limit, logging.

## Tekshiruv

- `python manage.py check`
- `DEBUG=False` + kuchli `SECRET_KEY`: `python manage.py check --deploy`
- CI: `.github/workflows/ci.yml`

## Serverda muhim

- `backend/.env`: `ALLOWED_HOSTS` ga barcha haqiqiy API domenlari (va kerak bo‘lsa IP) kiriting.
- FJSTI build uchun: `VITE_API_BASE_URL=https://fjstiapi.ziyrak.org/api` (`server-deploy.sh` `.env` dan o‘qiydi).
