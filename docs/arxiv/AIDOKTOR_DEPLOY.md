# 🏥 AiDoktor Server Deployment Guide
## Farg'ona Jamoat Salomatligi Tibbiyot Instituti

---

## ✅ GitHub'ga Yuklandi

- **Commit:** abcfb1c
- **Branch:** main
- **Files Changed:** 351 files
- **Rebrand:** MEDORA AI  ->  AiDoktor

---

## 🔧 Serverda Bajarish (SSH orqali)

### **1. SSH Kirish:**
```bash
ssh root@167.71.53.238
# Password: ${SERVER_PASSWORD}
```

### **2. To'liq Deploy (Copy-Paste):**
```bash
cd /root/medoraai && git pull origin main && cd backend && source venv/bin/activate && python manage.py migrate && pkill -f gunicorn || true && sleep 2 && nohup gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 >> logs/gunicorn.log 2>&1 & sleep 3 && sudo nginx -t && sudo systemctl reload nginx && echo "✅ AiDoktor DEPLOYED!"
```

### **3. Test:**
```bash
curl http://127.0.0.1:8001/health/
```

Javob:
```json
{"status":"healthy","service":"aidoktor-backend"}
```

---

## 🌐 Production URLs

- **Frontend:** https://aidoktor.uz
- **Backend API:** https://api.aidoktor.uz
- **Admin Panel:** https://api.aidoktor.uz/admin/

---

## 📋 O'zgarishlar Ro'yxati

### **Backend:**
- ✅ settings.py: ALLOWED_HOSTS yangilandi
- ✅ .env: ANTHROPIC_API_KEY va boshqa sozlamalar (Claude Opus 4.7)
- ✅ Barcha Python fayllarida "MEDORA"  ->  "AiDoktor"
- ✅ Middleware va URL konfiguratsiyalari

### **Frontend:**
- ✅ package.json: nom yangilandi
- ✅ manifest.json: brending
- ✅ Barcha komponentlar (.tsx, .ts)
- ✅ i18n tarjimalar (uz, ru, en, kaa)
- ✅ API servislar
- ✅ Styles va constants

### **Deploy Scripts:**
- ✅ Barcha .sh va .ps1 skriptlar
- ✅ Hujjatlar (.md fayllar)
- ✅ Environment namunalari

---

## 🎨 Brending Qaerda Yangilandi:

1. **Loyiha nomi:** MEDORA AI  ->  **AiDoktor**
2. **Tashkilot:** CDC Group  ->  **Farg'ona Jamoat Salomatligi Tibbiyot Instituti**
3. **Domenlar:** **aidoktor.uz** va **api.aidoktor.uz**
4. **API:** https://api.aidoktor.uz/api
5. **Logotiplar:**Barcha iconlarda AiDoktor stili
6. **Hujjatlar:**Barcha README va qo'llanmalar

---

## 🚀 Tezkor Tekshirish

### **Backend:**
```bash
curl https://api.aidoktor.uz/health/
```

### **Frontend:**
Browser'da oching: https://aidoktor.uz

### **Admin Panel:**
https://api.aidoktor.uz/admin/

### **DNS (majburiy):**
- `aidoktor.uz` → A → `167.71.53.238`
- `api.aidoktor.uz` → A → `167.71.53.238`
- `www.aidoktor.uz` → A yoki CNAME → `aidoktor.uz`

---

## 📝 Muhim Eslatmalar

1. **Database:** Migrationlar avtomatik bajariladi
2. **Static Files:**Django automataik collectstatic qiladi
3. **Logs:** /root/medoraai/backend/logs/
4. **Gunicorn:** Port 8001 da ishlaydi
5. **Nginx:**Reverse proxy konfiguratsiyasi yangilandi

---

## 🆘 Muammolar Bo'lsa

### **Gunicorn ishlamayapti:**
```bash
ps aux | grep gunicorn
pkill-f gunicorn
cd /root/medoraai/backend
source venv/bin/activate
nohup gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 &
```

### **Nginx xatosi:**
```bash
sudo nginx -t
sudo systemctl status nginx
sudo journalctl -u nginx -n 50
```

### **Git pull xatosi:**
```bash
cd /root/medoraai
git fetch origin
git reset --hard origin/main
```

---

## 💰 AI xarajat (1000+ foydalanuvchi / minglab konsilium)

Default **scale** — **Claude Haiku 4.5** (eng arzon, ~$0.25/1M token; Sonnetdan 10–20× arzon):

```bash
# backend/.env
AI_COST_MODE=scale
CLAUDE_MODEL_HAIKU=claude-haiku-4-5-20251001
CLAUDE_MODEL_FAST=claude-haiku-4-5-20251001
CLAUDE_MODEL_PRO=claude-haiku-4-5-20251001

# frontend build
VITE_AI_COST_MODE=scale
VITE_CLAUDE_MODEL_HAIKU=claude-haiku-4-5-20251001
```

Tashxis sifati: to'liq klinik prompt + `diagnosisQuality` qoidalari Haiku bilan ham ishlaydi.

Agar tashxis uchun Sonnet kerak bo'lsa (qimmatroq): `CLAUDE_USE_SONNET_DIAGNOSIS=true` (backend) yoki `VITE_CLAUDE_USE_SONNET_DIAGNOSIS=true` (frontend).

Yuqori sifat: `AI_COST_MODE=balanced` (Sonnet) yoki `quality` (Opus).

Deploy: `npm ci && npm run build`, `systemctl restart aidoktorfjsti-backend`.

---

## ✨ Keyingi Qadamlar

1. ✅ Serverga deploy qilish
2. ✅ Frontend build (Vite avtomatik)
3. ✅ Browser cache tozalash
4. ✅ Domen DNS sozlamalari (agar kerak bo'lsa)
5. ✅ SSL sertifikatlarni yangilash

---

**🎉 AiDoktor tayyor! Farg'ona Jamoat Salomatligi Tibbiyot Instituti brendi bilan!**
