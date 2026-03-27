# 🚀 START HERE - Complete Deployment Guide

## ✅ All Files Ready on GitHub!

---

## 🎯 TWO SIMPLE OPTIONS TO DEPLOY:

### **OPTION 1: Double-Click Deploy(Windows)**

1. **Double-click this file:** `DEPLOY.bat`
2. It will try to connect and deploy automatically
3. If it fails, follow the manual instructions shown

---

### **OPTION 2: Copy-Paste Deploy (Most Reliable)**

#### **Step 1: Open Terminal**
Press `Win + R`, type: `ssh root@167.71.53.238`
Press Enter

#### **Step 2: Enter Password**
```
Ziyrak2025Ai
```

#### **Step 3: Copy This ENTIRE Command and Paste:**

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
source venv/bin/activate && pip install -r requirements.txt --quiet && python manage.py migrate --noinput && pkill -f gunicorn || true && sleep 2 && nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 >> logs/gunicorn.log 2>&1 & sleep 3 && sudo nginx -t && sudo systemctl reload nginx && sleep 3 && curl http://127.0.0.1:8001/health/ && echo "" && echo "✅ DEPLOYMENT COMPLETE!" && echo "Test: https://AiDoktorapi.fargana.uz/"
```

**Press Enter** and wait 2-3 minutes.

---

## 🧪 AFTER DEPLOYMENT - TEST REGISTRATION:

### **Option A: Test via Browser**
1. Go to: https://AiDoktor.fargana.uz/
2. Click "Register"
3. Fill in:
   - Phone: `+998901234567`
   - Name: Your name
   - Password: `testpass123`
   - Role: **Monitoring**
4. Click Register- Should work! ✅

### **Option B: Test via Command**
```bash
curl -X POST https://AiDoktorapi.fargana.uz/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "name": "Monitoring User",
    "password": "testpass123",
    "password_confirm": "testpass123",
    "role": "monitoring"
  }'
```

**Expected Response:**
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

---

## 📊 WHAT GETS DEPLOYED:

✅ Latest code from GitHub  
✅ `.env` file with ALL correct domains  
✅ Python dependencies installed  
✅ Database migrated  
✅ Gunicorn restarted  
✅ Nginx reloaded  
✅ Health checks run  

---

## 🔧 IF SOMETHING GOES WRONG:

### **Check Server Status:**
```bash
ssh root@167.71.53.238
# Password: Ziyrak2025Ai

# Check if running
ps aux | grep gunicorn

# Check logs
tail -f /root/AiDoktorai/backend/logs/django.log

# Quick restart
cd /root/AiDoktorai/deploy
./quick-restart.sh
```

---

## 📁 FILES CREATED (All on GitHub):

1. **DEPLOY.bat** - Windows one-click deployer
2. **DEPLOY_COMPLETE_SCRIPT.sh** - Full bash script for server
3. **FIX_REGISTRATION_400_ERROR.md** - Error troubleshooting
4. **COMPLETE_DEPLOYMENT_GUIDE.md** - Complete reference
5. **deploy-test.sh** - Interactive deployment
6. **quick-restart.sh** - Fast restart only

---

## 🎯 RECOMMENDED:

**Use Option 2 (Copy-Paste)** - It's the most reliable!

Just:
1. SSH to server
2. Paste the long command
3. Wait 2-3 minutes
4. Test registration

**That's it!** 🎉

---

**Server Info:**
- Host: 167.71.53.238
- User: root
- Password: Ziyrak2025Ai
- Project: /root/AiDoktorai

**Test URLs After Deploy:**
- https://AiDoktorapi.fargana.uz/
- https://AiDoktorapi.fargana.uz/admin/
- https://AiDoktor.fargana.uz/

---

**Last Updated:** March 11, 2026  
**Status:** ✅ Ready to Deploy
-NoNewline
