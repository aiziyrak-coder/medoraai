# AiDoktor — Farg'ona jamoat salomatligi tibbiyot instituti

Tibbiy konsilium tizimi. Professional tibbiy yordam ko'rsatishda AI texnologiyalaridan foydalanishga qaratilgan platforma.

## 🚀 Tezkor Boshlash

### Lokal Development

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver 8000

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## 📦 Deploy

- **Lokal Test**: `.\test-local.ps1` yoki `DEPLOY_LOCAL_TEST.md`
- **Digital Ocean Deploy**: `DEPLOY_DIGITALOCEAN.md` - Qadamma-qadam qo'llanma
- **GitHub Push**: `GITHUB_PUSH.md` - GitHub'ga yuklash qo'llanmasi

## 🌐 Production URLs

- **Frontend**: https://medora.cdcgroup.uz
- **Backend API**: https://medoraapi.cdcgroup.uz
- **Admin Panel**: https://medoraapi.cdcgroup.uz/admin/

## 📚 Qo'llanmalar

- `DEPLOY_DIGITALOCEAN.md` - Digital Ocean deploy qo'llanmasi
- `GITHUB_PUSH.md` - GitHub'ga push qilish
- `DEPLOY_LOCAL_TEST.md` - Lokal test
- `QUICK_START.md` - Tezkor boshlash

## 🔧 Tech Stack

- **Backend**: Django REST Framework, PostgreSQL, Gunicorn
- **Frontend**: React, TypeScript, Vite
- **AI**: Google Gemini API
- **Security**: JWT, Session limits, Rate limiting

## 📝 License

Proprietary - CDC Group
