#!/usr/bin/env python3
"""Incremental AiShifokor redeploy (SFTP sync + build + restart)."""
from __future__ import annotations

import os
import sys
import time
import shlex
from pathlib import Path

try:
    import paramiko
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
    import paramiko

REPO = Path(__file__).resolve().parent.parent
HOST = os.environ.get("AISHIFOKOR_SSH_HOST", "192.168.0.101")
USER = os.environ.get("AISHIFOKOR_SSH_USER", "admin_root")
PWD = (
    os.environ.get("AISHIFOKOR_SSH_PASSWORD", "").strip()
    or os.environ.get("AIDOKTOR_SSH_PASSWORD", "").strip()
)
ROOT = "/root/aishifokor"

SYNC_PATHS = [
    "backend/patients/icd10_catalog.py",
    "backend/patients/population_statistics.py",
    "backend/patients/population_views.py",
    "backend/patients/population_service.py",
    "backend/patients/models.py",
    "backend/patients/sox_excel_import.py",
    "backend/patients/migrations/0007_populationrecord_disability_group_and_more.py",
    "backend/patients/management/commands/backfill_population_stats_fields.py",
    "backend/patients/management/commands/import_sox_excel_patients.py",
    "frontend/src/components/population/PatientStatisticsPanel.tsx",
    "frontend/src/services/apiPatientStatisticsService.ts",
    "frontend/src/components/primarycare/PrimaryCareHub.tsx",
    "frontend/src/i18n/locales/uzL.ts",
    "frontend/src/i18n/locales/primaryCare.en.ts",
]

def _remote_script() -> str:
    sp = shlex.quote(PWD)
    root = shlex.quote(ROOT)
    return f"""set -euo pipefail
export PATH="/usr/local/bin:/usr/sbin:/usr/bin:/bin"
ROOT={root}
run_sudo() {{ printf '%s\\n' {sp} | sudo -S "$@"; }}

echo "==> Backend deps + migrate..."
cd "$ROOT/backend"
source venv/bin/activate
pip install -r requirements.txt -q
if grep -q '^STATS_HISTORICAL_BASELINE=' .env 2>/dev/null; then
  sed -i 's/^STATS_HISTORICAL_BASELINE=.*/STATS_HISTORICAL_BASELINE=0/' .env
else
  echo 'STATS_HISTORICAL_BASELINE=0' >> .env
fi
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "==> Frontend build..."
cd "$ROOT/frontend"
cat > .env.production << 'EOFENV'
VITE_API_BASE_URL=https://aishifokor.uz/api
EOFENV
npm ci
export NODE_ENV=production
npm run build

echo "==> Nginx config..."
run_sudo cp "$ROOT/deploy/nginx-aishifokor-uz.conf" /etc/nginx/sites-available/aishifokor.uz
run_sudo ln -sf /etc/nginx/sites-available/aishifokor.uz /etc/nginx/sites-enabled/aishifokor.uz
run_sudo nginx -t
run_sudo systemctl reload nginx

echo "==> Restart backend..."
run_sudo systemctl restart aishifokor-backend
sleep 2
run_sudo systemctl is-active aishifokor-backend
curl -sk -o /dev/null -w "API health: %{{http_code}}\\n" https://127.0.0.1/health/ -H "Host: api.aishifokor.uz" || true
echo DONE
"""


def _out(text: str) -> None:
    sys.stdout.buffer.write(text.encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()


def _mkdir_p(sftp: paramiko.SFTPClient, path: str) -> None:
    cur = ""
    for part in path.split("/"):
        if not part:
            continue
        cur = f"{cur}/{part}" if cur else part
        try:
            sftp.stat(cur)
        except OSError:
            sftp.mkdir(cur)


def _pump(stdout) -> int:
    ch = stdout.channel
    while not ch.exit_status_ready():
        if ch.recv_ready():
            _out(ch.recv(65536).decode("utf-8", errors="replace"))
        time.sleep(0.08)
    while ch.recv_ready():
        _out(ch.recv(65536).decode("utf-8", errors="replace"))
    return ch.recv_exit_status()


def main() -> int:
    if not PWD:
        print("AISHIFOKOR_SSH_PASSWORD kerak.", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    _out(f"==> Ulanish: {USER}@{HOST}\n")
    client.connect(
        HOST,
        username=USER,
        password=PWD,
        timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )

    _out("==> SFTP sync...\n")
    sftp = client.open_sftp()
    for rel in SYNC_PATHS:
        local = REPO / rel
        if not local.is_file():
            raise FileNotFoundError(local)
        remote = f"{ROOT}/{rel.replace(chr(92), '/')}"
        _mkdir_p(sftp, os.path.dirname(remote))
        sftp.put(str(local), remote)
        _out(f"  {rel}\n")
    sftp.close()

    _, stdout, _ = client.exec_command(_remote_script(), get_pty=True)
    code = _pump(stdout)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
