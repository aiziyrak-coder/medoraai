#!/usr/bin/env python3
"""SSH: serverda git fetch + hard reset + deploy/server-deploy.sh (medoraai yoki AiDoktorai)."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")


def _pw() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    return cred.read_text(encoding="utf-8").strip().splitlines()[0].strip()


def main() -> None:
    cmd = r"""set -e
for APP in /root/medoraai /root/AiDoktorai; do
  if [ -f "$APP/deploy/server-deploy.sh" ]; then
    cd "$APP"
    git fetch origin main
    git reset --hard origin/main
    bash deploy/server-deploy.sh
    exit 0
  fi
done
echo "XATO: deploy/server-deploy.sh topilmadi"
exit 1
"""
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=_pw(), timeout=90, banner_timeout=90)
    _stdin, stdout, _stderr = c.exec_command(cmd, get_pty=True)
    stdout.channel.settimeout(0.0)
    while True:
        if stdout.channel.recv_ready():
            chunk = stdout.channel.recv(65536)
            if chunk:
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
        elif stdout.channel.exit_status_ready():
            break
        else:
            time.sleep(0.05)
    while stdout.channel.recv_ready():
        chunk = stdout.channel.recv(65536)
        if chunk:
            sys.stdout.buffer.write(chunk)
            sys.stdout.buffer.flush()
    code = stdout.channel.recv_exit_status()
    c.close()
    raise SystemExit(0 if code == 0 else code or 1)


if __name__ == "__main__":
    main()
