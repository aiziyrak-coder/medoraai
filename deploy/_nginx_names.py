#!/usr/bin/env python3
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("167.71.53.238", username="root", password="Ziyrak2025Ai", timeout=30)
_, o, _ = c.exec_command("grep -rh 'server_name' /etc/nginx/sites-enabled/ 2>/dev/null", timeout=30)
o.channel.recv_exit_status()
open(r"D:\aidoktor\deploy\_nginx.txt", "w", encoding="utf-8").write(o.read().decode("utf-8", errors="replace"))
c.close()
