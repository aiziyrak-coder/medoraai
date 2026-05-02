#!/usr/bin/env bash
# Serverda ishga tushiring: /root/aidoktorfjsti dan keyin.
# Boshqa Gunicorn jarayonlariga tegmaydi — faqat systemd: aidoktorfjsti-backend (port 8020).
# Nginx: faqat yangi fayl sites-enabled/aidoktor-uz.conf (mavjud saytlarni o'zgartirmaydi).

set -euo pipefail

ROOT="${AIDOKTOR_ROOT:-/root/aidoktorfjsti}"
BACKEND_PORT="${AIDOKTOR_BACKEND_PORT:-8020}"
REPO_URL="${AIDOKTOR_REPO_URL:-https://github.com/aiziyrak-coder/aidoktorfjsti.git}"
BRANCH="${AIDOKTOR_BRANCH:-main}"
CERT_EMAIL="${DEPLOY_CERTBOT_EMAIL:-admin@aidoktor.uz}"

echo "==> Aidoktor.uz deploy: ROOT=$ROOT"

if ! command -v git >/dev/null; then
  echo "git kerak"; exit 1
fi

if [ ! -d "$ROOT/.git" ]; then
  mkdir -p "$(dirname "$ROOT")"
  git clone "$REPO_URL" "$ROOT"
fi
cd "$ROOT"
git fetch origin
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH" 2>/dev/null || true
git pull origin "$BRANCH" || git pull origin HEAD

cd "$ROOT/frontend"
if [ ! -f .env.production ] && [ -f .env.example ]; then
  echo "VITE_API_BASE_URL=https://api.aidoktor.uz/api" > .env.production
  echo "Taqqoslash: kerak bo'lsa GEMINI va boshqa VITE_* ni .env.production ga qo'shing"
fi
npm ci
export NODE_ENV=production
npm run build

cd "$ROOT/backend"
python3 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
pip install -r requirements.txt --quiet

mkdir -p logs
if [ ! -f .env ]; then
  cat > .env << EOF
SECRET_KEY=$(python3 -c "from django.core.management.utils import get_random_secret_key as k; print(k())")
DEBUG=False
ALLOWED_HOSTS=aidoktor.uz,www.aidoktor.uz,api.aidoktor.uz,127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=https://aidoktor.uz,https://www.aidoktor.uz
CSRF_TRUSTED_ORIGINS=https://aidoktor.uz,https://www.aidoktor.uz,https://api.aidoktor.uz
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=$ROOT/backend/db.sqlite3
SECURE_SSL_REDIRECT=True
GEMINI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_PAYMENT_GROUP_ID=
EOF
  echo "Yangi backend/.env yaratildi — GEMINI_API_KEY va boshqalarni to'ldiring."
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput

install -m 644 "$ROOT/deploy/systemd/aidoktorfjsti-backend.service" /etc/systemd/system/aidoktorfjsti-backend.service
systemctl daemon-reload
systemctl enable aidoktorfjsti-backend
systemctl restart aidoktorfjsti-backend

sleep 2
curl -fsS --max-time 15 "http://127.0.0.1:${BACKEND_PORT}/health/" || {
  echo "Gunicorn salomatligi tekshiruvi muvaffaqiyatsiz — journalctl -u aidoktorfjsti-backend -n 50"
  exit 1
}

# TLS: avval HTTP bootstrap, keyin certbot; certbot yiqilsa HTTP qoladi (DNS keyin tuzatiladi)
NGX_AVAIL="/etc/nginx/sites-available/aidoktor-uz.conf"
NGX_EN="/etc/nginx/sites-enabled/aidoktor-uz.conf"
CERT_PATH="/etc/letsencrypt/live/aidoktor.uz/fullchain.pem"

if [ ! -f "$CERT_PATH" ]; then
  install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-http-bootstrap.conf" "$NGX_AVAIL"
  ln -sf "$NGX_AVAIL" "$NGX_EN"
  nginx -t
  systemctl reload nginx
  if command -v certbot >/dev/null 2>&1; then
    certbot certonly --webroot -w "$ROOT/frontend/dist" \
      -d aidoktor.uz -d api.aidoktor.uz \
      --agree-tos --non-interactive -m "$CERT_EMAIL" \
      || echo "WARN: certbot muvaffaqiyatsiz — HTTP ishlaydi; DNS A yozuvlari va domen tekshirilsin."
  else
    echo "WARN: certbot o'rnatilmagan — faqat HTTP."
  fi
fi

if [ -f "$CERT_PATH" ]; then
  install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-ssl.conf" "$NGX_AVAIL"
else
  install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-http-bootstrap.conf" "$NGX_AVAIL"
fi
ln -sf "$NGX_AVAIL" "$NGX_EN"
nginx -t
systemctl reload nginx

echo "=== Backend: http://127.0.0.1:${BACKEND_PORT}/health/ ok ==="
if [ -f "$CERT_PATH" ]; then
  echo "Tayyor (HTTPS): https://aidoktor.uz  |  https://api.aidoktor.uz"
else
  echo "HTTP rejim: http://aidoktor.uz va http://api.aidoktor.uz (TLS uchun DNS + certbot)"
fi
