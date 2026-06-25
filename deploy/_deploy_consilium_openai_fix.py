#!/usr/bin/env python3
"""Konsilium: OpenAI matn + tez rejim + professional PDF eksport deploy."""
import os
import sys
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("AISHIFOKOR_SSH_HOST", "164.90.186.193")
PWD = os.environ.get("AISHIFOKOR_SSH_PASSWORD", "Fjsti2026Ai")
ROOT = "/root/aishifokor"

remote_script = f"""
set -euo pipefail
cd {ROOT}
git fetch origin
git reset --hard origin/main

ENV={ROOT}/backend/.env
# Tez konsilium rejimi
if grep -q '^AI_COST_MODE=' "$ENV" 2>/dev/null; then
  sed -i "s|^AI_COST_MODE=.*|AI_COST_MODE=scale|" "$ENV"
else
  echo 'AI_COST_MODE=scale' >> "$ENV"
fi
if grep -q '^OPENAI_MODEL_FAST=' "$ENV" 2>/dev/null; then
  sed -i "s|^OPENAI_MODEL_FAST=.*|OPENAI_MODEL_FAST=gpt-4o-mini|" "$ENV"
else
  echo 'OPENAI_MODEL_FAST=gpt-4o-mini' >> "$ENV"
fi
if grep -q '^OPENAI_MODEL_PRO=' "$ENV" 2>/dev/null; then
  sed -i "s|^OPENAI_MODEL_PRO=.*|OPENAI_MODEL_PRO=gpt-4o-mini|" "$ENV"
else
  echo 'OPENAI_MODEL_PRO=gpt-4o-mini' >> "$ENV"
fi
# DeepSeek o'chirilgan — faqat OpenAI
if grep -q '^DEEPSEEK_API_KEY=' "$ENV" 2>/dev/null; then
  sed -i "s|^DEEPSEEK_API_KEY=.*|# DEEPSEEK_API_KEY=disabled|" "$ENV"
fi
grep -q '^OPENAI_VISION_MODEL=' "$ENV" 2>/dev/null || echo 'OPENAI_VISION_MODEL=gpt-4o' >> "$ENV"
grep '^AI_COST_MODE\\|^OPENAI_MODEL\\|^OPENAI_API_KEY=' "$ENV" | sed 's/=.*/=***/'

cd {ROOT}/backend
./venv/bin/pip install -q 'openai>=1.55.0'
./venv/bin/python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')
django.setup()
from django.conf import settings
from ai_services.claude_utils import _get_client, _fast_model
print('openai_key:', bool(settings.OPENAI_API_KEY))
print('fast_model:', _fast_model())
print('cost_mode:', settings.AI_COST_MODE)
print('client:', _get_client() is not None)
"

cd {ROOT}/frontend
npm run build
chmod -R o+rX dist
systemctl restart aishifokor-backend
sleep 2
curl -fsS http://127.0.0.1:8100/health/
echo
nginx -t && systemctl reload nginx
echo DEPLOY_CONSILIUM_OPENAI_OK
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PWD, timeout=30, allow_agent=False, look_for_keys=False)
_, stdout, _ = c.exec_command(remote_script, get_pty=True, timeout=900)
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
c.close()
sys.exit(code)
