# Serverda oxirgi o‘zgarishlarni yuklash

Barcha yangi kod GitHub’da. Serverda faqat shu buyruqlarni ketma-ket bajaring.

## 1. Kodni tortish

```bash
cd /var/www/medoraai
git pull origin main
```

Agar `package-lock.json` conflict bersa:
```bash
git checkout -- frontend/package-lock.json
git pull origin main
```

---

## 2. Backend

```bash
cd /var/www/medoraai/backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
sudo chown -R www-data:www-data /var/www/medoraai/backend
sudo systemctl restart medoraai-backend
```

---

## 3. Frontend (build)

```bash
cd /var/www/medoraai/frontend
npm install
npm run build
```

---

## 4. Tekshirish

- Frontend: https://medora.cdcgroup.uz
- Backend health: https://medoraapi.cdcgroup.uz/health/
- Admin: https://medoraapi.cdcgroup.uz/admin/

Shundan keyin oxirgi o‘zgarishlar serverda ham ishlaydi.
