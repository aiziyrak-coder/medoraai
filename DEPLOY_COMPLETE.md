# 🚀 To'liq Deploy Qo'llanmasi - AiDoktor

Ushbu qo'llanma dasturni **production'ga deploy qilish** uchun barcha qadamlar.

---

## 📋 Deploy Oldidan Tekshiruv

### 1. Lokal Test
```powershell
# Barcha testlarni avtomatik bajaradi
.\test-local.ps1
```

Yoki qo'lda:
```powershell
# Backend health
curl http://localhost:8000/health/

# Frontend build
cd frontend
npm run build
```

**Barcha testlar muvaffaqiyatli bo'lishi kerak!**

---

## 🔧 Production Environment Setup

### 1. Server Requirements
- **OS**: Ubuntu 22.04+ yoki Windows Server
- **Python**: 3.11+
- **Node.js**: 18+
- **Database**: PostgreSQL 14+ (tavsiya) yoki SQLite (kichik loyihalar)
- **Web Server**: Nginx yoki Caddy
- **WSGI Server**: Gunicorn
- **Process Manager**: systemd (Linux) yoki PM2 (Windows)

### 2. Server Preparation

#### Linux (Ubuntu)
```bash
# System update
sudo apt update && sudo apt upgrade -y

# Python
sudo apt install python3.11 python3.11-venv python3-pip -y

# PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Nginx
sudo apt install nginx -y

# Node.js (nvm orqali)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Redis (caching uchun)
sudo apt install redis-server -y
```

#### Windows Server
- Python 3.11+ o'rnatilgan bo'lishi kerak
- PostgreSQL yoki SQLite
- IIS yoki Nginx
- Node.js 18+

---

## 📦 Backend Deploy

### 1. Code Deployment
```bash
# Server'ga kod yuklash (Git orqali)
git clone https://github.com/your-repo/AiDoktorai.git
cd AiDoktorai/backend

# Virtual environment
python3.11 -m venv venv
source venv/bin/activate  # Linux
# venv\Scripts\activate   # Windows

# Dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration
```bash
# .env faylini yaratish
cp .env.example .env
nano .env  # yoki vim
```

**.env fayli (Production):**
```env
# CRITICAL - Production uchun o'zgartiring!
SECRET_KEY=your-very-strong-secret-key-here-generate-new-one
DEBUG=False
ALLOWED_HOSTS=AiDoktorai.uz,api.AiDoktorai.uz,www.AiDoktorai.uz

# Database (PostgreSQL)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=AiDoktorai_db
DB_USER=AiDoktorai_user
DB_PASSWORD=strong_password_here
DB_HOST=localhost
DB_PORT=5432

# CORS - Faqat o'z domeningiz!
CORS_ALLOWED_ORIGINS=https://AiDoktorai.uz,https://www.AiDoktorai.uz

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_PAYMENT_GROUP_ID=-1001234567890

# Redis (caching, rate limiting)
REDIS_URL=redis://localhost:6379/1

# Celery (ixtiyoriy)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

**SECRET_KEY yaratish:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 3. Database Setup
```bash
# PostgreSQL database yaratish
sudo -u postgres psql
CREATE DATABASE AiDoktorai_db;
CREATE USER AiDoktorai_user WITH PASSWORD 'strong_password_here';
ALTER ROLE AiDoktorai_user SET client_encoding TO 'utf8';
ALTER ROLE AiDoktorai_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE AiDoktorai_user SET timezone TO 'Asia/Tashkent';
GRANT ALL PRIVILEGES ON DATABASE AiDoktorai_db TO AiDoktorai_user;
\q

# Migrations
python manage.py migrate

# Superuser yaratish
python manage.py createsuperuser

# Obuna rejalari yaratish
python manage.py create_default_plans
```

### 4. Static Files
```bash
# Static files yig'ish
python manage.py collectstatic --noinput

# Logs papkasi
mkdir -p logs
chmod 755 logs
```

### 5. Gunicorn Setup

**gunicorn_config.py:**
```python
bind = "127.0.0.1:8000"
workers = 4
threads = 2
timeout = 120
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
accesslog = "-"
errorlog = "-"
loglevel = "info"
```

**Ishga tushirish:**
```bash
gunicorn AiDoktorai_backend.wsgi:application -c gunicorn_config.py
```

### 6. Systemd Service (Linux)

**/etc/systemd/system/AiDoktorai-backend.service:**
```ini
[Unit]
Description=AiDoktorAI Backend Gunicorn
After=network.target postgresql.service redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/AiDoktorai/backend
Environment="PATH=/path/to/AiDoktorai/backend/venv/bin"
ExecStart=/path/to/AiDoktorai/backend/venv/bin/gunicorn \
    AiDoktorai_backend.wsgi:application \
    -c gunicorn_config.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Ishga tushirish:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable AiDoktorai-backend
sudo systemctl start AiDoktorai-backend
sudo systemctl status AiDoktorai-backend
```

---

## 🌐 Frontend Deploy

### 1. Build
```bash
cd frontend

# Environment
cp .env.example .env.local
nano .env.local
```

**.env.local (Production):**
```env
VITE_API_BASE_URL=https://api.AiDoktorai.uz/api
# VITE_GEMINI_API_KEY - frontend'da kerak emas (backend orqali)
```

**Build:**
```bash
npm install
npm run build
# dist/ papkasi yaratiladi
```

### 2. Hosting Options

#### Option A: Nginx Static Files
```nginx
server {
    listen 80;
    server_name AiDoktorai.uz www.AiDoktorai.uz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name AiDoktorai.uz www.AiDoktorai.uz;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    root /path/to/AiDoktorai/dist;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Static assets caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Option B: Vercel/Netlify
1. GitHub'ga push qiling
2. Vercel/Netlify'ga ulang
3. Build command: `cd frontend && npm run build`
4. Output directory: `frontend/dist`
5. Environment variables: `VITE_API_BASE_URL`

---

## 🔒 SSL/HTTPS Setup

### Let's Encrypt (Certbot)
```bash
# Certbot o'rnatish
sudo apt install certbot python3-certbot-nginx -y

# SSL sertifikat olish
sudo certbot --nginx -d AiDoktorai.uz -d www.AiDoktorai.uz -d api.AiDoktorai.uz

# Avtomatik yangilanish
sudo certbot renew --dry-run
```

---

## 🔄 Nginx Configuration

**/etc/nginx/sites-available/AiDoktorai:**
```nginx
# Backend API
server {
    listen 80;
    server_name api.AiDoktorai.uz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.AiDoktorai.uz;
    
    ssl_certificate /etc/letsencrypt/live/api.AiDoktorai.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.AiDoktorai.uz/privkey.pem;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    
    # Backend proxy
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
    
    # Static files
    location /static/ {
        alias /path/to/AiDoktorai/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Media files
    location /media/ {
        alias /path/to/AiDoktorai/backend/media/;
        expires 7d;
    }
    
    # Health check
    location /health/ {
        proxy_pass http://127.0.0.1:8000/health/;
        access_log off;
    }
}

# Frontend
server {
    listen 80;
    server_name AiDoktorai.uz www.AiDoktorai.uz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name AiDoktorai.uz www.AiDoktorai.uz;
    
    ssl_certificate /etc/letsencrypt/live/AiDoktorai.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/AiDoktorai.uz/privkey.pem;
    
    root /path/to/AiDoktorai/dist;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable:**
```bash
sudo ln -s /etc/nginx/sites-available/AiDoktorai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📅 Cron Jobs

### Subscription Expiry Check
```bash
# Har kuni ertalab 2:00
0 2 * * * cd /path/to/AiDoktorai/backend && /path/to/venv/bin/python manage.py check_subscription_expiry >> /var/log/AiDoktorai-cron.log 2>&1
```

### Database Backup
```bash
# Har kuni ertalab 3:00
0 3 * * * pg_dump -U AiDoktorai_user -d AiDoktorai_db > /backups/AiDoktorai_$(date +\%Y\%m\%d).sql
```

### Log Rotation
```bash
# Haftada 1 marta
0 4 * * 0 find /path/to/AiDoktorai/backend/logs -name "*.log" -mtime +30 -delete
```

**Crontab o'rnatish:**
```bash
crontab -e
# Yuqoridagi qatorlarni qo'shing
```

---

## ✅ Post-Deployment Checklist

- [ ] Backend health check: `curl https://api.AiDoktorai.uz/health/`
- [ ] Frontend ochiladi: `https://AiDoktorai.uz`
- [ ] Login/Register ishlaydi
- [ ] API so'rovlar ishlaydi
- [ ] SSL sertifikat to'g'ri
- [ ] CORS to'g'ri sozlangan
- [ ] Database backup ishlaydi
- [ ] Logs yozilmoqda
- [ ] Monitoring ishlaydi

---

## 🔍 Monitoring

### Health Checks
```bash
# Basic
curl https://api.AiDoktorai.uz/health/

# Detailed
curl https://api.AiDoktorai.uz/health/detailed/
```

### Logs
```bash
# Backend logs
tail -f /path/to/AiDoktorai/backend/logs/django.log

# Error logs
tail -f /path/to/AiDoktorai/backend/logs/django_errors.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Systemd service logs
sudo journalctl -u AiDoktorai-backend -f
```

---

## 🆘 Troubleshooting

### Backend ishlamayapti
```bash
# Status tekshirish
sudo systemctl status AiDoktorai-backend

# Logs
sudo journalctl -u AiDoktorai-backend -n 50

# Qayta ishga tushirish
sudo systemctl restart AiDoktorai-backend
```

### Database xatolik
```bash
# Connection tekshirish
psql -U AiDoktorai_user -d AiDoktorai_db -c "SELECT 1;"

# Migrations
cd backend
python manage.py migrate
```

### Nginx xatolik
```bash
# Config test
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

---

## 📚 Qo'shimcha Resurslar

- `DEPLOYMENT_CHECKLIST.md` - Deploy checklist
- `PRODUCTION_READINESS.md` - Production tayyorlik
- `DEPLOY_LOCAL_TEST.md` - Lokal test qo'llanmasi
- `test-local.ps1` - Avtomatik test script

---

## ✅ Tayyor!

Dastur production'da ishlayapti! 🎉
-NoNewline
