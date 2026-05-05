#!/usr/bin/env python3
"""Serverda /root/aidoktorfjsti: git pull, frontend build, nginx reload, backend restart.

  MEDORA_SSH_PASSWORD=... python scripts/deploy_aidoktor_server.py

yoki repo ildizida deploy_credentials.local birinchi qatorda SSH paroli."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("paramiko kerak: pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")


def _pw() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    return cred.read_text(encoding="utf-8").strip().splitlines()[0].strip()


CMD = """set -e
cd /root/aidoktorfjsti
git pull
cd frontend
npm run build
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart aidoktorfjsti-backend
echo OK_REMOTE_DEPLOY
"""


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=_pw(), timeout=120, banner_timeout=120)
    _stdin, stdout, stderr = c.exec_command(CMD, get_pty=True)
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
