# Serverda oxirgi o‘zgarishlarni yuklash

Barcha yangi kod GitHub’da. Serverda faqat shu buyruqlarni ketma-ket bajaring.

## 1. Kodni tortish

```bash
cd /var/www/AiDoktorai
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
cd /var/www/AiDoktorai/backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
```

Agar *"Your models in app(s): 'accounts' have changes that are not yet reflected in a migration"* chiqsa:
```bash
python manage.py makemigrations accounts
python manage.py migrate --noinput
```

```bash
sudo chown -R www-data:www-data /var/www/AiDoktorai/backend
sudo systemctl restart AiDoktorai-backend
```

---

## 3. Frontend (build)

**Gemini API kaliti** kerak bo‘lsa, avval loyiha rootida `.env.production` yarating:
```bash
nano /var/www/AiDoktorai/.env.production
```
Ichiga: `GEMINI_API_KEY=your-key` va `VITE_API_BASE_URL=https://AiDoktorapi.fargana.uz/api` yozing, saqlang.

Keyin build:

```bash
cd /var/www/AiDoktorai/frontend
npm install
npm run build
```

---

## 4. Tekshirish

- Frontend: https://AiDoktor.fargana.uz
- Backend health: https://AiDoktorapi.fargana.uz/health/
- Admin: https://AiDoktorapi.fargana.uz/admin/

Shundan keyin oxirgi o‘zgarishlar serverda ham ishlaydi.
-NoNewline
