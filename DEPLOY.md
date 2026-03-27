# Deploy

Qisqa yo‘l: batafsil **`deploy/README.md`**.

- **Qo‘lda:** SSH → `git pull` → `sudo bash deploy/server-deploy.sh`
- **GitHub:** Actions → **Deploy server** (secretlar: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`)

Lokal: `frontend` da `npm run build`, `backend` da `python manage.py migrate`.
