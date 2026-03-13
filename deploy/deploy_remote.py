#!/usr/bin/env python3
"""SSH orqali serverga ulanib deploy qilish (parol bilan). Nohup orqali build SSH uzilsa ham davom etadi."""
import base64
import os
import sys
import time

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
MAX_WAIT_MINUTES = 12
POLL_INTERVAL = 30

def run_ssh(client, cmd, timeout=60, wait_exit=True):
    _, out, _ = client.exec_command(cmd, timeout=timeout)
    if wait_exit:
        out.channel.recv_exit_status()
    return out.read().decode("utf-8", errors="replace")

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
    gemini_key = (os.environ.get("FJSTI_GEMINI_KEY") or os.environ.get("MEDORA_GEMINI_KEY") or "").strip()
    if gemini_key:
        key_b64 = base64.b64encode(gemini_key.encode()).decode()
        cmd_env = (
            f"grep -v '^GEMINI_API_KEY=' {BACKEND_ENV} 2>/dev/null > /tmp/FJSTI_env; "
            f"echo -n 'GEMINI_API_KEY=' >> /tmp/FJSTI_env; echo '{key_b64}' | base64 -d >> /tmp/FJSTI_env; "
            f"echo >> /tmp/FJSTI_env; mv /tmp/FJSTI_env {BACKEND_ENV}; echo GEMINI_ENV_SET"
        )
        _, o, e = client.exec_command(cmd_env)
        o.channel.recv_exit_status()
        if b"GEMINI_ENV_SET" in o.read() or b"GEMINI_ENV_SET" in e.read():
            print("Serverda GEMINI_API_KEY .env ga yozildi.")

    print("Deploy ishga tushirilmoqda (nohup — SSH uzilsa ham davom etadi)...")
    run_ssh(client, "rm -f /tmp/deploy.exit /tmp/deploy.log", timeout=10)
    # Start nohup in background; sleep 2 so nohup detaches before we close SSH
    _, out, _ = client.exec_command(
        "bash -c '( nohup bash -c \"cd /root/medoraai && git pull origin main && "
        "( sudo -n bash deploy/server-deploy.sh; echo \\$? > /tmp/deploy.exit ) > /tmp/deploy.log 2>&1\" & ); sleep 2'; echo DONE",
        timeout=30
    )
    out.channel.settimeout(15)
    buf = []
    try:
        while True:
            data = out.channel.recv(4096)
            if not data:
                break
            buf.append(data.decode("utf-8", errors="replace"))
            if "DONE" in "".join(buf):
                break
    except Exception:
        pass
    client.close()

    print("Build va restart bajarilmoqda (har %d s da tekshiriladi, max %d min)..." % (POLL_INTERVAL, MAX_WAIT_MINUTES))
    deadline = time.time() + MAX_WAIT_MINUTES * 60
    code = 1
    while time.time() < deadline:
        time.sleep(POLL_INTERVAL)
        try:
            c2 = paramiko.SSHClient()
            c2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c2.connect(HOST, username=USER, password=PASSWORD, timeout=15)
            exit_content = run_ssh(c2, "cat /tmp/deploy.exit 2>/dev/null || true", timeout=10).strip()
            if exit_content.isdigit():
                code = int(exit_content)
                log_tail = run_ssh(c2, "tail -60 /tmp/deploy.log 2>/dev/null", timeout=10)
                c2.close()
                try:
                    sys.stdout.buffer.write(log_tail.encode("utf-8", errors="replace"))
                except Exception:
                    print(log_tail.encode("ascii", errors="replace").decode("ascii"))
                break
            c2.close()
        except Exception as e:
            print(".", end="", flush=True)
    else:
        print("\nVaqt tugadi. Serverda qo'lda tekshiring: tail -100 /tmp/deploy.log")
        sys.exit(1)

    if code != 0:
        print("\nDeploy xato bilan tugadi (exit code %d). Log yuqorida." % code)
        sys.exit(code)
    print("\nDeploy muvaffaqiyatli tugadi. http://" + HOST)

if __name__ == "__main__":
    main()
