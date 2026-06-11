#!/usr/bin/env python3
"""To'liq production audit — aishifokor.uz DevOps tekshiruvi."""
import json
import os
import sys
import paramiko

HOST = "164.90.186.193"
PWD = os.environ.get("AISHIFOKOR_SSH_PASSWORD", "Fjsti2026Ai")
ROOT = "/root/aishifokor"

AUDIT = r"""
set +e
echo "========== GIT =========="
cd ROOT_PLACEHOLDER && git log -1 --oneline

echo "========== SERVICES =========="
systemctl is-active aishifokor-backend nginx
systemctl show aishifokor-backend -p ActiveState -p SubState -p MainPID

echo "========== HEALTH =========="
curl -fsS http://127.0.0.1:8100/health/; echo
curl -sk -o /dev/null -w 'front:%{http_code}\n' https://aishifokor.uz/
curl -sk -o /dev/null -w 'api_health:%{http_code}\n' https://api.aishifokor.uz/health/
curl -sk -o /dev/null -w 'proxy_health:%{http_code}\n' https://aishifokor.uz/health/
curl -sk -o /dev/null -w 'post_root:%{http_code}\n' -X POST https://api.aishifokor.uz/

echo "========== CORS PREFLIGHT =========="
curl -sk -D - -o /dev/null -X OPTIONS \
  -H 'Origin: https://aishifokor.uz' \
  -H 'Access-Control-Request-Method: POST' \
  https://aishifokor.uz/api/patients/ 2>&1 | sed -n '1,10p'
curl -sk -D - -o /dev/null -X OPTIONS \
  -H 'Origin: https://aishifokor.uz' \
  -H 'Access-Control-Request-Method: POST' \
  https://api.aishifokor.uz/api/patients/ 2>&1 | sed -n '1,10p'

echo "========== ENV (masked) =========="
grep -E '^(ALLOWED_HOSTS|CORS_ALLOWED|CSRF|AI_COST|DEBUG)=' ROOT_PLACEHOLDER/backend/.env 2>/dev/null | sed 's/KEY=.*/KEY=***/'
grep '^VITE_API' ROOT_PLACEHOLDER/frontend/.env.production 2>/dev/null

echo "========== NGINX =========="
nginx -t 2>&1
grep -c 'aishifokorapi_options_preflight' /etc/nginx/sites-available/aishifokor-uz.conf || true
grep -c 'location \^~ /api/' /etc/nginx/sites-available/aishifokor-uz.conf || true

echo "========== PYTHON IMPORTS =========="
cd ROOT_PLACEHOLDER/backend && ./venv/bin/python -c "
from ai_services.evidence_sources import build_fast_research_sources
from ai_services.consensus_repair import ensure_nutrition_prevention, ensure_consensus_from_phases
c = {'consensus_diagnosis': {'name': 'Gipertoniya'}}
c = ensure_nutrition_prevention(c, 'uz-L')
assert c.get('nutrition_prevention'), 'nutrition missing'
r = build_fast_research_sources('Gipertoniya', 'uz-L')
assert len(r) >= 5, 'research sources'
print('imports_ok', len(r), len(c['nutrition_prevention'].get('dietary_guidelines', [])))
"

echo "========== DISK / MEM =========="
df -h / | tail -1
free -h | head -2

echo "========== RECENT ERRORS =========="
tail -20 ROOT_PLACEHOLDER/backend/logs/error.log 2>/dev/null
tail -8 /var/log/nginx/error.log 2>/dev/null | grep aishifokor || true

echo "========== FRONTEND BUILD =========="
test -f ROOT_PLACEHOLDER/frontend/dist/index.html && echo dist_ok || echo dist_MISSING
ls ROOT_PLACEHOLDER/frontend/dist/assets/index-*.js 2>/dev/null | tail -1
""".replace("ROOT_PLACEHOLDER", ROOT)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PWD, timeout=45, allow_agent=False, look_for_keys=False)
_, stdout, stderr = c.exec_command(AUDIT, timeout=120)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
c.close()
sys.stdout.write(out)
if err:
    sys.stderr.write(err)
if "dist_MISSING" in out or "imports_ok" not in out:
    sys.exit(1)
