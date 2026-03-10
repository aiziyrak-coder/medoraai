# To'liq qayta ishga tushirish: 8000, 9000, 3000 portlarni tozalash, keyin Backend, Gateway, Frontend.
$ErrorActionPreference = 'SilentlyContinue'

Write-Host "Portlarni tozalash: 8000 (backend), 9000 (gateway), 3000 (frontend)..."
foreach ($port in 8000, 9000, 3000) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}
Start-Sleep -Seconds 2

$root = $PSScriptRoot

# 1) Backend (Django, 8000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; `$env:DJANGO_SETTINGS_MODULE='medoraai_backend.settings'; if (Test-Path venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 }; Write-Host 'Backend: http://127.0.0.1:8000'; python manage.py runserver 0.0.0.0:8000"
Start-Sleep -Seconds 2

# 2) Gateway (FastAPI 9000 + HL7 6006)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; if (Test-Path backend\venv\Scripts\Activate.ps1) { .\backend\venv\Scripts\Activate.ps1 }; Write-Host 'Gateway: http://127.0.0.1:9000, HL7: 6006'; uvicorn monitoring_gateway.main:app --host 0.0.0.0 --port 9000"
Start-Sleep -Seconds 2

# 3) Frontend (Vite, 3000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; Write-Host 'Frontend: http://localhost:3000'; npm run dev"

Write-Host "To'liq ishga tushirildi: Backend (8000), Gateway (9000, 6006), Frontend (3000)."
