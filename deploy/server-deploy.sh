#!/bin/bash
# MedoraAI — serverda to'liq deploy (167.71.53.238, /root/medoraai)
# Ishga tushirish: sudo bash deploy/server-deploy.sh  (yoki: chmod +x deploy/server-deploy.sh && sudo ./deploy/server-deploy.sh)

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
python manage.py remove_monitoring_demo_user 2>/dev/null || true
python manage.py create_monitoring_demo_data 2>/dev/null || true
python manage.py collectstatic --noinput 2>/dev/null || true
deactivate
# Backend restart — yangi ALLOWED_HOSTS/settings uchun (400 Bad Request bartaraf)
systemctl restart medoraai-backend-8001.service 2>/dev/null || true

echo "=== 3. Frontend build (API: medora.cdcgroup.uz — bitta domen) ==="
cd "$APP_DIR/frontend"
npm install --silent 2>/dev/null || npm install
# Bitta domen: medora.cdcgroup.uz (API ham shu domen orqali)
export VITE_API_BASE_URL=https://medora.cdcgroup.uz/api
npm run build

# Nginx (www-data) /root/medoraai/dist ni o'qishi uchun huquq
chmod 755 /root 2>/dev/null || true
chmod 755 "$APP_DIR" "$APP_DIR/dist" 2>/dev/null || true
chmod -R o+rX "$APP_DIR/dist" 2>/dev/null || true
chmod -R o+rX "$APP_DIR/backend/staticfiles" "$APP_DIR/backend/media" 2>/dev/null || true

# Dist tekshiruv: index.html borligi
if [ ! -f "$APP_DIR/dist/index.html" ]; then
  echo "XATO: $APP_DIR/dist/index.html topilmadi. Build chiqishi: $(ls -la $APP_DIR/dist 2>/dev/null | head -5)"
  exit 1
fi
echo "  dist/index.html mavjud ($(wc -c < "$APP_DIR/dist/index.html") bayt)"

echo "=== 4. Gateway dependencies (backend venv) ==="
cd "$APP_DIR/backend" && source venv/bin/activate
pip install -q -r ../monitoring_gateway/requirements.txt
deactivate

# Serverni .env da ALLOWED_HOSTS override qilishini o'chirish (DisallowedHost bartaraf)
if [ -f "$APP_DIR/backend/.env" ]; then
  sed -i.bak '/^ALLOWED_HOSTS=/d' "$APP_DIR/backend/.env" 2>/dev/null || true
  echo "  .env dan ALLOWED_HOSTS o'chirildi (agar bor edi)."
fi

echo "=== 5. Systemd: MedoraAI backend 8001 ==="
cp "$APP_DIR/deploy/medoraai-backend-8001.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable medoraai-backend-8001.service
systemctl restart medoraai-backend-8001.service
sleep 3
# Backend 8001 ishlamasa qayta urinish va xabar
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

echo "=== 6. Nginx (medora.cdcgroup.uz, medoraai.cdcgroup.uz) + HTTPS ==="
if [ -d /etc/nginx/sites-available ]; then
  for f in /etc/nginx/sites-enabled/*; do
    [ -e "$f" ] || continue
    target="$(readlink -f "$f" 2>/dev/null)" || target="$f"
    if grep -q "server_name.*medora.*cdcgroup\|server_name.*medoraai.*cdcgroup" "$target" 2>/dev/null; then
      case "$(basename "$f")" in medoraai-cdcgroup) continue ;; esac
      echo "  Eski config o'chirilmoqda: $f"
      rm -f "$f"
    fi
  done
  cp "$APP_DIR/deploy/nginx-medoraai-ip.conf" /etc/nginx/sites-available/medoraai-ip
  ln -sf /etc/nginx/sites-available/medoraai-ip /etc/nginx/sites-enabled/medoraai-ip 2>/dev/null || true

  CERT_PATH="/etc/letsencrypt/live/medora.cdcgroup.uz/fullchain.pem"
  if [ ! -f "$CERT_PATH" ]; then
    echo "  SSL sertifikat yo'q. HTTP-only config, keyin certbot..."
    cp "$APP_DIR/deploy/nginx-cdcgroup-http-only.conf" /etc/nginx/sites-available/medoraai-cdcgroup
    ln -sf /etc/nginx/sites-available/medoraai-cdcgroup /etc/nginx/sites-enabled/medoraai-cdcgroup 2>/dev/null || true
    nginx -t && systemctl reload nginx
    mkdir -p "$APP_DIR/dist/.well-known/acme-challenge"
    if command -v certbot >/dev/null 2>&1; then
      certbot certonly --webroot -w "$APP_DIR/dist" -d medora.cdcgroup.uz -d medoraai.cdcgroup.uz -d medoraapi.cdcgroup.uz \
        --non-interactive --agree-tos -m admin@cdcgroup.uz --no-eff-email --expand 2>/dev/null || true
    else
      echo "  certbot o'rnatilmagan: apt install certbot -y"
    fi
  fi

  if [ -f "$CERT_PATH" ]; then
    cp "$APP_DIR/deploy/nginx-cdcgroup.conf" /etc/nginx/sites-available/medoraai-cdcgroup
    ln -sf /etc/nginx/sites-available/medoraai-cdcgroup /etc/nginx/sites-enabled/medoraai-cdcgroup 2>/dev/null || true
    nginx -t && systemctl reload nginx
    echo "  HTTPS (443) yoqildi."
  else
    echo "  HTTPS uchun certbot qayta ishlatib sertifikat oling, keyin deployni takrorlang."
  fi
else
  echo "Nginx sites-available yo'q."
fi

echo "=== 7. Tekshirish ==="
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/ && echo " Backend 8001 OK" || echo " Backend 8001 javob bermadi"
systemctl is-active --quiet medoraai-backend-8001.service && echo "medoraai-backend-8001: active" || echo "medoraai-backend-8001: FAIL"
# medoraapi.cdcgroup.uz Host bilan 8001 ga so'rov — DisallowedHost bo'lmasa 200
HTTP_API_HOST=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: medoraapi.cdcgroup.uz" http://127.0.0.1:8001/ 2>/dev/null || echo "000")
echo "  medoraapi.cdcgroup.uz (8001 ga): HTTP $HTTP_API_HOST (200 bo'lishi kerak; 400 bo'lsa wsgi.py patch yuklanmagan)"
# medora.cdcgroup.uz localda 200 qaytarsa — nginx to'g'ri
HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: medora.cdcgroup.uz" http://127.0.0.1/)
echo "  medora.cdcgroup.uz (local): HTTP $HTTP_FRONT (200 bo'lishi kerak; 404 bo'lsa DNS boshqa serverga yo'naltirilgan bo'lishi mumkin)"

echo ""
echo "Tugadi. Bitta domen: https://medora.cdcgroup.uz (frontend + /api/ + /health/). Brauzerda Ctrl+Shift+R bilan yangilang."
echo ""
# 400 chiqsa: DNS tekshirish (medora.cdcgroup.uz -> 167.71.53.238 bo'lishi kerak)
PUBLIC_HEALTH=$(curl -sk -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://medora.cdcgroup.uz/health/" 2>/dev/null || echo "err")
echo "  Public https://medora.cdcgroup.uz/health/ (servernan): HTTP $PUBLIC_HEALTH (200 bo'lishi kerak; 400/err bo'lsa: deploy/TROUBLESHOOT_400.md)"
