# 🚀 TO'LIQ AVTOMATIK DEPLOY - Mening Ishtirokimsiz!

## ✅ Barcha Ishlar Avtomatik

### 1-Qadam: GitHub ga Push (Avtomatik)
```bash
cd e:\medoraai
git add .
git commit -m "Production deploy"
git push origin main
```

### 2-Qadam: Serverga Deploy (Bitta Buyruq)

**Windows PowerShell:**
```powershell
ssh root@167.71.53.238 "bash -s" < E:\medoraai\deploy\auto-deploy-now.sh
```
**Password:** `Ziyrak2025Ai`

---

## 🎯 Agar PowerShell ishlamasa (Manual SSH)

### 1. Serverga ulanish:
```bash
ssh root@167.71.53.238
# Password: Ziyrak2025Ai
```

### 2. Bu buyruqni copy-paste qiling (HAMMASINI BIRDA):

```bash
cd /root/AiDoktorai && git pull origin main && cd backend && cat > .env << 'EOF'
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
source venv/bin/activate && pip install -r requirements.txt --quiet && python manage.py migrate --noinput && pkill -f gunicorn || true && sleep 2 && nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 --threads 2 --timeout 120 >> logs/gunicorn.log 2>&1 & sleep 3 && sudo nginx -t && sudo systemctl reload nginx && echo "✅ DEPLOY COMPLETED!" && curl -s http://127.0.0.1:8001/health/
```

---

## ⚡ Tezkor Restart (Agar faqat restart kerak bo'lsa)

```bash
ssh root@167.71.53.238 "pkill -f gunicorn; sleep 2; cd /root/AiDoktorai/backend && source venv/bin/activate && nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 >> logs/gunicorn.log 2>&1 & sleep 3 && sudo nginx -t && sudo systemctl reload nginx && echo '✅ RESTARTED!'"
```

Password: `Ziyrak2025Ai`

---

## 📊 Status Tekshirish

```bash
ssh root@167.71.53.238 "ps aux | grep gunicorn | grep -v grep | wc -l | xargs echo 'Gunicorn workers:'; systemctl is-active nginx | xargs echo 'Nginx status:'; netstat -tlnp | grep 8001 | wc -l | xargs echo 'Port 8001:'"
```

---

## 🌐 URL Manzillar

| Sayt | URL |
|------|-----|
| **Frontend** | https://medora.cdcgroup.uz/ |
| **Backend API** | https://medoraapi.cdcgroup.uz/api/ |
| **Admin Panel** | https://medoraapi.cdcgroup.uz/admin/ |
| **Health Check** | https://medoraapi.cdcgroup.uz/api/health/ |

---

## 🎯 Eng Oson Usul (1 ta fayl)

`DEPLOY.bat` ni ishga tushiring:
```cmd
e:\medoraai\DEPLOY.bat
```

Keyin ko'rsatilgan buyruqni serverda bajaring.

---

**📞 AGAR MUAMMO BO'LSA:**

Serverga SSH orqali ulaning va loglarni tekshiring:
```bash
ssh root@167.71.53.238
tail -f /root/AiDoktorai/backend/logs/django.log
tail -f /root/AiDoktorai/backend/logs/gunicorn.log
tail -f /var/log/nginx/error.log
```

---

**🚀 HAMMASI TAYYOR! F AQ AT 1 TA BUYR UQNI BAJARING!**
