# MedoraAI serverga deploy

## Server

| Parametr | Qiymat |
|----------|--------|
| IP | `167.71.53.238` |
| SSH foydalanuvchi | `root` |
| Loyiha katalogi | `/root/medoraai` |
| Backend servis | `medoraai-backend-8001.service` |
| Frontend | https://fjsti.ziyrak.org |
| API | https://fjstiapi.ziyrak.org |
| DNS | `fjsti.ziyrak.org` va `fjstiapi.ziyrak.org` uchun **A** yozuv → server IP |
| Nginx namuna | `deploy/nginx-fjsti-ziyrak.conf` |

Boshqa katalogda turgan bo‘lsa, muhitda `DEPLOY_REMOTE_DIR` qo‘ying (masalan `/root/AiDoktorai`).

## Xavfsizlik

**SSH parolni GitHub yoki `.md` fayllarga yozmang.** Faqat mahalliy terminalda muhit o‘zgaruvchisi orqali bering.

## Windows (PowerShell)

```powershell
Set-Location E:\medoraai
$env:DEPLOY_SSH_HOST = "167.71.53.238"
$env:DEPLOY_SSH_USER = "root"
$env:DEPLOY_SSH_PASSWORD = "PAROLINGIZ_BU_YERDA"
python deploy\deploy_server.py
```

Serverdagi `backend/.env` da `CORS_ALLOWED_ORIGINS` ni qo‘lda override qilgan bo‘lsangiz, ichiga **`https://fjsti.ziyrak.org`** (va kerak bo‘lsa `http://...`) qo‘shing — aks holda login CORS xato beradi.

## Skript nima qiladi

1. SSH ulanish  
2. `cd /root/medoraai` → `git stash` → `git pull origin main`  
3. `cd frontend` → `npm run build` (`dist` nginx orqali beriladi)  
4. `nginx -t` va `systemctl reload nginx`  
5. `systemctl restart medoraai-backend-8001.service`  
6. `systemctl status` tekshiruvi  

## Talablar

- Mahalliy mashinada Python 3 va `paramiko` (`pip install paramiko`)  
- Serverda `git`, `node`/`npm`, `nginx`, systemd servisi o‘rnatilgan bo‘lishi kerak  

## Muammolar

- **Unicode xato (Windows konsol):** skript `stdout` ni UTF-8 ga sozlaydi; yangi `deploy_server.py` ishlating.  
- **DNS:** agar domen ochilmasa, `DEPLOY_SSH_HOST=167.71.53.238` ishlating.  
- **Pull xatosi:** serverda `git remote` va `main` branch tekshiring.

## Eski service worker / `index-....js` kesh

- Yangi `index.html` ochilganda brauzer **bitta marta** barcha SW larni `unregister` qiladi, keshni tozalaydi va **sahifani qayta yuklaydi** (`sessionStorage` bilan tsikl yo‘q).  
- Yangi cleanup skript: **`/medora-sw-cleanup.js`** (eski `/service-worker.js` o‘rniga). Nginx da ikkalasiga ham `Cache-Control: no-store` qo‘ying — `deploy/nginx-cdcgroup.conf` namunasida bor.  
- **`/health/` 503:** `deploy/nginx-fjsti-ziyrak.conf` dagi kabi `/health/` uchun `return 200` stub qo‘ying yoki backend `proxy_pass`.
- **SSL:** `certbot certonly --webroot -w /root/medoraai/frontend/dist -d fjsti.ziyrak.org -d fjstiapi.ziyrak.org`
