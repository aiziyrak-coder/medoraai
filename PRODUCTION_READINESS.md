# MedoraAI — Bozorga Chiqish va Real Hayotda Ishga Tushirish Qo'llanmasi

Ushbu hujjat dasturni **real hayotda** ishga tushirish va **bozorga olib chiqish** uchun qilish kerak bo'lgan qadamlar ro'yxati.

---

## 1. Xavfsizlik (Muhim)

### 1.1 Maxfiy ma'lumotlar
- [ ] **SECRET_KEY** — Production uchun yangi, kuchli kalit yarating (`python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`).
- [ ] **GEMINI_API_KEY** — Faqat backend `.env` da; frontendda hech qachon saqlamang.
- [ ] **TELEGRAM_BOT_TOKEN** va **TELEGRAM_PAYMENT_GROUP_ID** — Faqat backend `.env` da (allaqachon backend orqali yuboriladi).
- [ ] Barcha kalitlarni `.env` orqali oling; `.env` faylini **hech qachon** Git ga commit qilmang (`.gitignore` da bor).

### 1.2 Production rejimi
- [ ] **DEBUG=False** — Serverda `DEBUG=False` qiling.
- [ ] **ALLOWED_HOSTS** — Faqat o'z domeningizni qo'shing, masalan: `medoraai.uz,api.medoraai.uz`.

### 1.3 HTTPS va cookie
- [ ] Domen uchun **SSL sertifikat** (masalan Let's Encrypt) o'rnating.
- [ ] Backend `DEBUG=False` da allaqachon `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` qo'llanadi (settings.py da mavjud).

### 1.4 CORS
- [ ] **CORS_ALLOWED_ORIGINS** — Faqat frontend domeningiz, masalan: `https://medoraai.uz,https://www.medoraai.uz`.

---

## 2. Ma'lumotlar bazasi

### 2.1 Production DB
- [ ] **PostgreSQL** ishlatish tavsiya etiladi (SQLite faqat development uchun).
- [ ] `.env` da: `DB_ENGINE=django.db.backends.postgresql`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`.
- [ ] Migratsiyalar: `python manage.py migrate`.
- [ ] Backup rejasi: kunlik/haftalik PostgreSQL backup (masalan cron + `pg_dump`).

---

## 3. Backend deploy

### 3.1 Server
- [ ] Linux server (Ubuntu 22.04 yoki shunga o'xshash) yoki PaaS (Render, Railway, DigitalOcean App Platform, AWS, yoki O'zbekiston provayderlari).
- [ ] Python 3.11+, virtualenv, `pip install -r backend/requirements.txt`.

### 3.2 WSGI server
- [ ] **Gunicorn** ishlatish (allaqachon requirements da):  
  `gunicorn medoraai_backend.wsgi:application --bind 0.0.0.0:8000 --workers 2`.
- [ ] Reverse proxy (Nginx yoki Caddy) — backend'ni `https://api.medoraai.uz` ga yo'naltirish, SSL ni proxy da hal qilish.

### 3.3 Static va media
- [ ] `python manage.py collectstatic --noinput` — static fayllar `STATIC_ROOT` ga.
- [ ] Nginx/Caddy da `STATIC_URL` va `MEDIA_URL` uchun alias sozlang; yoki WhiteNoise (static uchun allaqachon qo'shilgan).

### 3.4 Environment o'zgaruvchilari
- [ ] Barcha kalitlar va sozlamalar serverda `.env` yoki hosting panelidagi "Environment variables" orqali berilgan bo'lsin.

---

## 4. Frontend deploy

### 4.1 Build
- [ ] `VITE_API_BASE_URL` — production API manziliga o'rnating (masalan `https://api.medoraai.uz/api`).
- [ ] `npm run build` (yoki `pnpm build`) — `dist/` yoki loyiha konfiguratsiyasidagi output papkaga build.

### 4.2 Hosting
- [ ] Build natijasini CDN/hosting ga yuklang: Vercel, Netlify, Cloudflare Pages, yoki o'z serveringizda Nginx/Caddy orqali static fayllarni xizmat qilish.

### 4.3 PWA (ixtiyoriy)
- [ ] Service worker va manifest allaqachon mavjud; HTTPS da PWA to'liq ishlaydi.

---

## 5. Qo'shimcha xizmatlar

### 5.1 Parol tiklash
- [ ] **SMS** yoki **email** orqali parol tiklash: backend da `password_reset_request` uchun SMS/email provayder (Eskiz.uz, Twilio, SendGrid va hokazo) ulang.
- [ ] Token yoki link yuborish va yangi parol o'rnatish endpoint'i (agar hali bo'lmasa, qo'shing).

### 5.2 Monitoring va log
- [ ] Xatoliklar uchun monitoring (Sentry, LogRocket yoki server loglarini tahlil qilish).
- [ ] Backend loglari: `logging` sozlang (DEBUG=False da log level INFO yoki WARNING).

### 5.3 Rate limiting
- [ ] DRF throttle allaqachon yoqilgan (`anon`, `user`). Kerak bo'lsa limitlarni production uchun sozlang.

---

## 6. Tibbiy ma'lumotlar va qonuniy talablar

- [ ] **Shaxsiy ma'lumotlar** — Foydalanuvchi va bemor ma'lumotlari qayd etilishi va saqlanishi bo'yicha mahalliy qonunlar (O'zbekiston) va ichki siyosatni tekshiring.
- [ ] **Maxfiylik va foydalanish shartlari** — Saytda "Maxfiylik siyosati" va "Foydalanish shartlari" sahifalari bo'lsin; ro'yxatdan o'tishda rozilik oling (allaqachon AuthPage da bor).
- [ ] **Tibbiy maslahat disclaimer** — Tizim "tibbiy maslahat o'rniga bormaydi" degan ogohlantirish allaqachon hisobotlarda; buni bosh sahifada ham ko'rsatish mumkin.

---

## 7. Bozorga chiqish oldi tekshiruv

| Tekshiruv | Holat |
|-----------|--------|
| Barcha API kalitlar faqat backend'da | ✅ |
| Telegram token frontendda emas | ✅ |
| DEBUG=False production da | Qilish kerak |
| HTTPS yoqilgan | Qilish kerak |
| ALLOWED_HOSTS to'g'ri | Qilish kerak |
| CORS faqat o'z domeningiz | Qilish kerak |
| DB backup rejasi | Qo'shish kerak |
| Parol tiklash (SMS/email) | Qo'shish kerak |
| Monitoring / xatolik yig'ish | Tavsiya etiladi |
| Maxfiylik va foydalanish shartlari | Tekshirish kerak |

---

## 8. Tezkor ishga tushirish (minimal production)

1. **Server:** Ubuntu + Nginx + Gunicorn + PostgreSQL.
2. **Backend:**  
   - `.env` da: `SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, `DB_*`, `GEMINI_API_KEY`, `CORS_ALLOWED_ORIGINS`, `TELEGRAM_*` (agar kerak bo'lsa).  
   - `migrate`, `collectstatic`, Gunicorn ishga tushiring.
3. **Frontend:**  
   - `VITE_API_BASE_URL=https://api.medoraai.uz/api` bilan build qiling.  
   - Build ni Nginx da static sifatida xizmat qiling yoki Vercel/Netlify ga yuklang.
4. **Domen:** DNS da A/CNAME record, SSL (Let's Encrypt).
5. **Monitoring:** Kamida server va app loglarini kuzatish; ixtiyoriy Sentry.

---

## 9. Fayllar va manbalar

- **Backend sozlash:** `backend/README.md`, `backend/.env.example`
- **Frontend sozlash:** `frontend/.env.example`, `QUICK_START.md`
- **API ulanish:** `API_CONNECTION.md`, `INTEGRATION.md`

Xulosa: xavfsizlik (maxfiy ma'lumotlar, HTTPS, CORS), production DB va backup, parol tiklash va monitoring qo'shilsa, dasturni bozorga chiqarish uchun asos tayyor.
