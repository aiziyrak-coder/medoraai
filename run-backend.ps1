# Kill process on port 8000, then start Django backend
$ErrorActionPreference = 'SilentlyContinue'
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Sleep -Seconds 1
Set-Location $PSScriptRoot\backend
if (Test-Path venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 }
Write-Host "Backend starting on http://127.0.0.1:8000"
python manage.py runserver 8000
