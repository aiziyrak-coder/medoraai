#!/usr/bin/env python3
"""OpenAI API key + physiology filter fix deploy."""
import os
import sys
import time

import paramiko

HOST = os.environ.get("AISHIFOKOR_SSH_HOST", "164.90.186.193")
PWD = os.environ.get("AISHIFOKOR_SSH_PASSWORD", "Fjsti2026Ai")
ROOT = "/root/aishifokor"

OPENAI_KEY = (os.environ.get("DEPLOY_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip()
if not OPENAI_KEY:
    print("DEPLOY_OPENAI_API_KEY muhit o'zgaruvchisi kerak", file=sys.stderr)
    sys.exit(1)

key_esc = OPENAI_KEY.replace("'", "'\"'\"'")

remote_script = f"""
set -euo pipefail
cd {ROOT}
git fetch origin && git reset --hard origin/main

ENV={ROOT}/backend/.env
if grep -q '^OPENAI_API_KEY=' "$ENV" 2>/dev/null; then
  sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY='{key_esc}'|" "$ENV"
else
  echo "OPENAI_API_KEY='{key_esc}'" >> "$ENV"
fi
if grep -q '^DEEPSEEK_API_KEY=' "$ENV" 2>/dev/null; then
  sed -i "s|^DEEPSEEK_API_KEY=.*|# DEEPSEEK_API_KEY=disabled|" "$ENV"
fi
for kv in "AI_COST_MODE=scale" "OPENAI_MODEL_FAST=gpt-4o-mini" "OPENAI_MODEL_PRO=gpt-4o" "OPENAI_VISION_MODEL=gpt-4o"; do
  k="${{kv%%=*}}"
  v="${{kv#*=}}"
  if grep -q "^$k=" "$ENV" 2>/dev/null; then
    sed -i "s|^$k=.*|$k=$v|" "$ENV"
  else
    echo "$k=$v" >> "$ENV"
  fi
done
grep '^OPENAI_\\|^AI_COST' "$ENV" | sed 's/=.*/=***/'

cd {ROOT}/backend
./venv/bin/python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')
django.setup()
from django.conf import settings
from ai_services.claude_utils import _get_client, _fast_model, _model_diagnosis
from ai_services.vision_utils import vision_available, vision_provider
print('openai:', bool(settings.OPENAI_API_KEY))
print('fast:', _fast_model())
print('diagnosis:', _model_diagnosis())
print('vision:', vision_available(), vision_provider())
print('client:', _get_client() is not None)
"

systemctl restart aishifokor-backend
sleep 2
curl -fsS http://127.0.0.1:8100/health/
echo
echo DEPLOY_OPENAI_KEY_OK
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PWD, timeout=30, allow_agent=False, look_for_keys=False)
_, stdout, _ = c.exec_command(remote_script, get_pty=True, timeout=180)
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
