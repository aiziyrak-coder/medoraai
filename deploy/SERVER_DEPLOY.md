# MedoraAI serverga deploy

## Server

| Parametr | Qiymat |
|----------|--------|
| IP | `167.71.53.238` |
| SSH foydalanuvchi | `root` |
| Loyiha katalogi | `/root/medoraai` |
| Backend servis | `medoraai-backend-8001.service` |
| Sayt | https://medora.cdcgroup.uz |
| API (subdomen) | https://medoraapi.cdcgroup.uz |

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
