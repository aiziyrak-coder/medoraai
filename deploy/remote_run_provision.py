#!/usr/bin/env python3
"""
Bir martalik serverda deploy/provision-aidoktor-uz.sh ni ishga tushirish.
Maxfiy parol repoda yo'q: faqat muhit o'zgaruvchisi AIDOKTOR_SSH_PASSWORD.

  set AIDOKTOR_SSH_PASSWORD=...
  python deploy/remote_run_provision.py
"""

from __future__ import annotations

import os
import sys

HOST = os.environ.get("AIDOKTOR_SSH_HOST", "167.71.53.238")
USER = os.environ.get("AIDOKTOR_SSH_USER", "root")


def main() -> int:
    password = os.environ.get("AIDOKTOR_SSH_PASSWORD", "").strip()
    if not password:
        print("AIDOKTOR_SSH_PASSWORD muhit o'zgaruvchisi bo'sh.", file=sys.stderr)
        return 1

    try:
        import paramiko  # type: ignore
    except ImportError:
        print("paramiko yo'q: pip install paramiko", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=password, timeout=30, allow_agent=False, look_for_keys=False)

    script = r"""
set -euo pipefail
ROOT=/root/aidoktorfjsti
REPO=https://github.com/aiziyrak-coder/aidoktorfjsti.git
mkdir -p /root
if [ ! -d "$ROOT/.git" ]; then
  git clone "$REPO" "$ROOT"
fi
cd "$ROOT"
git pull origin main || git pull origin master
chmod +x deploy/provision-aidoktor-uz.sh
bash deploy/provision-aidoktor-uz.sh
"""
    stdin, stdout, stderr = client.exec_command(script, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    client.close()
    if out:
        print(out, end="")
    if err:
        print(err, end="", file=sys.stderr)
    return stdout.channel.recv_exit_status()


if __name__ == "__main__":
    raise SystemExit(main())
