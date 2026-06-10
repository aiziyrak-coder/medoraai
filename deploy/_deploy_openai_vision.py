#!/usr/bin/env python3
"""OpenAI vision deploy: OPENAI_API_KEY serverga, fayllar, restart."""
import os
import sys
import time
from pathlib import Path

import paramiko

HOST = "164.90.186.193"
PWD = os.environ.get("AISHIFOKOR_SSH_PASSWORD", "Fjsti2026Ai")
ROOT = "/root/aishifokor"
REPO = Path(__file__).resolve().parents[1]

OPENAI_KEY = (os.environ.get("DEPLOY_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip()
if not OPENAI_KEY:
    print("DEPLOY_OPENAI_API_KEY muhit o'zgaruvchisi kerak", file=sys.stderr)
    sys.exit(1)

FILES = [
    "backend/ai_services/vision_utils.py",
    "backend/ai_services/imaging_analysis.py",
    "backend/ai_services/clinical_tools.py",
    "backend/ai_services/views.py",
    "backend/medoraai_backend/settings.py",
    "backend/.env.example",
]

key_esc = OPENAI_KEY.replace("'", "'\"'\"'")

post_script = f"""
set -e
ENV={ROOT}/backend/.env
if grep -q '^OPENAI_API_KEY=' "$ENV" 2>/dev/null; then
  sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY='{key_esc}'|" "$ENV"
else
  echo "OPENAI_API_KEY='{key_esc}'" >> "$ENV"
fi
grep -q '^OPENAI_VISION_MODEL=' "$ENV" 2>/dev/null || echo 'OPENAI_VISION_MODEL=gpt-4o' >> "$ENV"

cd {ROOT}/backend
./venv/bin/pip install -q 'openai>=1.55.0' 'pymupdf>=1.24.0'
./venv/bin/python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')
django.setup()
from ai_services.vision_utils import vision_available, vision_provider
print('vision_available:', vision_available())
print('vision_provider:', vision_provider())
"

systemctl restart aishifokor-backend
sleep 2
curl -fsS http://127.0.0.1:8100/health/
echo
echo DEPLOY_OK
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PWD, timeout=30, allow_agent=False, look_for_keys=False)

for rel in FILES:
    local_path = REPO / rel
    remote_path = f"{ROOT}/{rel}"
    print(f"upload {rel}")
    sftp = c.open_sftp()
    try:
        sftp.put(str(local_path), remote_path)
    finally:
        sftp.close()

_, stdout, _ = c.exec_command(post_script, get_pty=True, timeout=300)
parts = []
ch = stdout.channel
while not ch.exit_status_ready():
    if ch.recv_ready():
        parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
    time.sleep(0.2)
while ch.recv_ready():
    parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
code = ch.recv_exit_status()
sys.stdout.buffer.write("".join(parts).encode("utf-8", errors="replace"))
c.close()
sys.exit(code)
