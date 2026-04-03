#!/usr/bin/env python3
"""
Bir SSH sessiyasida: monorepo git reset + frontend build + gunicorn restart.

Parol tartibi:
  1) MEDORA_SSH_PASSWORD muhit o'zgaruvchisi
  2) deploy_credentials.local (bir qator, *.local gitignore)
  3) lokalda bo'lsa full_auto_deploy.py ichidagi PASSWORD (gitga qo'shmang — faqat sizda)
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("ERROR: pip install paramiko")
    sys.exit(1)

HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")
REPO = os.environ.get("MEDORA_REMOTE_REPO", "/root/medoraai")


def _password() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    root = Path(__file__).resolve().parents[1]
    cred = root / "deploy_credentials.local"
    if cred.is_file():
        line = cred.read_text(encoding="utf-8").strip().splitlines()
        if line and not line[0].startswith("#"):
            return line[0].strip()
    legacy = root / "full_auto_deploy.py"
    if legacy.is_file():
        m = re.search(r'PASSWORD\s*=\s*"([^"]+)"', legacy.read_text(encoding="utf-8", errors="replace"))
        if m:
            return m.group(1)
    print("ERROR: Parol topilmadi: MEDORA_SSH_PASSWORD yoki deploy_credentials.local yoki full_auto_deploy.py")
    sys.exit(1)


REMOTE_SCRIPT_TEMPLATE = """
set -euo pipefail
REPO="{repo}"
if [ ! -d "$REPO/.git" ]; then
  echo "NO_GIT_REPO at $REPO"
  exit 2
fi
cd "$REPO"
echo "==> git fetch + reset main"
git fetch origin main
git reset --hard origin/main

if [ -f "$REPO/frontend/package.json" ]; then
  echo "==> frontend npm install + build"
  cd "$REPO/frontend"
  npm install --silent
  npm run build
else
  echo "NO $REPO/frontend/package.json"
  exit 3
fi

if [ -d "$REPO/backend" ] && [ -f "$REPO/backend/venv/bin/activate" ]; then
  echo "==> backend gunicorn"
  pkill -f "gunicorn.*medoraai_backend" 2>/dev/null || true
  pkill -f "gunicorn.*AiDoktorai_backend" 2>/dev/null || true
  sleep 2
  mkdir -p "$REPO/backend/logs"
  cd "$REPO/backend"
  # shellcheck disable=SC1091
  source venv/bin/activate
  pip install -q -r requirements.txt 2>/dev/null || true
  nohup gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 --threads 2 --timeout 120 >> logs/gunicorn.log 2>&1 &
  sleep 2
else
  echo "NO backend venv"
  exit 4
fi

nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
echo "==> health"
curl -sS --max-time 8 http://127.0.0.1:8001/health/ || true
echo ""
echo "DONE"
"""


def main() -> None:
    pw = _password()
    remote_script = REMOTE_SCRIPT_TEMPLATE.format(repo=REPO)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=pw, timeout=30, banner_timeout=35)

    stdin, stdout, stderr = client.exec_command("bash -s", get_pty=False)
    stdin.write(remote_script.encode("utf-8"))
    stdin.channel.shutdown_write()

    while True:
        line = stdout.readline()
        if not line:
            break
        sys.stdout.write(line)
        sys.stdout.flush()
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        sys.stderr.write(err)
    code = stdout.channel.recv_exit_status()
    client.close()
    raise SystemExit(code if code == 0 else code or 1)


if __name__ == "__main__":
    main()
