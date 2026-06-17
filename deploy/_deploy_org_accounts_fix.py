#!/usr/bin/env python3
"""Tashkilot hisoblari tuzatishlari: git pull, sync, frontend build, restart."""
import os
import sys
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("AISHIFOKOR_SSH_HOST", "164.90.186.193")
PWD = os.environ.get("AISHIFOKOR_SSH_PASSWORD", "Fjsti2026Ai")
ROOT = "/root/aishifokor"
REPO = Path(__file__).resolve().parents[1]

remote_script = f"""
set -euo pipefail
cd {ROOT}
git fetch origin
git reset --hard origin/main
cd {ROOT}/backend
./venv/bin/python manage.py create_default_plans 2>/dev/null || true
./venv/bin/python manage.py create_republic_org_accounts --days 60 --export-csv {ROOT}/docs/REPUBLIC_ORG_LOGINS.csv
./venv/bin/python manage.py create_regional_health_org_accounts --days 60 --export-csv {ROOT}/docs/REGIONAL_HEALTH_ORG_LOGINS.csv
cd {ROOT}/frontend
npm run build
chmod -R o+rX dist
systemctl restart aishifokor-backend
sleep 2
curl -fsS http://127.0.0.1:8100/health/
echo
nginx -t && systemctl reload nginx
echo DEPLOY_ORG_ACCOUNTS_OK
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PWD, timeout=30, allow_agent=False, look_for_keys=False)
_, stdout, stderr = c.exec_command(remote_script, get_pty=True, timeout=900)
parts = []
ch = stdout.channel
while not ch.exit_status_ready():
    if ch.recv_ready():
        parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
    time.sleep(0.2)
while ch.recv_ready():
    parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
code = ch.recv_exit_status()
out = "".join(parts)
sys.stdout.buffer.write(out.encode("utf-8", errors="replace"))

sftp = c.open_sftp()
try:
    os.makedirs(REPO / "docs", exist_ok=True)
    sftp.get(f"{ROOT}/docs/REPUBLIC_ORG_LOGINS.csv", str(REPO / "docs/REPUBLIC_ORG_LOGINS.csv"))
    sftp.get(f"{ROOT}/docs/REGIONAL_HEALTH_ORG_LOGINS.csv", str(REPO / "docs/REGIONAL_HEALTH_ORG_LOGINS.csv"))
finally:
    sftp.close()
c.close()

if code != 0:
    sys.exit(code)
print("\n--- CSV files updated locally in docs/ ---")
