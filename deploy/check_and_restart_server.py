#!/usr/bin/env python3
"""Serverda backend va nginx holatini tekshirish va kerak bo'lsa restart."""
import paramiko

HOST = "167.71.53.238"
USER = "root"
PASSWORD = "Ziyrak2025Ai"

def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    _, o, _ = c.exec_command(
        "echo Backend:; systemctl is-active medoraai-backend-8001.service 2>/dev/null || echo inactive; "
        "echo Nginx:; systemctl is-active nginx 2>/dev/null || echo inactive; "
        "echo Health 8001:; curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8001/health/; echo"
    )
    o.channel.recv_exit_status()
    print(o.read().decode("utf-8", errors="replace"))
    c.close()

if __name__ == "__main__":
    main()
