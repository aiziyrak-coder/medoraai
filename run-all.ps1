# Kill processes on 8000 and 3000, then start backend and frontend
$ErrorActionPreference = 'SilentlyContinue'

Write-Host "Stopping existing processes on ports 8000 and 3000..."
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Sleep -Seconds 2

$root = $PSScriptRoot

# Start backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; if (Test-Path venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 }; Write-Host 'Backend: http://127.0.0.1:8000'; python manage.py runserver 8000"

Start-Sleep -Seconds 2

# Start frontend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; Write-Host 'Frontend: http://localhost:3000'; npm run dev"

Write-Host "Backend (8000) and Frontend (3000) started in separate windows."
