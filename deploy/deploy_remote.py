#!/usr/bin/env python3
"""SSH orqali serverga ulanib deploy qilish (parol bilan)."""
import sys
import os

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

def main():
    pubkey = open(PUBKEY_PATH).read().strip()
    cmd_add_key = (
        "mkdir -p ~/.ssh && "
        f"grep -qF '{pubkey[:50]}' ~/.ssh/authorized_keys 2>/dev/null || "
        f"echo '{pubkey}' >> ~/.ssh/authorized_keys && "
        "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && echo KEY_ADDED"
    )
    cmd_deploy = (
        "cd /root/medoraai && git pull origin main && sudo -n bash deploy/server-deploy.sh"
    )

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Serverga ulanmoqda...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    print("Kalitni qo'shmoqda...")
    _, out, err = client.exec_command(cmd_add_key)
    out.channel.recv_exit_status()
    if b"KEY_ADDED" in out.read() or b"KEY_ADDED" in err.read():
        print("Kalit qo'shildi.")
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
