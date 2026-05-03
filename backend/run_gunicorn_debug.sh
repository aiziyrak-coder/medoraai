#!/bin/bash
# Serverda Gunicorn xatosini ko'rish: AiDoktor ni to'xtatib, shu skriptni ishga tushiring.
# Chiqan xato matnini (traceback) developer ga yuboring.
cd "$(dirname "$0")"
echo "=== Stopping AiDoktor service (sudo required) ==="
sudo systemctl stop AiDoktor 2>/dev/null || true
echo "=== Starting Gunicorn in foreground (Ctrl+C to stop) ==="
# Venv: serverda odatda ~/AiDoktor_platform/venv (backend dan ../../venv)
VENV="${VENV:-../../venv}"
exec "$VENV/bin/gunicorn" medoraai_backend.wsgi:application --bind 127.0.0.1:8000
