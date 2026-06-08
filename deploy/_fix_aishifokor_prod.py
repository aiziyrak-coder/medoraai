#!/usr/bin/env python3
"""Pushdan keyin: pull, nginx CORS map, gunicorn, restart."""
import os, sys, time, paramiko

HOST = "164.90.186.193"
PWD = os.environ.get("AISHIFOKOR_SSH_PASSWORD", "Fjsti2026Ai")
ROOT = "/root/aishifokor"

script = f"""
set -e
cd {ROOT}
git fetch origin && git reset --hard origin/main
echo GIT: $(git log -1 --oneline)
rm -f /etc/nginx/conf.d/aishifokor-cors-map.conf
cp {ROOT}/deploy/nginx-aishifokor-uz.conf /etc/nginx/sites-available/aishifokor-uz.conf
cp {ROOT}/deploy/systemd/aishifokor-backend.service /etc/systemd/system/aishifokor-backend.service
: > {ROOT}/backend/logs/error.log || true
systemctl daemon-reload
systemctl restart aishifokor-backend
cd {ROOT}/backend && ./venv/bin/python manage.py merge_patient_duplicates || true
cd {ROOT}/frontend && (npm ci --silent 2>/dev/null || npm ci) && npm run build
chmod -R o+rX {ROOT}/frontend/dist
nginx -t && systemctl reload nginx
sleep 2
curl -fsS http://127.0.0.1:8100/health/
echo
curl -sk -I -H 'Origin: https://aishifokor.uz' https://api.aishifokor.uz/health/ | head -6
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PWD, timeout=30, allow_agent=False, look_for_keys=False)
_, stdout, _ = c.exec_command(script, get_pty=True, timeout=120)
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
