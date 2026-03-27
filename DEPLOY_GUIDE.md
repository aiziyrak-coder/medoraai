# 🚀 MedoraAI - Deploy Qo'llanma

## Avtomatik Deploy (Tavsiya etiladi)

### Windows PowerShell orqali:
```powershell
cd e:\medoraai
.\DEPLOY_AUTO.ps1
```

### WSL yoki Git Bash orqali:
```bash
cd /mnt/e/medoraai/deploy
bash quick-deploy.sh
```

## Manual Deploy (Agar avtomatik ishlamasa)

### 1️⃣ GitHub ga push:
```bash
cd e:\medoraai
git add .
git commit -m "Production deploy"
git push origin main
```

### 2️⃣ Serverga SSH:
```bash
ssh root@167.71.53.238
# Password: Ziyrak2025Ai
```

### 3️⃣ Serverda buyruqlar:

```bash
# Project papkasiga o'tish
cd /root/AiDoktorai

# Yangiliklarni olish
git pull origin main

# Backend .env faylini yangilash
cd /root/AiDoktorai/backend
cat > .env << 'EOF'
SECRET_KEY=django-insecure-AiDoktorai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,AiDoktorapi.fargana.uz,AiDoktor.fargana.uz,AiDoktor.ziyrak.org,AiDoktorapi.ziyrak.org,20.82.115.71,167.71.53.238,medora.cdcgroup.uz,medoraapi.cdcgroup.uz

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://AiDoktor.fargana.uz,https://AiDoktorapi.fargana.uz,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz

DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/AiDoktorai/backend/db.sqlite3

GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview

TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
EOF

# Virtual environment faollashtirish
source venv/bin/activate

# Dependencies
pip install -r requirements.txt --quiet

# Migrations
python manage.py migrate --noinput

# Gunicorn restart
pkill -f gunicorn || true
sleep 2

cd /root/AiDoktorai/backend
source venv/bin/activate
nohup gunicorn AiDoktorai_backend.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --threads 2 \
    --timeout 120 \
    --access-logfile logs/access.log \
    --error-logfile logs/error.log \
    >> logs/gunicorn.log 2>&1 &

sleep 3

# Nginx reload
sudo nginx -t
sudo systemctl reload nginx

# Health check
curl -s http://127.0.0.1:8001/health/
```

## ✅ Tekshirish

### URL lar:
- Frontend: https://medora.cdcgroup.uz/
- Backend API: https://medoraapi.cdcgroup.uz/api/
- Admin Panel: https://medoraapi.cdcgroup.uz/admin/

### Log lar:
```bash
# Django log
tail -f /root/AiDoktorai/backend/logs/django.log

# Gunicorn log
tail -f /root/AiDoktorai/backend/logs/gunicorn.log

# Nginx error log
tail -f /var/log/nginx/error.log

# Nginx access log
tail -f /var/log/nginx/access.log
```

### Status tekshirish:
```bash
# Gunicorn status
ps aux | grep gunicorn

# Nginx status
systemctl status nginx

# Port 8001 tinglayaptimi?
netstat -tlnp | grep 8001
```

## 🔧 Muammolarni hal qilish

### Agar Gunicorn ishmasa:
```bash
cd /root/AiDoktorai/backend
source venv/bin/activate
gunicorn AiDoktorai_backend.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --timeout 120
```

### Agar Nginx xato bersa:
```bash
sudo nginx -t
# Xatoni to'g'rilash
sudo systemctl restart nginx
```

### Port 8001 band bo'lsa:
```bash
# Eski jarayonni o'ldirish
lsof -ti:8001 | xargs kill -9

# Yoki
pkill -f gunicorn
```

## 📊 Monitoring

### Real-time monitoring:
```bash
# CPU va xotira
htop

# Disk joy
df -h

# Eng katta fayllar
du -ah /root/AiDoktorai | sort -rh | head -20
```

### Log analiz:
```bash
# Oxirgi 100 qator
tail -100 /root/AiDoktorai/backend/logs/django.log

# Xatolar
grep -i error /root/AiDoktorai/backend/logs/django.log | tail -20

# Bugungi hodisalar
grep "$(date '+%Y-%m-%d')" /root/AiDoktorai/backend/logs/django.log
```

## 🎯 Tezkor Restart

Barcha xizmatlarni restart qilish:
```bash
cd /root/AiDoktorai/deploy
bash quick-restart.sh
```

Yoki manual:
```bash
# Gunicorn restart
pkill -f gunicorn
cd /root/AiDoktorai/backend
source venv/bin/activate
nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 &

# Nginx restart
sudo systemctl restart nginx
```

---
**Server**: 167.71.53.238  
**User**: root  
**Password**: Ziyrak2025Ai  
**Project**: /root/AiDoktorai
