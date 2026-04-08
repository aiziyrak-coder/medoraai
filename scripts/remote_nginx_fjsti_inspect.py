#!/usr/bin/env python3
"""SSH: nginx ichida fjsti.ziyrak.org qayerda ekanini ko'rsatish."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")


def pw() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    return cred.read_text(encoding="utf-8").strip().splitlines()[0].strip()


def main() -> None:
    cmd = r"""set -e
echo "=== sites-enabled files mentioning fjsti ==="
grep -rln 'fjsti' /etc/nginx/sites-enabled/ 2>/dev/null || true
echo ""
echo "=== grep server_name fjsti.ziyrak ==="
grep -rn 'fjsti\.ziyrak' /etc/nginx/sites-enabled/ 2>/dev/null || echo "(no match)"
echo ""
echo "=== default_server on 443 ==="
grep -rn 'listen.*443' /etc/nginx/sites-enabled/ 2>/dev/null | head -40
"""
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=pw(), timeout=35)
    _, stdout, stderr = c.exec_command(cmd)
    sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
    sys.stderr.write(stderr.read().decode("utf-8", errors="replace"))
    c.close()


if __name__ == "__main__":
    main()
