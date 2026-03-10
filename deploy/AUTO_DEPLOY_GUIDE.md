# 🤖 Automated Deployment Guide

## 📋 Overview

This guide explains how to use the automated deployment script that handles everything from GitHub push to server deployment.

---

## 🚀 Quick Start (One Command Deploy)

### **Option 1: Using Python Script (Recommended)**

```bash
cd e:\medoraai\deploy
python auto-deploy.py
```

**What it does:**
1. ✅ Connects to server via SSH
2. ✅ Pulls latest changes from GitHub
3. ✅ Creates/updates `.env` file with correct settings
4. ✅ Installs dependencies
5. ✅ Runs database migrations
6. ✅ Restarts Gunicorn
7. ✅ Reloads Nginx
8. ✅ Performs health checks
9. ✅ Shows logs

---

### **Option 2: Manual Steps**

If you prefer manual control:

#### **Step 1: Push to GitHub**
```bash
cd e:\medoraai
git add .
git commit -m "Your commit message"
git push origin main
```

#### **Step 2: SSH to Server**
```bash
ssh root@167.71.53.238
# Password: Ziyrak2025Ai
```

#### **Step 3: Deploy on Server**
```bash
cd /root/medoraai
git pull origin main

# Create/update.env
cd backend
cp .env.example.env
nano .env  # Edit with production values

# Restart services
pkill -f gunicorn
source venv/bin/activate
nohup gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 &

sudo nginx -t && sudo systemctl reload nginx
```

---

## 🔧 Automated Script Details

### **Prerequisites**

Install paramiko (Python SSH library):
```bash
pip install paramiko
```

### **Configuration**

The script uses these credentials (hardcoded in `auto-deploy.py`):
- **Server**: 167.71.53.238
- **Username**: root
- **Password**: Ziyrak2025Ai

⚠️ **Security Note**: In production, consider using SSH keys instead of passwords!

### **Environment Variables Set by Script**

The script automatically creates this `.env` file:

```env
SECRET_KEY=django-insecure-medoraai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,medoraapi.cdcgroup.uz,medora.cdcgroup.uz,medora.ziyrak.org,medoraapi.ziyrak.org,20.82.115.71,167.71.53.238

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz

DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/medoraai/backend/db.sqlite3

GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview

TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
```

---

## 📊 Deployment Workflow

```mermaid
graph TB
    A[Start Deployment] --> B[Connect to Server via SSH]
    B --> C[Git Pull from GitHub]
    C --> D[Create.env File]
    D --> E[Install Dependencies]
    E --> F[Run Migrations]
    F --> G[Restart Gunicorn]
    G --> H[Reload Nginx]
    H --> I[Health Checks]
    I --> J{All Checks Pass?}
    J -->|Yes| K[✅ Deployment Success]
    J -->|No| L[❌ Show Error Logs]
    L --> M[Manual Intervention Required]
```

---

## 🧪 Testing After Deployment

### **1. Local Tests (from server)**
```bash
# Health check
curl http://127.0.0.1:8001/health/

# Root endpoint
curl http://127.0.0.1:8001/

# Admin panel
curl http://127.0.0.1:8001/admin/
```

### **2. HTTPS Tests (from browser)**
- https://medoraapi.cdcgroup.uz/
- https://medoraapi.cdcgroup.uz/admin/
- https://medoraapi.cdcgroup.uz/swagger/
- https://medora.cdcgroup.uz/

### **3. API Test**
```bash
curl https://medoraapi.cdcgroup.uz/api/auth/profile/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📝 Troubleshooting

### **Issue: Script fails at SSH connection**
**Solution:**
```bash
# Check if server is reachable
ping 167.71.53.238

# Test SSH manually
ssh root@167.71.53.238
```

### **Issue: Git pull fails**
**Solution:**
```bash
# SSH to server and check git status
ssh root@167.71.53.238
cd /root/medoraai
git status
git remote -v
```

### **Issue: .env file not created**
**Solution:**
```bash
# SSH to server and create manually
ssh root@167.71.53.238
cd /root/medoraai/backend
cp .env.example .env
nano .env
```

### **Issue: 502 Bad Gateway**
**Solution:**
```bash
# Check if Gunicorn is running
ssh root@167.71.53.238
ps aux | grep gunicorn

# If not running, restart manually
cd /root/medoraai/backend
source venv/bin/activate
gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 &
```

### **Issue: DisallowedHost error**
**Solution:**
```bash
# Check .env file
ssh root@167.71.53.238
cat /root/medoraai/backend/.env | grep ALLOWED_HOSTS

# Should include: medoraapi.cdcgroup.uz
# If not, re-run the automated script or edit manually
```

---

## 🔐 Security Best Practices

### **Current Setup (Development)**
- ✅ Uses password authentication
- ✅ DEBUG=True
- ✅ Insecure secret key

### **Production Recommendations**
1. **Use SSH Keys instead of password:**
   ```bash
  ssh-keygen -t ed25519
  ssh-copy-id root@167.71.53.238
   ```

2. **Update auto-deploy.py to use SSH keys:**
   ```python
   client.connect(
      hostname=SERVER_HOST,
       username=SERVER_USER,
       key_filename='/path/to/private/key'
   )
   ```

3. **Set DEBUG=False in .env**

4. **Generate secure SECRET_KEY:**
   ```bash
   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
   ```

---

## 📊 Monitoring Deployment

### **View Real-time Logs**
```bash
# Django logs
tail -f /root/medoraai/backend/logs/django.log

# Gunicorn logs
tail -f /root/medoraai/backend/logs/gunicorn.log

# Nginx errors
tail -f /var/log/nginx/error.log

# All together (multiple terminals or tmux)
tmux
# Split panes and tail different logs
```

### **Check Service Status**
```bash
# Gunicorn
ps aux | grep gunicorn

# Nginx
sudo systemctl status nginx

# Port 8001
netstat -tulpn | grep 8001
```

---

## 🎯 Complete Deployment Checklist

Before considering deployment complete:

- [ ] Code pushed to GitHub
- [ ] Automated script ran successfully
- [ ] No errors in deployment output
- [ ] Health check passed (HTTP 200)
- [ ] HTTPS works in browser
- [ ] Admin panel accessible
- [ ] API endpoints responding
- [ ] No critical errors in logs
- [ ] Frontend can connect to backend

---

## 🔄 Daily Deployment Routine

### **Morning Check**
```bash
# From local machine
python deploy/auto-deploy.py

# Or SSH and check manually
ssh root@167.71.53.238
cd /root/medoraai
./deploy/quick-restart.sh
```

### **After Updates**
```bash
# Make changes locally
git add .
git commit -m "Fix: description"
git push origin main

# Deploy to server
python deploy/auto-deploy.py
```

---

## 📞 Emergency Commands

### **Quick Restart (No Git Pull)**
```bash
ssh root@167.71.53.238
cd /root/medoraai/deploy
./quick-restart.sh
```

### **Full Manual Restart**
```bash
ssh root@167.71.53.238

# Stop everything
pkill -f gunicorn
sudo systemctl stop nginx

# Start backend
cd /root/medoraai/backend
source venv/bin/activate
gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 &

# Start nginx
sudo systemctl start nginx
```

### **Rollback to Previous Version**
```bash
ssh root@167.71.53.238
cd /root/medoraai
git log --oneline -5  # Find previous good commit
git reset --hard COMMIT_HASH
./deploy/quick-restart.sh
```

---

**📅 Last Updated:** March 11, 2026  
**👥 Author:** MEDORA AI Team  
**🔧 Version:** 1.0 (Automated)
