#!/usr/bin/env bash
# Tekshiruv: authoritative DNS vs umumiy resolverlar (Google kesh muammosi aniqlash).
# Ishlatish: bash deploy/verify-aidoktor-dns.sh
set -euo pipefail
DOMAIN="${1:-aidoktor.uz}"
EXPECTED="${EXPECTED_IP:-167.71.53.238}"
echo "=== Authoritative (manba) ==="
for ns in rdns1.ahost.uz rdns2.ahost.uz rdns3.ahost.uz; do
  out=$(dig +short "@${ns}" "${DOMAIN}" A 2>/dev/null | tail -1)
  echo "  ${ns}: ${out:-<javob yo'q>}"
done
echo "=== Umumiy resolverlar ==="
for r in 8.8.8.8 1.1.1.1 9.9.9.9; do
  out=$(dig +short "@${r}" "${DOMAIN}" A 2>/dev/null | tail -1)
  ok="OK"; [[ "${out}" != "${EXPECTED}" ]] && ok="KUTILGAN ${EXPECTED} emas (kesh/tarmoq)"
  echo "  ${r}: ${out:-?}  (${ok})"
done
echo "=== HTTPS (faqat IP to'g'ri bo'lsa) ==="
if command -v curl >/dev/null; then
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -k --resolve "${DOMAIN}:443:${EXPECTED}" "https://${DOMAIN}/" || echo "000")
  echo "  https://${DOMAIN}/ (resolve shartli): HTTP ${code}"
fi
