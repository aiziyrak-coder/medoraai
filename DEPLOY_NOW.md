# 🚀 Quick Deploy - Simple Instructions

## ✅ All Files Pushed to GitHub!

Your code and all deployment scripts are now on GitHub.

---

## 🎯 Next Steps (Simple)

### **Option 1: SSH and Deploy(Recommended - 2 Minutes)**

#### **Step 1: Open SSH Connection**
```bash
ssh root@167.71.53.238
```
**Password:** `Ziyrak2025Ai`

#### **Step 2: Copy and Paste This Command**

Once connected, copy and paste this entire block:

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
pkill -f gunicorn || true && sleep 2 && source venv/bin/activate && nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 >> logs/gunicorn.log 2>&1 & sleep 3 && sudo nginx -t && sudo systemctl reload nginx && echo "✅ DEPLOYMENT COMPLETE!" && curl http://127.0.0.1:8001/health/
```

#### **Step 3: Test**
Open your browser:
- https://AiDoktorapi.fargana.uz/
- https://AiDoktorapi.fargana.uz/admin/
- https://AiDoktor.fargana.uz/

---

### **Option 2: Use Deployment Scripts**

#### **Windows (PowerShell)**
```powershell
cd e:\AiDoktorai\deploy
.\deploy.ps1
```

#### **Linux/Mac/WSL (Bash)**
```bash
cd e:\AiDoktorai/deploy
bash full-auto-deploy.sh
```

---

## 📊 What Gets Deployed

✅ Latest code from GitHub  
✅ `.env` file with correct domains  
✅ All dependencies installed  
✅ Database migrated  
✅ Gunicorn restarted  
✅ Nginx reloaded  
✅ Health checks run  

---

## 🔧 Server Credentials

- **Host:** 167.71.53.238
- **Username:** root
- **Password:** Ziyrak2025Ai
- **Project:** `/root/AiDoktorai`

---

## 🆘 If Something Goes Wrong

### **Check Logs**
```bash
ssh root@167.71.53.238
tail -f /root/AiDoktorai/backend/logs/django.log
```

### **Quick Restart**
```bash
ssh root@167.71.53.238
cd /root/AiDoktorai/deploy
./quick-restart.sh
```

---

## ✅ Files Created

All these files are now on GitHub:

1. **deploy-test.sh** - Full deployment script
2. **quick-restart.sh** - Fast restart only
3. **full-auto-deploy.sh** - Automated bash deployment
4. **deploy.ps1** - PowerShell deployment helper
5. **QUICK_FIX_HTTPS.md** - HTTPS troubleshooting
6. **AUTO_DEPLOY_GUIDE.md** - Detailed automation guide
7. **COMPLETE_DEPLOYMENT_GUIDE.md** - Complete reference

---

**🎉 Ready to deploy!** Just SSH and run the command above!
-NoNewline
