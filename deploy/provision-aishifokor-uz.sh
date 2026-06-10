#!/usr/bin/env bash
# aishifokor.uz + api.aishifokor.uz — to'liq deploy (Digital Ocean 164.90.186.193)
# Ishga tushirish: bash deploy/provision-aishifokor-uz.sh

set -euo pipefail

ROOT="${AISHIFOKOR_ROOT:-/root/aishifokor}"
BACKEND_PORT="${AISHIFOKOR_BACKEND_PORT:-8100}"
REPO_URL="${AISHIFOKOR_REPO_URL:-https://github.com/aiziyrak-coder/aidoktorfjsti.git}"
BRANCH="${AISHIFOKOR_BRANCH:-main}"
FRONT_HOST="aishifokor.uz"
API_HOST="api.aishifokor.uz"
CERT_EMAIL="${DEPLOY_CERTBOT_EMAIL:-admin@aishifokor.uz}"

echo "==> AiShifokor deploy: $FRONT_HOST | $API_HOST | ROOT=$ROOT"

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
git reset --hard "origin/$BRANCH"
echo "GIT: $(git log -1 --oneline)"

cd "$ROOT/frontend"
DS_KEY="${DEEPSEEK_API_KEY:-${ANTHROPIC_API_KEY:-}}"
{
  echo "VITE_API_BASE_URL=https://${FRONT_HOST}/api"
  if [ -n "$DS_KEY" ]; then
    echo "VITE_DEEPSEEK_API_KEY=$DS_KEY"
    echo "VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com"
  fi
} > .env.production
npm ci
export NODE_ENV=production
npm run build

cd "$ROOT/backend"
python3 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
pip install -r requirements.txt --quiet
mkdir -p logs

ENV_FILE="$ROOT/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << EOF
SECRET_KEY=$(python3 -c "from django.core.management.utils import get_random_secret_key as k; print(k())")
DEBUG=False
ALLOWED_HOSTS=${FRONT_HOST},www.${FRONT_HOST},${API_HOST},127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=https://${FRONT_HOST},https://www.${FRONT_HOST},http://${FRONT_HOST}
CSRF_TRUSTED_ORIGINS=https://${FRONT_HOST},https://www.${FRONT_HOST},https://${API_HOST}
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=$ROOT/backend/db.sqlite3
SECURE_SSL_REDIRECT=True
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL_FAST=deepseek-chat
DEEPSEEK_MODEL_PRO=deepseek-reasoner
TELEGRAM_BOT_TOKEN=
TELEGRAM_PAYMENT_GROUP_ID=
EOF
  echo "Yangi backend/.env — DEEPSEEK_API_KEY ni to'ldiring."
fi

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}
set_kv ALLOWED_HOSTS "${FRONT_HOST},www.${FRONT_HOST},${API_HOST},127.0.0.1,localhost"
set_kv CORS_ALLOWED_ORIGINS "https://${FRONT_HOST},https://www.${FRONT_HOST},http://${FRONT_HOST}"
set_kv CSRF_TRUSTED_ORIGINS "https://${FRONT_HOST},https://www.${FRONT_HOST},https://${API_HOST}"
set_kv SECURE_SSL_REDIRECT "True"
if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  set_kv DEEPSEEK_API_KEY "$DEEPSEEK_API_KEY"
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py assign_fjsti_group 2>/dev/null || true

ADMIN_PHONE="${ADMIN_PHONE:-+998995751111}"
ADMIN_PASS="${ADMIN_PASSWORD:-admin1234}"
python manage.py ensure_superuser --phone "$ADMIN_PHONE" --password "$ADMIN_PASS" --name "AiShifokor Admin" 2>/dev/null || true

install -m 644 "$ROOT/deploy/systemd/aishifokor-backend.service" /etc/systemd/system/aishifokor-backend.service
systemctl daemon-reload
systemctl enable aishifokor-backend
systemctl restart aishifokor-backend

sleep 2
curl -fsS --max-time 15 "http://127.0.0.1:${BACKEND_PORT}/health/" || {
  echo "Backend health xato — journalctl -u aishifokor-backend -n 50"
  exit 1
}

chmod 755 /root 2>/dev/null || true
chmod -R o+rX "$ROOT/frontend/dist" "$ROOT/backend/staticfiles" "$ROOT/backend/media" 2>/dev/null || true

# Nginx: HTTP bootstrap (SSL sertifikat olishdan oldin)
NGX_BOOT="$ROOT/deploy/nginx-aishifokor-http-bootstrap.conf"
if [ ! -f "$ROOT/deploy/nginx-aishifokor-uz.conf" ]; then
  echo "nginx-aishifokor-uz.conf topilmadi"; exit 1
fi

cat > "$NGX_BOOT" << 'BOOT'
server {
    listen 80;
    server_name aishifokor.uz www.aishifokor.uz api.aishifokor.uz;
    client_max_body_size 20M;
    root /root/aishifokor/frontend/dist;
    location /.well-known/acme-challenge/ { root /root/aishifokor/frontend/dist; }
    location /api/ {
        proxy_pass http://127.0.0.1:8100/api/;
        proxy_set_header Host api.aishifokor.uz;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /health/ { proxy_pass http://127.0.0.1:8100/health/; }
    location /static/ { alias /root/aishifokor/backend/staticfiles/; }
    location /media/  { alias /root/aishifokor/backend/media/; }
    location / { try_files $uri $uri/ /index.html; }
}
BOOT

NGX_AVAIL="/etc/nginx/sites-available/aishifokor-uz.conf"
NGX_EN="/etc/nginx/sites-enabled/00-aishifokor-uz.conf"

if [ ! -f /etc/letsencrypt/live/aishifokor.uz/fullchain.pem ]; then
  install -m 644 "$NGX_BOOT" "$NGX_AVAIL"
else
  install -m 644 "$ROOT/deploy/nginx-aishifokor-uz.conf" "$NGX_AVAIL"
fi
ln -sf "$NGX_AVAIL" "$NGX_EN"
nginx -t
systemctl reload nginx

# SSL sertifikat (DNS tayyor bo'lsa)
if [ ! -f /etc/letsencrypt/live/aishifokor.uz/fullchain.pem ]; then
  echo "==> Certbot SSL..."
  CERT_DOMAINS="-d api.aishifokor.uz"
  if host aishifokor.uz 2>/dev/null | grep -q "164.90.186.193"; then
    CERT_DOMAINS="-d aishifokor.uz -d www.aishifokor.uz -d api.aishifokor.uz"
  fi
  certbot certonly --webroot -w "$ROOT/frontend/dist" \
    $CERT_DOMAINS \
    --email "$CERT_EMAIL" --agree-tos --non-interactive --keep-until-expiring || {
    echo "Certbot xato — DNS tekshiring (aishifokor.uz → 164.90.186.193)"
  }
  if [ -f /etc/letsencrypt/live/aishifokor.uz/fullchain.pem ] || [ -f /etc/letsencrypt/live/api.aishifokor.uz/fullchain.pem ]; then
    # certbot domen nomi bo'yicha papka yaratadi
  if [ -f /etc/letsencrypt/live/api.aishifokor.uz/fullchain.pem ] && [ ! -f /etc/letsencrypt/live/aishifokor.uz/fullchain.pem ]; then
    mkdir -p /etc/letsencrypt/live/aishifokor.uz
    ln -sf ../api.aishifokor.uz/fullchain.pem /etc/letsencrypt/live/aishifokor.uz/fullchain.pem
    ln -sf ../api.aishifokor.uz/privkey.pem /etc/letsencrypt/live/aishifokor.uz/privkey.pem
  fi
    install -m 644 "$ROOT/deploy/nginx-aishifokor-uz.conf" "$NGX_AVAIL"
    nginx -t && systemctl reload nginx
  fi
fi

echo "=== Tayyor ==="
echo "Frontend: https://${FRONT_HOST}"
echo "API:      https://${API_HOST}/api/"
echo "Health:   https://${API_HOST}/health/"
curl -fsS --max-time 10 -H "Host: ${API_HOST}" "http://127.0.0.1:${BACKEND_PORT}/health/" || true
