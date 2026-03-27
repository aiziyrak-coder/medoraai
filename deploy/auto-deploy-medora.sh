#!/bin/bash
# MedoraAI - To'liq Avtomatik Deploy Script
# Server: 167.71.53.238 (root)
# Domains: medora.cdcgroup.uz, medoraapi.cdcgroup.uz

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER_USER="root"
SERVER_HOST="167.71.53.238"
SERVER_PASSWORD="Ziyrak2025Ai"
PROJECT_DIR="/root/AiDoktorai"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}🚀 MedoraAI - To'liq Avtomatik Deploy${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Step 1: Git commit & push
echo -e "${YELLOW}[1/5] Git commit va push...${NC}"
cd /mnt/e/medoraai
git add .
git commit -m "Auto-deploy: $(date '+%Y-%m-%d %H:%M:%S')" || echo "No changes"
git push origin main
echo -e "${GREEN}✅ GitHub push completed${NC}"
echo ""

# Step 2: Serverga ulanish va deploy
echo -e "${YELLOW}[2/5] Serverga ulanish...${NC}"

# SSH orqali serverda bajariladigan buyruqlar
ssh -o StrictHostKeyChecking=no -o PasswordAuthentication=yes \
    ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
set -e

echo ""
echo "========================================"
echo "📦 GitHub dan yangiliklarni tortib olish..."
echo "========================================"
cd /root/AiDoktorai
git pull origin main

echo ""
echo "========================================"
echo "🔧 .env faylini yangilash..."
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

echo ".env fayli yaratildi!"

echo ""
echo "========================================"
echo "📦 Dependencielarni o'rnatish..."
echo "========================================"
source venv/bin/activate
pip install -r requirements.txt --quiet
echo "Dependencielar o'rnatildi!"

echo ""
echo "========================================"
echo "🗄️  Migrations..."
echo "========================================"
python manage.py migrate --noinput
echo "Migrations tugallandi!"

echo ""
echo "========================================"
echo "🔄 Gunicorn restart..."
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
echo "Gunicorn ishga tushdi!"

echo ""
echo "========================================"
echo "🌐 Nginx reload..."
echo "========================================"
sudo nginx -t
sudo systemctl reload nginx
echo "Nginx yangilandi!"

echo ""
echo "========================================"
echo "🏥 Health checks..."
echo "========================================"
sleep 3

echo "Local health endpoint test..."
curl -s http://127.0.0.1:8001/health/ && echo " ✅ Health check passed!"

echo ""
echo "Root endpoint test..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:8001/

echo ""
echo "Admin endpoint test..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:8001/admin/

echo ""
echo "========================================"
echo "🎉 Deploy Muvaffaqiyatli Yakunlandi!"
echo "========================================"
echo ""
echo "📝 URL manzillar:"
echo "   - https://medora.cdcgroup.uz/"
echo "   - https://medoraapi.cdcgroup.uz/api/"
echo "   - https://medoraapi.cdcgroup.uz/admin/"
echo ""
echo "📊 Loglarni kuzatish:"
echo "  tail -f /root/AiDoktorai/backend/logs/django.log"
echo "  tail -f /var/log/nginx/error.log"
echo ""

ENDSSH

echo -e "${GREEN}✅ Deploy muvaffaqiyatli yakunlandi!${NC}"
echo ""
echo "🌐 Sayt ishga tushdi:"
echo "   https://medora.cdcgroup.uz/"
echo ""
