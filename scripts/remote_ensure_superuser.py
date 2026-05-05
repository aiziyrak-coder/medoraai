#!/usr/bin/env python3
"""SSH: production backendda telefon bo'yicha superuser yaratish / tiklash.

Parol repoda saqlanmaydi. Ishga tushirish:
  MEDORA_ENSURE_PASSWORD='...' python scripts/remote_ensure_superuser.py

Ixtiyoriy: MEDORA_ENSURE_PHONE, MEDORA_ENSURE_NAME, MEDORA_ENSURE_BACKEND_DIR,
  MEDORA_SSH_HOST, MEDORA_SSH_USER, MEDORA_SSH_PASSWORD
  (yoki deploy_credentials.local birinchi qatorida SSH paroli).

  api.aidoktor.uz (Nginx → 127.0.0.1:8099, /root/aidoktorfjsti) uchun:
    MEDORA_ENSURE_BACKEND_DIR=/root/aidoktorfjsti/backend

  Eski medoraai / fargana backend (/root/medoraai, port 8001) uchun default:
    MEDORA_ENSURE_BACKEND_DIR=/root/medoraai/backend

  Avvalgi akkauntni admin va kirishdan chiqarish (telefon bo'yicha, bazadan o'chirmaydi):
    MEDORA_REVOKE_PHONE=+998...
"""
from __future__ import annotations

import base64
import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")
# Remote Django backend (venv + manage.py joyi). api.aidoktor.uz → aidoktorfjsti; medoraai → boshqa DB.
_DEFAULT_BACKEND = "/root/medoraai/backend"


def _backend_dir() -> str:
    return os.environ.get("MEDORA_ENSURE_BACKEND_DIR", _DEFAULT_BACKEND).strip().rstrip("/")


def _pw() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    return cred.read_text(encoding="utf-8").strip().splitlines()[0].strip()


def _remote_script(
    phone: str,
    password: str,
    name: str,
    revoke_phone: str | None = None,
) -> str:
    lines: list[str] = [
        "import os",
        "import django",
        'os.environ.setdefault("DJANGO_SETTINGS_MODULE", "medoraai_backend.settings")',
        "django.setup()",
        "from accounts.models import User, ActiveSession",
        "",
    ]
    if revoke_phone:
        lines.extend(
            [
                f"_rev_phone = {revoke_phone!r}",
                "_rev_u = User.objects.filter(phone=_rev_phone).first()",
                "if _rev_u:",
                "    ActiveSession.objects.filter(user=_rev_u).delete()",
                "    _rev_u.is_staff = False",
                "    _rev_u.is_superuser = False",
                "    _rev_u.is_active = False",
                "    _rev_u.save()",
                '    print("OK: eski raqam admin va kirishdan chiqarildi")',
                "else:",
                '    print("INFO: MEDORA_REVOKE_PHONE bazada topilmadi")',
                "",
            ]
        )
    lines.extend(
        [
            f"phone = {phone!r}",
            f"password = {password!r}",
            f"name = {name!r}",
            "",
            "u = User.objects.filter(phone=phone).first()",
            "if u:",
            "    u.name = name or u.name",
            "    u.is_staff = True",
            "    u.is_superuser = True",
            "    u.is_active = True",
            '    u.role = "clinic"',
            "    u.set_password(password)",
            "    u.save()",
            '    print("OK: yangilandi (staff/superuser/parol)")',
            "else:",
            "    User.objects.create_superuser(phone=phone, password=password, name=name)",
            '    print("OK: yaratildi (superuser)")',
        ]
    )
    return "\n".join(lines)


def main() -> None:
    phone = os.environ.get("MEDORA_ENSURE_PHONE", "+998995751111").strip()
    password = os.environ.get("MEDORA_ENSURE_PASSWORD", "").strip()
    name = os.environ.get("MEDORA_ENSURE_NAME", "FJSTI Admin").strip()
    revoke_phone = os.environ.get("MEDORA_REVOKE_PHONE", "").strip() or None
    if not password:
        print("MEDORA_ENSURE_PASSWORD bo'sh — serverda parolni o'rnatib bo'lmaydi.", file=sys.stderr)
        raise SystemExit(1)
    if not phone:
        print("MEDORA_ENSURE_PHONE bo'sh.", file=sys.stderr)
        raise SystemExit(1)

    body = _remote_script(phone, password, name, revoke_phone=revoke_phone)
    b64 = base64.b64encode(body.encode("utf-8")).decode("ascii")
    backend = _backend_dir()
    cmd = f"""set -e
echo {b64} | base64 -d > /tmp/medora_ensure_superuser.py
cd {backend}
. venv/bin/activate
export PYTHONPATH={backend}
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
