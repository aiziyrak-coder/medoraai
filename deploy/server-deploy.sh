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
python manage.py collectstatic --noinput 2>/dev/null || true
deactivate

echo "=== 3. Frontend build (API: medoraai.cdcgroup.uz) ==="
cd "$APP_DIR/frontend"
npm install --silent 2>/dev/null || npm install
export VITE_API_BASE_URL=https://medoraai.cdcgroup.uz/api
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

echo "=== 5. Systemd: MedoraAI backend 8001 ==="
cp "$APP_DIR/deploy/medoraai-backend-8001.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable medoraai-backend-8001.service
systemctl restart medoraai-backend-8001.service

echo "=== 6. Nginx (medora.cdcgroup.uz, medoraai.cdcgroup.uz — eski bloklarni o'chirish) ==="
if [ -d /etc/nginx/sites-available ]; then
  # Eski configlar (medora.cdcgroup.uz / medoraai.cdcgroup.uz) sites-enabled dan olib tashlash — yangi config ishlashi uchun
  for f in /etc/nginx/sites-enabled/*; do
    [ -e "$f" ] || continue
    target="$(readlink -f "$f" 2>/dev/null)" || target="$f"
    if grep -q "server_name.*medora.*cdcgroup\|server_name.*medoraai.*cdcgroup" "$target" 2>/dev/null; then
      case "$(basename "$f")" in
        medoraai-cdcgroup) continue ;;
      esac
      echo "  Eski config o'chirilmoqda: $f"
      rm -f "$f"
    fi
  done
  cp "$APP_DIR/deploy/nginx-medoraai-ip.conf" /etc/nginx/sites-available/medoraai-ip
  cp "$APP_DIR/deploy/nginx-cdcgroup.conf" /etc/nginx/sites-available/medoraai-cdcgroup
  ln -sf /etc/nginx/sites-available/medoraai-ip /etc/nginx/sites-enabled/medoraai-ip 2>/dev/null || true
  ln -sf /etc/nginx/sites-available/medoraai-cdcgroup /etc/nginx/sites-enabled/medoraai-cdcgroup 2>/dev/null || true
  nginx -t && systemctl reload nginx
else
  echo "Nginx sites-available yo'q; configni qo'lda qo'ying."
fi

echo "=== 7. Tekshirish ==="
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/ && echo " Backend 8001 OK" || echo " Backend 8001 javob bermadi"
systemctl is-active --quiet medoraai-backend-8001.service && echo "medoraai-backend-8001: active" || echo "medoraai-backend-8001: FAIL"
# medora.cdcgroup.uz localda 200 qaytarsa — nginx to'g'ri; 404 bo'lsa — config yoki root muammo
HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: medora.cdcgroup.uz" http://127.0.0.1/)
echo "  medora.cdcgroup.uz (local): HTTP $HTTP_FRONT (200 bo'lishi kerak; 404 bo'lsa DNS boshqa serverga yo'naltirilgan bo'lishi mumkin)"

echo ""
echo "Tugadi. Frontend: http://medora.cdcgroup.uz  API: http://medoraai.cdcgroup.uz  (DNS 167.71.53.238 ga yo'naltirilgan bo'lishi kerak)"
