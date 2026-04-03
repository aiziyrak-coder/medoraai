#!/bin/bash
# MedoraAI / AiDoktor — serverda to'liq deploy (/root/medoraai)
# Ishga tushirish: cd /root/medoraai && sudo bash deploy/server-deploy.sh

set -e
APP_DIR="/root/medoraai"
cd "$APP_DIR" || { echo "Xato: $APP_DIR topilmadi"; exit 1; }

echo "=== 1. Git pull ==="
git pull origin main

echo "=== 2. Backend venv va migrate (SQL bazasi serverda saqlanadi) ==="
cd "$APP_DIR/backend"
# SQLite: serverda doimiy path — restart dan keyin ma'lumotlar yo'qolmasin
MEDORA_DB="$APP_DIR/backend/db.sqlite3"
if [ -f .env ]; then
  grep -q '^DB_NAME=' .env || echo "DB_NAME=$MEDORA_DB" >> .env
  grep -q '^DB_ENGINE=' .env || echo "DB_ENGINE=django.db.backends.sqlite3" >> .env
else
  touch .env
  echo "DB_NAME=$MEDORA_DB" >> .env
  echo "DB_ENGINE=django.db.backends.sqlite3" >> .env
fi
if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
python manage.py migrate --noinput
# Bazaga yozish huquqi (restart dan keyin ham saqlanadi)
[ -f db.sqlite3 ] && chmod 664 db.sqlite3
[ -f "$MEDORA_DB" ] && chmod 664 "$MEDORA_DB" 2>/dev/null || true
python manage.py collectstatic --noinput 2>/dev/null || true
deactivate
systemctl restart medoraai-backend-8001.service 2>/dev/null || true

echo "=== 3. Frontend build ==="
cd "$APP_DIR/frontend"
npm install --silent 2>/dev/null || npm install
# API URL: backend .env da VITE_API_BASE_URL bo'lsa shu (FJSTI: https://fjstiapi.ziyrak.org/api)
VITE_API_BASE_URL="https://medora.cdcgroup.uz/api"
if [ -f "$APP_DIR/backend/.env" ]; then
  _v=$(grep -E '^VITE_API_BASE_URL=' "$APP_DIR/backend/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r')
  _v=$(echo "$_v" | sed "s/^[\"']//;s/[\"']$//")
  [ -n "$_v" ] && VITE_API_BASE_URL="$_v"
  GEMINI_API_KEY=$(grep -E '^GEMINI_API_KEY=' "$APP_DIR/backend/.env" 2>/dev/null | cut -d= -f2-)
  [ -n "$GEMINI_API_KEY" ] && export VITE_GEMINI_API_KEY="$GEMINI_API_KEY"
fi
export VITE_API_BASE_URL
echo "  VITE_API_BASE_URL=$VITE_API_BASE_URL"
npm run build

chmod 755 /root 2>/dev/null || true
chmod 755 "$APP_DIR" "$APP_DIR/frontend/dist" 2>/dev/null || true
chmod -R o+rX "$APP_DIR/frontend/dist" 2>/dev/null || true
chmod -R o+rX "$APP_DIR/backend/staticfiles" "$APP_DIR/backend/media" 2>/dev/null || true

if [ ! -f "$APP_DIR/frontend/dist/index.html" ]; then
  echo "XATO: $APP_DIR/frontend/dist/index.html topilmadi. Build chiqishi: $(ls -la $APP_DIR/frontend/dist 2>/dev/null | head -5)"
  exit 1
fi
echo "  frontend/dist/index.html mavjud ($(wc -c < "$APP_DIR/frontend/dist/index.html") bayt)"

# Nginx /root/medoraai/dist dan xizmat qiladi — symlink qilamiz
rm -rf "$APP_DIR/dist" 2>/dev/null || true
ln -sfn "$APP_DIR/frontend/dist" "$APP_DIR/dist"
chmod -R o+rX "$APP_DIR/dist" 2>/dev/null || true

if [ -f "$APP_DIR/backend/.env" ]; then
  if ! grep -qE '^ALLOWED_HOSTS=' "$APP_DIR/backend/.env" 2>/dev/null; then
    echo "  ESLATMA: backend/.env da ALLOWED_HOSTS yo'q — settings.py dagi default domenlar ishlatiladi."
  fi
fi

pkill -f "gunicorn.*medoraai_backend.wsgi" 2>/dev/null || true
sleep 1

echo "=== 5. Systemd: MedoraAI backend 8001 ==="
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
    echo "  Backend 8001 birinchi marta javob bermadi, qayta ishga tushirilmoqda..."
    systemctl restart medoraai-backend-8001.service
    sleep 3
  else
    echo "  XATO: Backend 8001 ishlamadi. Tekshiring: systemctl status medoraai-backend-8001.service && journalctl -u medoraai-backend-8001.service -n 30 --no-pager"
    exit 1
  fi
done

echo "=== 6. Nginx reload ==="
nginx -t 2>/dev/null && systemctl reload nginx && echo "  Nginx reload OK" || echo "  Nginx reload skip (config mavjud bo'lsa qo'lda reload qiling)"

echo "=== 7. Tekshirish ==="
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/ && echo " Backend 8001 OK" || echo " Backend 8001 javob bermadi"
systemctl is-active --quiet medoraai-backend-8001.service && echo "medoraai-backend-8001: active" || echo "medoraai-backend-8001: FAIL"
HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: medoraapi.cdcgroup.uz" http://127.0.0.1:8001/ 2>/dev/null || echo "000")
echo "  medoraapi.cdcgroup.uz (8001): HTTP $HTTP_API (200 kerak)"
HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: medora.cdcgroup.uz" http://127.0.0.1/ 2>/dev/null || echo "000")
echo "  medora.cdcgroup.uz (local): HTTP $HTTP_FRONT (200 kerak)"

echo ""
echo "Tugadi. https://medora.cdcgroup.uz — Brauzerda Ctrl+Shift+R bilan yangilang."
PUBLIC_HEALTH=$(curl -sk -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://medora.cdcgroup.uz/health/" 2>/dev/null || echo "err")
echo "  Public /health/: HTTP $PUBLIC_HEALTH"
