"""Serverda fix-aidoktor-502.sh ni ishga tushirish. AIDOKTOR_SSH_PASSWORD muhitda."""
import os
import sys
import time

import paramiko

SCRIPT = r"""
set -e
cd /root/aidoktorfjsti
git pull origin main 2>/dev/null || true
git fetch origin && git checkout main && git reset --hard origin/main
chmod +x deploy/fix-aidoktor-502.sh
bash deploy/fix-aidoktor-502.sh
"""


def pump(stdout) -> str:
    ch = stdout.channel
    parts: list[str] = []
    while not ch.exit_status_ready():
        if ch.recv_ready():
            parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
        time.sleep(0.06)
    while ch.recv_ready():
        parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
    return "".join(parts)


def main() -> int:
    pwd = os.environ.get("AIDOKTOR_SSH_PASSWORD", "").strip()
    if not pwd:
        print("AIDOKTOR_SSH_PASSWORD kerak", file=sys.stderr)
        return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        os.environ.get("AIDOKTOR_SSH_HOST", "167.71.53.238"),
        username="root",
        password=pwd,
        timeout=90,
        banner_timeout=90,
        auth_timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    _, stdout, _ = c.exec_command(SCRIPT, get_pty=True)
    out = pump(stdout)
    code = stdout.channel.recv_exit_status()
    c.close()
    try:
        sys.stdout.write(out)
    except UnicodeEncodeError:
        sys.stdout.buffer.write(out.encode(sys.stdout.encoding or "utf-8", errors="replace"))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
