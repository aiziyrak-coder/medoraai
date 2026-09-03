#!/usr/bin/env bash
#
# aishifokor.uz — ishlab turgan serverga deploy.
#
# Serverda 23 ta loyiha va 40 ta domen ishlaydi. Bu skript FAQAT
# /root/aishifokor va aishifokor-* servislariga tegadi. Boshqa hech narsaga
# tegmaydi: docker, nginx restart, umumiy crontab — hech biri.
#
# ISHGA TUSHIRISH (serverda, admin_root nomidan):
#   bash /root/aishifokor/deploy/deploy-aishifokor.sh
#
# Servislarni qayta ishga tushirish uchun oxirida sudo paroli so'raladi.
# Skriptni sudo ostida ishga tushirmang — fayllar egasi buzilib ketadi.

set -euo pipefail

APP=/root/aishifokor
BRANCH="${BRANCH:-claude/dasturni-organish-muammolar-3d4fdc}"
REPO="${REPO:-https://github.com/aiziyrak-coder/medoraai.git}"
BACKUPS=/home/admin_root/aishifokor-backups
TS=$(date +%F-%H%M%S)

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mXATO: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -un)" = "root" ] && die "sudo ostida ishga tushirmang. Oddiy: bash $0"
[ -d "$APP/backend" ] || die "$APP topilmadi"
command -v git >/dev/null || die "git yo'q"

# ---------------------------------------------------------------- 1. ZAXIRA
say "1/7 Zaxira nusxa"
mkdir -p "$BACKUPS"

# Bazani ishlab turgan holda nusxalash: oddiy `cp` buzuq nusxa berishi mumkin,
# shuning uchun sqlite'ning o'z backup API'si ishlatiladi.
"$APP/backend/venv/bin/python" - "$APP/backend/db.sqlite3" "$BACKUPS/db-$TS.sqlite3" <<'PY'
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
s = sqlite3.connect(src); d = sqlite3.connect(dst)
with d:
    s.backup(d)
d.close(); s.close()
print("baza zaxirasi tayyor")
PY

# Kod va .env — venv/media/db'siz
tar -czf "$BACKUPS/code-$TS.tar.gz" -C /root \
    --exclude='aishifokor/backend/venv' \
    --exclude='aishifokor/backend/db.sqlite3*' \
    --exclude='aishifokor/backend/media' \
    --exclude='aishifokor/frontend/node_modules' \
    aishifokor
ls -lh "$BACKUPS/db-$TS.sqlite3" "$BACKUPS/code-$TS.tar.gz"

# ---------------------------------------------------- 2. YANGI KODNI OLISH
say "2/7 Yangi kodni olish"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/src"

# Bu serverda GitHub uchun kalit ham, credential helper ham yo'q — yopiq
# repozitoriyni klonlab bo'lmaydi. Shuning uchun manba tar arxivi orqali
# keladi. Klon faqat kalit sozlangan bo'lsa ishlatiladi.
SRC_TAR="${SRC_TAR:-/home/admin_root/aishifokor-src.tar.gz}"

if [ -f "$SRC_TAR" ]; then
  echo "manba: $SRC_TAR"
  tar -xzf "$SRC_TAR" -C "$TMP/src"
elif git ls-remote "$REPO" >/dev/null 2>&1; then
  echo "manba: git ($BRANCH)"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/src" >/dev/null 2>&1 \
    || die "klon bo'lmadi"
else
  die "Manba topilmadi. $SRC_TAR ni serverga yuklang yoki GitHub kalitini sozlang."
fi

[ -d "$TMP/src/backend" ] && [ -d "$TMP/src/frontend" ] \
  || die "arxiv ichida backend/ va frontend/ yo'q"

# ------------------------------------------------------- 3. KODNI YOZISH
say "3/7 Kodni joyiga qo'yish"
# .env, baza, media, logs, venv, dist — TEGILMAYDI.
rsync -a --delete \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='db.sqlite3*' \
  --exclude='media/' \
  --exclude='logs/' \
  --exclude='venv/' \
  --exclude='staticfiles/' \
  "$TMP/src/backend/" "$APP/backend/"

# ---------------------------------------------------------- 4. PAKETLAR
say "4/7 Paketlar (Django 5.0.1 -> 5.2.14)"
"$APP/backend/venv/bin/pip" install -r "$APP/backend/requirements.txt" --quiet
"$APP/backend/venv/bin/python" -c "import django;print('django',django.get_version())"

# --------------------------------------------------------- 5. MIGRATSIYA
say "5/7 Migratsiya va statik fayllar"
cd "$APP/backend"
set -a; . ./.env; set +a
venv/bin/python manage.py migrate --noinput
venv/bin/python manage.py collectstatic --noinput >/dev/null
venv/bin/python manage.py check --deploy 2>&1 | tail -5

# ------------------------------------------------------------ 6. FRONTEND
say "6/7 Frontend (serverda quriladi)"
# Vaqtinchalik katalogda quramiz — dist tayyor bo'lgunicha eski sayt ishlab turadi.
cd "$TMP/src/frontend"
npm ci --silent
VITE_API_BASE_URL="https://aishifokor.uz/api" npm run build >/dev/null
[ -f dist/index.html ] || die "frontend qurilmadi"

# Kalit bundle'ga tushib qolmaganini tekshiramiz (vite.config o'zgargan, lekin ishonch shart).
if grep -rqE 'sk-ant-|AIza[0-9A-Za-z_-]{35}' dist/assets/*.js 2>/dev/null; then
  die "dist ichida API kalit topildi — deploy to'xtatildi"
fi

rm -rf "$APP/frontend/dist.old"
[ -d "$APP/frontend/dist" ] && mv "$APP/frontend/dist" "$APP/frontend/dist.old"
cp -r dist "$APP/frontend/dist"
cd "$APP/backend"
echo "yangi dist qo'yildi (eskisi: frontend/dist.old)"

# ------------------------------------------------------------- 7. RESTART
say "7/7 Servislarni qayta ishga tushirish (sudo paroli so'raladi)"
sudo systemctl restart aishifokor-backend
sudo systemctl restart aishifokor-celery
sleep 4
systemctl is-active aishifokor-backend aishifokor-celery

say "Tekshiruv"
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8100/health/ || echo "ULANMADI")
echo "health/ -> $code"
[ "$code" = "200" ] || {
  echo
  echo "SOG'LIQ TEKSHIRUVI O'TMADI. Loglar:"
  journalctl -u aishifokor-backend -n 40 --no-pager 2>/dev/null | tail -20
  echo
  echo "QAYTARISH:"
  echo "  cp $BACKUPS/db-$TS.sqlite3 $APP/backend/db.sqlite3"
  echo "  tar -xzf $BACKUPS/code-$TS.tar.gz -C /root"
  echo "  sudo systemctl restart aishifokor-backend aishifokor-celery"
  exit 1
}

echo
echo "TAYYOR. Zaxira: $BACKUPS/db-$TS.sqlite3"
echo "Boshqa loyihalar tekshiruvi: docker ps -q | wc -l  (avvalgidek bo'lishi kerak)"
