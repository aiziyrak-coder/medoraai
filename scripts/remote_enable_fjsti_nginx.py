#!/usr/bin/env python3
"""SSH: deploy/nginx-fjsti-ziyrak.conf ni serverga yozib, sites-enabled ga ulash."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")
CONF_LOCAL = ROOT / "deploy" / "nginx-fjsti-ziyrak.conf"
REMOTE_PATH = "/etc/nginx/sites-available/fjsti-ziyrak-medora.conf"
ENABLED = "/etc/nginx/sites-enabled/fjsti-ziyrak-medora.conf"


def _pw() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    return cred.read_text(encoding="utf-8").strip().splitlines()[0].strip()


def main() -> None:
    body = CONF_LOCAL.read_text(encoding="utf-8")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=_pw(), timeout=40)
    sftp = client.open_sftp()
    with sftp.file(REMOTE_PATH, "w") as f:
        f.write(body)
    sftp.close()

    shell = f"""set -euo pipefail
ln -sf {REMOTE_PATH} {ENABLED}
nginx -t
systemctl reload nginx
echo "=== SNI fjsti.ziyrak.org (local) ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername fjsti.ziyrak.org 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName
echo "=== SNI fjstiapi.ziyrak.org ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername fjstiapi.ziyrak.org 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName
"""
    stdin, stdout, stderr = client.exec_command(shell)
    sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        sys.stderr.write(err)
    code = stdout.channel.recv_exit_status()
    client.close()
    raise SystemExit(0 if code == 0 else code or 1)


if __name__ == "__main__":
    main()
