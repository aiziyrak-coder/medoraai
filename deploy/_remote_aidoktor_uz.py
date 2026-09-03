#!/usr/bin/env python3
"""Serverni faqat aidoktor.uz domenlarida ishlashi uchun sozlash."""
from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_SSH_HOST", "167.71.53.238")
USER = os.environ.get("DEPLOY_SSH_USER", "root")
PWD = os.environ.get("DEPLOY_SSH_PASSWORD", os.environ["SERVER_PASSWORD"])
ROOT = "/root/aidoktorfjsti"

REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = REPO_ROOT / "backend" / ".env"


def _anthropic_key() -> str:
    if os.environ.get("DEPLOY_BACKEND_ANTHROPIC_API_KEY"):
        return os.environ["DEPLOY_BACKEND_ANTHROPIC_API_KEY"].strip()
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ANTHROPIC_API_KEY="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
                if v:
                    return v
    return ""


KEY = _anthropic_key().replace("'", "'\"'\"'")

REMOTE = f"""set -euo pipefail
ROOT={ROOT!r}
KEY='{KEY}'
cd "$ROOT"
git fetch origin main && git reset --hard origin/main

# backend .env — faqat aidoktor.uz
ENV="$ROOT/backend/.env"
touch "$ENV"
set_kv() {{
  k="$1"; v="$2"
  grep -qE "^${{k}}=" "$ENV" 2>/dev/null && sed -i "s|^${{k}}=.*|${{k}}=${{v}}|" "$ENV" || echo "${{k}}=${{v}}" >> "$ENV"
}}
set_kv ALLOWED_HOSTS "aidoktor.uz,www.aidoktor.uz,api.aidoktor.uz,127.0.0.1,localhost"
set_kv CORS_ALLOWED_ORIGINS "https://aidoktor.uz,https://www.aidoktor.uz,http://aidoktor.uz,http://www.aidoktor.uz"
set_kv CSRF_TRUSTED_ORIGINS "https://aidoktor.uz,https://www.aidoktor.uz,https://api.aidoktor.uz"
set_kv SECURE_SSL_REDIRECT "True"
if [ -n "$KEY" ]; then
  set_kv ANTHROPIC_API_KEY "$KEY"
fi
set_kv AI_COST_MODE "scale"
set_kv CONSILIUM_AGENT_LIMIT "4"
set_kv CLAUDE_MODEL_HAIKU "claude-haiku-4-5-20251001"
set_kv CLAUDE_MODEL_FAST "claude-haiku-4-5-20251001"
set_kv CLAUDE_MODEL_PRO "claude-haiku-4-5-20251001"
set_kv CLAUDE_USE_SONNET_DIAGNOSIS "False"
set_kv AI_MODEL_DEFAULT "claude-haiku-4-5-20251001"
sed -i '/^GEMINI_/d;/^AI_MODEL_DEFAULT=gemini/d' "$ENV" 2>/dev/null || true

# frontend production API
FP="$ROOT/frontend/.env.production"
touch "$FP"
grep -q '^VITE_API_BASE_URL=' "$FP" 2>/dev/null && \\
  sed -i 's|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://api.aidoktor.uz/api|' "$FP" || \\
  echo 'VITE_API_BASE_URL=https://api.aidoktor.uz/api' >> "$FP"
if [ -n "$KEY" ]; then
  grep -q '^VITE_ANTHROPIC_API_KEY=' "$FP" 2>/dev/null && \\
    sed -i "s|^VITE_ANTHROPIC_API_KEY=.*|VITE_ANTHROPIC_API_KEY=$KEY|" "$FP" || \\
    echo "VITE_ANTHROPIC_API_KEY=$KEY" >> "$FP"
fi

# nginx aidoktor.uz
NGX_AVAIL="/etc/nginx/sites-available/aidoktor-uz.conf"
NGX_EN="/etc/nginx/sites-enabled/00-aidoktor-uz.conf"
CERT="/etc/letsencrypt/live/aidoktor.uz/fullchain.pem"
mkdir -p /etc/nginx/snippets
install -m 644 "$ROOT/deploy/nginx-snippet-ssl-aidoktor-uz.conf" /etc/nginx/snippets/ssl-aidoktor-uz.conf
if [ -f "$CERT" ]; then
  install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-ssl.conf" "$NGX_AVAIL"
else
  install -m 644 "$ROOT/deploy/nginx-aidoktor-uz-http-bootstrap.conf" "$NGX_AVAIL"
fi
rm -f /etc/nginx/sites-enabled/aidoktor-uz.conf
ln -sf "$NGX_AVAIL" "$NGX_EN"

cd "$ROOT/frontend"
export VITE_API_BASE_URL=https://api.aidoktor.uz/api
export VITE_AI_COST_MODE=scale
export VITE_CLAUDE_MODEL_HAIKU=claude-haiku-4-5-20251001
[ -n "$KEY" ] && export VITE_ANTHROPIC_API_KEY="$KEY"
npm ci
npm run build

cd "$ROOT/backend"
source venv/bin/activate
pip install -q -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput 2>/dev/null || true

nginx -t
systemctl reload nginx
systemctl restart aidoktorfjsti-backend
sleep 3

echo "=== DNS (server) ==="
getent hosts aidoktor.uz api.aidoktor.uz 2>/dev/null || true
echo "=== local ==="
curl -sS -m 10 http://127.0.0.1:8099/health/
echo ""
curl -sS -m 10 -H "Host: api.aidoktor.uz" http://127.0.0.1:8099/api/ai/test-claude/ | head -c 200
echo ""
echo "=== HTTPS public ==="
curl -sS -m 20 https://api.aidoktor.uz/health/
echo ""
curl -sS -m 20 -o /dev/null -w "aidoktor.uz:%{{http_code}}\\n" https://aidoktor.uz/
echo OK_AIDOKTOR_UZ
"""


def _pump(stdout) -> tuple[str, int]:
    ch = stdout.channel
    parts: list[str] = []
    while not ch.exit_status_ready():
        if ch.recv_ready():
            parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
        time.sleep(0.1)
    while ch.recv_ready():
        parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
    return "".join(parts), ch.recv_exit_status()


def main() -> int:
    print(f"aidoktor.uz deploy -> {USER}@{HOST}")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=90, allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = c.exec_command(REMOTE, get_pty=True, timeout=900)
    out, code = _pump(stdout)
    out = re.sub(r"\x1b\[[0-9;]*m", "", out)
    try:
        sys.stdout.write(out)
    except UnicodeEncodeError:
        sys.stdout.buffer.write(out.encode("utf-8", errors="replace"))
    c.close()
    return 0 if "OK_AIDOKTOR_UZ" in out else (code or 1)


if __name__ == "__main__":
    raise SystemExit(main())
