"""Bir martalik: serverda 8099 port, pull, nginx+systemd yangilash, qayta ishga tushirish."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "167.71.53.238"
USER = "root"
ROOT = "/root/aidoktorfjsti"

SCRIPT = r"""
set -euo pipefail
systemctl stop aidoktorfjsti-backend || true
cd """ + ROOT + r"""
git fetch origin && git checkout main && git reset --hard origin/main
install -m 644 deploy/systemd/aidoktorfjsti-backend.service /etc/systemd/system/aidoktorfjsti-backend.service
CERT=/etc/letsencrypt/live/aidoktor.uz/fullchain.pem
if [ -f "$CERT" ]; then
  install -m 644 deploy/nginx-aidoktor-uz-ssl.conf /etc/nginx/sites-available/aidoktor-uz.conf
else
  install -m 644 deploy/nginx-aidoktor-uz-http-bootstrap.conf /etc/nginx/sites-available/aidoktor-uz.conf
fi
rm -f /etc/nginx/sites-enabled/aidoktor-uz.conf
ln -sf /etc/nginx/sites-available/aidoktor-uz.conf /etc/nginx/sites-enabled/00-aidoktor-uz.conf
systemctl daemon-reload
systemctl enable aidoktorfjsti-backend
systemctl start aidoktorfjsti-backend
sleep 2
curl -fsS http://127.0.0.1:8099/health/
nginx -t
systemctl reload nginx
echo OK_PORT8099
"""


def main() -> int:
    pwd = os.environ.get("AIDOKTOR_SSH_PASSWORD", "").strip()
    if not pwd:
        print("AIDOKTOR_SSH_PASSWORD kerak", file=sys.stderr)
        return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=pwd, timeout=45, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = c.exec_command(SCRIPT, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    c.close()
    sys.stdout.write(out)
    sys.stderr.write(err)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
