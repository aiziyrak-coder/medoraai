@echo off
REM MedoraAI - Windows Batch Deploy Script
REM Server: 167.71.53.238

echo ================================================================
echo 🚀 MedoraAI - Serverga Deploy
echo ================================================================
echo.

echo [1/3] GitHub ga push...
cd /d %~dp0..
git add .
git commit -m "Production deploy" || echo No changes
git push origin main
if errorlevel 1 (
    echo ❌ GitHub push failed!
    pause
    exit /b 1
)
echo ✅ GitHub push completed
echo.

echo [2/3] Serverga ulanish...
echo.
echo Quyidagi buyruqlarni serverda bajaring:
echo.
echo ssh root@167.71.53.238
echo Password: Ziyrak2025Ai
echo.
echo # Serverda:
echo cd /root/AiDoktorai
echo git pull origin main
echo cd backend
echo source venv/bin/activate
echo pip install -r requirements.txt --quiet
echo python manage.py migrate --noinput
echo pkill -f gunicorn || true
echo sleep 2
echo nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 --threads 2 --timeout 120 ^>^> logs/gunicorn.log 2^>^&1 ^&
echo sleep 3
echo sudo nginx -t
echo sudo systemctl reload nginx
echo curl -s http://127.0.0.1:8001/health/
echo.
echo ================================================================
echo ✅ Deploy tayyor!
echo ================================================================
echo.
echo 🌐 URL: https://medora.cdcgroup.uz/
echo.
pause
