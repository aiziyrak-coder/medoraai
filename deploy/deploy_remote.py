#!/usr/bin/env python3
"""SSH orqali serverga ulanib deploy qilish (parol bilan)."""
import base64
import os
import sys

try:
    import paramiko
except ImportError:
    print("Paramiko kerak: pip install paramiko")
    sys.exit(1)

HOST = "167.71.53.238"
USER = "root"
PASSWORD = "Ziyrak2025Ai"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBKEY_PATH = os.path.join(SCRIPT_DIR, "deploy_key.pub")
BACKEND_ENV = "/root/medoraai/backend/.env"

def main():
    if os.path.isfile(PUBKEY_PATH):
        pubkey = open(PUBKEY_PATH).read().strip()
    else:
        pubkey = None
    cmd_add_key = (
        "mkdir -p ~/.ssh && "
        f"grep -qF '{pubkey[:50]}' ~/.ssh/authorized_keys 2>/dev/null || "
        f"echo '{pubkey}' >> ~/.ssh/authorized_keys && "
        "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && echo KEY_ADDED"
    ) if pubkey else None
    cmd_deploy = (
        "cd /root/medoraai && git pull origin main && sudo -n bash deploy/server-deploy.sh"
    )

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Serverga ulanmoqda...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    if cmd_add_key:
        print("Kalitni qo'shmoqda...")
        _, out, err = client.exec_command(cmd_add_key)
        out.channel.recv_exit_status()
        if b"KEY_ADDED" in out.read() or b"KEY_ADDED" in err.read():
            print("Kalit qo'shildi.")
    # Ixtiyoriy: MEDORA_GEMINI_KEY env orqali server .env ga GEMINI_API_KEY yozish (Gitga push qilinmaydi)
    gemini_key = os.environ.get("MEDORA_GEMINI_KEY", "").strip()
    if gemini_key:
        key_b64 = base64.b64encode(gemini_key.encode()).decode()
        cmd_env = (
            f"grep -v '^GEMINI_API_KEY=' {BACKEND_ENV} 2>/dev/null > /tmp/medora_env; "
            f"echo -n 'GEMINI_API_KEY=' >> /tmp/medora_env; echo '{key_b64}' | base64 -d >> /tmp/medora_env; "
            f"echo >> /tmp/medora_env; mv /tmp/medora_env {BACKEND_ENV}; echo GEMINI_ENV_SET"
        )
        _, o, e = client.exec_command(cmd_env)
        o.channel.recv_exit_status()
        if b"GEMINI_ENV_SET" in o.read() or b"GEMINI_ENV_SET" in e.read():
            print("Serverda GEMINI_API_KEY .env ga yozildi.")
    print("Deploy bajarilmoqda (git pull + server-deploy.sh)...")
    _, out, err = client.exec_command(cmd_deploy, get_pty=True)
    out.channel.settimeout(300)
    try:
        while True:
            data = out.channel.recv(4096)
            if not data:
                break
            sys.stdout.write(data.decode("utf-8", errors="replace"))
            sys.stdout.flush()
    except Exception:
        pass
    code = out.channel.recv_exit_status()
    client.close()
    if code != 0:
        sys.exit(code)
    print("\nDeploy tugadi. http://" + HOST)

if __name__ == "__main__":
    main()
