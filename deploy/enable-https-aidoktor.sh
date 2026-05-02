#!/usr/bin/env bash
# Aidoktor: Let's Encrypt + SSL nginx. Faqat DNS shu serverga yo'naltirilgan domenlar sertifikatga kiradi.
# Ishga tushirish: DEPLOY_CERTBOT_EMAIL=you@mail.uz bash deploy/enable-https-aidoktor.sh
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

echo "==> Frontend (HTTPS API URL)"
mkdir -p "$ROOT/frontend"
echo "VITE_API_BASE_URL=https://api.aidoktor.uz/api" > "$ROOT/frontend/.env.production"
cd "$ROOT/frontend"
npm ci
export NODE_ENV=production
npm run build

echo "==> HTTP bootstrap (ACME)"
install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-http-bootstrap.conf" "$AVAIL"
rm -f /etc/nginx/sites-enabled/aidoktor-uz.conf
ln -sf "$AVAIL" "$EN"
nginx -t
systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq certbot 2>/dev/null || true
fi

echo "==> DNS tekshiruv (shu mashina IPv4)"
PUB_IP=""
for _url in https://api.ipify.org https://ifconfig.me/ip https://icanhazip.com; do
  PUB_IP=$(curl -4 -fsS --max-time 5 "$_url" 2>/dev/null | tr -d '\r\n' || true)
  [[ -n "$PUB_IP" ]] && break
done
if [[ -z "$PUB_IP" ]]; then
  PUB_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}' || true)
fi
echo "    Server tashqi IPv4 taxminan: ${PUB_IP:-noma'lum}"

CERT_ARGS=()
if [[ -z "$PUB_IP" ]]; then
  echo "WARN: Tashqi IP aniqlanmadi — DNS tekshiruvsiz 3 domen uriniladi"
  CERT_ARGS=(-d aidoktor.uz -d www.aidoktor.uz -d api.aidoktor.uz)
else
  for host in aidoktor.uz www.aidoktor.uz api.aidoktor.uz; do
    R=$(getent ahosts "$host" 2>/dev/null | awk '{print $1; exit}')
    [[ -z "$R" ]] && R=$(dig +short "$host" A 2>/dev/null | tail -1)
    if [[ -z "$R" ]]; then
      echo "    SKIP $host — DNS yozuvi yo'q"
      continue
    fi
    if [[ "$R" != "$PUB_IP" ]]; then
      echo "    SKIP $host — $R (server ${PUB_IP} emas)"
      continue
    fi
    echo "    OK $host -> $R"
    CERT_ARGS+=(-d "$host")
  done
fi

if [[ ${#CERT_ARGS[@]} -eq 0 ]]; then
  echo "XATO: Hech qaysi domen shu server IP ga yo'naltirilmagan."
  echo "xHOST: A yozuvlari aidoktor.uz, www, api -> ${PUB_IP:-SERVER_IP}"
  exit 1
fi

echo "==> Certbot"
certbot certonly --webroot -w "$ROOT/frontend/dist" \
  "${CERT_ARGS[@]}" \
  --cert-name aidoktor.uz \
  --agree-tos --non-interactive \
  -m "$CERT_EMAIL" \
  --expand

if [[ ! -f "$CERT" ]]; then
  echo "XATO: $CERT topilmadi"
  exit 1
fi

echo "==> SSL nginx"
install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-ssl.conf" "$AVAIL"
ln -sf "$AVAIL" "$EN"
nginx -t
systemctl reload nginx

ENVF="$ROOT/backend/.env"
if [[ -f "$ENVF" ]] && ! grep -q '^SECURE_SSL_REDIRECT=' "$ENVF"; then
  echo "SECURE_SSL_REDIRECT=True" >> "$ENVF"
fi

systemctl restart aidoktorfjsti-backend
sleep 2
curl -fsS --max-time 10 "http://127.0.0.1:${BACKEND_PORT}/health/" >/dev/null

echo "==> Tayyor (HTTPS yoqilgan domenlar certifikatda SAN sifatida):"
printf ' %s\n' "${CERT_ARGS[@]}"
