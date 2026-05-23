#!/usr/bin/env python3
"""Also update /root/medoraai (port 8001 / fjstiapi.ziyrak.org)."""
from deploy._remote_deploy_claude import (
    ANTHROPIC_KEY,
    KEY_ESC,
    VITE_API,
    _pump,
    HOST,
    USER,
    PWD,
)
import paramiko
import sys

ROOT = "/root/medoraai"
REMOTE = f"""set -euo pipefail
ROOT={ROOT!r}
KEY='{KEY_ESC}'
cd "$ROOT"
git remote set-url origin https://github.com/aiziyrak-coder/medoraai.git || true
git fetch origin main && git reset --hard origin/main
ENV="$ROOT/backend/.env"
touch "$ENV"
sed -i '/^GEMINI_API_KEY=/d;/^GEMINI_MODEL_/d;/^AI_MODEL_DEFAULT=gemini/d' "$ENV" 2>/dev/null || true
set_kv() {{ k="$1"; v="$2"; grep -qE "^${{k}}=" "$ENV" && sed -i "s|^${{k}}=.*|${{k}}=${{v}}|" "$ENV" || echo "${{k}}=${{v}}" >> "$ENV"; }}
set_kv ANTHROPIC_API_KEY "$KEY"
set_kv CLAUDE_MODEL_PRO claude-opus-4-7
set_kv CLAUDE_MODEL_FAST claude-sonnet-4-6
set_kv AI_MODEL_DEFAULT claude-opus-4-7
cd "$ROOT/backend" && source venv/bin/activate
pip install -q 'anthropic>=0.49.0,<1.0.0'
pip uninstall -y google-genai 2>/dev/null || true
pip install -q -r requirements.txt
python manage.py migrate --noinput
systemctl restart medoraai-backend-8001
sleep 2
systemctl is-active medoraai-backend-8001
curl -sS -m 10 http://127.0.0.1:8001/health/
echo OK_MEDORAAI
"""

def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=90, allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = c.exec_command(REMOTE, get_pty=True, timeout=600)
    out, code = _pump(stdout)
    print(out)
    c.close()
    return 0 if "OK_MEDORAAI" in out else 1

if __name__ == "__main__":
    raise SystemExit(main())
