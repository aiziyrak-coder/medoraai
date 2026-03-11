#!/bin/bash
# MedoraAI / AiDoktor — serverda to'liq deploy (/root/medoraai)
# Ishga tushirish: cd /root/medoraai && sudo bash deploy/server-deploy.sh

set -e
APP_DIR="/root/medoraai"
cd "$APP_DIR" || { echo "Xato: $APP_DIR topilmadi"; exit 1; }

echo "=== 1. Git pull ==="
git pull origin main

echo "=== 2. Backend venv va migrate ==="
cd "$APP_DIR/backend"
if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput 2>/dev/null || true
deactivate
systemctl restart medoraai-backend-8001.service 2>/dev/null || true

echo "=== 3. Frontend build ==="
cd "$APP_DIR/frontend"
npm install --silent 2>/dev/null || npm install
export VITE_API_BASE_URL=https://medora.cdcgroup.uz/api
if [ -f "$APP_DIR/backend/.env" ]; then
  GEMINI_API_KEY=$(grep -E '^GEMINI_API_KEY=' "$APP_DIR/backend/.env" 2>/dev/null | cut -d= -f2-)
  [ -n "$GEMINI_API_KEY" ] && export VITE_GEMINI_API_KEY="$GEMINI_API_KEY"
fi
npm run build

chmod 755 /root 2>/dev/null || true
chmod 755 "$APP_DIR" "$APP_DIR/dist" 2>/dev/null || true
chmod -R o+rX "$APP_DIR/dist" 2>/dev/null || true
chmod -R o+rX "$APP_DIR/backend/staticfiles" "$APP_DIR/backend/media" 2>/dev/null || true

if [ ! -f "$APP_DIR/dist/index.html" ]; then
  echo "XATO: $APP_DIR/dist/index.html topilmadi."
  exit 1
fi
echo "  dist/index.html mavjud ($(wc -c < "$APP_DIR/dist/index.html") bayt)"

if [ -f "$APP_DIR/backend/.env" ]; then
  sed -i.bak '/^ALLOWED_HOSTS=/d' "$APP_DIR/backend/.env" 2>/dev/null || true
fi

pkill -f "gunicorn.*medoraai_backend.wsgi" 2>/dev/null || true
sleep 1

echo "=== 5. Systemd: backend 8001 ==="
cp "$APP_DIR/deploy/medoraai-backend-8001.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable medoraai-backend-8001.service
systemctl restart medoraai-backend-8001.service
sleep 3
for i in 1 2; do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/ | grep -q 200; then
    echo "  Backend 8001 ishga tushdi."
    break
  fi
  if [ "$i" -eq 1 ]; then
    systemctl restart medoraai-backend-8001.service
    sleep 3
  else
    echo "  XATO: Backend 8001 ishlamadi. systemctl status medoraai-backend-8001.service"
    exit 1
  fi
done

echo "=== 6. Nginx ==="
if [ -d /etc/nginx/sites-available ]; then
  cp "$APP_DIR/deploy/nginx-medoraai-ip.conf" /etc/nginx/sites-available/medoraai 2>/dev/null || true
  ln -sf /etc/nginx/sites-available/medoraai /etc/nginx/sites-enabled/medoraai 2>/dev/null || true
  nginx -t && systemctl reload nginx
  echo "  Nginx reload qilindi."
fi

echo "=== 7. Tekshirish ==="
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/ && echo " Backend 8001 OK" || true
systemctl is-active --quiet medoraai-backend-8001.service && echo "medoraai-backend-8001: active" || echo "medoraai-backend-8001: FAIL"
echo ""
echo "Tugadi. Brauzerda Ctrl+Shift+R bilan yangilang."
