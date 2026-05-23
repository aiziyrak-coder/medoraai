#!/usr/bin/env python3
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("167.71.53.238", username="root", password=__import__("os").environ.get("DEPLOY_SSH_PASSWORD", "Ziyrak2025Ai"), timeout=60, allow_agent=False, look_for_keys=False)
cmd = """
grep -E '^(ALLOWED_HOSTS|CORS_ALLOWED|VITE_API)' /root/aidoktorfjsti/backend/.env /root/aidoktorfjsti/frontend/.env.production 2>/dev/null | sed 's/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=***/; s/VITE_ANTHROPIC.*/VITE_ANTHROPIC_API_KEY=***/'
grep -o 'api\\.aidoktor\\.uz' /root/aidoktorfjsti/frontend/dist/assets/index-*.js 2>/dev/null | head -3
echo DONE
"""
stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
print(stdout.read().decode("utf-8", errors="replace"))
c.close()
