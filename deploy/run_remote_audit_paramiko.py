#!/usr/bin/env python3
"""SSH: aidoktor server to'liq audit (boshqa xizmatlarga tegmasdan)."""
import os
import sys

import paramiko

HOST = os.environ.get("SSH_DEPLOY_HOST", "167.71.53.238")
USER = os.environ.get("SSH_DEPLOY_USER", "root")
PWD = os.environ.get("SSH_DEPLOY_PASSWORD", "")

REMOTE = r"""
set -e
cd /root/aidoktorfjsti 2>/dev/null && git fetch -q origin && git reset -q --hard origin/main 2>/dev/null || true
echo "=== systemctl aidoktorfjsti-backend ==="
systemctl is-active aidoktorfjsti-backend || true
systemctl show aidoktorfjsti-backend -p MainPID -p ActiveState --no-pager
echo "=== backend /health (8099) ==="
curl -fsS --max-time 10 http://127.0.0.1:8099/health/ || echo FAIL
echo ""
echo "=== TLS SNI aidoktor.uz (localhost:443) ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername aidoktor.uz 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || echo openssl_fail
echo ""
echo "=== nginx aidoktor symlink ==="
ls -la /etc/nginx/sites-enabled/00-aidoktor-uz.conf 2>/dev/null || echo missing
nginx -t 2>&1 | tail -3
echo "=== Let's Encrypt muddati ==="
openssl x509 -in /etc/letsencrypt/live/aidoktor.uz/fullchain.pem -noout -dates 2>/dev/null || echo no_cert_file
echo "=== verify-aidoktor-dns (agar repoda bor) ==="
bash /root/aidoktorfjsti/deploy/verify-aidoktor-dns.sh 2>/dev/null || echo "script yoq — git pull qiling"
echo REMOTE_AUDIT_OK
"""

if not PWD:
    print("SSH_DEPLOY_PASSWORD kerak", file=sys.stderr)
    sys.exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(HOST, username=USER, password=PWD, timeout=30, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = client.exec_command(REMOTE, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    exit_status = stdout.channel.recv_exit_status()
    sys.stdout.buffer.write(out.encode("utf-8", errors="replace"))
    if err:
        sys.stderr.buffer.write(err.encode("utf-8", errors="replace"))
    sys.exit(exit_status if exit_status is not None else 1)
finally:
    client.close()
