#!/usr/bin/env python3
"""
One-off: read SSH password from env SSH_DEPLOY_PASSWORD, run remote provision.
Usage: set SSH_DEPLOY_PASSWORD and run: python deploy/run_remote_provision_paramiko.py
"""
import os
import sys

import paramiko

HOST = os.environ.get("SSH_DEPLOY_HOST", "167.71.53.238")
USER = os.environ.get("SSH_DEPLOY_USER", "root")
PWD = os.environ.get("SSH_DEPLOY_PASSWORD", "")

REMOTE = r"""set -e
ROOT=/root/aidoktorfjsti
REPO=https://github.com/aiziyrak-coder/aidoktorfjsti.git
export AIDOKTOR_BRANCH=main
export AIDOKTOR_REPO_URL="$REPO"
if [ ! -d "$ROOT/.git" ]; then
  mkdir -p /root
  git clone "$REPO" "$ROOT"
fi
cd "$ROOT"
git fetch origin
git checkout main
git reset --hard origin/main
bash deploy/provision-aidoktor-uz.sh
echo REMOTE_PROVISION_OK
"""

if not PWD:
    print("Set SSH_DEPLOY_PASSWORD", file=sys.stderr)
    sys.exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(HOST, username=USER, password=PWD, timeout=30, allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = client.exec_command(REMOTE, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    exit_status = stdout.channel.recv_exit_status()
    out_b = (out or "").encode("utf-8", errors="replace")
    err_b = (err or "").encode("utf-8", errors="replace")
    sys.stdout.buffer.write(out_b)
    if err_b:
        sys.stderr.buffer.write(err_b)
    sys.exit(exit_status if exit_status is not None else 1)
finally:
    client.close()
