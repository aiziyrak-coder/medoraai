# Serverda qilish kerak bo‘lgan ishlar

Barcha kod o‘zgarishlari loyihada qilingan. Siz faqat serverda quyidagilarni bajarasiz.

---

## 1. Loyihani serverga olib keling

```bash
cd /var/www/medoraai
git pull
# yoki agar git ishlatmasangiz: o‘zgargan fayllarni (backend/ai_services/, frontend/src/App.tsx) serverga nusxalang.
```

---

## 2. Gemini API kalitini tekshiring

```bash
nano /var/www/medoraai/.env.production
```

- `GEMINI_API_KEY=...` qatori mavjud va to‘g‘ri kalit bilan to‘ldirilgan bo‘lsin (https://aistudio.google.com/apikey dan olingan).
- Kalitda bosh joy yoki qo‘shtirnoq bo‘lmasin. Saqlang: **Ctrl+O**, Enter, **Ctrl+X**.

---

## 3. Backend (Django) – qayta ishga tushiring

```bash
cd /var/www/medoraai/backend
source venv/bin/activate   # agar venv ishlatilsa
pip install -r requirements.txt
sudo systemctl restart gunicorn
# yoki: sudo systemctl restart medoraai-backend  (servicing nomingizga qarab)
```

---

## 4. Frontend – qayta build qiling

```bash
cd /var/www/medoraai/frontend
npm ci
npm run build
```

---

## 5. Brauzerda tekshirish

- https://medora.cdcgroup.uz ni yangilang (**Ctrl+Shift+R**).
- Yangi konsilium boshlang: bemor ma’lumoti → Tahlil boshlash.
- Aniqlashtiruvchi savollar kasallik/sholatga mos chiqishi, tavsiya etilgan mutaxassislar va differensial tashxislar haqiqiy (mock emas) bo‘lishi kerak.

---

**Xulosa:** Git pull → .env da GEMINI_API_KEY tekshirish → backend restart → frontend build. Boshqa hech narsa serverda qilish shart emas.
