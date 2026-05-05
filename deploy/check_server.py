#!/usr/bin/env python3
"""Serverda aidoktor.uz uchun HTTP javobni tekshirish."""
import paramiko
import sys

HOST = "167.71.53.238"
USER = "root"
KEY_PATH = __file__.replace("check_server.py", "deploy_key")
PASSWORD = "Ziyrak2025Ai"

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, username=USER, key_filename=KEY_PATH, timeout=10)
    except Exception:
        client.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    _, out, _ = client.exec_command(
        "echo '=== HTTP 80 ==='; curl -sI -H 'Host: aidoktor.uz' http://127.0.0.1/ | head -3; "
        "echo '=== HTTPS 443 ==='; curl -skI -H 'Host: aidoktor.uz' https://127.0.0.1/ 2>/dev/null | head -3 || echo '443 yopiq yoki cert yoq'; "
        "ls /etc/letsencrypt/live/aidoktor.uz/fullchain.pem 2>/dev/null && echo 'SSL cert mavjud' || echo 'SSL cert yoq'"
    )
    print(out.read().decode())
    client.close()

if __name__ == "__main__":
    main()
-NoNewline
