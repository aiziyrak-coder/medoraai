#!/usr/bin/env python3
"""SSH: production backendda telefon bo'yicha superuser yaratish / tiklash.

Parol repoda saqlanmaydi. Ishga tushirish:
  MEDORA_ENSURE_PASSWORD='...' python scripts/remote_ensure_superuser.py

Ixtiyoriy: MEDORA_ENSURE_PHONE, MEDORA_ENSURE_NAME, MEDORA_SSH_HOST, MEDORA_SSH_PASSWORD
(yoki deploy_credentials.local birinchi qatorida SSH paroli).
"""
from __future__ import annotations

import base64
import os
import sys
import textwrap
import time
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


def _remote_script(phone: str, password: str, name: str) -> str:
    return textwrap.dedent(
        f"""
        import os
        import django

        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "medoraai_backend.settings")
        django.setup()

        from accounts.models import User

        phone = {phone!r}
        password = {password!r}
        name = {name!r}

        u = User.objects.filter(phone=phone).first()
        if u:
            u.name = name or u.name
            u.is_staff = True
            u.is_superuser = True
            u.is_active = True
            u.role = "clinic"
            u.set_password(password)
            u.save()
            print("OK: yangilandi (staff/superuser/parol)")
        else:
            User.objects.create_superuser(phone=phone, password=password, name=name)
            print("OK: yaratildi (superuser)")
        """
    ).strip()


def main() -> None:
    phone = os.environ.get("MEDORA_ENSURE_PHONE", "+998995751111").strip()
    password = os.environ.get("MEDORA_ENSURE_PASSWORD", "").strip()
    name = os.environ.get("MEDORA_ENSURE_NAME", "FJSTI Admin").strip()
    if not password:
        print("MEDORA_ENSURE_PASSWORD bo'sh — serverda parolni o'rnatib bo'lmaydi.", file=sys.stderr)
        raise SystemExit(1)
    if not phone:
        print("MEDORA_ENSURE_PHONE bo'sh.", file=sys.stderr)
        raise SystemExit(1)

    body = _remote_script(phone, password, name)
    b64 = base64.b64encode(body.encode("utf-8")).decode("ascii")
    cmd = f"""set -e
echo {b64} | base64 -d > /tmp/medora_ensure_superuser.py
cd /root/medoraai/backend
. venv/bin/activate
export PYTHONPATH=/root/medoraai/backend
python /tmp/medora_ensure_superuser.py
rm -f /tmp/medora_ensure_superuser.py
"""
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=_pw(), timeout=90, banner_timeout=90)
    _stdin, stdout, _stderr = c.exec_command(cmd, get_pty=True)
    stdout.channel.settimeout(0.0)
    while True:
        if stdout.channel.recv_ready():
            chunk = stdout.channel.recv(65536)
            if chunk:
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
        elif stdout.channel.exit_status_ready():
            break
        else:
            time.sleep(0.05)
    while stdout.channel.recv_ready():
        chunk = stdout.channel.recv(65536)
        if chunk:
            sys.stdout.buffer.write(chunk)
            sys.stdout.buffer.flush()
    code = stdout.channel.recv_exit_status()
    c.close()
    raise SystemExit(0 if code == 0 else code or 1)


if __name__ == "__main__":
    main()
