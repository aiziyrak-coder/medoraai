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
nginx -v 2>&1
echo "=== first 25 listen 443 lines in merged config ==="
nginx -T 2>/dev/null | grep -n 'listen.*443' | head -25
echo ""
echo "=== curl with resolve ==="
curl -skI --resolve fjsti.ziyrak.org:443:127.0.0.1 https://fjsti.ziyrak.org/ 2>&1 | head -15
echo ""
echo "=== openssl session new ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername fjsti.ziyrak.org -nosession 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || true
systemctl restart nginx
sleep 1
echo "=== after full restart ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername fjsti.ziyrak.org 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null
"""
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=pw(), timeout=40)
_, out, err = c.exec_command(cmd)
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
sys.stderr.write(err.read().decode("utf-8", errors="replace"))
c.close()
