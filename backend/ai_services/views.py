"""
AI Services Views – haqiqiy Gemini orqali; mock yo'q.
Autonomous Treatment Protocol Generation System
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
from .autonomous_protocol_generator import autonomous_generator
from .clinical_decision_engine import clinical_decision_engine
from .continuous_monitoring import continuous_monitoring
from .self_learning_system import self_learning_system

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
    """
    Konsilium munozarasi – hozircha frontend tomondan Gemini API orqali amalga oshiriladi.
    Bu endpoint kelajakda server-side debate uchun ishlatilishi mumkin.
    """
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

        return Response({
            "success": True,
            "data": {
                "message": "Konsilium munozarasi frontend tomondan amalga oshiriladi.",
                "mode": "client_side",
            }
        })
    except Exception as e:
        logger.exception("Error in council debate endpoint: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Konsilium munozarasida xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# --- AUTONOMOUS TREATMENT PROTOCOL ENDPOINTS ---

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_autonomous_protocol(request):
    """Generate autonomous treatment protocol with minimal human intervention"""
    try:
        patient_data = _patient_data_from_request(request)
        language = request.data.get("language", "uz-L")
        
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

        protocol = autonomous_generator.generate_autonomous_protocol(patient_data, language)
        
        return Response({
            "success": True, 
            "data": protocol
        })
        
    except Exception as e:
        logger.exception("Error generating autonomous protocol: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Avtonom protokol yaratishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def make_clinical_decision(request):
    """Make comprehensive autonomous clinical decision"""
    try:
        patient_data = _patient_data_from_request(request)
        language = request.data.get("language", "uz-L")
        
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

        decision = clinical_decision_engine.make_autonomous_decision(patient_data, language)
        
        return Response({
            "success": True, 
            "data": decision
        })
        
    except Exception as e:
        logger.exception("Error making clinical decision: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Klinik qaror qabul qilishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_monitoring(request):
    """Start continuous monitoring session"""
    try:
        protocol_id = request.data.get("protocol_id")
        patient_data = request.data.get("patient_data")
        treatment_plan = request.data.get("treatment_plan")
        
        if not all([protocol_id, patient_data, treatment_plan]):
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": "Kerakli ma'lumotlar to'liq emas",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        session_id = continuous_monitoring.start_monitoring_session(
            protocol_id, patient_data, treatment_plan
        )
        
        return Response({
            "success": True,
            "data": {
                "session_id": session_id,
                "message": "Monitoring sessiyasi boshlandi"
            }
        })
        
    except Exception as e:
        logger.exception("Error starting monitoring: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Monitoringni boshlashda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def record_vital_signs(request):
    """Record vital signs and get analysis"""
    try:
        session_id = request.data.get("session_id")
        vital_data = request.data.get("vital_data")
        
        if not session_id or not vital_data:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": "Sessiya ID yoki vital ma'lumotlari kiritilmagan",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        analysis = continuous_monitoring.record_vital_signs(session_id, vital_data)
        
        if 'error' in analysis:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": analysis['error'],
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        return Response({
            "success": True,
            "data": analysis
        })
        
    except Exception as e:
        logger.exception("Error recording vital signs: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Vital belgilarni yozishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stop_monitoring(request, session_id):
    """Stop monitoring session"""
    try:
        success = continuous_monitoring.stop_monitoring_session(session_id)
        
        if success:
            return Response({
                "success": True,
                "data": {
                    "message": "Monitoring sessiyasi to'xtatildi"
                }
            })
        else:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_404_NOT_FOUND,
                        "message": "Monitoring sessiyasi topilmadi",
                    }
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        
    except Exception as e:
        logger.exception("Error stopping monitoring: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Monitoringni to'xtatishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def record_treatment_outcome(request):
    """Record treatment outcome for learning system"""
    try:
        protocol_id = request.data.get("protocol_id")
        patient_data = request.data.get("patient_data")
        outcome_data = request.data.get("outcome_data")
        
        if not all([protocol_id, patient_data, outcome_data]):
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": "Kerakli ma'lumotlar to'liq emas",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        analysis = self_learning_system.analyze_protocol_outcome(
            protocol_id, patient_data, outcome_data
        )
        
        return Response({
            "success": True,
            "data": analysis
        })
        
    except Exception as e:
        logger.exception("Error recording treatment outcome: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Natijalarni yozishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def get_improved_protocol(request):
    """Get improved protocol based on learning"""
    try:
        patient_data = request.data.get("patient_data")
        base_protocol = request.data.get("base_protocol")
        
        if not patient_data or not base_protocol:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": status.HTTP_400_BAD_REQUEST,
                        "message": "Bemor ma'lumotlari yoki asosiy protokol kiritilmagan",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        improved_protocol = self_learning_system.get_improved_protocol_template(
            patient_data, base_protocol
        )
        
        return Response({
            "success": True,
            "data": improved_protocol
        })
        
    except Exception as e:
        logger.exception("Error getting improved protocol: %s", e)
        return Response(
            {
                "success": False,
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Yaxshilangan protokolni olishda xatolik yuz berdi",
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
