#!/usr/bin/env bash
# 502 Bad Gateway — nginx upstream (127.0.0.1:8099) javob bermayotganda.
# Serverda root sifatida ishga tushiring: bash deploy/fix-aidoktor-502.sh
set -euo pipefail

ROOT="${AIDOKTOR_ROOT:-/root/aidoktorfjsti}"
BACKEND_PORT="${AIDOKTOR_BACKEND_PORT:-8099}"
CERT="/etc/letsencrypt/live/aidoktor.uz/fullchain.pem"
AVAIL="/etc/nginx/sites-available/aidoktor-uz.conf"
EN_PRI="/etc/nginx/sites-enabled/00-aidoktor-uz.conf"

echo "==> 1) Kod yangilash"
cd "$ROOT"
git fetch origin
git checkout main
git reset --hard origin/main

echo "==> 2) Backend"
install -m 644 "$ROOT/deploy/systemd/aidoktorfjsti-backend.service" /etc/systemd/system/aidoktorfjsti-backend.service
systemctl daemon-reload
systemctl enable aidoktorfjsti-backend
systemctl restart aidoktorfjsti-backend
sleep 3
if ! curl -fsS --max-time 10 "http://127.0.0.1:${BACKEND_PORT}/health/" >/dev/null; then
  echo "BACKEND HALI ISHLAMADI — journal:"
  journalctl -u aidoktorfjsti-backend -n 60 --no-pager
  exit 1
fi
echo "OK: backend ${BACKEND_PORT} /health/"

echo "==> 2b) Nginx: boshqa yoqilgan saytlarda aidoktor dublikati (502 sababi bo'lishi mumkin)"
BACKDIR="/root/nginx-aidoktor-dup-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKDIR"
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  bn=$(basename "$f")
  [[ "$bn" == "$(basename "$EN_PRI")" ]] && continue
  if grep -qE 'server_name[^;]*aidoktor\.uz|server_name[^;]*api\.aidoktor\.uz' "$f" 2>/dev/null; then
    echo "Duplikat olib tashlanmoqda: $f -> $BACKDIR/"
    mv "$f" "$BACKDIR/"
  fi
done

echo "==> 3) Nginx (00- prefiks — boshqa default_server bilan chalkashmasin)"
if [ -f "$CERT" ]; then
  install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-ssl.conf" "$AVAIL"
else
  install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-http-bootstrap.conf" "$AVAIL"
fi
rm -f /etc/nginx/sites-enabled/aidoktor-uz.conf
ln -sf "$AVAIL" "$EN_PRI"
nginx -t
systemctl reload nginx

echo "==> 4) aidoktor domeni uchun barcha nginx bloklari (duplikat tekshiruv)"
nginx -T 2>/dev/null | grep -E 'server_name|listen |proxy_pass' | grep -E 'aidoktor|8099|8020' || true

echo "==> Tayyor. Tekshiring: curl -sS -H 'Host: aidoktor.uz' http://127.0.0.1/ | head -c 200"
