# 🚀 Digital Ocean Deploy Qo'llanmasi - MEDORA AI

Ushbu qo'llanma Digital Ocean serverida dasturni deploy qilish uchun **qadamma-qadam** ko'rsatma.

---

## 📋 Oldindan Tayyorlash

### 1. GitHub Repository
- Repository: `https://github.com/aiziyrak-coder/medoraai`
- Kod GitHub'ga push qilingan bo'lishi kerak

### 2. Server Ma'lumotlari
- **Frontend Domain**: `medora.cdcgroup.uz`
- **Backend Domain**: `medoraapi.cdcgroup.uz`
- **Server IP**: (Digital Ocean droplet IP)

---

## 🔧 SERVERDA QILISH KERAK BO'LGAN QADAMLAR

### QADAM 1: Serverga Kirish va Yangi Papka Yaratish

```bash
# SSH orqali serverga kiring
ssh root@YOUR_SERVER_IP

# Yangi papka yaratish
mkdir -p /var/www/medoraai
cd /var/www/medoraai
```

---

### QADAM 2: Git va Dasturlarni O'rnatish

```bash
# System update
apt update && apt upgrade -y

# Git o'rnatish (agar yo'q bo'lsa)
apt install git -y

# Python 3.11+ o'rnatish
apt install python3.11 python3.11-venv python3-pip -y

# Node.js 18+ o'rnatish (nvm orqali)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# PostgreSQL o'rnatish
apt install postgresql postgresql-contrib -y

# Nginx o'rnatish
apt install nginx -y

# Redis o'rnatish (caching uchun)
apt install redis-server -y

# Gunicorn o'rnatish (Python paket sifatida)
pip3 install gunicorn
```

---

### QADAM 3: GitHub'dan Kodni Yuklab Olish

```bash
cd /var/www/medoraai

# GitHub'dan clone qilish
git clone https://github.com/aiziyrak-coder/medoraai.git .

# Yoki agar repository bo'sh bo'lsa, kodni boshqa usul bilan yuklang
```

---

### QADAM 4: Backend Setup

```bash
cd /var/www/medoraai/backend

# Virtual environment yaratish
python3.11 -m venv venv

# Virtual environmentni faollashtirish
source venv/bin/activate

# Dependencies o'rnatish
pip install -r requirements.txt

# .env faylini yaratish
cp .env.example .env
nano .env
```

**.env fayli (Production):**
```env
# CRITICAL - O'zgartiring!
SECRET_KEY=your-very-strong-secret-key-here-generate-new-one
DEBUG=False
ALLOWED_HOSTS=medoraapi.cdcgroup.uz,localhost,127.0.0.1

# Database (PostgreSQL)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=medoraai_db
DB_USER=medoraai_user
DB_PASSWORD=strong_password_here_change_this
DB_HOST=localhost
DB_PORT=5432

# CORS - Faqat frontend domeni!
CORS_ALLOWED_ORIGINS=https://medora.cdcgroup.uz,http://medora.cdcgroup.uz

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_PAYMENT_GROUP_ID=-1001234567890

# Redis
REDIS_URL=redis://localhost:6379/1
```

**SECRET_KEY yaratish:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

### QADAM 5: PostgreSQL Database Yaratish

```bash
# PostgreSQL'ga kirish
sudo -u postgres psql

# Database va user yaratish
CREATE DATABASE medoraai_db;
CREATE USER medoraai_user WITH PASSWORD 'strong_password_here';
ALTER ROLE medoraai_user SET client_encoding TO 'utf8';
ALTER ROLE medoraai_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE medoraai_user SET timezone TO 'Asia/Tashkent';
GRANT ALL PRIVILEGES ON DATABASE medoraai_db TO medoraai_user;
\q

# Migrations
cd /var/www/medoraai/backend
source venv/bin/activate
python manage.py migrate

# Superuser yaratish (admin uchun)
python manage.py createsuperuser
# Login: aiproduct
# Parol: 2026

# Obuna rejalari yaratish
python manage.py create_default_plans

# Static files yig'ish
python manage.py collectstatic --noinput

# Logs papkasi
mkdir -p logs
chmod 755 logs
```

---

### QADAM 6: Frontend Build

```bash
cd /var/www/medoraai/frontend

# .env.local yaratish
cp .env.example .env.local
nano .env.local
```

**.env.local (Production):**
```env
VITE_API_BASE_URL=https://medoraapi.cdcgroup.uz/api
```

**Build:**
```bash
npm install
npm run build
# dist/ papkasi yaratiladi
```

---

### QADAM 7: Gunicorn Configuration

```bash
cd /var/www/medoraai/backend
nano gunicorn_config.py
```

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

---

### QADAM 8: Systemd Service (Backend)

```bash
nano /etc/systemd/system/medoraai-backend.service
```

**/etc/systemd/system/medoraai-backend.service:**
```ini
[Unit]
Description=MedoraAI Backend Gunicorn
After=network.target postgresql.service redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/medoraai/backend
Environment="PATH=/var/www/medoraai/backend/venv/bin"
ExecStart=/var/www/medoraai/backend/venv/bin/gunicorn \
    medoraai_backend.wsgi:application \
    -c gunicorn_config.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Ishga tushirish:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable medoraai-backend
sudo systemctl start medoraai-backend
sudo systemctl status medoraai-backend
```

---

### QADAM 9: Nginx Configuration

#### Backend (medoraapi.cdcgroup.uz)

```bash
nano /etc/nginx/sites-available/medoraapi
```

**/etc/nginx/sites-available/medoraapi:**
```nginx
server {
    listen 80;
    server_name medoraapi.cdcgroup.uz;
    
    # SSL redirect (Let's Encrypt keyin qo'shiladi)
    # return 301 https://$server_name$request_uri;
    
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
        alias /var/www/medoraai/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Media files
    location /media/ {
        alias /var/www/medoraai/backend/media/;
        expires 7d;
    }
    
    # Health check
    location /health/ {
        proxy_pass http://127.0.0.1:8000/health/;
        access_log off;
    }
}
```

#### Frontend (medora.cdcgroup.uz)

```bash
nano /etc/nginx/sites-available/medora
```

**/etc/nginx/sites-available/medora:**
```nginx
server {
    listen 80;
    server_name medora.cdcgroup.uz;
    
    # SSL redirect (Let's Encrypt keyin qo'shiladi)
    # return 301 https://$server_name$request_uri;
    
    root /var/www/medoraai/frontend/dist;
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

**Enable qilish:**
```bash
ln -s /etc/nginx/sites-available/medoraapi /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/medora /etc/nginx/sites-enabled/

# Test va reload
nginx -t
systemctl reload nginx
```

---

### QADAM 10: DNS Sozlash

Digital Ocean DNS panelida yoki domen provayderingizda:

**A Records:**
- `medora.cdcgroup.uz` → Server IP
- `medoraapi.cdcgroup.uz` → Server IP

Yoki **CNAME** (agar subdomain bo'lsa):
- `medora` → `@` yoki asosiy domen
- `medoraapi` → `@` yoki asosiy domen

---

### QADAM 11: SSL Sertifikat (Let's Encrypt)

```bash
# Certbot o'rnatish
apt install certbot python3-certbot-nginx -y

# SSL sertifikat olish (Backend)
certbot --nginx -d medoraapi.cdcgroup.uz

# SSL sertifikat olish (Frontend)
certbot --nginx -d medora.cdcgroup.uz

# Avtomatik yangilanish
certbot renew --dry-run
```

Certbot avtomatik ravishda Nginx konfiguratsiyasini yangilaydi va HTTPS'ni yoqadi.

---

### QADAM 12: Firewall Sozlash

```bash
# UFW firewall
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

---

### QADAM 13: Cron Jobs (Subscription Expiry)

```bash
crontab -e
```

**Qo'shing:**
```bash
# Har kuni ertalab 2:00 - Subscription expiry check
0 2 * * * cd /var/www/medoraai/backend && /var/www/medoraai/backend/venv/bin/python manage.py check_subscription_expiry >> /var/log/medoraai-cron.log 2>&1

# Har kuni ertalab 3:00 - Database backup
0 3 * * * pg_dump -U medoraai_user -d medoraai_db > /backups/medoraai_$(date +\%Y\%m\%d).sql
```

---

## ✅ Tekshirish

### Backend
```bash
curl http://medoraapi.cdcgroup.uz/health/
# yoki
curl https://medoraapi.cdcgroup.uz/health/
```

### Frontend
```bash
curl http://medora.cdcgroup.uz
# yoki
curl https://medora.cdcgroup.uz
```

### Logs
```bash
# Backend logs
tail -f /var/www/medoraai/backend/logs/django.log

# Systemd service logs
journalctl -u medoraai-backend -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🔄 Yangilash (Update)

```bash
cd /var/www/medoraai

# Kodni yangilash
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
systemctl restart medoraai-backend

# Frontend
cd ../frontend
npm install
npm run build
systemctl reload nginx
```

---

## 🆘 Troubleshooting

### Backend ishlamayapti
```bash
systemctl status medoraai-backend
journalctl -u medoraai-backend -n 50
```

### Nginx xatolik
```bash
nginx -t
systemctl status nginx
```

### Database xatolik
```bash
sudo -u postgres psql -d medoraai_db -c "SELECT 1;"
```

---

## 📚 Qo'shimcha Ma'lumot

- **Backend Admin**: https://medoraapi.cdcgroup.uz/admin/
- **API Docs**: https://medoraapi.cdcgroup.uz/swagger/
- **Frontend**: https://medora.cdcgroup.uz

---

**Tayyor! Dastur production'da ishlayapti! 🎉**
