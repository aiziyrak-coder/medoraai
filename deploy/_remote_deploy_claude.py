#!/usr/bin/env python3
"""Deploy Claude migration to /root/aidoktorfjsti (production FJSTI)."""
from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_SSH_HOST", "167.71.53.238")
USER = os.environ.get("DEPLOY_SSH_USER", "root")
PWD = os.environ.get("DEPLOY_SSH_PASSWORD", "Ziyrak2025Ai")
ROOT = os.environ.get("DEPLOY_REMOTE_DIR", "/root/aidoktorfjsti")
VITE_API = os.environ.get("DEPLOY_VITE_API_BASE_URL", "https://api.aidoktor.uz/api")

REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = REPO_ROOT / "backend" / ".env"


def _read_anthropic_key() -> str:
    if os.environ.get("DEPLOY_BACKEND_ANTHROPIC_API_KEY"):
        return os.environ["DEPLOY_BACKEND_ANTHROPIC_API_KEY"].strip()
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


ANTHROPIC_KEY = _read_anthropic_key()
if not ANTHROPIC_KEY:
    print("ANTHROPIC_API_KEY topilmadi (backend/.env yoki DEPLOY_BACKEND_ANTHROPIC_API_KEY)", file=sys.stderr)
    sys.exit(1)

KEY_ESC = ANTHROPIC_KEY.replace("'", "'\"'\"'")

REMOTE_SCRIPT = f"""set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
ROOT={ROOT!r}
KEY='{KEY_ESC}'
VITE_API={VITE_API!r}

cd "$ROOT"
echo "=== git: medoraai main ==="
git remote set-url origin https://github.com/aiziyrak-coder/medoraai.git || true
git fetch origin main
git stash push -u -m deploy-stash-$(date +%s) 2>/dev/null || true
git checkout main 2>/dev/null || git checkout -B main
git reset --hard origin/main
echo "$(git log -1 --oneline)"

echo "=== backend .env Claude ==="
ENV="$ROOT/backend/.env"
touch "$ENV"
sed -i '/^GEMINI_API_KEY=/d;/^GEMINI_MODEL_/d;/^AI_MODEL_DEFAULT=gemini/d' "$ENV" 2>/dev/null || true
set_kv() {{
  k="$1"; v="$2"
  if grep -qE "^${{k}}=" "$ENV" 2>/dev/null; then
    sed -i "s|^${{k}}=.*|${{k}}=${{v}}|" "$ENV"
  else
    echo "${{k}}=${{v}}" >> "$ENV"
  fi
}}
set_kv ANTHROPIC_API_KEY "$KEY"
set_kv CLAUDE_MODEL_PRO claude-opus-4-7
set_kv CLAUDE_MODEL_FAST claude-sonnet-4-6
set_kv AI_MODEL_DEFAULT claude-opus-4-7

echo "=== backend deps ==="
cd "$ROOT/backend"
source venv/bin/activate
pip install -q 'anthropic>=0.49.0,<1.0.0'
pip uninstall -y google-genai 2>/dev/null || true
pip install -q -r requirements.txt
python manage.py migrate --noinput

echo "=== frontend build ==="
cd "$ROOT/frontend"
export VITE_API_BASE_URL="$VITE_API"
export VITE_ANTHROPIC_API_KEY="$KEY"
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build

echo "=== nginx ==="
nginx -t
systemctl reload nginx

echo "=== restart backend ==="
systemctl restart aidoktorfjsti-backend
sleep 3
systemctl is-active aidoktorfjsti-backend

echo "=== health local 8099 ==="
curl -sS -m 10 http://127.0.0.1:8099/health/ || true
echo ""
echo "=== test claude ==="
curl -sS -m 30 "http://127.0.0.1:8099/api/ai/test-claude/" || true
echo ""
echo "=== public health ==="
curl -sS -m 15 https://api.aidoktor.fargana.uz/health/ || true
echo ""
echo OK_DEPLOY_CLAUDE
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
    print(f"Deploying to {USER}@{HOST}:{ROOT}")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username=USER,
        password=PWD,
        timeout=90,
        banner_timeout=90,
        auth_timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    stdin, stdout, stderr = client.exec_command(REMOTE_SCRIPT, get_pty=True, timeout=900)
    out, code = _pump(stdout)
  # strip ANSI for Windows console
    out_clean = re.sub(r"\x1b\[[0-9;]*m", "", out)
    try:
        sys.stdout.write(out_clean)
    except UnicodeEncodeError:
        sys.stdout.buffer.write(out_clean.encode("utf-8", errors="replace"))
    client.close()
    if "OK_DEPLOY_CLAUDE" not in out and code != 0:
        return code or 1
    if "OK_DEPLOY_CLAUDE" not in out:
        print("Deploy tugadi lekin OK_DEPLOY_CLAUDE ko'rinmadi", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
