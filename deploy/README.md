# Server deploy

Loyiha serverda odatda quyidagilardan birida:

| Yo‘l | Izoh |
|------|------|
| `/root/medoraai` | `deploy/server-deploy.sh` — **asosiy** (MedoraAI, `medoraai-backend-8001`) |
| `/root/AiDoktorai` | Eski nom; skript topilsa xuddi shu ish ketadi |

IP misol: **167.71.53.238**. Backend port **8001**.

---

## 1) Qo‘lda SSH (eng ishonchli)

```bash
ssh root@167.71.53.238
cd /root/medoraai || cd /root/AiDoktorai
git pull origin main
sudo bash deploy/server-deploy.sh
```

Skript: `pip install`, `migrate --noinput`, `collectstatic`, frontend `npm run build`, systemd + nginx.

**Migratsiya** skript ichida: `python manage.py migrate --noinput`.

---

## 2) GitHub Actions (bir marta secret, keyin “Run workflow”)

Repo: **Settings → Secrets and variables → Actions** — qo‘shing:

- `DEPLOY_HOST` — server IP
- `DEPLOY_USER` — masalan `root`
- `DEPLOY_SSH_KEY` — **SSH private key** (butun matn)

Keyin: **Actions → Deploy server → Run workflow**.

**Avtomatik deploy:** `main` ga `frontend/`, `backend/`, `deploy/` o‘zgarishi bilan push qilinsa, shu workflow serverda ham `server-deploy.sh` ni ishga tushiradi (secretlar mavjud bo‘lsa). Secretlar yo‘q bo‘lsa, workflow xato beradi — yoki faqat qo‘lda **Run workflow** ishlating.

Fayl: `.github/workflows/deploy-server.yml`

---

## 3) Faqat tezkor restart (kod o‘zgarmagan bo‘lsa)

Serverda `deploy/quick-restart.sh` — faqat gunicorn + nginx (repo `README` dagi eski yo‘l bilan mos kelishi mumkin).

---

## Xatolik

- Backend: `sudo systemctl status medoraai-backend-8001` yoki `journalctl -u medoraai-backend-8001 -n 50`
- Nginx: `sudo nginx -t`
- Frontend 404: build `frontend/dist`; nginx `root` shu papkaga qarashi kerak
