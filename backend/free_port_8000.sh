#!/bin/bash
# 8000-portni band qilgan protsessni topib to'xtatadi (medora/gunicorn qoldig'i).
# Keyin gunicorn ni qo'lda ishga tushirishingiz mumkin.
set -e
echo "=== Port 8000 da ishlayotgan protsesslar ==="
sudo lsof -i :8000 2>/dev/null || sudo ss -tlnp | grep 8000 || true
PIDS=$(sudo lsof -t -i :8000 2>/dev/null || true)
if [ -z "$PIDS" ]; then
  echo "Port 8000 bo'sh."
  exit 0
fi
echo "To'xtatilmoqda: $PIDS"
for p in $PIDS; do sudo kill -9 "$p" 2>/dev/null || true; done
sleep 1
echo "=== Port 8000 hozir bo'sh (tekshirish) ==="
sudo lsof -i :8000 2>/dev/null && echo "Hali band!" || echo "OK: port bo'sh."
