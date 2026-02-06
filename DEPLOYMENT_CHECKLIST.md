# MedoraAI — Real Bozorga Chiqish Checklist

## ✅ Barcha Muammolar Hal Qilindi

Ushbu checklist **real bozorga chiqishdan oldin** barcha qadamlar ro'yxati.

---

## 1. Backend Setup

### 1.1 Environment Variables (.env)
```bash
# Muhim - Production'da o'zgartiring!
SECRET_KEY=your-very-strong-secret-key-here
DEBUG=False
ALLOWED_HOSTS=medoraai.uz,api.medoraai.uz

# Database (PostgreSQL)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=medoraai_db
DB_USER=medoraai_user
DB_PASSWORD=strong_password_here
DB_HOST=localhost
DB_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=https://medoraai.uz,https://www.medoraai.uz

# API Keys
GEMINI_API_KEY=your_gemini_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_PAYMENT_GROUP_ID=-1001234567890

# Redis (caching, rate limiting)
REDIS_URL=redis://localhost:6379/1
```

### 1.2 Database
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
python manage.py create_default_plans  # Obuna rejalari
python manage.py createsuperuser
```

### 1.3 Static Files
```bash
python manage.py collectstatic --noinput
```

### 1.4 Logs Directory
```bash
mkdir -p logs
chmod 755 logs
```

---

## 2. Frontend Setup

### 2.1 Environment Variables (.env.local)
```bash
VITE_API_BASE_URL=https://api.medoraai.uz/api
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 2.2 Build
```bash
cd frontend
npm install
npm run build
```

### 2.3 Bank Account Details
`frontend/src/components/SubscriptionPage.tsx` ichida `BANK_ACCOUNT` konstantasini yangilang:
- `bankName` — haqiqiy bank nomi
- `accountNumber` — haqiqiy hisob raqam
- `mfo` — MFO kodi
- `inn` — INN
- `receiver` — Qabul qiluvchi nomi

---

## 3. Server Configuration

### 3.1 Nginx Configuration
```nginx
server {
    listen 80;
    server_name api.medoraai.uz;
    
    # SSL redirect
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.medoraai.uz;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # Backend
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files
    location /static/ {
        alias /path/to/backend/staticfiles/;
        expires 30d;
    }
    
    # Media files
    location /media/ {
        alias /path/to/backend/media/;
        expires 7d;
    }
    
    # Health check
    location /health/ {
        proxy_pass http://127.0.0.1:8000/health/;
        access_log off;
    }
}
```

### 3.2 Gunicorn
```bash
gunicorn medoraai_backend.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 4 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
```

### 3.3 Systemd Service
`/etc/systemd/system/medoraai-backend.service`:
```ini
[Unit]
Description=MedoraAI Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/gunicorn medoraai_backend.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 4. Cron Jobs

### 4.1 Subscription Expiry Check
```bash
# Har kuni ertalab 2:00
0 2 * * * cd /path/to/backend && /path/to/venv/bin/python manage.py check_subscription_expiry >> /var/log/medoraai-cron.log 2>&1
```

### 4.2 Database Backup
```bash
# Har kuni ertalab 3:00
0 3 * * * pg_dump -U medoraai_user -d medoraai_db > /backups/medoraai_$(date +\%Y\%m\%d).sql
```

### 4.3 Log Rotation
```bash
# Haftada 1 marta
0 4 * * 0 find /path/to/backend/logs -name "*.log" -mtime +30 -delete
```

---

## 5. Monitoring

### 5.1 Health Checks
- **Basic:** `curl https://api.medoraai.uz/health/`
- **Detailed:** `curl https://api.medoraai.uz/health/detailed/`

### 5.2 Log Monitoring
```bash
# Real-time log monitoring
tail -f /path/to/backend/logs/django.log

# Error log monitoring
tail -f /path/to/backend/logs/django_errors.log
```

### 5.3 Server Monitoring
- CPU, RAM, Disk usage
- Database connection count
- Redis memory usage
- Nginx access/error logs

---

## 6. Security Checklist

- [ ] `DEBUG=False` production'da
- [ ] `SECRET_KEY` yangi, kuchli kalit
- [ ] `ALLOWED_HOSTS` faqat o'z domeningiz
- [ ] `CORS_ALLOWED_ORIGINS` faqat frontend domeni
- [ ] SSL sertifikat o'rnatilgan va ishlayapti
- [ ] Database paroli kuchli
- [ ] API kalitlar `.env` da (Git'ga commit qilinmagan)
- [ ] Firewall sozlangan (faqat kerakli portlar ochiq)
- [ ] SSH key-based authentication (parol emas)

---

## 7. Testing Checklist

- [ ] Health check endpoint'lar ishlayapti
- [ ] API endpoint'lar to'g'ri ishlayapti
- [ ] Authentication ishlayapti (login, register, token refresh)
- [ ] File upload ishlayapti va validation qo'llanilmoqda
- [ ] Subscription sahifasi ishlayapti (klinika va shifokor)
- [ ] Rate limiting ishlayapti (100 req/min test)
- [ ] Error handling ishlayapti (xatoliklar to'g'ri ko'rsatilmoqda)
- [ ] Frontend build muvaffaqiyatli
- [ ] Static fayllar yuklanmoqda

---

## 8. Post-Deployment

### 8.1 Birinchi kun
- [ ] Log fayllarini kuzatish
- [ ] Error'lar tekshirish
- [ ] Performance monitoring
- [ ] User feedback to'plash

### 8.2 Birinchi hafta
- [ ] Database backup'lar tekshirish
- [ ] Subscription expiry automation ishlayaptimi tekshirish
- [ ] Usage limits to'g'ri ishlayaptimi tekshirish
- [ ] Payment flow to'g'ri ishlayaptimi tekshirish

---

## Xulosa

Barcha asosiy muammolar hal qilindi va dastur **real bozorga chiqishga tayyor**!

Batafsil ma'lumot:
- `PRODUCTION_HARDENING.md` — Barcha muammolar va yechimlar
- `CRITICAL_ISSUES_FIXED.md` — Hal qilingan muammolar ro'yxati
- `PRODUCTION_READINESS.md` — Production deploy qo'llanmasi
