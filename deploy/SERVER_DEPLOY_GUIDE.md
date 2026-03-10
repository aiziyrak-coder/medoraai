# 🚀 Server Deploy & Test Qo'llanmasi

## 📋 Qisqacha Ma'lumot

Serverda dasturni yangilash va test qilish uchun qadamma-qadam qo'llanma.

---

## 1️⃣ SSH Orqali Serverga Ulanish

```bash
ssh root@167.71.53.238
# yoki
ssh root@medoraapi.cdcgroup.uz
```

**Parol**: `Ziyrak2025Ai` (yoki sizning shaxsiy kalitingiz)

---

## 2️⃣ Deploy Variantlari

### Variant A: To'liq Deploy Script (Tavsiya etiladi)

```bash
cd /root/medoraai/deploy
chmod +x deploy-test.sh
./deploy-test.sh
```

**Nima qiladi:**
- ✅ GitHub'dan yangilanishlarni yuklaydi (`git pull`)
- ✅ `.env` faylini tekshiradi
- ✅ Dependencies o'rnatadi
- ✅ Database migrations bajaradi
- ✅ Gunicorn restart qiladi
- ✅ Nginx reload qiladi
- ✅ Health check bajaradi
- ✅ Test endpoint'larni tekshiradi

---

### Variant B: Tezkor Restart

```bash
cd /root/medoraai/deploy
chmod +x quick-restart.sh
./quick-restart.sh
```

**Nima qiladi:**
- ✅ Faqat Gunicorn restart qiladi
- ✅ Nginx reload qiladi
- ✅ Tezkor health check

**Qachon ishlatish:** Agar kod o'zgarmagan, faqat konfiguratsiya o'zgarganda (masalan `.env`).

---

### Variant C: Manual Buyruqlar

Agar skriptlar ishlamasa, har bir buyruqni alohida bajaring:

#### 1. Git Pull
```bash
cd /root/medoraai
git pull origin main
```

#### 2. .env Faylini Tahrirlash
```bash
cd /root/medoraai/backend
nano .env
```

**Muhim o'zgarishlar:**
```env
ALLOWED_HOSTS=localhost,127.0.0.1,medoraapi.cdcgroup.uz,medora.cdcgroup.uz,medora.ziyrak.org,medoraapi.ziyrak.org,20.82.115.71,167.71.53.238

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz
```

Saqlash: `Ctrl+O` → `Enter` → `Ctrl+X`

#### 3. Virtual Environment Faollashtirish
```bash
cd /root/medoraai/backend
source venv/bin/activate
```

#### 4. Dependencies O'rnatish
```bash
pip install -r requirements.txt
```

#### 5. Migrations
```bash
python manage.py migrate
```

#### 6. Gunicorn Restart

**Systemctl bilan:**
```bash
sudo systemctl restart medoraai-backend
sudo systemctl status medoraai-backend
```

**Yoki Manual:**
```bash
# Eski process'larni to'xtatish
pkill -f "gunicorn.*medoraai_backend"

# Yangi boshlash
cd /root/medoraai/backend
source venv/bin/activate
nohup gunicorn medoraai_backend.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --timeout 120 \
    --access-logfile logs/access.log \
    --error-logfile logs/error.log \
    > /dev/null 2>&1 &

echo $! > /tmp/gunicorn.pid
```

#### 7. Nginx Reload
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3️⃣ Test Qilish

### Local Health Check (Server ichida)
```bash
# Health endpoint
curl http://127.0.0.1:8001/health/

# Root endpoint
curl http://127.0.0.1:8001/

# Admin endpoint
curl http://127.0.0.1:8001/admin/

# API endpoint
curl http://127.0.0.1:8001/api/
```

### Tashqi Test (Brauzerda)

1. **Backend:**
   - https://medoraapi.cdcgroup.uz/
   - https://medoraapi.cdcgroup.uz/admin/
   - https://medoraapi.cdcgroup.uz/swagger/

2. **Frontend:**
   - https://medora.cdcgroup.uz/

3. **API Test:**
   ```bash
  curl https://medoraapi.cdcgroup.uz/api/auth/profile/ \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

---

## 4️⃣ Loglarni Tekshirish

### Django Loglar
```bash
# Real-time kuzatish
tail -f /root/medoraai/backend/logs/django.log

# Oxirgi 50 qator
tail -n 50 /root/medoraai/backend/logs/django.log

# Xatoliklar
tail -f /root/medoraai/backend/logs/django_errors.log
```

### Gunicorn Loglar
```bash
tail -f /root/medoraai/backend/logs/access.log
tail -f /root/medoraai/backend/logs/error.log
```

### Nginx Loglar
```bash
# Error log
tail -f /var/log/nginx/error.log

# Access log
tail -f /var/log/nginx/access.log
```

### Systemd Journal (agar systemctl ishlatilsa)
```bash
# Backend service
journalctl -u medoraai-backend-f

# Nginx service
journalctl -u nginx -f
```

---

## 5️⃣ Muammolarni Hal Qilish

### ❌ DisallowedHost Xatoligi
**Sabab:** `.env` faylida domen yo'q  
**Yechim:**
```bash
nano /root/medoraai/backend/.env
# ALLOWED_HOSTS ga domenni qo'shing
sudo systemctl restart medoraai-backend
```

### ❌ 502 Bad Gateway
**Sabab:**Gunicorn ishlamayapti  
**Yechim:**
```bash
# Gunicorn holatini tekshirish
ps aux | grep gunicorn

# Restart
sudo systemctl restart medoraai-backend
# yoki manual restart
```

### ❌ 504 Gateway Timeout
**Sabab:** Backend juda sekin javob bermoqda  
**Yechim:**
```bash
# Nginx timeout oshirish
nano /etc/nginx/nginx.conf
# proxy_read_timeout 300s; qo'shing
sudo nginx -t && sudo systemctl reload nginx
```

### ❌ CORS Xatoligi
**Sabab:** Frontend domeni CORS ro'yxatida yo'q  
**Yechim:**
```bash
nano /root/medoraai/backend/.env
# CORS_ALLOWED_ORIGINS ga frontend domenni qo'shing
sudo systemctl restart medoraai-backend
```

---

## 6️⃣ Foydali Buyruqlar

### Process'larni Tekshirish
```bash
# Gunicorn
ps aux | grep gunicorn

# Nginx
ps aux | grep nginx

# Port 8001 bandligini tekshirish
netstat -tulpn | grep 8001
# yoki
lsof -i :8001
```

### Service Holati
```bash
# Backend
sudo systemctl status medoraai-backend

# Nginx
sudo systemctl status nginx

# Redis (agar mavjud bo'lsa)
sudo systemctl status redis
```

### Restart
```bash
# Backend
sudo systemctl restart medoraai-backend

# Nginx
sudo systemctl restart nginx

# Hammasi
sudo systemctl restart nginx medoraai-backend
```

### Enable on Boot
```bash
sudo systemctl enable medoraai-backend
sudo systemctl enable nginx
```

---

## 7️⃣ Xavfsizlik

### 🔐 Hech Qachon GitHub'ga Yuklamang!
```bash
# .env fayllari
backend/.env
frontend/.env.local

# Maxfiy kalitlar
SECRET_KEY=...
API_KEY=...
DATABASE_PASSWORD=...
TELEGRAM_BOT_TOKEN=...
```

### ✅ Ruxsat Berilgan Fayllar
```bash
# Template fayllar
backend/.env.example
frontend/.env.example

# Public configuration
nginx/*.conf
systemd/*.service
```

---

## 8️⃣ Deployment Checklist

Har bir deploy dan keyin tekshiring:

- [ ] Git pull muvaffaqiyatli bajarildi
- [ ] `.env` fayli to'g'ri sozlangan
- [ ] Dependencies o'rnatildi
- [ ] Migrations bajarildi
- [ ] Gunicorn restart edildi
- [ ] Nginx reload qilindi
- [ ] Health check: `http://127.0.0.1:8001/health/` → HTTP 200
- [ ] HTTPS orqali test: `https://medoraapi.cdcgroup.uz/`
- [ ] Admin panel: `https://medoraapi.cdcgroup.uz/admin/`
- [ ] Frontend ulandi: `https://medora.cdcgroup.uz/`
- [ ] Loglarda xatolik yo'q

---

## 📞 Yordam

Agar muammo bo'lsa:

1. **Loglarni tekshiring:**
   ```bash
   tail -f /root/medoraai/backend/logs/django.log
   ```

2. **Service holatini tekshiring:**
   ```bash
   sudo systemctl status medoraai-backend
   ```

3. **Port bandligini tekshiring:**
   ```bash
   netstat -tulpn | grep 8001
   ```

4. **Test curl bilan:**
   ```bash
  curl -I http://127.0.0.1:8001/health/
   ```

---

**📅 Oxirgi yangilanish:** March 11, 2026  
**👤 Muallif:** MEDORA AI Team
