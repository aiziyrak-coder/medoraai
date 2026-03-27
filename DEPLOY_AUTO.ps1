# MedoraAI - Full Automated Deployment Script (PowerShell)
# Pushes to GitHub, SSH to server and deploy automatically

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Blue
Write-Host "🚀 MedoraAI - Full Automated Deployment" -ForegroundColor Blue
Write-Host "================================================" -ForegroundColor Blue
Write-Host ""

# Configuration
$SERVER_USER = "root"
$SERVER_HOST = "167.71.53.238"
$SERVER_PASSWORD = "Ziyrak2025Ai"
$PROJECT_DIR = "/root/AiDoktorai"

# Step 1: Commit and push to GitHub
Write-Host "Step 1: Pushing to GitHub..." -ForegroundColor Yellow
git add .
$commitMsg = "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMsg 2>$null || Write-Host "No changes to commit" -ForegroundColor Gray
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ GitHub push failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ GitHub push completed" -ForegroundColor Green
Write-Host ""

# Step 2: Create deployment script for server
Write-Host "Step 2: Creating deployment script..." -ForegroundColor Yellow

$deployScript = @'
#!/bin/bash
set -e

echo ""
echo "========================================"
echo "📦 Pulling latest changes from GitHub..."
echo "========================================"
cd /root/AiDoktorai
git pull origin main

echo ""
echo "========================================"
echo "🔧 Creating .env file..."
echo "========================================"
cd /root/AiDoktorai/backend

cat > .env << 'EOF'
SECRET_KEY=django-insecure-AiDoktorai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,AiDoktorapi.fargana.uz,AiDoktor.fargana.uz,AiDoktor.ziyrak.org,AiDoktorapi.ziyrak.org,20.82.115.71,167.71.53.238,medora.cdcgroup.uz,medoraapi.cdcgroup.uz

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://AiDoktor.fargana.uz,https://AiDoktorapi.fargana.uz,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz

DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/AiDoktorai/backend/db.sqlite3

GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview

TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
EOF

echo ".env file created!"

echo ""
echo "========================================"
echo "📦 Installing dependencies..."
echo "========================================"
source venv/bin/activate
pip install -r requirements.txt --quiet
echo "Dependencies installed!"

echo ""
echo "========================================"
echo "🗄️  Running migrations..."
echo "========================================"
python manage.py migrate --noinput
echo "Migrations completed!"

echo ""
echo "========================================"
echo "🔄 Restarting Gunicorn..."
echo "========================================"
pkill -f gunicorn || true
sleep 2

cd /root/AiDoktorai/backend
source venv/bin/activate
nohup gunicorn AiDoktorai_backend.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --threads 2 \
    --timeout 120 \
    --access-logfile logs/access.log \
    --error-logfile logs/error.log \
    >> logs/gunicorn.log 2>&1 &

sleep 3
echo "Gunicorn started!"

echo ""
echo "========================================"
echo "🌐 Reloading Nginx..."
echo "========================================"
sudo nginx -t
sudo systemctl reload nginx
echo "Nginx reloaded!"

echo ""
echo "========================================"
echo "🏥 Running health checks..."
echo "========================================"
sleep 3

echo "Testing local health endpoint..."
curl -s http://127.0.0.1:8001/health/ && echo " ✅ Health check passed!"

echo ""
echo "Testing root endpoint..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:8001/

echo ""
echo "Testing admin endpoint..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:8001/admin/

echo ""
echo "========================================"
echo "🎉 Deployment Completed Successfully!"
echo "========================================"
echo ""
echo "📝 Test URLs:"
echo "   - https://medora.cdcgroup.uz/"
echo "   - https://medoraapi.cdcgroup.uz/api/"
echo "   - https://medoraapi.cdcgroup.uz/admin/"
echo ""
echo "📊 Monitor logs:"
echo "  tail -f /root/AiDoktorai/backend/logs/django.log"
echo "  tail -f /var/log/nginx/error.log"
echo ""
'@

$deployScriptPath = "$env:TEMP\deploy_commands.sh"
$deployScript | Out-File -FilePath $deployScriptPath -Encoding UTF8 -NoNewline
Write-Host "✅ Deployment script created: $deployScriptPath" -ForegroundColor Green
Write-Host ""

# Step 3: Upload and execute on server using Plink (PuTTY)
Write-Host "Step 3: Deploying to server $SERVER_USER@$SERVER_HOST..." -ForegroundColor Yellow

# Check if plink is available
$plinkPath = "plink.exe"
$plinkFound = Get-Command $plinkPath -ErrorAction SilentlyContinue

if ($plinkFound) {
    Write-Host "Using Plink for SSH connection..." -ForegroundColor Green
    
    # Upload script
    Write-Host "Uploading deployment script..." -ForegroundColor Yellow
    $uploadCmd = "& '$plinkPath' -ssh -pw '$SERVER_PASSWORD' -batch $SERVER_USER@$SERVER_HOST put `"$deployScriptPath`" /tmp/deploy_commands.sh"
    Invoke-Expression $uploadCmd
    
    # Execute script
    Write-Host "Executing deployment on server..." -ForegroundColor Yellow
    $execCmd = "& '$plinkPath' -ssh -pw '$SERVER_PASSWORD' -batch $SERVER_USER@$SERVER_HOST 'bash /tmp/deploy_commands.sh'"
    Invoke-Expression $execCmd
    
    Write-Host "✅ Deployment completed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Plink (PuTTY) not found. Installing alternative method..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install PuTTY or use WSL:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html" -ForegroundColor Gray
    Write-Host "  2. Or use WSL: wsl bash deploy/full-auto-deploy.sh" -ForegroundColor Gray
    Write-Host ""
    
    # Alternative: Use Windows Subsystem for Linux if available
    $wslFound = Get-Command wsl -ErrorAction SilentlyContinue
    if ($wslFound) {
        Write-Host "WSL detected! Using WSL for deployment..." -ForegroundColor Green
        wsl bash -c "cd /mnt/e/medoraai && bash deploy/full-auto-deploy.sh"
    } else {
        Write-Host "❌ No SSH client found. Please install PuTTY or enable WSL." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "🎉 DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your application is now live at:" -ForegroundColor Cyan
Write-Host "   https://medora.cdcgroup.uz/" -ForegroundColor White
Write-Host "   https://medoraapi.cdcgroup.uz/api/" -ForegroundColor White
Write-Host ""
Write-Host "📊 Monitor status:" -ForegroundColor Cyan
Write-Host "   SSH: ssh root@167.71.53.238" -ForegroundColor Gray
Write-Host "   Password: $SERVER_PASSWORD" -ForegroundColor Gray
Write-Host ""
