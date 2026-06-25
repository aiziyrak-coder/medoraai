#!/usr/bin/env python3
"""Deploy ICD-10 + report consolidation fixes (backend + frontend)."""
import os
import sys
import time
import paramiko

HOST = "164.90.186.193"
PWD = os.environ.get("AISHIFOKOR_SSH_PASSWORD", "Fjsti2026Ai")
ROOT = "/root/aishifokor"

script = f"""
set -e
cd {ROOT}
git fetch origin
git reset --hard origin/main
echo "GIT: $(git log -1 --oneline)"
cd {ROOT}/frontend
npm ci --silent 2>/dev/null || npm ci
export NODE_ENV=production
npm run build
chmod -R o+rX dist
systemctl restart aishifokor-backend
sleep 2
curl -fsS http://127.0.0.1:8100/health/
echo
systemctl is-active aishifokor-backend
systemctl reload nginx 2>/dev/null || true
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PWD, timeout=60, allow_agent=False, look_for_keys=False)
_, stdout, _ = c.exec_command(script, get_pty=True)
parts = []
ch = stdout.channel
while not ch.exit_status_ready():
    if ch.recv_ready():
        parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
    time.sleep(0.15)
while ch.recv_ready():
    parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
code = ch.recv_exit_status()
sys.stdout.buffer.write("".join(parts).encode("utf-8", errors="replace"))
c.close()
sys.exit(code)
