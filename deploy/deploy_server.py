#!/usr/bin/env python3
"""
MedoraAI Server Deployment Script
Connects to server via SSH and deploys latest changes.

Security: parol repoda saqlanmaydi. Muhit o'zgaruvchilari:
  DEPLOY_SSH_HOST   — masalan 167.71.53.238 yoki fjsti.ziyrak.org
  DEPLOY_SSH_USER   — odatda root
  DEPLOY_SSH_PASSWORD yoki SSH parolni shell env orqali bering
"""

import os
import paramiko
import sys
import time

# Windows cp1251 konsolida Unicode chiqarish xato bermasligi uchun
def _configure_stdio_utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


_configure_stdio_utf8()

SERVER_USER = os.environ.get("DEPLOY_SSH_USER", "root")
SERVER_HOST = os.environ.get("DEPLOY_SSH_HOST", "167.71.53.238")
SERVER_PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "").strip()
REMOTE_DIR = os.environ.get("DEPLOY_REMOTE_DIR", "/root/medoraai")

def deploy():
    """Deploy to server via SSH"""
    if not SERVER_PASSWORD:
        print("[X] DEPLOY_SSH_PASSWORD muhit o'zgaruvchisi o'rnatilmagan.")
        print("   Misol (PowerShell): $env:DEPLOY_SSH_PASSWORD='...'; python deploy/deploy_server.py")
        return False

    print("=" * 60)
    print(" MedoraAI Server Deployment")
    print("=" * 60)
    print(f"Server: {SERVER_USER}@{SERVER_HOST}")
    print(f"Remote Directory: {REMOTE_DIR}")
    print()
    
    # Create SSH client
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print("[1/6] Connecting to server...")
        client.connect(
            hostname=SERVER_HOST,
            username=SERVER_USER,
            password=SERVER_PASSWORD,
            timeout=30,
            allow_agent=False,
            look_for_keys=False
        )
        print("[OK] Connected successfully")
        print()
        
        # Step 1: Pull from GitHub (with stash to handle local changes)
        print("[2/6] Pulling latest changes from GitHub...")
        stdin, stdout, stderr = client.exec_command(
            f"cd {REMOTE_DIR} && git stash && git pull origin main",
            timeout=60
        )
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if output:
            print(output)
        if error and "error:" not in error.lower():
            print(f"WARNING: {error}")
        
        print("[OK] Pull completed")
        print()
        
        # Small delay
        time.sleep(1)

        # Step 2: Build frontend
        print("[3/6] Building frontend (npm run build)...")
        stdin, stdout, stderr = client.exec_command(
            f"cd {REMOTE_DIR}/frontend && npm run build",
            timeout=180
        )
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        if output:
            print(output[-2000:])  # last 2000 chars
        if error and 'warn' not in error.lower()[:20]:
            print(f"BUILD WARNING: {error[-1000:]}")
        print("[OK] Frontend built")
        print()

        # Step 3: Nginx serves /root/medoraai/frontend/dist (vite outDir); reload after build
        print("[4/6] Reloading nginx (frontend served from frontend/dist) ...")
        stdin, stdout, stderr = client.exec_command(
            "nginx -t && systemctl reload nginx",
            timeout=30
        )
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        if output:
            print(output)
        if error:
            # nginx -t outputs to stderr even on success
            print(f"Nginx: {error.strip()}")
        print("[OK] Frontend deployed and nginx reloaded")
        print()

        time.sleep(1)
        
        # Step 5: Restart service
        print("[5/6] Restarting backend service...")
        stdin, stdout, stderr = client.exec_command(
            "sudo systemctl restart medoraai-backend-8001.service",
            timeout=30
        )
        exit_restart = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        if output:
            print(output)
        if exit_restart != 0:
            print(f"ERROR (restart exit {exit_restart}): {error}")
            return False
        if error.strip():
            print(f"restart stderr: {error.strip()}")

        print("[OK] Service restarted")
        print()
        
        # Small delay
        time.sleep(2)
        
        # Step 6: Check service status
        print("[6/6] Checking service status...")
        stdin, stdout, stderr = client.exec_command(
            "sudo systemctl status medoraai-backend-8001.service --no-pager -l",
            timeout=30
        )
        status_output = stdout.read().decode('utf-8')
        print(status_output)
        
        # Check if service is active
        if "active (running)" in status_output:
            print()
            print("=" * 60)
            print(" [OK] DEPLOYMENT SUCCESSFUL!")
            print("=" * 60)
            print()
            print("Backend service is running.")
            print("Frontend: https://fjsti.ziyrak.org")
            print("API:      https://fjstiapi.ziyrak.org/api/")
            print("Test URL: https://fjstiapi.ziyrak.org/api/ai/clarifying-questions/")
            print()
            return True
        else:
            print()
            print("[!] Service may not be running properly. Check logs:")
            print("   sudo journalctl -u medoraai-backend-8001.service -f --no-pager")
            return False
            
    except paramiko.AuthenticationException:
        print("[X] Authentication failed! Check username/password.")
        return False
    except paramiko.SSHException as e:
        print(f"[X] SSH connection error: {e}")
        return False
    except Exception as e:
        print(f"[X] Deployment failed: {e}")
        return False
    finally:
        client.close()

if __name__ == "__main__":
    success = deploy()
    sys.exit(0 if success else 1)
