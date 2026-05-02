#!/usr/bin/env bash
# Eski skript maxfiy kalitlar bilan aralashgan edi — repoda parol/API kalit saqlanmaydi.
# Aidoktor.uz uchun serverda: deploy/provision-aidoktor-uz.sh
# Uzoqdan: SSH kalit qo‘ying, keyin:
#   ssh root@SERVER 'bash -s' < deploy/provision-aidoktor-uz.sh
# yoki: python deploy/remote_run_provision.py (AIDOKTOR_SSH_PASSWORD muhit o‘zgaruvchisi)

set -euo pipefail
echo "Bu skript endi serverni avtomatik ishga tushirmaydi (maxfiy kalitlar olib tashlangan)."
echo "Serverda: bash /root/aidoktorfjsti/deploy/provision-aidoktor-uz.sh"
echo "Yoki: AIDOKTOR_SSH_PASSWORD o'rnatib python deploy/remote_run_provision.py"
exit 0
