# Bozorga chiqishdan oldin tekshiruv ro‘yxati

## Xavfsizlik
- [x] Backend: production da DEBUG=False, SECRET_KEY o‘rnatilgan
- [x] Backend: 5xx xatolarda foydalanuvchiga ichki tafsilot ko‘rsatilmaydi
- [x] Backend: SECURE_PROXY_SSL_HEADER (Nginx orqada)
- [x] Frontend: Auth form maydonlari id/name va label (accessibility)
- [ ] Serverda: `.env` va `.env.production` da haqiqiy kalitlar, Gitga kirmasin

## Backend (server)
- [ ] `python manage.py migrate`
- [ ] `python manage.py createsuperuser` yoki `python create_superuser.py`
- [ ] SQLite: `chown www-data:www-data backend/db.sqlite3` va backend papkasi
- [ ] `systemctl restart medoraai-backend`
- [ ] Health: `curl https://medoraapi.cdcgroup.uz/health/`

## Frontend (server)
- [ ] `/var/www/medoraai/.env.production` da GEMINI_API_KEY va VITE_API_BASE_URL
- [ ] `cd frontend && npm install && npm run build`
- [ ] Brauzerda: https://medora.cdcgroup.uz ochilishi, login/register ishlashi

## Foydalanuvchi tajribasi
- [x] Brauzer orqaga – SPA ichida qoladi
- [x] Parol maydoni – ko‘rsatish/yashirish tugmasi
- [x] Label va ogohlantirish matnlari – kontrast (o‘qilishi oson)
- [x] Tailwind: text-primary / text-secondary (ranglar ishlashi)
- [x] Gemini xato – foydalanuvchiga tushunarli xabar (server yo‘li yashirin)

## Ixtiyoriy (keyingi qadamlar)
- [ ] Error tracking (masalan Sentry)
- [ ] Backup: db.sqlite3 va .env nusxalari
- [ ] Monitoring: uptime, loglar
