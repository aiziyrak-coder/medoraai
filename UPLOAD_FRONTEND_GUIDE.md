# 🚀 Frontend ni Serverga Yuklash (Tezkor)

## 1-usul: Windows PowerShell (Tavsiya etiladi)

```powershell
# Local dist papkasini serverga yuklash
$distPath = "E:\medoraai\frontend\dist"
$server = "root@167.71.53.238"
$remotePath = "/root/AiDoktorai/frontend/dist"

# PSCP (PuTTY) yoki WinSCP ishlatish
# Agar PSCP bo'lsa:
pscp.exe -pw Ziyrak2025Ai -r "$distPath\*" "$server`:$remotePath"
```

---

## 2-usul: Rclone (Agar o'rnatilgan bo'lsa)

```bash
rclone copy E:\medoraai\frontend\dist remote:/root/AiDoktorai/frontend/dist --progress
```

---

## 3-usul: Python SFTP (Ishlayapti)

```powershell
cd E:\medoraai
python upload_frontend_to_server.py
```

**Lekin muammo bor:** Assets papkalari bilan ishlashda xatolik.

---

## ✅ ENG OSON USUL - Manual SCP

### 1. WSL orqali:
```bash
cd /mnt/e/medoraai/frontend
scp -r dist/* root@167.71.53.238:/root/AiDoktorai/frontend/dist/
```
Password: `Ziyrak2025Ai`

### 2. Yoki PowerShell + OpenSSH:
```powershell
cd E:\medoraai\frontend
scp -r dist\* root@167.71.53.238:/root/AiDoktorai/frontend/dist/
```
Password: `Ziyrak2025Ai`

---

## 🎯 Avtomatik Script (PowerShell)

`upload-frontend.ps1` faylini yarating:

```powershell
$distPath = "E:\medoraai\frontend\dist"
$serverUser = "root"
$serverHost = "167.71.53.238"
$serverPass = "Ziyrak2025Ai"
$remotePath = "/root/AiDoktorai/frontend/dist"

Write-Host "🚀 Frontend yuklash boshlandi..." -ForegroundColor Cyan

# SSH/SFTP library tekshirish
try {
    Add-Type -AssemblyName System.Web
    
    # PSCP download va use
    $pscpUrl = "https://the.earth.li/~sgtatham/putty/latest/w64/pscp.exe"
    $pscpPath = "$env:TEMP\pscp.exe"
    
    if (!(Test-Path $pscpPath)) {
        Write-Host "⬇️  PSCP yuklanmoqda..." -ForegroundColor Yellow
        $wc = New-Object Net.WebClient
        $wc.DownloadFile($pscpUrl, $pscpPath)
    }
    
    Write-Host "📦 Fayllar yuklanmoqda..." -ForegroundColor Green
    & $pscpPath -pw $serverPass -r "$distPath\*" "${serverUser}@${serverHost}:${remotePath}"
    
    Write-Host "✅ MUVAFFAQIYATLI YUKLANDI!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Sayt: https://medora.cdcgroup.uz/" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ XATO: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual SCP ishlatib ko'ring:" -ForegroundColor Yellow
    Write-Host "scp -r E:\medoraai\frontend\dist\* root@167.71.53.238:/root/AiDoktorai/frontend/dist/" -ForegroundColor Gray
}
```

Keyin ishga tushiring:
```powershell
E:\medoraai\upload-frontend.ps1
```

---

## 📊 Tekshirish

Serverga ulanib tekshiring:
```bash
ssh root@167.71.53.238
ls -la /root/AiDoktorai/frontend/dist/
```

---

**🎯 Maqsad:** Local `dist` papkasini serverdagi `/root/AiDoktorai/frontend/dist/` ga yuklash.
