#!/usr/bin/env python3
"""Write VITE_GEMINI_API_KEY to server frontend/.env.local before build"""
import paramiko

SERVER_USER = "root"
SERVER_HOST = "fjsti.ziyrak.org"
SERVER_PASSWORD = "Ziyrak2025Ai"
REMOTE_DIR = "/root/medoraai"

GEMINI_API_KEY = ""  # Set manually on server - do NOT put key here
VITE_API_BASE_URL = "https://fjstiapi.ziyrak.org/api"

env_content = f"""VITE_API_BASE_URL={VITE_API_BASE_URL}
VITE_GEMINI_API_KEY={GEMINI_API_KEY}
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD,
               timeout=30, allow_agent=False, look_for_keys=False)

sftp = client.open_sftp()
with sftp.open(f'{REMOTE_DIR}/frontend/.env.local', 'w') as f:
    f.write(env_content)
sftp.close()

_, stdout, _ = client.exec_command(f'cat {REMOTE_DIR}/frontend/.env.local')
print("Server .env.local content:")
print(stdout.read().decode())
client.close()
print("Done!")
