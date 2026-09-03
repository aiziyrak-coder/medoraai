"""
103 — Tezkor triaj endpointi.

POST /api/ai/emergency-triage/   (va /api/ziyrak/emergency-triage/)

Alohida faylda: tez yordam yo'li konsilium/doctor-support oqimidan mustaqil
bo'lishi kerak — biri buzilsa ikkinchisi ishlab turaversin.
"""
from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAuthenticatedWithSubscription

from .emergency_triage import (
    AGE_BANDS,
    EmergencyAIUnavailable,
    run_emergency_triage,
)

logger = logging.getLogger(__name__)

_MAX_COMPLAINTS = 12
_MAX_NOTE_LEN = 1000


def _err(code: int, message: str):
    return Response(
        {"success": False, "error": {"code": code, "message": message, "details": {}}},
        status=code,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
def emergency_triage_view(request):
    """
    Tezkor triaj: shikoyat(lar) → qizil bayroqlar, ehtimoliy holat,
    hozirgi choralar, qaror.

    Kirish:
      complaints: ["ko'krak og'rig'i", ...]   (tanlangan shikoyatlar)
      note:       "qo'shimcha matn"            (ixtiyoriy)
      age_band:   infant|child|teen|adult|elderly
      age_years:  aniq yosh (ixtiyoriy, age_band dan ustun)
      sex:        male|female
      language:   uz-L | uz-C | ru | en | kaa
    """
    data = request.data if isinstance(request.data, dict) else {}

    complaints = data.get("complaints") or []
    if not isinstance(complaints, list):
        return _err(status.HTTP_400_BAD_REQUEST, "complaints ro'yxat bo'lishi kerak.")
    complaints = [str(c).strip() for c in complaints if str(c).strip()][:_MAX_COMPLAINTS]

    note = str(data.get("note") or "").strip()[:_MAX_NOTE_LEN]

    if not complaints and not note:
        return _err(
            status.HTTP_400_BAD_REQUEST,
            "Kamida bitta shikoyat tanlang yoki qo'shimcha izoh yozing.",
        )

    age_band = str(data.get("age_band") or "").strip()
    if age_band and age_band not in AGE_BANDS:
        return _err(status.HTTP_400_BAD_REQUEST, "age_band noto'g'ri.")

    age_years = data.get("age_years")
    if age_years not in (None, ""):
        try:
            age_years = int(age_years)
        except (TypeError, ValueError):
            return _err(status.HTTP_400_BAD_REQUEST, "age_years butun son bo'lishi kerak.")
        if not 0 <= age_years <= 120:
            return _err(status.HTTP_400_BAD_REQUEST, "age_years 0-120 oralig'ida bo'lsin.")

    sex = str(data.get("sex") or "").strip()
    if sex and sex not in ("male", "female"):
        return _err(status.HTTP_400_BAD_REQUEST, "sex noto'g'ri.")

    language = str(data.get("language") or "uz-L").strip()

    try:
        result = run_emergency_triage(
            complaints=complaints,
            note=note,
            age_band=age_band,
            age_years=age_years,
            sex=sex,
            language=language,
        )
    except EmergencyAIUnavailable as exc:
        # Soxta triaj qaytarilmaydi — feldsher xizmat ishlamayotganini bilishi shart.
        logger.error("Emergency triage unavailable (user=%s): %s", request.user.id, exc)
        return _err(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Triaj xizmati hozir ishlamayapti. O'z protokolingiz bo'yicha harakat qiling.",
        )
    except Exception as exc:  # kutilmagan xato ham soxta javobga aylanmasin
        logger.exception("Emergency triage failed (user=%s): %s", request.user.id, exc)
        return _err(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Triaj xizmati hozir ishlamayapti. O'z protokolingiz bo'yicha harakat qiling.",
        )

    logger.info(
        "Emergency triage: user=%s complaints=%d disposition=%s red_flags=%d",
        request.user.id, len(complaints), result.get("disposition"), len(result.get("red_flags") or []),
    )
    return Response({"success": True, "data": result})
