#!/usr/bin/env python3
"""
Remote: backend/.env ga GEMINI_API_KEY, frontend/.env.production ga VITE_GEMINI_API_KEY,
keyin npm run build, nginx reload, backend restart.

  GEMINI_API_KEY=... MEDORA_SSH_PASSWORD=... python scripts/remote_set_gemini_env.py

Kalitni chatga yozmang; faqat mahalliy muhit o'zgaruvchisi yoki deploy_credentials.local.
"""
from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("paramiko kerak: pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("MEDORA_SSH_HOST", "167.71.53.238")
USER = os.environ.get("MEDORA_SSH_USER", "root")

BACKEND_ENV = "/root/aidoktorfjsti/backend/.env"
FRONTEND_ENV = "/root/aidoktorfjsti/frontend/.env.production"


def _pw() -> str:
    p = os.environ.get("MEDORA_SSH_PASSWORD", "").strip()
    if p:
        return p
    cred = ROOT / "deploy_credentials.local"
    if cred.is_file():
        return cred.read_text(encoding="utf-8").strip().splitlines()[0].strip()
    return ""


def _drop_line_for_key(line: str, env_key: str) -> bool:
    s = line.strip()
    if s.startswith(f"{env_key}="):
        return True
    return bool(re.match(rf"^export\s+{re.escape(env_key)}\s*=", s))


def upsert_env_key(content: str, env_key: str, value: str) -> str:
    text = content.replace("\r\n", "\n")
    lines = text.split("\n") if text else []
    kept = [ln for ln in lines if not _drop_line_for_key(ln, env_key)]
    while kept and kept[-1] == "":
        kept.pop()
    kept.append(f"{env_key}={value}")
    kept.append("")
    return "\n".join(kept)


def main() -> None:
    key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    if not key:
        print("GEMINI_API_KEY muhit o'zgaruvchisini o'rnating.", file=sys.stderr)
        raise SystemExit(1)
    pw = _pw()
    if not pw:
        print("MEDORA_SSH_PASSWORD yoki deploy_credentials.local kerak.", file=sys.stderr)
        raise SystemExit(1)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=pw, timeout=120, banner_timeout=120)

    def read_remote_cat(path: str) -> str:
        _in, out, err = client.exec_command(f"cat '{path}' 2>/dev/null || true")
        out.channel.recv_exit_status()
        raw = out.read().decode("utf-8", errors="replace")
        return raw

    def write_remote_stdin(path: str, body: str) -> None:
        # SFTP ba'zi serverlarda uziladi; stdin orqali yozamiz
        quoted = path.replace("'", "'\\''")
        cmd = f"cat > '{quoted}.new' && mv '{quoted}.new' '{quoted}'"
        stdin, stdout, stderr = client.exec_command(cmd)
        stdin.write(body.encode("utf-8"))
        stdin.channel.shutdown_write()
        code = stdout.channel.recv_exit_status()
        if code != 0:
            err = stderr.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"write {path} failed: {code} {err}")

    b = read_remote_cat(BACKEND_ENV)
    write_remote_stdin(BACKEND_ENV, upsert_env_key(b, "GEMINI_API_KEY", key))
    f = read_remote_cat(FRONTEND_ENV)
    write_remote_stdin(FRONTEND_ENV, upsert_env_key(f, "VITE_GEMINI_API_KEY", key))

    cmd = """set -e
cd /root/aidoktorfjsti/frontend
npm run build
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart aidoktorfjsti-backend
echo OK_GEMINI_REMOTE
"""
    _stdin, stdout, _stderr = client.exec_command(cmd, get_pty=True)
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
    client.close()
    raise SystemExit(0 if code == 0 else code or 1)


if __name__ == "__main__":
    main()
