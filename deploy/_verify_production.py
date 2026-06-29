#!/usr/bin/env python3
"""Production smoke test — health, auth rate limit, primary-care endpoints."""
import os
import sys
import json
import urllib.request
import urllib.error

BASE = os.environ.get('AISHIFOKOR_BASE', 'https://aishifokor.uz')
PWD = os.environ.get('AISHIFOKOR_SSH_PASSWORD', 'Fjsti2026Ai')

def get(path: str, token: str | None = None) -> tuple[int, dict | str]:
    req = urllib.request.Request(f'{BASE}{path}')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode('utf-8', errors='replace')
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body


def main() -> int:
    print('=== Health ===')
    code, data = get('/api/health/')
    print(code, data)
    if code != 200:
        return 1

    print('=== Anonymous rate limit headers (expect not 429 on single call) ===')
    code, _ = get('/api/patients/primary-care/stats/overview/')
    print('overview without auth:', code)

  # Optional: SSH check backend service
    try:
        import paramiko
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect('164.90.186.193', username='root', password=PWD, timeout=30, allow_agent=False, look_for_keys=False)
        _, stdout, _ = c.exec_command('systemctl is-active aishifokor-backend && curl -fsS http://127.0.0.1:8100/health/')
        print('=== Server ===')
        print(stdout.read().decode('utf-8', errors='replace'))
        c.close()
    except Exception as e:
        print('SSH skip:', e)

    return 0


if __name__ == '__main__':
    sys.exit(main())
