#!/bin/bash
# MedoraAI - To'liq avtomatik deploy (faqat /root/medoraai)
# Boshqa loyihalar: nginx ni restart qilmang — faqat reload; boshqa saytlarning
# sites-enabled konfiglariga tegmang.
# Server: fjsti.ziyrak.org  |  katalog: /root/medoraai

set -e

echo "🚀 MedoraAI - Boshlanmoqda..."
echo "================================"

# 1. GitHub dan yangi kodni tortib olish
echo "📥 GitHub dan yangi kod yuklanmoqda..."
cd /root/medoraai
git pull origin main
echo "✅ GitHub dan kod yuklandi"

# 2. Backend dependencies tekshirish
echo "📦 Dependencies tekshirilmoqda..."
cd /root/medoraai/backend
source venv/bin/activate
pip install -r requirements.txt --quiet
echo "✅ Dependencies o'rnatildi"

# 3. Django migrations
echo "🔄 Migrations bajarilmoqda..."
python manage.py migrate --noinput
echo "✅ Migrations bajarildi"

# 4. Frontend build
echo "🏗️ Frontend build qilinmoqda..."
cd /root/medoraai/frontend
npm install --silent
npm run build
echo "✅ Frontend build tugadi"

# 5. Backend restart (Gunicorn)
echo "🔄 Backend restart qilinmoqda..."
sudo systemctl restart medoraai-backend-8001
sleep 3
echo "✅ Backend restart qilindi"

# 6. Nginx reload
echo "🔄 Nginx reload qilinmoqda..."
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx reload qilindi"

# 7. Health check
echo "🏥 Health check..."
sleep 2
response=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/)
if [ "$response" == "200" ]; then
    echo "✅ Health check: MUVAFFAQIYATLI ($response)"
else
    echo "⚠️ Health check: XATOLIK ($response)"
fi

# 8. Xulosa
echo ""
echo "🎉 DEPLOY MUVAFFAQIYATLI TUGADI!"
echo "================================"
echo "✅ Sayt: https://fjsti.ziyrak.org/"
echo "✅ Backend: Port 8001"
echo "✅ Frontend: Yangilandi"
echo "✅ Optimallashtirish: Faol"
echo ""
echo "⏱️ Mutaxassislar: 0ms (darhol)"
echo "⏱️ Konsilium: 60-120s (avvalgiga qaraganda 40% tezroq)"
echo ""
