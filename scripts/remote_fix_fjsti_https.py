#!/usr/bin/env python3
"""
SSH: aidoktor.uz / api.aidoktor.uz uchun TLS tekshiruvi va Certbot + nginx reload.

Parol: MEDORA_SSH_PASSWORD yoki deploy_credentials.local (1-qator) — remote_pull_gemini_deploy.py bilan bir xil.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("ERROR: pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")
# Certbot email — avval CERTBOT_EMAIL, keyin backend/.env dan ADMIN_EMAIL yoki placeholder
CERTBOT_EMAIL = os.environ.get("CERTBOT_EMAIL", "").strip()


def _ssh_password() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    if cred.is_file():
        line = cred.read_text(encoding="utf-8").strip().splitlines()
        if line and not line[0].startswith("#"):
            return line[0].strip()
    print("ERROR: MEDORA_SSH_PASSWORD yoki deploy_credentials.local kerak.", file=sys.stderr)
    sys.exit(1)


def _read_email() -> str:
    global CERTBOT_EMAIL
    if CERTBOT_EMAIL:
        return CERTBOT_EMAIL
    env_path = ROOT / "backend" / ".env"
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("CERTBOT_EMAIL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
            if line.strip().startswith("ADMIN_EMAIL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return "admin@ziyrak.org"


def main() -> None:
    pw = _ssh_password()
    email = _read_email()

    remote = r"""set -euo pipefail
echo "=== letsencrypt/live ==="
ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "(no live certs dir)"

echo ""
echo "=== nginx: fjsti server_name ==="
nginx -T 2>/dev/null | grep -nE 'server_name|ssl_certificate' | grep -i fjsti || true

echo ""
echo "=== curl local SNI aidoktor.uz ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername aidoktor.uz 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || echo "openssl failed"

echo ""
echo "=== certbot (expand / issue) ==="
if [ -x /usr/bin/certbot ] || command -v certbot >/dev/null 2>&1; then
  certbot certonly --nginx \
    -d aidoktor.uz -d api.aidoktor.uz \
    --non-interactive --agree-tos --email "__EMAIL__" \
    --expand 2>&1 || certbot certonly --nginx \
    -d aidoktor.uz -d api.aidoktor.uz \
    --non-interactive --agree-tos --email "__EMAIL__" 2>&1 || true
else
  echo "certbot not installed"
fi

echo ""
echo "=== nginx test + reload ==="
nginx -t && systemctl reload nginx && echo "nginx reload OK" || echo "nginx FAILED"

echo ""
echo "=== verify SNI after ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername aidoktor.uz 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null || true
"""

    remote = remote.replace("__EMAIL__", email.replace('"', ""))

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=pw, timeout=40, banner_timeout=45)
    stdin, stdout, stderr = client.exec_command("bash -s", get_pty=False)
    stdin.write(remote.encode("utf-8"))
    stdin.channel.shutdown_write()

    while True:
        line = stdout.readline()
        if not line:
            break
        sys.stdout.write(line)
        sys.stdout.flush()
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        sys.stderr.write(err)
    code = stdout.channel.recv_exit_status()
    client.close()
    raise SystemExit(0 if code == 0 else code or 1)


if __name__ == "__main__":
    main()
