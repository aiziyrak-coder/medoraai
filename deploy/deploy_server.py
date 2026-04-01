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
import pathlib
import shlex
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
# 1 = fjsti.ziyrak.org uchun nginx da boshqa loyiha bilan to'qnashuvni bartaraf etadi (HTTP :80)
FIX_FJSTI_NGINX = os.environ.get("DEPLOY_FIX_FJSTI_NGINX", "1").strip().lower() in (
    "1",
    "true",
    "yes",
)


def _apply_fjsti_nginx_http(client: "paramiko.SSHClient", local_repo_deploy_dir: str) -> bool:
    """sites-enabled da fjsti domenlari bo'lgan boshqa konfiglarni vaqtincha oladi, Medora HTTP konfigni qo'yadi."""

    conf_local = pathlib.Path(local_repo_deploy_dir) / "nginx-fjsti-medora-http.conf"
    if not conf_local.is_file():
        print(f"[X] Local nginx config topilmadi: {conf_local}")
        return False
    body = conf_local.read_bytes()
    try:
        sftp = client.open_sftp()
        remote_tmp = "/tmp/medora-fjsti-http.conf"
        with sftp.file(remote_tmp, "wb") as rf:
            rf.write(body)
        sftp.close()
    except Exception as e:
        print(f"[X] SFTP yuklash xatosi: {e}")
        return False

    shell = r'''set -e
BACKUP=/root/nginx-fjsti-conflicts-$(date +%s)
mkdir -p "$BACKUP"
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  bn=$(basename "$f")
  case "$bn" in
    00-medora-fjsti-ziyrak-http.conf) continue ;;
  esac
  if grep -qE 'fjsti\.ziyrak\.org|fjstiapi\.ziyrak\.org' "$f" 2>/dev/null; then
    echo "BACKUP: $f -> $BACKUP/"
    mv "$f" "$BACKUP/"
  fi
done
if [ -d /etc/nginx/conf.d ] && grep -rqE 'fjsti\.ziyrak\.org|fjstiapi\.ziyrak\.org' /etc/nginx/conf.d/ 2>/dev/null; then
  echo "WARN: conf.d da ham fjsti bor (bir faylda bir nechta server bo'lishi mumkin). Qo'lda tekshiring:"
  grep -rlE 'fjsti\.ziyrak\.org|fjstiapi\.ziyrak\.org' /etc/nginx/conf.d/ 2>/dev/null || true
fi
cp /tmp/medora-fjsti-http.conf /etc/nginx/sites-available/medora-fjsti-ziyrak-http.conf
ln -sf /etc/nginx/sites-available/medora-fjsti-ziyrak-http.conf /etc/nginx/sites-enabled/00-medora-fjsti-ziyrak-http.conf
nginx -t
systemctl reload nginx
echo OK_FJSTI_NGINX
'''
    stdin, stdout, stderr = client.exec_command(shell, timeout=60)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err.strip():
        print(f"stderr: {err.strip()}")
    if exit_code != 0 or "OK_FJSTI_NGINX" not in out:
        print("[X] nginx-fjsti qo'llash muvaffaqiyatsiz (nginx -t yoki boshqa xato).")
        return False
    print("[OK] fjsti / fjstiapi uchun Medora nginx (HTTP) qo'llandi")
    return True


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
        print("[1/7] Connecting to server...")
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
        print("[2/7] Pulling latest changes from GitHub...")
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

        # Step 2: Build frontend (serverda to'g'ri API domeni bilan)
        vite_api = os.environ.get(
            "DEPLOY_VITE_API_BASE_URL", "https://fjstiapi.ziyrak.org/api"
        )
        build_cmd = (
            f"cd {REMOTE_DIR}/frontend && "
            f"export VITE_API_BASE_URL={shlex.quote(vite_api)} && npm run build"
        )
        print(f"[3/7] Building frontend (VITE_API_BASE_URL={vite_api})...")
        stdin, stdout, stderr = client.exec_command(build_cmd, timeout=180)
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        if output:
            print(output[-2000:])  # last 2000 chars
        if error and 'warn' not in error.lower()[:20]:
            print(f"BUILD WARNING: {error[-1000:]}")
        print("[OK] Frontend built")
        print()

        deploy_dir = str(pathlib.Path(__file__).resolve().parent)
        if FIX_FJSTI_NGINX:
            print(
                "[4/7] fjsti nginx: boshqa loyihalar bilan to'qnashuvni olib, Medora HTTP konfigni qo'yish..."
            )
            if not _apply_fjsti_nginx_http(client, deploy_dir):
                return False
            print()
        else:
            print("[4/7] Reloading nginx (DEPLOY_FIX_FJSTI_NGINX=0)...")
            stdin, stdout, stderr = client.exec_command(
                "nginx -t && systemctl reload nginx",
                timeout=30,
            )
            output = stdout.read().decode("utf-8")
            error = stderr.read().decode("utf-8")
            if output:
                print(output)
            if error:
                print(f"Nginx: {error.strip()}")
            print("[OK] nginx reloaded")
            print()

        time.sleep(1)

        # Step 5: Restart service
        print("[5/7] Restarting backend service...")
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
        print("[6/7] Checking service status...")
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
