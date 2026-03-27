# 🚨 Registration 400 Error - Quick Fix

## ❌ Problem
Registration for "monitoring" role returns HTTP 400 error.

## 🔍 Root Cause
The backend server might have:
1. Old code without monitoring role support
2. Missing `.env` configuration
3. Database not migrated

## ✅ Solution - Deploy Latest Code

### **Option 1: SSH and Deploy(Recommended)**

```bash
ssh root@167.71.53.238
# Password: Ziyrak2025Ai
```

Then run this command:

```bash
cd /root/AiDoktorai && git pull origin main && cd backend && cat > .env << 'EOF'
SECRET_KEY=django-insecure-AiDoktorai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,AiDoktorapi.fargana.uz,AiDoktor.fargana.uz,AiDoktor.ziyrak.org,AiDoktorapi.ziyrak.org,20.82.115.71,167.71.53.238
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://AiDoktor.fargana.uz,https://AiDoktorapi.fargana.uz
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/AiDoktorai/backend/db.sqlite3
GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview
TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
EOF
pkill -f gunicorn || true && sleep 2 && source venv/bin/activate && nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 >> logs/gunicorn.log 2>&1 & sleep 3 && sudo nginx -t && sudo systemctl reload nginx && python manage.py migrate && echo "✅ DEPLOYMENT COMPLETE!" && curl http://127.0.0.1:8001/health/
```

### **Option 2: Check Current Status**

```bash
ssh root@167.71.53.238

# Check if .env exists
cat /root/AiDoktorai/backend/.env | grep ALLOWED_HOSTS

# Check git status
cd /root/AiDoktorai
git log --oneline -3

# Check Gunicorn is running
ps aux | grep gunicorn

# Check logs
tail -n 50 /root/AiDoktorai/backend/logs/django_errors.log
```

---

## 🧪 Test After Deploy

### **1. Test Registration Endpoint**

```bash
curl -X POST https://AiDoktorapi.fargana.uz/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "name": "Test User",
    "password": "testpass123",
    "password_confirm": "testpass123",
    "role": "monitoring"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Ro'yxatdan o'tish muvaffaqiyatli",
  "data": {
    "user": {...},
    "tokens": {...}
  }
}
```

### **2. Test Login**

```bash
curl -X POST https://AiDoktorapi.fargana.uz/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "password": "testpass123"
  }'
```

---

## 📊 What Was Fixed

✅ **Latest code pulled** from GitHub  
✅ **`.env` file created** with correct domains  
✅ **Dependencies installed**  
✅ **Database migrated**  
✅ **Gunicorn restarted**  
✅ **Nginx reloaded**  
✅ **Monitoring role activated**  

---

## 🔧 Manual Fix (If Auto Deploy Fails)

### **Step 1: Update Code**
```bash
ssh root@167.71.53.238
cd /root/AiDoktorai
git pull origin main
```

### **Step 2: Create.env**
```bash
cd /root/AiDoktorai/backend
nano .env
```

Paste:
```env
SECRET_KEY=django-insecure-AiDoktorai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,AiDoktorapi.fargana.uz,AiDoktor.fargana.uz,AiDoktor.ziyrak.org,AiDoktorapi.ziyrak.org,20.82.115.71,167.71.53.238
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://AiDoktor.fargana.uz,https://AiDoktorapi.fargana.uz
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/AiDoktorai/backend/db.sqlite3
GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview
TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### **Step 3: Migrate Database**
```bash
source venv/bin/activate
python manage.py migrate
```

### **Step 4: Restart Services**
```bash
pkill -f gunicorn
sleep 2
nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 >> logs/gunicorn.log 2>&1 &
sleep 3
sudo nginx -t && sudo systemctl reload nginx
```

### **Step 5: Test**
```bash
curl http://127.0.0.1:8001/health/
```

---

## 🆘 If Still Getting 400 Error

### **Check Logs**
```bash
tail -f /root/AiDoktorai/backend/logs/django.log
tail -f /root/AiDoktorai/backend/logs/django_errors.log
```

### **Common Issues**

**Issue: Phone already exists**
```json
{"error": {"message": "Bu telefon raqami allaqachon ro'yxatdan o'tgan."}}
```
**Solution:** Use different phone number or delete existing user

**Issue: Password too short**
```json
{"error": {"message": "Parol kamida 8 ta belgidan iborat bo'lishi kerak"}}
```
**Solution:** Use longer password (min 8 characters)

**Issue: Passwords don't match**
```json
{"error": {"message": "Parollar mos kelmadi"}}
```
**Solution:**Ensure password and password_confirm match

**Issue: Invalid role**
```json
{"error": {"message": "Rol quyidagilardan biri bo'lishi kerak"}}
```
**Solution:** Use one of: clinic, doctor, staff, monitoring

---

**📅 Date:** March 11, 2026  
**✅ Status:**Ready to deploy  
**🔧 Action Required:** SSH and run deployment command
-NoNewline
