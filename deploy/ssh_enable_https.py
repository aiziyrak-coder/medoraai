#!/usr/bin/env python3
"""Masofadan: git reset + deploy/enable-https-aidoktor.sh. AIDOKTOR_SSH_PASSWORD."""
import os
import sys
import time

import paramiko

CMD = r"""
set -e
cd /root/aidoktorfjsti
git fetch origin && git checkout main && git reset --hard origin/main
chmod +x deploy/enable-https-aidoktor.sh
bash deploy/enable-https-aidoktor.sh
"""


def pump(stdout) -> None:
    ch = stdout.channel
    while not ch.exit_status_ready():
        if ch.recv_ready():
            sys.stdout.buffer.write(ch.recv(65536))
        time.sleep(0.06)
    while ch.recv_ready():
        sys.stdout.buffer.write(ch.recv(65536))


def main() -> int:
    pwd = os.environ.get("AIDOKTOR_SSH_PASSWORD", "").strip()
    if not pwd:
        print("AIDOKTOR_SSH_PASSWORD", file=sys.stderr)
        return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        os.environ.get("AIDOKTOR_SSH_HOST", "167.71.53.238"),
        username="root",
        password=pwd,
        timeout=120,
        banner_timeout=120,
        auth_timeout=120,
        allow_agent=False,
        look_for_keys=False,
    )
    _, stdout, _ = c.exec_command(CMD, get_pty=True)
    pump(stdout)
    code = stdout.channel.recv_exit_status()
    c.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
