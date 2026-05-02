#!/bin/bash
# Serverda deploy va restart qilish uchun script
# Foydalanish: ./deploy-test.sh

echo "================================================"
echo "🚀 AiDoktor - Deploy & Restart Script"
echo "================================================"
echo ""

# 1. Git pull
echo "📦 GitHub'dan yangilanishlarni yuklash..."
cd /root/AiDoktorai
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Git pull xatolik!"
    exit 1
fi
echo "✅ Git pull muvaffaqiyatli!"
echo ""

# 2. Backend .env faylini tekshirish
echo "🔧 Backend .env faylini tekshirish..."
cd /root/AiDoktorai/backend

if [ ! -f ".env" ]; then
    echo "❌ .env fayl topilmadi!"
    exit 1
fi

# ALLOWED_HOSTS ni tekshirish
if grep -q "AiDoktorapi.fargana.uz" .env; then
    echo "✅ ALLOWED_HOSTS to'g'ri sozlangan"
else
    echo "⚠️  ALLOWED_HOSTS da AiDoktorapi.fargana.uz yo'q!"
    echo "Quyidagi buyruqni bajaring:"
    echo "nano .env"
    echo ""
    echo "ALLOWED_HOSTS=localhost,127.0.0.1,AiDoktorapi.fargana.uz,AiDoktor.fargana.uz,AiDoktor.ziyrak.org,AiDoktorapi.ziyrak.org,20.82.115.71,167.71.53.238"
   read -p "Davom etishdan oldin .env ni tahrirlashni xohlaysizmi? (y/n): " edit_choice
    if [ "$edit_choice" = "y" ]; then
        nano .env
    fi
fi
echo ""

# 3. Dependencies o'rnatish (agar kerak bo'lsa)
echo "📦 Dependencies tekshirilmoqda..."
pip install -r requirements.txt --quiet
echo "✅ Dependencies tayyor"
echo ""

# 4. Database migrations
echo "🗄️  Database migrations tekshirilmoqda..."
python manage.py migrate --noinput
echo "✅ Migrations bajarildi"
echo ""

# 5. Gunicorn restart
echo "🔄 Gunicorn restart qilinmoqda..."

# Variant 1: Agar systemctl ishlatilsa
if command -v systemctl &> /dev/null && systemctl is-active --quiet AiDoktorai-backend; then
    echo "Systemctl orqali restart..."
    sudo systemctl restart AiDoktorai-backend
    sudo systemctl status AiDoktorai-backend --no-pager
else
    # Variant 2: Manual restart
    echo "Manual restart..."
    
    # Eski process'larni to'xtatish
    pkill -f "gunicorn.*AiDoktorai_backend"
    sleep 2
    
    # Yangi process boshlash (background)
    cd /root/AiDoktorai/backend
    source venv/bin/activate
    nohup gunicorn AiDoktorai_backend.wsgi:application \
        --bind 127.0.0.1:8001 \
        --workers 3 \
        --threads 2 \
        --timeout 120 \
        --access-logfile logs/access.log \
        --error-logfile logs/error.log \
        > /dev/null 2>&1 &
    
    echo $! > /tmp/gunicorn.pid
    sleep 3
fi

echo "✅ Gunicorn restart edildi"
echo ""

# 6. Nginx restart (agar kerak bo'lsa)
echo "🔄 Nginx tekshirilmoqda..."
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx reload qilindi"
else
    echo "❌ Nginx konfiguratsiyasida xatolik!"
fi
echo ""

# 7. Health check
echo "🏥 Health check bajarilmoqda..."
sleep 3

# Local health check
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/)

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Backend health check: OK (HTTP $HEALTH_RESPONSE)"
else
    echo "❌ Backend health check: FAILED (HTTP $HEALTH_RESPONSE)"
    echo "Loglarni tekshiring: /root/AiDoktorai/backend/logs/"
fi
echo ""

# 8. Test endpoints
echo "🧪 Test endpoints:"
echo ""

# Root endpoint
echo "1. Root endpoint (/):"
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" http://127.0.0.1:8001/

# Admin endpoint
echo "2. Admin endpoint (/admin/):"
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" http://127.0.0.1:8001/admin/

# API endpoint
echo "3. API endpoint (/api/):"
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" http://127.0.0.1:8001/api/

echo ""
echo "================================================"
echo "✅ Deploy & Restart yakunlandi!"
echo "================================================"
echo ""
echo "📝 Keyingi qadamlar:"
echo "1. Brauzerda ochib tekshiring:"
echo "   - https://AiDoktorapi.fargana.uz/"
echo "   - https://AiDoktorapi.fargana.uz/admin/"
echo "   - https://AiDoktor.fargana.uz/"
echo ""
echo "2. Agar xatolik bo'lsa loglarni tekshiring:"
echo "   - tail -f /root/AiDoktorai/backend/logs/django.log"
echo "   - tail -f /var/log/nginx/error.log"
echo ""
echo "3. Yoki ushbu skriptni qayta ishga tushiring:"
echo "   ./deploy-test.sh"
echo ""
-NoNewline
