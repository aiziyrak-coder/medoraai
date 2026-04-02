#!/usr/bin/env python3
"""
MedoraAI Server Deployment Script
Connects to server via SSH and deploys latest changes.

Security: parol repoda saqlanmaydi. Muhit o'zgaruvchilari:
  DEPLOY_SSH_HOST   — masalan 167.71.53.238 yoki fjsti.ziyrak.org
  DEPLOY_SSH_USER   — odatda root
  DEPLOY_SSH_PASSWORD yoki SSH parolni shell env orqali bering

  HTTPS (fjsti):
  DEPLOY_CERTBOT_EMAIL — Let's Encrypt uchun email (birinchi marta sert olish).
  Bo'lmasa sert yo'qida faqat HTTP nginx qo'llanadi.
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

CERTBOT_EMAIL = os.environ.get("DEPLOY_CERTBOT_EMAIL", "").strip()
CERT_PATH = "/etc/letsencrypt/live/fjsti.ziyrak.org/fullchain.pem"

# Optional: rotate Gemini key on server + bake to frontend build env (Vite).
# SECURITY: key repo'ga yozilmaydi, faqat deploy vaqtida env orqali beriladi.
DEPLOY_BACKEND_GEMINI_API_KEY = (os.environ.get("DEPLOY_BACKEND_GEMINI_API_KEY") or "").strip()
DEPLOY_VITE_GEMINI_API_KEY = (
    (os.environ.get("DEPLOY_VITE_GEMINI_API_KEY") or "").strip()
    or DEPLOY_BACKEND_GEMINI_API_KEY
)


def _set_backend_env_key_if_needed(client: "paramiko.SSHClient", remote_dir: str, key: str) -> bool:
    """backend/.env ga GEMINI_API_KEY ni xavfsiz yozadi (bo'lmasa qo'shadi)."""
    if not key:
        return True
    env_path = shlex.quote(f"{remote_dir}/backend/.env")
    key_q = shlex.quote(key)
    shell = f"""set -e
ENV_FILE={env_path}
KEY={key_q}
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
if grep -qE '^GEMINI_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  # replace existing line
  sed -i "s/^GEMINI_API_KEY=.*/GEMINI_API_KEY=$KEY/" "$ENV_FILE"
else
  echo "GEMINI_API_KEY=$KEY" >> "$ENV_FILE"
fi
echo OK_GEMINI_ENV
"""
    stdin, stdout, stderr = client.exec_command(shell, timeout=30)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if err.strip():
        print(f"    backend/.env update stderr: {err.strip()[-1000:]}")
    if code != 0 or "OK_GEMINI_ENV" not in out:
        print("[X] backend/.env ga GEMINI_API_KEY yozib bo'lmadi.")
        return False
    print("[OK] backend/.env GEMINI_API_KEY yangilandi")
    return True


def _fjsti_ssl_cert_exists(client: "paramiko.SSHClient") -> bool:
    stdin, stdout, _ = client.exec_command(f"test -f {CERT_PATH} && echo yes || echo no")
    return stdout.read().decode().strip() == "yes"


def _install_certbot_and_obtain_cert(
    client: "paramiko.SSHClient", remote_dir: str, email: str
) -> bool:
    webroot = shlex.quote(f"{remote_dir}/frontend/dist")
    em = shlex.quote(email)
    shell = f"""set -e
if ! command -v certbot >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y certbot
fi
certbot certonly --webroot -w {webroot} \\
  --non-interactive --agree-tos --email {em} \\
  -d fjsti.ziyrak.org -d fjstiapi.ziyrak.org \\
  --preferred-challenges http --expand
test -f {CERT_PATH}
echo CERTBOT_OK
"""
    print(f"    certbot (webroot {remote_dir}/frontend/dist)...")
    stdin, stdout, stderr = client.exec_command(shell, timeout=300)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out[-4000:])
    if err.strip():
        print(f"    certbot stderr: {err.strip()[-2000:]}")
    if code != 0 or "CERTBOT_OK" not in out:
        print("[X] certbot muvaffaqiyatsiz (DNS, 80-port yoki rate limit tekshiring).")
        return False
    print("[OK] Let's Encrypt sertifikati olindi")
    return True


def _apply_fjsti_nginx_config(
    client: "paramiko.SSHClient", local_repo_deploy_dir: str, use_ssl: bool
) -> bool:
    """Boshqa fjsti konfiglarni zaxiralab Medora nginx ni qo'llaydi (HTTP yoki HTTPS)."""
    fname = (
        "nginx-fjsti-medora-ssl.conf"
        if use_ssl
        else "nginx-fjsti-medora-http.conf"
    )
    conf_local = pathlib.Path(local_repo_deploy_dir) / fname
    if not conf_local.is_file():
        print(f"[X] Local nginx topilmadi: {conf_local}")
        return False
    body = conf_local.read_bytes()
    try:
        sftp = client.open_sftp()
        remote_tmp = "/tmp/medora-fjsti-nginx.conf"
        with sftp.file(remote_tmp, "wb") as rf:
            rf.write(body)
        sftp.close()
    except Exception as e:
        print(f"[X] SFTP: {e}")
        return False

    mode = "HTTPS" if use_ssl else "HTTP"
    shell = r"""set -e
BACKUP=/root/nginx-fjsti-conflicts-$(date +%s)
mkdir -p "$BACKUP"
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  bn=$(basename "$f")
  case "$bn" in
    00-medora-fjsti-ziyrak.conf) continue ;;
    00-medora-fjsti-ziyrak-http.conf) continue ;;
    00-medora-fjsti-ziyrak-ssl.conf) continue ;;
  esac
  if grep -qE 'fjsti\.ziyrak\.org|fjstiapi\.ziyrak\.org' "$f" 2>/dev/null; then
    echo "BACKUP: $f -> $BACKUP/"
    mv "$f" "$BACKUP/"
  fi
done
if [ -d /etc/nginx/conf.d ] && grep -rqE 'fjsti\.ziyrak\.org|fjstiapi\.ziyrak\.org' /etc/nginx/conf.d/ 2>/dev/null; then
  echo "WARN: conf.d da fjsti — qo'lda: grep -r fjsti /etc/nginx/conf.d/"
  grep -rlE 'fjsti\.ziyrak\.org|fjstiapi\.ziyrak\.org' /etc/nginx/conf.d/ 2>/dev/null || true
fi
rm -f /etc/nginx/sites-enabled/00-medora-fjsti-ziyrak-http.conf
rm -f /etc/nginx/sites-enabled/00-medora-fjsti-ziyrak-ssl.conf
cp /tmp/medora-fjsti-nginx.conf /etc/nginx/sites-available/medora-fjsti-ziyrak.conf
ln -sf /etc/nginx/sites-available/medora-fjsti-ziyrak.conf /etc/nginx/sites-enabled/00-medora-fjsti-ziyrak.conf
nginx -t
systemctl reload nginx
echo OK_FJSTI_NGINX
"""
    stdin, stdout, stderr = client.exec_command(shell, timeout=90)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err.strip():
        print(f"stderr: {err.strip()}")
    if exit_code != 0 or "OK_FJSTI_NGINX" not in out:
        print(f"[X] nginx qo'llash muvaffaqiyatsiz ({mode}).")
        return False
    print(f"[OK] fjsti nginx ({mode}) qo'llandi")
    return True


def _apply_fjsti_nginx_full(
    client: "paramiko.SSHClient", deploy_dir: str, remote_dir: str
) -> bool:
    """Sert bor bo'lsa HTTPS; yo'q bo'lsa email bilan certbot, aks holda HTTP."""
    print("[4/7] fjsti nginx (HTTPS / certbot)...")

    if _fjsti_ssl_cert_exists(client):
        print("    SSL sertifikat mavjud — HTTPS konfig qo'llanmoqda.")
        return _apply_fjsti_nginx_config(client, deploy_dir, use_ssl=True)

    if CERTBOT_EMAIL:
        print("    Sert yo'q — avval HTTP (ACME), keyin certbot.")
        if not _apply_fjsti_nginx_config(client, deploy_dir, use_ssl=False):
            return False
        if not _install_certbot_and_obtain_cert(client, remote_dir, CERTBOT_EMAIL):
            return False
        if not _fjsti_ssl_cert_exists(client):
            print("[X] certbot dan keyin ham sert fayli topilmadi.")
            return False
        return _apply_fjsti_nginx_config(client, deploy_dir, use_ssl=True)

    print(
        "[!] DEPLOY_CERTBOT_EMAIL berilmagan — faqat HTTP. HTTPS uchun qayta deploy:\n"
        "    $env:DEPLOY_CERTBOT_EMAIL='siz@email.com'"
    )
    return _apply_fjsti_nginx_config(client, deploy_dir, use_ssl=False)


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

        # Step 2.5: Update backend Gemini key (optional)
        if DEPLOY_BACKEND_GEMINI_API_KEY:
            print("[2.5/7] Updating backend GEMINI_API_KEY...")
            if not _set_backend_env_key_if_needed(client, REMOTE_DIR, DEPLOY_BACKEND_GEMINI_API_KEY):
                return False
            print()

        # Step 2: Build frontend (serverda to'g'ri API domeni bilan)
        vite_api = os.environ.get(
            "DEPLOY_VITE_API_BASE_URL", "https://fjstiapi.ziyrak.org/api"
        )
        build_cmd = (
            f"cd {REMOTE_DIR}/frontend && "
            f"export VITE_API_BASE_URL={shlex.quote(vite_api)}"
            + (f" VITE_GEMINI_API_KEY={shlex.quote(DEPLOY_VITE_GEMINI_API_KEY)}" if DEPLOY_VITE_GEMINI_API_KEY else "")
            + " && npm run build"
        )
        extra = " + VITE_GEMINI_API_KEY" if DEPLOY_VITE_GEMINI_API_KEY else ""
        print(f"[3/7] Building frontend (VITE_API_BASE_URL={vite_api}{extra})...")
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
            if not _apply_fjsti_nginx_full(client, deploy_dir, REMOTE_DIR):
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
            print("CORS preflight (login xatosi bo'lsa, serverda nginx yangilanganini tekshiring):")
            print('  curl -sI -X OPTIONS "https://fjstiapi.ziyrak.org/api/auth/login/" \\')
            print('    -H "Origin: https://fjsti.ziyrak.org" -H "Access-Control-Request-Method: POST"')
            print("  Kutilyapti: access-control-allow-origin: https://fjsti.ziyrak.org")
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
