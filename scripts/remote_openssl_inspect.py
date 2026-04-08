#!/usr/bin/env python3
import os, sys
from pathlib import Path
import paramiko
ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")
def pw():
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p: return p
    return (ROOT / "deploy_credentials.local").read_text(encoding="utf-8").strip().splitlines()[0].strip()
cmd = r"""
set -e
echo "=== fullchain.pem on disk ==="
openssl x509 -in /etc/letsencrypt/live/fjsti.ziyrak.org/fullchain.pem -noout -subject -dates -ext subjectAltName 2>&1

echo ""
echo "=== nginx -T server blocks for fjsti (snippet) ==="
nginx -T 2>/dev/null | grep -n 'fjsti.ziyrak' | head -30

echo ""
echo "=== order: listen 443 with fjsti ==="
nginx -T 2>/dev/null | awk '/server_name fjsti\.ziyrak\.org/{flag=1} flag{print} /^}/{if(flag&&++c>25){exit}}' | head -40
"""
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=pw(), timeout=35)
_, out, err = c.exec_command(cmd)
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
sys.stderr.write(err.read().decode("utf-8", errors="replace"))
c.close()
