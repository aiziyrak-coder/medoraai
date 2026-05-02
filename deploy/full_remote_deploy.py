#!/usr/bin/env python3
"""
To'liq server deploy: muhit AIDOKTOR_SSH_PASSWORD, ixtiyoriy AIDOKTOR_SSH_HOST (default 167.71.53.238).
Chiqishni real vaqtda o'qish (uzoq npm build uchun).
"""
from __future__ import annotations

import os
import sys
import time

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    raise SystemExit(1)

HOST = os.environ.get("AIDOKTOR_SSH_HOST", "167.71.53.238")
USER = os.environ.get("AIDOKTOR_SSH_USER", "root")

REMOTE = r"""
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export PATH="/usr/local/bin:/usr/sbin:/usr/bin:/bin"
REPO="https://github.com/aiziyrak-coder/aidoktorfjsti.git"
ROOT="/root/aidoktorfjsti"

if ! command -v git >/dev/null; then
  apt-get update -qq && apt-get install -y -qq git curl nginx
fi
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1 || echo 0)
if ! command -v node >/dev/null || ! command -v npm >/dev/null || [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  apt-get update -qq
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
if ! command -v certbot >/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null || apt-get install -y -qq certbot
fi
if ! command -v python3 >/dev/null; then
  apt-get install -y -qq python3 python3-venv python3-pip
fi

mkdir -p /root
if [ ! -d "$ROOT/.git" ]; then
  git clone "$REPO" "$ROOT"
fi
cd "$ROOT"
git fetch origin
git checkout main
git pull origin main
chmod +x deploy/provision-aidoktor-uz.sh
exec bash deploy/provision-aidoktor-uz.sh
"""


def _pump_channels(stdout, _stderr) -> tuple[str, str, int]:
    """PTY rejimida stderr stdout bilan qo'shiladi."""
    out_parts: list[str] = []
    ch = stdout.channel
    while not ch.exit_status_ready():
        if ch.recv_ready():
            out_parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
        time.sleep(0.08)
    while ch.recv_ready():
        out_parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
    code = ch.recv_exit_status()
    return "".join(out_parts), "", code


def main() -> int:
    pwd = os.environ.get("AIDOKTOR_SSH_PASSWORD", "").strip()
    if not pwd:
        print("Muhit: AIDOKTOR_SSH_PASSWORD o'rnating (repoda saqlanmaydi).", file=sys.stderr)
        return 1
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username=USER,
        password=pwd,
        timeout=90,
        banner_timeout=90,
        auth_timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    stdin, stdout, stderr = client.exec_command(REMOTE, get_pty=True)
    # Uzoq build: kanal to'lib qolmasin
    out, err, code = _pump_channels(stdout, stderr)
    client.close()
    sys.stdout.write(out)
    sys.stderr.write(err)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
