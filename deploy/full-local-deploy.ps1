# MedoraAI — mahalliy to'liq tekshiruv: pull, backend migrate, frontend build
# Ishlatish (PowerShell):  cd repo   .\deploy\full-local-deploy.ps1

# npm stderr (warnings) PowerShell da xato sifatida ko'rinmasin
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== 1. Git pull (main) ===" -ForegroundColor Cyan
git pull origin main

Write-Host "=== 2. Backend: venv, pip, migrate ===" -ForegroundColor Cyan
Set-Location "$Root\backend"
if (-not (Test-Path "venv\Scripts\Activate.ps1")) {
    python -m venv venv
}
& .\venv\Scripts\Activate.ps1
pip install -q -r requirements.txt
python manage.py migrate --noinput

Write-Host "=== 3. Frontend: npm ci / install, build ===" -ForegroundColor Cyan
Set-Location "$Root\frontend"
if (Test-Path "package-lock.json") {
    npm ci 2>$null
    if ($LASTEXITCODE -ne 0) { npm install }
} else {
    npm install
}
npm run build

Set-Location $Root
Write-Host "`nTugadi. Serverda: git pull + sudo bash deploy/server-deploy.sh" -ForegroundColor Green
