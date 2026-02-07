"""
AI Services Views – haqiqiy Gemini orqali; mock yo‘q.
"""
import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .gemini_utils import (
    generate_clarifying_questions as gemini_clarifying,
    recommend_specialists as gemini_recommend,
    generate_diagnoses as gemini_diagnoses,
)

logger = logging.getLogger(__name__)


def _patient_data_from_request(request):
    return request.data.get("patient_data") or {}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_clarifying_questions(request):
    """Aniqlashtiruvchi savollar – bemor ma'lumotiga qarab Gemini orqali."""
    try:
        patient_data = _patient_data_from_request(request)
        if not patient_data or not patient_data.get("complaints"):
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": "Bemor ma'lumotlari yoki shikoyatlar kiritilmagan",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not getattr(settings, "GEMINI_API_KEY", None):
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_503_SERVICE_UNAVAILABLE,
                        "message": "AI xizmati sozlanmagan",
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        questions = gemini_clarifying(patient_data)
        return Response({"success": True, "data": questions})
    except Exception as e:
        logger.exception("Error generating clarifying questions: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Savollar yaratishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def recommend_specialists(request):
    """Mutaxassislar tavsiyasi – bemor holatiga qarab Gemini orqali."""
    try:
        patient_data = _patient_data_from_request(request)
        if not patient_data or not patient_data.get("complaints"):
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": "Bemor ma'lumotlari kiritilmagan",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not getattr(settings, "GEMINI_API_KEY", None):
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_503_SERVICE_UNAVAILABLE,
                        "message": "AI xizmati sozlanmagan",
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        recommendations = gemini_recommend(patient_data)
        return Response({"success": True, "data": {"recommendations": recommendations}})
    except Exception as e:
        logger.exception("Error recommending specialists: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Mutaxassislar tavsiya qilishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_diagnoses(request):
    """Dastlabki differensial tashxislar – Gemini orqali (mock yo‘q)."""
    try:
        patient_data = _patient_data_from_request(request)
        if not patient_data or not patient_data.get("complaints"):
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": "Bemor ma'lumotlari kiritilmagan",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not getattr(settings, "GEMINI_API_KEY", None):
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_503_SERVICE_UNAVAILABLE,
                        "message": "AI xizmati sozlanmagan",
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        diagnoses = gemini_diagnoses(patient_data)
        return Response({"success": True, "data": diagnoses})
    except Exception as e:
        logger.exception("Error generating diagnoses: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Tashxis yaratishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_council_debate(request):
    """Konsilium munozarasi – frontend tomonida ishlatiladi; backend faqat stub."""
    try:
        patient_data = request.data.get("patient_data") or {}
        diagnoses = request.data.get("diagnoses") or []

        if not patient_data or not diagnoses:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": "Kerakli ma'lumotlar kiritilmagan",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Asl munozara frontendda aiCouncilService.runCouncilDebate orqali ishlaydi.
        # Bu endpoint boshqa integratsiyalar uchun qoldirilgan.
        return Response(
            {
                "success": True,
                "message": "Konsilium munozarasi boshlandi",
                "data": {"status": "processing", "message": "Frontendda munozara davom etadi"},
            }
        )
    except Exception as e:
        logger.exception("Error running council debate: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Konsilium munozarasi boshlamasda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
