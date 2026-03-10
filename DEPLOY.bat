@echo off
REM MEDORA AI - One-Click Deployment
REM This script will connect to server and deploy everything automatically

echo ================================================================
echo 🚀 MEDORA AI - Automated Server Deployment
echo ================================================================
echo.
echo Connecting to server...
echo.

REM Create temporary PowerShell script for SSH connection
set PSScript=%TEMP%\medora_deploy.ps1

(
echo $password = "Ziyrak2025Ai"
echo $securePassword = ConvertTo-SecureString $password -AsPlainText -Force
echo $credential = New-Object System.Management.Automation.PSCredential("root", $securePassword)
echo.
echo Write-Host "Connecting to server..." -ForegroundColor Cyan
echo.
echo # Deploy script content
echo $deployScript = @'
echo #!/bin/bash
echo set -e
echo echo "🚀 Starting deployment..."
echo cd /root/medoraai ^&^& git pull origin main ^&^& cd backend ^&^& cat ^> .env ^<^< 'EOF'
echo SECRET_KEY=django-insecure-medoraai-dev-key-change-in-production
echo DEBUG=True
echo ALLOWED_HOSTS=localhost,127.0.0.1,medoraapi.cdcgroup.uz,medora.cdcgroup.uz,medora.ziyrak.org,medoraapi.ziyrak.org,20.82.115.71,167.71.53.238
echo CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz
echo DB_ENGINE=django.db.backends.sqlite3
echo DB_NAME=/root/medoraai/backend/db.sqlite3
echo GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
echo AI_MODEL_DEFAULT=gemini-3-pro-preview
echo TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
echo TELEGRAM_PAYMENT_GROUP_ID=-5041567370
echo EOF
echo source venv/bin/activate ^&^& pip install-r requirements.txt --quiet ^&^& python manage.py migrate --noinput ^&^& pkill -f gunicorn ^|^| true ^&^& sleep 2 ^&^& nohup gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 ^>^> logs/gunicorn.log 2^>^&1 ^&^& sleep 3 ^&^& sudo nginx -t ^&^& sudo systemctl reload nginx ^&^& sleep 3 ^&^& curl http://127.0.0.1:8001/health/ ^&^& echo "" ^&^& echo "✅ DEPLOYMENT COMPLETE!" ^&^& echo "Test: https://medoraapi.cdcgroup.uz/"
echo '@
echo.
echo # Execute on remote server
echo Invoke-Command-ComputerName "167.71.53.238" -Credential $credential -ScriptBlock {
echo     param([string]$script)
echo     Set-Content -Path "/tmp/deploy.sh" -Value $script
echo     chmod +x "/tmp/deploy.sh"
echo     bash "/tmp/deploy.sh"
echo } -ArgumentList $deployScript -SessionOption (New-PSSessionOption -SkipCACheck-SkipCNCheck)
echo.
) > %PSScript%

echo Running deployment script...
powershell.exe -ExecutionPolicy Bypass -File "%PSScript%"

echo.
echo ================================================================
echo If the automatic deployment failed, please use manual SSH:
echo ================================================================
echo.
echo 1. Open PowerShell and run:
echo   ssh root@167.71.53.238
echo    Password: Ziyrak2025Ai
echo.
echo 2. Copy and paste this command:
echo.
echo cd /root/medoraai ^&^& git pull origin main ^&^& cd backend ^&^& cat ^> .env ^<^< 'EOF'
echo SECRET_KEY=django-insecure-medoraai-dev-key-change-in-production
echo DEBUG=True
echo ALLOWED_HOSTS=localhost,127.0.0.1,medoraapi.cdcgroup.uz,medora.cdcgroup.uz,medora.ziyrak.org,medoraapi.ziyrak.org,20.82.115.71,167.71.53.238
echo CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz
echo DB_ENGINE=django.db.backends.sqlite3
echo DB_NAME=/root/medoraai/backend/db.sqlite3
echo GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
echo AI_MODEL_DEFAULT=gemini-3-pro-preview
echo TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
echo TELEGRAM_PAYMENT_GROUP_ID=-5041567370
echo EOF
echo source venv/bin/activate ^&^& pip install-r requirements.txt --quiet ^&^& python manage.py migrate --noinput ^&^& pkill -f gunicorn ^|^| true ^&^& sleep 2 ^&^& nohup gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 ^>^> logs/gunicorn.log 2^>^&1 ^&^& sleep 3 ^&^& sudo nginx -t ^&^& sudo systemctl reload nginx ^&^& sleep 3 ^&^& curl http://127.0.0.1:8001/health/ ^&^& echo "✅ DONE!"
echo.
echo ================================================================

pause
