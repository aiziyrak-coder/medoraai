# MedoraAI — Backend 8000, Frontend 3000 da ishga tushirish

## Birinchi marta sozlash

### Backend (port 8000)
```powershell
cd E:\medoraai\backend
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Frontend (port 3000)
**Node.js kerak.** Agar `npm` topilmasa: https://nodejs.org/ dan LTS versiyasini o'rnating, "Add to PATH" belgilang, keyin terminalni qayta oching. Batafsil: `FRONTEND_SETUP.md`.

```powershell
cd E:\medoraai\frontend
npm install
npm run dev
```
Yoki: `frontend\run-dev.bat` faylini ikki marta bosing (avval Node.js o'rnatilgan bo'lishi kerak).

---

## Har doim ishga tushirish

### Variant 1: Ikkala serverni bir vaqtda (alohida oynalarda)
```powershell
cd E:\medoraai
.\run-all.ps1
```
Backend **8000**, frontend **3000** portda ochiladi (ikkita yangi PowerShell oynasi).

### Variant 2: Alohida terminalda
**Terminal 1 – Backend:**
```powershell
cd E:\medoraai
.\run-backend.ps1
```

**Terminal 2 – Frontend:**
```powershell
cd E:\medoraai
.\run-frontend.ps1
```

---

## O'zgarishdan keyin qayta ishga tushirish (kill + run)

1. Portlarni tozalash:
   ```powershell
   cd E:\medoraai
   .\kill-ports.ps1
   ```
2. Qayta ishga tushirish:
   ```powershell
   .\run-all.ps1
   ```
   yoki alohida: `.\run-backend.ps1` va `.\run-frontend.ps1`.

---

## Portlar

| Xizmat   | Port | URL                    |
|----------|------|------------------------|
| Backend  | 8000 | http://127.0.0.1:8000  |
| Frontend | 3000 | http://localhost:3000 |

Frontend API uchun `http://localhost:8000/api` dan foydalanadi (Vite env da sozlangan).
