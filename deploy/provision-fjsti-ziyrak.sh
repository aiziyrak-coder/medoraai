#!/usr/bin/env bash
# fjsti.ziyrak.org + fjstiapi.ziyrak.org — to'liq deploy
# Ishga tushirish: bash deploy/provision-fjsti-ziyrak.sh

set -euo pipefail

ROOT="${FJSTI_ROOT:-/root/aidoktorfjsti}"
BACKEND_PORT="${FJSTI_BACKEND_PORT:-8099}"
REPO_URL="${FJSTI_REPO_URL:-https://github.com/aiziyrak-coder/aidoktorfjsti.git}"
BRANCH="${FJSTI_BRANCH:-main}"
FRONT_HOST="fjsti.ziyrak.org"
API_HOST="fjstiapi.ziyrak.org"

echo "==> FJSTI deploy: $FRONT_HOST | $API_HOST | ROOT=$ROOT"

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
  echo "VITE_API_BASE_URL=https://${API_HOST}/api"
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
ALLOWED_HOSTS=${FRONT_HOST},${API_HOST},127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=https://${FRONT_HOST},http://${FRONT_HOST}
CSRF_TRUSTED_ORIGINS=https://${FRONT_HOST},https://${API_HOST}
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

# Mavjud .env da FJSTI domenlarini yangilash
set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}
set_kv ALLOWED_HOSTS "${FRONT_HOST},${API_HOST},127.0.0.1,localhost"
set_kv CORS_ALLOWED_ORIGINS "https://${FRONT_HOST},http://${FRONT_HOST}"
set_kv CSRF_TRUSTED_ORIGINS "https://${FRONT_HOST},https://${API_HOST}"
set_kv SECURE_SSL_REDIRECT "True"
if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  set_kv DEEPSEEK_API_KEY "$DEEPSEEK_API_KEY"
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Django admin superuser (telefon + parol)
ADMIN_PHONE="${ADMIN_PHONE:-+998995751111}"
ADMIN_PASS="${ADMIN_PASSWORD:-admin1234}"
python manage.py ensure_superuser --phone "$ADMIN_PHONE" --password "$ADMIN_PASS" --name "FJSTI Admin"

install -m 644 "$ROOT/deploy/systemd/aidoktorfjsti-backend.service" /etc/systemd/system/aidoktorfjsti-backend.service
systemctl daemon-reload
systemctl enable aidoktorfjsti-backend
systemctl restart aidoktorfjsti-backend

sleep 2
curl -fsS --max-time 15 "http://127.0.0.1:${BACKEND_PORT}/health/" || {
  echo "Backend health xato — journalctl -u aidoktorfjsti-backend -n 50"
  exit 1
}

# Nginx: fjsti.ziyrak.org (aidoktor.uz blokini o'chirish)
NGX_AVAIL="/etc/nginx/sites-available/fjsti-ziyrak.conf"
NGX_EN="/etc/nginx/sites-enabled/00-fjsti-ziyrak.conf"
install -m 644 "$ROOT/deploy/nginx-fjsti-ziyrak.conf" "$NGX_AVAIL"
rm -f /etc/nginx/sites-enabled/00-aidoktor-uz.conf /etc/nginx/sites-enabled/aidoktor-uz.conf
ln -sf "$NGX_AVAIL" "$NGX_EN"
nginx -t
systemctl reload nginx

echo "=== Tayyor ==="
echo "Frontend: https://${FRONT_HOST}"
echo "API:      https://${API_HOST}/api/"
echo "Health:   https://${API_HOST}/health/"
curl -fsS --max-time 10 -H "Host: ${API_HOST}" "http://127.0.0.1:${BACKEND_PORT}/health/" || true
