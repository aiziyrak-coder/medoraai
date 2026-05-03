#!/bin/bash
# FULL DEPLOYMENT SCRIPT - Copy and paste this ENTIRE script on server

set -e

echo "========================================"
echo "🚀 AiDoktor - Full Deployment"
echo "========================================"
echo ""

# Step 1: Git pull
echo "📦 Pulling latest changes..."
cd /root/AiDoktorai
git pull origin main
echo "✅ Git pull complete"
echo ""

# Step 2: Create.env file
echo "🔧 Creating.env file..."
cd /root/AiDoktorai/backend

cat > .env << 'EOF'
SECRET_KEY=django-insecure-AiDoktorai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,AiDoktorapi.fargana.uz,AiDoktor.fargana.uz,AiDoktor.ziyrak.org,AiDoktorapi.ziyrak.org,20.82.115.71,167.71.53.238
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://AiDoktor.fargana.uz,https://AiDoktorapi.fargana.uz
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/AiDoktorai/backend/db.sqlite3
GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview
TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
EOF

echo "✅ .env created"
echo ""

# Step 3: Install dependencies
echo "📦 Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet
echo "✅ Dependencies installed"
echo ""

# Step 4: Database migrations
echo "🗄️  Running migrations..."
python manage.py migrate --noinput
echo "✅ Migrations complete"
echo ""

# Step 5: Restart Gunicorn
echo "🔄 Restarting Gunicorn..."
pkill-f gunicorn || true
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
echo "✅ Gunicorn restarted"
echo ""

# Step 6: Reload Nginx
echo "🌐 Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

# Step 7: Health checks
echo "🏥 Running health checks..."
sleep 3

echo "Testing local health endpoint..."
if curl -s http://127.0.0.1:8001/health/ | grep -q "healthy"; then
   echo "✅ Health check PASSED"
else
   echo "⚠️  Health check returned non-200"
fi

echo ""
echo "Testing root endpoint..."
ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/)
echo "   Root endpoint: HTTP $ROOT_STATUS"

echo ""
echo "Testing admin endpoint..."
ADMIN_STATUS=$(curl -s -o /dev/null-w "%{http_code}" http://127.0.0.1:8001/admin/)
echo "   Admin endpoint: HTTP $ADMIN_STATUS"

echo ""
echo "========================================"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "Test URLs:"
echo "  Backend: https://AiDoktorapi.fargana.uz/"
echo "  Admin: https://AiDoktorapi.fargana.uz/admin/"
echo "  Frontend: https://AiDoktor.fargana.uz/"
echo ""
echo "Registration test:"
echo "  curl -X POST https://AiDoktorapi.fargana.uz/api/auth/register/ \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"phone\":\"+998901234567\",\"name\":\"Test\",\"password\":\"testpass123\",\"password_confirm\":\"testpass123\",\"role\":\"monitoring\"}'"
echo ""
echo "Monitor logs:"
echo "  tail -f /root/AiDoktorai/backend/logs/django.log"
echo ""
-NoNewline
