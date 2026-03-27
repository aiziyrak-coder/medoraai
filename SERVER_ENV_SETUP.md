# Serverda API kalitlarni joylash (AiDoktor.fargana.uz / AiDoktorapi.fargana.uz)

Serverda **ikki joyda** `.env` fayllari bo‘lishi kerak.

---

## 0. SQLite: "attempt to write a readonly database" bo‘lsa

Backend **www-data** hisobi ostida ishlaydi. SQLite (db.sqlite3) va backend papkasi unga **yozish huquqi** bilan berilishi kerak:

```bash
sudo chown -R www-data:www-data /var/www/AiDoktorai/backend
sudo chmod 664 /var/www/AiDoktorai/backend/db.sqlite3
sudo chmod 775 /var/www/AiDoktorai/backend
sudo systemctl restart AiDoktorai-backend
```

Shundan keyin ro‘yxatdan o‘tish/kirish ishlashi kerak.

---

## 1. Backend uchun (Django / Gunicorn)

**Joyi:** `/var/www/AiDoktorai/backend/.env`

Backend ishga tushganda shu papkadan ishlaydi, shuning uchun kalitlar shu yerda bo‘lishi kerak.

```bash
sudo nano /var/www/AiDoktorai/backend/.env
```

**Fayl ichiga (barcha kalitlarni o‘zingizniki bilan almashtiring):**

```env
# Django
SECRET_KEY=your-very-long-random-secret-key-change-this
DEBUG=False
ALLOWED_HOSTS=AiDoktorapi.fargana.uz,127.0.0.1,localhost

# CORS  -  frontend manzili
CORS_ALLOWED_ORIGINS=https://AiDoktor.fargana.uz,http://localhost:3000

# Ma'lumotlar bazasi (SQL — serverda saqlanadi, restart dan keyin ham)
DB_ENGINE=django.db.backends.sqlite3
# To'liq path: serverda restart dan keyin ma'lumot yo'qolmasin (masalan: /root/medoraai/backend/db.sqlite3)
DB_NAME=/root/medoraai/backend/db.sqlite3

# AI (Gemini)
GEMINI_API_KEY=your-gemini-api-key-here
AI_MODEL_DEFAULT=gemini-1.5-pro

# Telegram (to‘lov xabarnomalari  -  ixtiyoriy)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_PAYMENT_GROUP_ID=-1001234567890

# Redis
REDIS_URL=redis://localhost:6379/1
```

**Xavfsizlik:** Fayl faqat serverda bo‘lsin, Gitga commit qilmaymiz. Ruxsatni tekshirish:

```bash
sudo chown www-data:www-data /var/www/AiDoktorai/backend/.env
sudo chmod 600 /var/www/AiDoktorai/backend/.env
```

Backendni qayta ishga tushirish:

```bash
sudo systemctl restart AiDoktorai-backend
```

---

## 2. Frontend build uchun (Vite  -  build paytida)

**Joyi:** `/var/www/AiDoktorai/.env.production`

Frontend `npm run build` **loyiha root**idan (ya’ni `/var/www/AiDoktorai`) env o‘qiydi, shuning uchun fayl **root**da bo‘lishi kerak: `/var/www/AiDoktorai/.env.production`.

```bash
sudo nano /var/www/AiDoktorai/.env.production
```

**Fayl ichiga:**

```env
# Gemini  -  frontend build paytida bundle’ga yoziladi (AI brauzerda ishlashi uchun)
GEMINI_API_KEY=your-gemini-api-key-here

# Yoki: VITE_GEMINI_API_KEY=your-gemini-api-key-here

# Backend API manzili (production)
VITE_API_BASE_URL=https://AiDoktorapi.fargana.uz/api
```

Keyin build:

```bash
cd /var/www/AiDoktorai/frontend
npm run build
```

Builddan keyin `dist/` yangilangan bo‘ladi va brauzerda API kalit ishlatiladi.

**Eslatma:** Bir xil Gemini kalitini backend va frontend uchun ishlatishingiz mumkin; kalitni faqat serverdagi `.env` fayllarida saqlang, Gitga yuklamang.

---

## Qisqacha

| Qayerda        | Fayl yo‘li                           | Vazifasi                    |
|----------------|--------------------------------------|-----------------------------|
| Backend        | `/var/www/AiDoktorai/backend/.env`     | Django/Gunicorn kalitlari   |
| Frontend build | `/var/www/AiDoktorai/.env.production`  | Build paytida GEMINI, API URL |

Barcha API kalitlarni (Gemini, Telegram, SECRET_KEY va hokazo) **faqat serverdagi** shu ikki faylga yozing; repoda faqat `.env.example` bo‘lsin, ichida haqiqiy kalitlar bo‘lmasin.
-NoNewline
