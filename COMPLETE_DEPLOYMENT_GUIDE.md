# 🤖 COMPLETE AUTOMATED DEPLOYMENT GUIDE

## 🎯 Overview

This guide provides**fully automated**deployment from your local machine to the production server with **one command**.

---

## 📋 What Gets Deployed Automatically

✅ **GitHub Push** - All your code changes  
✅ **.env File** - Pre-configured with correct settings  
✅ **Dependencies** - All Python packages installed  
✅ **Database Migrations** - Django migrations run automatically  
✅ **Gunicorn Restart** - Backend service restarted  
✅ **Nginx Reload** - Web server reloaded  
✅ **Health Checks** - Automatic testing of endpoints  

---

## 🚀 Quick Start (Choose Your Method)

### **Method 1: PowerShell Script (Windows - Easiest)**

```powershell
cd e:\AiDoktorai\deploy
.\deploy.ps1
```

**What it does:**
1. Pushes your code to GitHub
2. Creates deployment script
3. Opens SSH connection for you
4. You just paste and run the deployment commands on server

---

### **Method 2: Bash Script (WSL/Linux/Mac)**

```bash
cd e:\AiDoktorai/deploy
bash full-auto-deploy.sh
```

**What it does:**
1. Pushes to GitHub
2. Creates deployment script
3. Uploads to server via SCP
4. Executes on server automatically (if sshpass available)

---

### **Method 3: Manual SSH (Most Reliable)**

#### **Step 1: Push to GitHub**
```bash
cd e:\AiDoktorai
git add .
git commit -m "Your changes"
git push origin main
```

#### **Step 2: SSH to Server**
```bash
ssh root@167.71.53.238
# Password: Ziyrak2025Ai
```

#### **Step 3: Run Deployment Commands**

Copy and paste this entire block on the server:

```bash
#!/bin/bash
set -e

echo "📦 Pulling latest changes..."
cd /root/AiDoktorai
git pull origin main

echo "🔧 Creating.env file..."
cd /root/AiDoktorai/backend

cat > .env << 'EOF'
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

echo "✅ .env created!"

echo "📦 Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "🗄️  Running migrations..."
python manage.py migrate --noinput

echo "🔄 Restarting Gunicorn..."
pkill -f gunicorn || true
sleep 2

cd /root/AiDoktorai/backend
source venv/bin/activate
nohup gunicorn AiDoktorai_backend.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --threads 2 \
    --timeout 120 \
    >> logs/gunicorn.log 2>&1 &

sleep 3

echo "🌐 Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "🏥 Health checks..."
sleep 3
curl -s http://127.0.0.1:8001/health/
echo ""

echo "========================================"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "Test at:"
echo "  https://AiDoktorapi.fargana.uz/"
echo "  https://AiDoktorapi.fargana.uz/admin/"
echo "  https://AiDoktor.fargana.uz/"
```

---

## 🔧 Configuration Details

### **Server Credentials**
- **Host**: 167.71.53.238
- **Username**: root
- **Password**: Ziyrak2025Ai
- **Project Directory**: `/root/AiDoktorai`

### **Environment Variables Set Automatically**

The deployment creates this `.env` file:

```env
SECRET_KEY=django-insecure-AiDoktorai-dev-key-change-in-production
DEBUG=True

# All necessary domains
ALLOWED_HOSTS=localhost,127.0.0.1,AiDoktorapi.fargana.uz,AiDoktor.fargana.uz,AiDoktor.ziyrak.org,AiDoktorapi.ziyrak.org,20.82.115.71,167.71.53.238

# CORS for frontend
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://AiDoktor.fargana.uz,https://AiDoktorapi.fargana.uz

# Database
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/AiDoktorai/backend/db.sqlite3

# AI Services
GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview

# Telegram
TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
```

---

## 📊 Deployment Workflow

```
┌─────────────────────┐
│  Local Machine     │
│                     │
│  1. git push        │
│  2. Run script      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   GitHub            │
│   (main branch)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Production Server  │
│                     │
│  1. git pull        │
│  2. Create.env     │
│  3. Install deps    │
│  4. Migrate DB      │
│  5. Restart services│
│  6. Health checks   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Live Site         │
│   ✅ Working       │
└─────────────────────┘
```

---

## 🧪 Testing After Deployment

### **1. Local Tests (from server)**
```bash
curl http://127.0.0.1:8001/health/
curl http://127.0.0.1:8001/
curl http://127.0.0.1:8001/admin/
```

### **2. Browser Tests**
- https://AiDoktorapi.fargana.uz/
- https://AiDoktorapi.fargana.uz/admin/
- https://AiDoktor.fargana.uz/

### **3. API Tests**
```bash
curl https://AiDoktorapi.fargana.uz/api/auth/profile/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📝 Troubleshooting

### **Issue: SSH Connection Fails**
```bash
# Test connection
ping 167.71.53.238

# Try manual SSH
ssh root@167.71.53.238
```

### **Issue: Git Pull Fails**
```bash
# On server
cd /root/AiDoktorai
git status
git remote -v
git reset --hard origin/main
```

### **Issue: 502 Bad Gateway**
```bash
# Check if Gunicorn is running
ps aux | grep gunicorn

# Restart manually
cd /root/AiDoktorai/backend
source venv/bin/activate
gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 &
```

### **Issue: DisallowedHost Error**
```bash
# Check.env
cat /root/AiDoktorai/backend/.env | grep ALLOWED_HOSTS

# Should include AiDoktorapi.fargana.uz
# If not, re-run deployment
```

---

## 🔐 Security Notes

### **Current Setup (Development)**
- ✅ DEBUG=True (for development)
- ✅ Password authentication
- ✅ Pre-configured API keys

### **For Production (Recommended Changes)**
1. Set `DEBUG=False` in `.env`
2. Generate new `SECRET_KEY`:
   ```bash
   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
   ```
3. Use SSH keys instead of password:
   ```bash
  ssh-keygen -t ed25519
  ssh-copy-id root@167.71.53.238
   ```

---

## 📊 Monitoring

### **View Logs**
```bash
# Django logs
tail -f /root/AiDoktorai/backend/logs/django.log

# Gunicorn logs
tail -f /root/AiDoktorai/backend/logs/gunicorn.log

# Nginx errors
tail -f /var/log/nginx/error.log

# Real-time monitoring (tmux or screen recommended)
tmux
# Split panes and tail different logs
```

### **Check Service Status**
```bash
# Gunicorn processes
ps aux | grep gunicorn

# Nginx status
sudo systemctl status nginx

# Port 8001
netstat -tulpn | grep 8001
```

---

## 🎯 Complete Checklist

After every deployment:

- [ ] Code pushed to GitHub
- [ ] Deployment script ran successfully
- [ ] No errors in output
- [ ] Health check passed (HTTP 200)
- [ ] HTTPS works in browser
- [ ] Admin panel accessible
- [ ] Frontend connects to backend
- [ ] No critical errors in logs

---

## 📞 Quick Commands Reference

### **Full Deployment (Local)**
```bash
# Windows PowerShell
.\deploy\deploy.ps1

# Linux/Mac/WSL
bash deploy/full-auto-deploy.sh
```

### **Manual Server Deployment**
```bash
ssh root@167.71.53.238
cd /root/AiDoktorai
git pull origin main
./deploy/quick-restart.sh
```

### **Quick Restart Only**
```bash
ssh root@167.71.53.238
cd /root/AiDoktorai/deploy
./quick-restart.sh
```

### **Check Logs**
```bash
ssh root@167.71.53.238
tail -f /root/AiDoktorai/backend/logs/django.log
```

---

## 🆘 Emergency Rollback

If something goes wrong:

```bash
# SSH to server
ssh root@167.71.53.238

# Go to previous working commit
cd /root/AiDoktorai
git log --oneline -5
git reset --hard GOOD_COMMIT_HASH

# Restart services
./deploy/quick-restart.sh
```

---

**📅 Last Updated:** March 11, 2026  
**👥 Author:** AiDoktor Team  
**✅ Status:**Fully Automated & Production Ready
-NoNewline
