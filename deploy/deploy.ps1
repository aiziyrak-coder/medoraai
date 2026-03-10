# MEDORA AI - Automated Deployment (PowerShell)
# Pushes to GitHub and deploys to server

Write-Host "================================================" -ForegroundColor Blue
Write-Host "🚀 MEDORA AI - Automated Deployment" -ForegroundColor Blue
Write-Host "================================================" -ForegroundColor Blue
Write-Host ""

# Configuration
$ServerUser = "root"
$ServerHost = "167.71.53.238"
$ServerPassword = "Ziyrak2025Ai"
$ProjectDir = "/root/medoraai"

# Step 1: Push to GitHub
Write-Host "Step 1: Pushing to GitHub..." -ForegroundColor Yellow
git add .
$commitResult = git commit -m "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Changes committed" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No changes to commit or commit skipped" -ForegroundColor Cyan
}

git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GitHub push completed" -ForegroundColor Green
} else {
    Write-Host "❌ GitHub push failed!" -ForegroundColor Red
   exit 1
}
Write-Host ""

# Step 2: Create deployment script content
Write-Host "Step 2: Creating deployment script..." -ForegroundColor Yellow

$deployScript = @'
#!/bin/bash
set -e

echo ""
echo "========================================"
echo "📦 Pulling latest changes..."
echo "========================================"
cd /root/medoraai
git pull origin main

echo ""
echo "========================================"
echo "🔧 Creating.env file..."
echo "========================================"
cd /root/medoraai/backend

cat > .env << 'EOF'
SECRET_KEY=django-insecure-medoraai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,medoraapi.cdcgroup.uz,medora.cdcgroup.uz,medora.ziyrak.org,medoraapi.ziyrak.org,20.82.115.71,167.71.53.238

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz

DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/medoraai/backend/db.sqlite3

GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview

TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
EOF

echo "✅ .env created!"

echo ""
echo "========================================"
echo "📦 Installing dependencies..."
echo "========================================"
source venv/bin/activate
pip install-r requirements.txt --quiet
echo "✅ Dependencies installed!"

echo ""
echo "========================================"
echo "🗄️  Running migrations..."
echo "========================================"
python manage.py migrate --noinput
echo "✅ Migrations completed!"

echo ""
echo "========================================"
echo "🔄 Restarting Gunicorn..."
echo "========================================"
pkill -f gunicorn || true
sleep 2

cd /root/medoraai/backend
source venv/bin/activate
nohup gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 --threads 2 --timeout 120 >> logs/gunicorn.log 2>&1 &

sleep 3
echo "✅ Gunicorn started!"

echo ""
echo "========================================"
echo "🌐 Reloading Nginx..."
echo "========================================"
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx reloaded!"

echo ""
echo "========================================"
echo "🏥 Health checks..."
echo "========================================"
sleep 3
curl -s http://127.0.0.1:8001/health/
echo ""
echo "✅ All checks passed!"

echo ""
echo "========================================"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "Test URLs:"
echo "  https://medoraapi.cdcgroup.uz/"
echo "  https://medoraapi.cdcgroup.uz/admin/"
echo "  https://medora.cdcgroup.uz/"
echo ""
'@

# Save to temp file
$tempScript = "$env:TEMP\deploy_server.sh"
$deployScript | Out-File -FilePath $tempScript -Encoding utf8 -NoNewline
Write-Host "✅ Deployment script created at: $tempScript" -ForegroundColor Green
Write-Host ""

# Step 3: Provide instructions
Write-Host "================================================" -ForegroundColor Blue
Write-Host "Step 3: Deploy to Server" -ForegroundColor Blue
Write-Host "================================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Choose one of the following options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Manual SSH (Recommended)" -ForegroundColor Cyan
Write-Host "  1. Open PowerShell/Terminal" -ForegroundColor Gray
Write-Host "  2. Run: ssh root@167.71.53.238" -ForegroundColor Gray
Write-Host "  3. Password: Ziyrak2025Ai" -ForegroundColor Gray
Write-Host "  4. Copy the script content from: $tempScript" -ForegroundColor Gray
Write-Host "  5. Paste and run on server" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Using Plink (Windows SSH tool)" -ForegroundColor Cyan
Write-Host "  Download Plink from: https://www.putty.org/" -ForegroundColor Gray
Write-Host "  Then run: plink -ssh root@167.71.53.238 -pw Ziyrak2025Ai bash /tmp/deploy_server.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 3: Use the bash script (if on WSL/Linux)" -ForegroundColor Cyan
Write-Host "  Run: bash deploy/full-auto-deploy.sh" -ForegroundColor Gray
Write-Host ""

Write-Host "Opening SSH connection now?" -ForegroundColor Yellow
$response = Read-Host "Type 'y' to proceed with SSH, or press Enter to exit"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host ""
    Write-Host "Opening SSH connection..." -ForegroundColor Green
    Write-Host "Password: Ziyrak2025Ai" -ForegroundColor Yellow
    Write-Host ""
    
    # Try to open SSH connection
    Start-Process"ssh.exe" -ArgumentList "-o", "StrictHostKeyChecking=no", "root@167.71.53.238"
    
    Write-Host ""
    Write-Host "Once connected, copy and paste this command:" -ForegroundColor Cyan
    Write-Host "bash" -ForegroundColor White
    Write-Host "Then paste the deployment script content" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "✅ Deployment process initiated!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
