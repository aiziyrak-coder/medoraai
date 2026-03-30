"""USD → UZS conversion (ceiling / katta tomonga yaxlitlash)."""
from decimal import Decimal, ROUND_CEILING

from django.conf import settings


def get_usd_to_uzs_rate() -> Decimal:
    return getattr(settings, 'USD_TO_UZS_RATE', Decimal('12500'))


def usd_to_uzs_ceil(usd) -> int:
    rate = get_usd_to_uzs_rate()
    d = Decimal(str(usd)) * rate
    return int(d.to_integral_value(rounding=ROUND_CEILING))


def plan_price_monthly_uzs(plan) -> int:
    """Oylik narxni so'mda qaytaradi: USD bo'lsa kurs bo'yicha, UZS bo'lsa yaxlitlangan butun."""
    cur = (getattr(plan, 'price_currency', None) or 'USD').upper()
    raw = Decimal(str(plan.price_monthly))
    if cur == 'UZS':
        return int(raw.to_integral_value(rounding=ROUND_CEILING))
    return usd_to_uzs_ceil(raw)
