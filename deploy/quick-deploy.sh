#!/bin/bash
# MedoraAI - To'liq Avtomatik Deploy (Windows WSL orqali)

echo "🚀 MedoraAI - Serverga Deploy boshlandi..."
echo ""

SERVER="root@167.71.53.238"
PASSWORD="Ziyrak2025Ai"

# Serverda bajariladigan buyruqlar
read -r -d '' REMOTE_CMD << 'ENDOFSCRIPT'
set -e

echo "========================================"
echo "📦 GitHub dan yangiliklarni olish..."
echo "========================================"
cd /root/AiDoktorai
git pull origin main

echo ""
echo "========================================"
echo "🔧 .env faylini yaratish..."
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

echo ".env fayli yangilandi!"

echo ""
echo "========================================"
echo "📦 Dependencies..."
echo "========================================"
source venv/bin/activate
pip install -r requirements.txt --quiet

echo ""
echo "========================================"
echo "🗄️  Migrations..."
echo "========================================"
python manage.py migrate --noinput

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

echo ""
echo "========================================"
echo "🌐 Nginx reload..."
echo "========================================"
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "========================================"
echo "🏥 Health checks..."
echo "========================================"
sleep 3
curl -s http://127.0.0.1:8001/health/ && echo "✅ Health check passed!"

echo ""
echo "========================================"
echo "🎉 DEPLOY MUVAFFAQIYATLI YAKUNLANDI!"
echo "========================================"
echo ""
echo "🌐 URL: https://medora.cdcgroup.uz/"
echo "🌐 API: https://medoraapi.cdcgroup.uz/api/"
echo ""
ENDOFSCRIPT

# SSH orqali serverga ulanish va buyruqlarni bajarish
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "$REMOTE_CMD"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy muvaffaqiyatli yakunlandi!"
    echo ""
    echo "🌐 Sayt: https://medora.cdcgroup.uz/"
else
    echo ""
    echo "❌ Deploy xato bilan yakunlandi!"
    echo "SSH password yoki server ma'lumotlarini tekshiring."
    exit 1
fi
