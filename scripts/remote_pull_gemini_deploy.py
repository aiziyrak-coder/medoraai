#!/usr/bin/env python3
"""
Server: git pull main, backend/.env da GEMINI_API_KEY ni lokal backend/.env dan yozish,
keyin deploy/server-deploy.sh.

Maxfiyat: parol faqat MEDORA_SSH_PASSWORD yoki birinchi qatordagi deploy_credentials.local
(git: *.local ignore).
"""
from __future__ import annotations

import base64
import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("ERROR: pip install paramiko")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")
REPO = os.environ.get("MEDORA_REMOTE_REPO", "/root/medoraai")


def _ssh_password() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    if cred.is_file():
        line = cred.read_text(encoding="utf-8").strip().splitlines()
        if line and not line[0].startswith("#"):
            return line[0].strip()
    print(
        "ERROR: MEDORA_SSH_PASSWORD yoki loyiha ildizidagi deploy_credentials.local (1-qator) kerak.",
        file=sys.stderr,
    )
    sys.exit(1)


def _read_local_gemini_key() -> str:
    env_path = ROOT / "backend" / ".env"
    if not env_path.is_file():
        print(f"ERROR: {env_path} topilmadi", file=sys.stderr)
        sys.exit(1)
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("ERROR: backend/.env da GEMINI_API_KEY yo'q", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    gemini = _read_local_gemini_key()
    pw = _ssh_password()
    b64 = base64.b64encode(gemini.encode("utf-8")).decode("ascii")

    remote = f"""set -euo pipefail
REPO="{REPO}"
KEY=$(echo {b64} | base64 -d)
cd "$REPO"
git fetch origin main
git reset --hard origin/main
sed -i 's/\r$//' deploy/server-deploy.sh 2>/dev/null || true
mkdir -p backend
touch backend/.env
if grep -q '^GEMINI_API_KEY=' backend/.env; then
  sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$KEY|" backend/.env
else
  echo "GEMINI_API_KEY=$KEY" >> backend/.env
fi
sudo bash deploy/server-deploy.sh
"""

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=pw, timeout=35, banner_timeout=40)
    stdin, stdout, stderr = client.exec_command("bash -s", get_pty=False)
    stdin.write(remote.encode("utf-8"))
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
    raise SystemExit(0 if code == 0 else code or 1)


if __name__ == "__main__":
    main()
