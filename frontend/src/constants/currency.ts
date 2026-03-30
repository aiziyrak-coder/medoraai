/** USD → UZS: backend `USD_TO_UZS_RATE` bilan moslashsin (build vaqtida bake). */
const USD_TO_UZS_RATE = Math.max(1, Number(import.meta.env.VITE_USD_TO_UZS_RATE ?? 12500));

export function usdToUzsCeil(usd: number): number {
  return Math.ceil(usd * USD_TO_UZS_RATE);
}

export function formatUzs(amount: number): string {
  return `${amount.toLocaleString('uz-UZ')} so'm`;
}

export function USD_TO_UZS_RATE_VALUE(): number {
  return USD_TO_UZS_RATE;
}
