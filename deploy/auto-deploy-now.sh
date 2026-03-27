#!/bin/bash
# Serverda avtomatik deploy - mening ishtirokimsiz

SERVER="root@167.71.53.238"
PASSWORD="Ziyrak2025Ai"

echo "🚀 Serverga deploy boshlandi..."
echo ""

# Deploy skriptni serverda bajarish
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" << 'ENDSSH'
set -e

echo "========================================"
echo "🚀 MedoraAI - Server Deploy"
echo "========================================"
echo ""

cd /root/AiDoktorai

echo "📦 GitHub dan yangiliklarni olish..."
git pull origin main
echo "✅ Pull completed"
echo ""

cd backend

echo "🔧 .env faylini yangilash..."
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
echo "✅ .env created"
echo ""

echo "📦 Dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet
echo "✅ Dependencies installed"
echo ""

echo "🗄️  Migrations..."
python manage.py migrate --noinput
echo "✅ Migrations completed"
echo ""

echo "🔄 Gunicorn restart..."
pkill -f gunicorn || true
sleep 2

cd /root/AiDoktorai/backend
source venv/bin/activate
nohup gunicorn AiDoktorai_backend.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --threads 2 \
    --timeout 120 \
    >> logs/gunicorn.log 2>&1 &

sleep 3
echo "✅ Gunicorn restarted"
echo ""

echo "🌐 Nginx reload..."
sudo nginx -t
sudo systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

echo "🏥 Health check..."
sleep 3
curl -s http://127.0.0.1:8001/health/ && echo "✅ Health check passed"
echo ""

echo "========================================"
echo "🎉 DEPLOY MUVAFFAQIYATLI YAKUNLANDI!"
echo "========================================"
echo ""
echo "🌐 URL: https://medora.cdcgroup.uz/"
echo "🌐 API: https://medoraapi.cdcgroup.uz/api/"
echo ""

# Status tekshirish
echo "📊 Status:"
ps aux | grep gunicorn | grep -v grep | wc -l | xargs echo "   Gunicorn workers:"
systemctl is-active nginx | xargs echo "   Nginx status:"
netstat -tlnp | grep 8001 | wc -l | xargs echo "   Port 8001 listening:"
echo ""

ENDSSH

if [ $? -eq 0 ]; then
    echo "✅ Deploy muvaffaqiyatli yakunlandi!"
    echo ""
    echo "🌐 Sayt: https://medora.cdcgroup.uz/"
else
    echo "❌ Deploy xato bilan yakunlandi!"
    exit 1
fi
