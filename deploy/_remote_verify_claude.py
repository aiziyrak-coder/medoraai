#!/usr/bin/env python3
import os
import paramiko

PWD = os.environ.get("DEPLOY_SSH_PASSWORD", "Ziyrak2025Ai")
CMD = r"""
echo '=== nginx fjsti domains ==='
grep -l 'aidoktor\|8099\|fjsti' /etc/nginx/sites-enabled/* 2>/dev/null | head -5
for f in /etc/nginx/sites-enabled/*aidoktor* /etc/nginx/sites-enabled/*fjsti*; do
  [ -f "$f" ] && echo "--- $f ---" && grep -E 'server_name|proxy_pass|8099' "$f" | head -15
done 2>/dev/null

echo '=== test-claude (follow redirect) ==='
curl -sS -m 60 -L http://127.0.0.1:8099/api/ai/test-claude/ | head -c 500
echo ""

echo '=== django claude call ==='
cd /root/aidoktorfjsti/backend
export DJANGO_SETTINGS_MODULE=medoraai_backend.settings
source venv/bin/activate
python << 'PY'
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "medoraai_backend.settings")
django.setup()
from django.conf import settings
from ai_services.claude_utils import _get_client, _call_claude, _model_fast
print("key_len", len(settings.ANTHROPIC_API_KEY or ""))
print("client", bool(_get_client()))
try:
    t = _call_claude("Javobingiz: salom. Faqat shu so'zni yozing.", _model_fast())
    print("ok sample:", (t or "")[:120])
except Exception as e:
    print("call_err:", type(e).__name__, str(e)[:300])
PY
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("167.71.53.238", username="root", password=PWD, timeout=60, allow_agent=False, look_for_keys=False)
stdin, stdout, stderr = c.exec_command(CMD, timeout=180)
print(stdout.read().decode("utf-8", errors="replace"))
e = stderr.read().decode("utf-8", errors="replace")
if e.strip():
    print("ERR:", e[:800])
c.close()
