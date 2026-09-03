# 🖥️ SERVERDA DEPLOY QILISH - QADAMMA-QADAM

Ushbu qo'llanma **Digital Ocean serverida** dasturni deploy qilish uchun **siz qilishingiz kerak bo'lgan** barcha qadamlar.

---

## 📋 OLDINDAN TAYYORLASH

✅ Kod GitHub'ga push qilingan: https://github.com/aiziyrak-coder/AiDoktorai  
✅ Server IP va SSH access mavjud  
✅ Domenlar sozlangan:
   - `AiDoktor.fargana.uz`  ->  Frontend
   - `AiDoktorapi.fargana.uz`  ->  Backend

---

## 🔧 QADAM 1: SERVERGA KIRISH VA YANGI PAPKA

```bash
# SSH orqali serverga kiring
ssh root@YOUR_SERVER_IP

# Yangi papka yaratish
mkdir -p /var/www/AiDoktorai
cd /var/www/AiDoktorai
```

---

## 🔧 QADAM 2: DASTURLARNI O'RNATISH

```bash
# System update
apt update && apt upgrade -y

# Git (agar yo'q bo'lsa)
apt install git -y

# Python 3.11+
apt install python3.11 python3.11-venv python3-pip -y

# Node.js 18+ (nvm orqali)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# PostgreSQL
apt install postgresql postgresql-contrib -y

# Nginx
apt install nginx -y

# Redis
apt install redis-server -y

# Gunicorn
pip3 install gunicorn
```

---

## 🔧 QADAM 3: GITHUB'DAN KODNI YUKLAB OLISH

```bash
cd /var/www/AiDoktorai

# GitHub'dan clone qilish
git clone https://github.com/aiziyrak-coder/AiDoktorai.git .

# Tekshirish
ls -la
# backend/ va frontend/ papkalari ko'rinishi kerak
```

---

## 🔧 QADAM 4: BACKEND SETUP

```bash
cd /var/www/AiDoktorai/backend

# Virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Dependencies
pip install -r requirements.txt

# .env faylini yaratish
cp .env.example .env
nano .env
```

**.env faylini quyidagicha to'ldiring:**
```env
SECRET_KEY=GENERATE_NEW_STRONG_KEY_HERE
DEBUG=False
ALLOWED_HOSTS=AiDoktorapi.fargana.uz,localhost,127.0.0.1

DB_ENGINE=django.db.backends.postgresql
DB_NAME=AiDoktorai_db
DB_USER=AiDoktorai_user
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=https://AiDoktor.fargana.uz,http://AiDoktor.fargana.uz

GEMINI_API_KEY=your_gemini_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_PAYMENT_GROUP_ID=-1001234567890

REDIS_URL=redis://localhost:6379/1
```

**SECRET_KEY yaratish:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## 🔧 QADAM 5: POSTGRESQL DATABASE

```bash
# PostgreSQL'ga kirish
sudo -u postgres psql

# Database yaratish
CREATE DATABASE AiDoktorai_db;
CREATE USER AiDoktorai_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
ALTER ROLE AiDoktorai_user SET client_encoding TO 'utf8';
ALTER ROLE AiDoktorai_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE AiDoktorai_user SET timezone TO 'Asia/Tashkent';
GRANT ALL PRIVILEGES ON DATABASE AiDoktorai_db TO AiDoktorai_user;
\q

# Migrations
cd /var/www/AiDoktorai/backend
source venv/bin/activate
python manage.py migrate

# Superuser (admin uchun)
python manage.py createsuperuser
# Login: aiproduct
# Parol: 2026

# Obuna rejalari
python manage.py create_default_plans

# Static files
python manage.py collectstatic --noinput

# Logs papkasi
mkdir -p logs
chmod 755 logs
```

---

## 🔧 QADAM 6: FRONTEND BUILD

```bash
cd /var/www/AiDoktorai/frontend

# .env.local yaratish
cp .env.example .env.local
nano .env.local
```

**.env.local:**
```env
VITE_API_BASE_URL=https://AiDoktorapi.fargana.uz/api
```

**Build:**
```bash
npm install
npm run build
# dist/ papkasi yaratiladi
```

---

## 🔧 QADAM 7: GUNICORN CONFIG

```bash
cd /var/www/AiDoktorai/backend
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

## 🔧 QADAM 8: SYSTEMD SERVICE

```bash
nano /etc/systemd/system/AiDoktorai-backend.service
```

**/etc/systemd/system/AiDoktorai-backend.service:**
```ini
[Unit]
Description=AiDoktorAI Backend Gunicorn
After=network.target postgresql.service redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/AiDoktorai/backend
Environment="PATH=/var/www/AiDoktorai/backend/venv/bin"
ExecStart=/var/www/AiDoktorai/backend/venv/bin/gunicorn \
    AiDoktorai_backend.wsgi:application \
    -c gunicorn_config.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Ishga tushirish:**
```bash
systemctl daemon-reload
systemctl enable AiDoktorai-backend
systemctl start AiDoktorai-backend
systemctl status AiDoktorai-backend
```

---

## 🔧 QADAM 9: NGINX CONFIGURATION

### Backend (AiDoktorapi.fargana.uz)

```bash
nano /etc/nginx/sites-available/AiDoktorapi
```

**/etc/nginx/sites-available/AiDoktorapi:**
```nginx
server {
    listen 80;
    server_name AiDoktorapi.fargana.uz;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
    
    location /static/ {
        alias /var/www/AiDoktorai/backend/staticfiles/;
        expires 30d;
    }
    
    location /media/ {
        alias /var/www/AiDoktorai/backend/media/;
        expires 7d;
    }
    
    location /health/ {
        proxy_pass http://127.0.0.1:8000/health/;
        access_log off;
    }
}
```

### Frontend (AiDoktor.fargana.uz)

```bash
nano /etc/nginx/sites-available/AiDoktor
```

**/etc/nginx/sites-available/AiDoktor:**
```nginx
server {
    listen 80;
    server_name AiDoktor.fargana.uz;
    
    root /var/www/AiDoktorai/frontend/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable qilish:**
```bash
ln -s /etc/nginx/sites-available/AiDoktorapi /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/AiDoktor /etc/nginx/sites-enabled/

nginx -t
systemctl reload nginx
```

---

## 🔧 QADAM 10: DNS SOZLASH

Digital Ocean DNS panelida yoki domen provayderingizda:

**A Records:**
- `AiDoktor.fargana.uz`  ->  Server IP
- `AiDoktorapi.fargana.uz`  ->  Server IP

---

## 🔧 QADAM 11: SSL SERTIFIKAT (Let's Encrypt)

```bash
# Certbot
apt install certbot python3-certbot-nginx -y

# Backend SSL
certbot --nginx -d AiDoktorapi.fargana.uz

# Frontend SSL
certbot --nginx -d AiDoktor.fargana.uz

# Avtomatik yangilanish
certbot renew --dry-run
```

---

## 🔧 QADAM 12: FIREWALL

```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

---

## ✅ TEKSHIRISH

```bash
# Backend
curl http://AiDoktorapi.fargana.uz/health/

# Frontend
curl http://AiDoktor.fargana.uz

# Logs
tail -f /var/www/AiDoktorai/backend/logs/django.log
journalctl -u AiDoktorai-backend -f
```

---

## 🔄 YANGILASH (Update)

```bash
cd /var/www/AiDoktorai
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
systemctl restart AiDoktorai-backend

# Frontend
cd ../frontend
npm install
npm run build
systemctl reload nginx
```

---

**Tayyor! Dastur production'da ishlayapti! 🎉**
-NoNewline
