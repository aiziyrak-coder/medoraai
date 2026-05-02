#!/bin/bash
# Tezkor restart - faqat Gunicorn va Nginx
echo "🔄 Tezkor restart..."

# Gunicorn restart
pkill -f "gunicorn.*AiDoktorai_backend"
sleep 2

cd /root/AiDoktorai/backend
source venv/bin/activate
nohup gunicorn AiDoktorai_backend.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --timeout 120 \
    > /dev/null 2>&1 &

sleep 3

# Nginx reload
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Restart tamam!"
echo ""
echo "🧪 Test:"
curl -I http://127.0.0.1:8001/health/
echo ""
echo "Brauzerda tekshiring: https://AiDoktorapi.fargana.uz/"
-NoNewline
