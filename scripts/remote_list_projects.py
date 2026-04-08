#!/usr/bin/env python3
"""SSH: serverdagi loyihalar / xizmatlar / nginx saytlari ro'yxati."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")


def _pw() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    return cred.read_text(encoding="utf-8").strip().splitlines()[0].strip()


def main() -> None:
    cmd = r"""set +e
echo "========== HOST / UPTIME =========="
hostname; date -u; uptime
echo ""
echo "========== SYSTEMD (failed + running web-like) =========="
systemctl list-units --type=service --state=failed --no-pager 2>/dev/null | head -40
echo ""
systemctl list-units --type=service --state=running --no-pager 2>/dev/null | grep -iE 'nginx|gunicorn|uwsgi|docker|celery|redis|postgres|mysql|node|pm2|medora|fjsti|api' || true
echo ""
echo "========== ALL enabled systemd services (name + active) =========="
systemctl list-unit-files --type=service --state=enabled --no-pager 2>/dev/null | head -80
echo ""
echo "========== NGINX sites-enabled =========="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "(no sites-enabled)"
echo ""
echo "========== NGINX server_name (qisqa) =========="
grep -rh '^\s*server_name' /etc/nginx/sites-enabled/ 2>/dev/null | head -60 | sort -u
echo ""
echo "========== Listening TCP (80,443,8xxx) =========="
ss -tlnp 2>/dev/null | grep -E ':80 |:443 |:800[0-9]|:81[0-9][0-9]|:3000|:5000|:9000' || ss -tlnp 2>/dev/null | head -40
echo ""
echo "========== /root ichidagi kataloglar (1-daraja) =========="
ls -la /root/ 2>/dev/null | head -50
echo ""
echo "========== Docker (agar bor) =========="
command -v docker >/dev/null 2>&1 && (docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo "docker error") || echo "(docker yoq)"
echo ""
echo "========== PM2 (agar bor) =========="
command -v pm2 >/dev/null 2>&1 && pm2 list 2>/dev/null || echo "(pm2 yoq)"
echo ""
echo "========== Gunicorn / python process (qisqa) =========="
ps aux 2>/dev/null | grep -E '[g]unicorn|[u]wsgi' | head -25
echo ""
echo "========== Disk (/) =========="
df -h / 2>/dev/null
"""
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=_pw(), timeout=45, banner_timeout=50)
    stdin, stdout, stderr = c.exec_command(cmd, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    sys.stdout.write(out)
    if err.strip():
        sys.stderr.write(err)
    code = stdout.channel.recv_exit_status()
    c.close()
    raise SystemExit(0 if code == 0 else code or 1)


if __name__ == "__main__":
    main()
