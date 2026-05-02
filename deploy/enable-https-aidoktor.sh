#!/usr/bin/env bash
# Faqat Aidoktor: Let's Encrypt + SSL nginx (front va api.aidoktor.uz HTTPS).
# Oldindan: DNS A yozuvlari aidoktor.uz, www, api -> server IP (masalan 167.71.53.238).
# Ishga tushirish: bash deploy/enable-https-aidoktor.sh
set -euo pipefail

ROOT="${AIDOKTOR_ROOT:-/root/aidoktorfjsti}"
CERT_EMAIL="${DEPLOY_CERTBOT_EMAIL:-admin@aidoktor.uz}"
CERT="/etc/letsencrypt/live/aidoktor.uz/fullchain.pem"
AVAIL="/etc/nginx/sites-available/aidoktor-uz.conf"
EN="/etc/nginx/sites-enabled/00-aidoktor-uz.conf"
BACKEND_PORT="${AIDOKTOR_BACKEND_PORT:-8099}"

echo "==> Kod"
cd "$ROOT"
git fetch origin
git checkout main
git reset --hard origin/main

echo "==> Frontend build (API URL HTTPS)"
mkdir -p "$ROOT/frontend"
echo "VITE_API_BASE_URL=https://api.aidoktor.uz/api" > "$ROOT/frontend/.env.production"
cd "$ROOT/frontend"
npm ci
export NODE_ENV=production
npm run build

echo "==> HTTP bootstrap (ACME uchun)"
install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-http-bootstrap.conf" "$AVAIL"
rm -f /etc/nginx/sites-enabled/aidoktor-uz.conf
ln -sf "$AVAIL" "$EN"
nginx -t
systemctl reload nginx

echo "==> Certbot (aidoktor.uz + www + api)"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null || apt-get install -y -qq certbot
fi

certbot certonly --webroot -w "$ROOT/frontend/dist" \
  -d aidoktor.uz \
  -d www.aidoktor.uz \
  -d api.aidoktor.uz \
  --agree-tos --non-interactive \
  -m "$CERT_EMAIL" \
  --expand

if [ ! -f "$CERT" ]; then
  echo "XATO: Sertifikat yaratilmadi."
  echo "Tekshiring: dig aidoktor.uz + dig api.aidoktor.uz -> shu server IP"
  exit 1
fi

echo "==> SSL nginx"
install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-ssl.conf" "$AVAIL"
ln -sf "$AVAIL" "$EN"
nginx -t
systemctl reload nginx

echo "==> Backend .env (HTTPS)"
ENVF="$ROOT/backend/.env"
if [ -f "$ENVF" ] && ! grep -q '^SECURE_SSL_REDIRECT=' "$ENVF"; then
  echo "SECURE_SSL_REDIRECT=True" >> "$ENVF"
fi

systemctl restart aidoktorfjsti-backend
sleep 2
curl -fsS --max-time 10 "http://127.0.0.1:${BACKEND_PORT}/health/" >/dev/null

echo "==> Tayyor:"
echo "    https://aidoktor.uz"
echo "    https://api.aidoktor.uz"
echo "    https://www.aidoktor.uz -> https://aidoktor.uz"
