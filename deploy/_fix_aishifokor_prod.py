#!/usr/bin/env python3
"""Pushdan keyin: pull, nginx CORS map, gunicorn, restart."""
import os, sys, time, paramiko

HOST = "164.90.186.193"
PWD = os.environ.get("AISHIFOKOR_SSH_PASSWORD", "Fjsti2026Ai")
ROOT = "/root/aishifokor"

script = f"""
set -e
cd {ROOT}
git fetch origin && git reset --hard origin/main
echo GIT: $(git log -1 --oneline)
rm -f /etc/nginx/conf.d/aishifokor-cors-map.conf
cp {ROOT}/deploy/nginx-aishifokor-security-limits.conf /etc/nginx/conf.d/aishifokor-security-limits.conf
cp {ROOT}/deploy/nginx-aishifokor-uz.conf /etc/nginx/sites-available/aishifokor-uz.conf
cp {ROOT}/deploy/systemd/aishifokor-backend.service /etc/systemd/system/aishifokor-backend.service
: > {ROOT}/backend/logs/error.log || true
ENV={ROOT}/backend/.env
patch_env() {{
  k="$1"; v="$2"
  if grep -q "^$k=" "$ENV" 2>/dev/null; then
    sed -i "s|^$k=.*|$k=$v|" "$ENV"
  else
    echo "$k=$v" >> "$ENV"
  fi
}}
patch_env ALLOWED_HOSTS 'aishifokor.uz,www.aishifokor.uz,api.aishifokor.uz,127.0.0.1,localhost'
patch_env CORS_ALLOWED_ORIGINS 'https://aishifokor.uz,https://www.aishifokor.uz,http://aishifokor.uz,https://api.aishifokor.uz'
patch_env CSRF_TRUSTED_ORIGINS 'https://aishifokor.uz,https://www.aishifokor.uz,https://api.aishifokor.uz'
patch_env AI_COST_MODE 'balanced'
patch_env DEBUG 'False'
patch_env SECURE_SSL_REDIRECT 'True'
systemctl daemon-reload
systemctl restart aishifokor-backend
cd {ROOT}/backend && ./venv/bin/python manage.py merge_patient_duplicates || true
FP={ROOT}/frontend/.env.production
if [ -f "$FP" ]; then
  grep -q '^VITE_API_BASE_URL=' "$FP" && \\
    sed -i 's|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://aishifokor.uz/api|' "$FP" || \\
    echo 'VITE_API_BASE_URL=https://aishifokor.uz/api' >> "$FP"
else
  echo 'VITE_API_BASE_URL=https://aishifokor.uz/api' > "$FP"
fi
cd {ROOT}/frontend && (npm ci --silent 2>/dev/null || npm ci) && npm run build
chmod -R o+rX {ROOT}/frontend/dist
nginx -t && systemctl reload nginx
sleep 2
curl -fsS http://127.0.0.1:8100/health/
echo
curl -sk -o /dev/null -w 'cors_api:%{{http_code}}\\n' -X OPTIONS -H 'Origin: https://aishifokor.uz' -H 'Access-Control-Request-Method: POST' https://api.aishifokor.uz/api/patients/
curl -sk -o /dev/null -w 'cors_front:%{{http_code}}\\n' -X OPTIONS -H 'Origin: https://aishifokor.uz' -H 'Access-Control-Request-Method: POST' https://aishifokor.uz/api/patients/
curl -sk -o /dev/null -w 'probe_env:%{{http_code}}\\n' https://api.aishifokor.uz/.env
curl -sk -o /dev/null -w 'admin_block:%{{http_code}}\\n' https://api.aishifokor.uz/admin/
curl -sk -D - -o /dev/null https://aishifokor.uz/ 2>&1 | grep -i 'strict-transport-security' | head -1
cd {ROOT}/backend && ./venv/bin/python -c "from ai_services.consensus_repair import ensure_nutrition_prevention, ensure_related_research; c={{'consensus_diagnosis':{{'name':'Test'}}}}; c=ensure_nutrition_prevention(c); c=ensure_related_research(c); assert c.get('nutrition_prevention'); assert c.get('related_research'); print('audit_ok')"
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PWD, timeout=30, allow_agent=False, look_for_keys=False)
_, stdout, _ = c.exec_command(script, get_pty=True, timeout=120)
parts = []
ch = stdout.channel
while not ch.exit_status_ready():
    if ch.recv_ready():
        parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
    time.sleep(0.15)
while ch.recv_ready():
    parts.append(ch.recv(65536).decode("utf-8", errors="replace"))
code = ch.recv_exit_status()
sys.stdout.buffer.write("".join(parts).encode("utf-8", errors="replace"))
c.close()
sys.exit(code)
