"""
AI Services Views вЂ” Azure AI Foundry
  - /ai/consilium/       в†’ Multi-Agent Consilium (5 professor, 3 faza)
  - /ai/doctor-support/  в†’ Doctor Support Mode (GPT-4o, tezkor)
  - /ai/doctor-stream/   в†’ Doctor Support SSE stream
  - Legacy endpoints     в†’ qolgan endpointlar (backwards-compat)
"""
import json
import logging

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from . import gemini_utils
from .multi_agent_system     import run_consilium
from .doctor_support         import (
    doctor_consult, doctor_consult_stream,
    TASK_QUICK_CONSULT, TASK_DIAGNOSIS, TASK_TREATMENT,
    TASK_DRUG_CHECK, TASK_LAB_INTERPRET, TASK_FOLLOW_UP,
)
from .physiology_filter      import check as physiology_check
from .autonomous_protocol_generator import autonomous_generator
from .clinical_decision_engine      import clinical_decision_engine
from .continuous_monitoring         import continuous_monitoring
from .self_learning_system          import self_learning_system

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pd(request):
    return request.data.get("patient_data") or {}


def _gemini_ok() -> bool:
    return bool(getattr(settings, "GEMINI_API_KEY", None))


def _err(code: int, msg: str):
    return Response({"success": False, "error": {"code": code, "message": msg}},
                    status=code)


def _ai_not_configured():
    return _err(503, "AI xizmati sozlanmagan. Iltimos, GEMINI_API_KEY ni .env faylga kiriting.")


def _run_filter(patient_data: dict) -> Response | None:
    """
    Run PhysiologyFilter. Returns error Response if blocked, else None.
    """
    result = physiology_check(patient_data, use_ai=True)
    if not result.passed:
        return Response(
            {
                "success": False,
                "filtered": True,
                "filter_level": result.level,
                "error": {
                    "code": 422,
                    "message": result.message,
                },
            },
            status=422,
        )
    return None


# ---------------------------------------------------------------------------
# Multi-Agent Consilium
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_consilium_view(request):
    """
    POST /api/ai/consilium/
    Body: { patient_data, language }

    Phase 1: Independent Analysis (4 agents, parallel)
    Phase 2: Cross-Examination / Debate (4 agents, parallel)
    Phase 3: Consensus (GPT-4o Orchestrator)
    """
    patient_data = _pd(request)
    language     = request.data.get("language", "uz-L")

    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor shikoyatlari kiritilmagan")
    if not _gemini_ok():
        return _ai_not_configured()

    # Physiology / Logic Gate filter
    blocked = _run_filter(patient_data)
    if blocked:
        return blocked

    try:
        result = run_consilium(patient_data, language)
        return Response({"success": True, "data": result})
    except Exception as exc:
        logger.exception("Consilium error: %s", exc)
        return _err(500, f"Konsilium xatosi: {exc}")


# Backwards-compat alias
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_council_debate(request):
    return run_consilium_view(request)


# ---------------------------------------------------------------------------
# Doctor Support Mode
# ---------------------------------------------------------------------------

_VALID_TASKS = {
    TASK_QUICK_CONSULT, TASK_DIAGNOSIS, TASK_TREATMENT,
    TASK_DRUG_CHECK, TASK_LAB_INTERPRET, TASK_FOLLOW_UP,
}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def doctor_support_view(request):
    """
    POST /api/ai/doctor-support/
    Body: { patient_data, query?, task_type?, language }

    task_type: quick_consult | diagnosis | treatment_plan |
               drug_check | lab_interpretation | follow_up
    """
    patient_data = _pd(request)
    query        = request.data.get("query", "")
    task_type    = request.data.get("task_type", TASK_QUICK_CONSULT)
    language     = request.data.get("language", "uz-L")

    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor shikoyatlari kiritilmagan")
    if not _gemini_ok():
        return _ai_not_configured()
    if task_type not in _VALID_TASKS:
        return _err(400, f"Noto'g'ri task_type: {task_type}")

    # PhysiologyFilter
    blocked = _run_filter(patient_data)
    if blocked:
        return blocked

    try:
        result = doctor_consult(patient_data, query, task_type, language)
        return Response({"success": True, "data": result})
    except Exception as exc:
        logger.exception("DoctorSupport error: %s", exc)
        return _err(500, f"Doktor yordami xatosi: {exc}")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def doctor_support_stream_view(request):
    """
    POST /api/ai/doctor-stream/
    Returns: text/event-stream  (Server-Sent Events)
    """
    patient_data = _pd(request)
    query        = request.data.get("query", "")
    task_type    = request.data.get("task_type", TASK_QUICK_CONSULT)
    language     = request.data.get("language", "uz-L")

    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor shikoyatlari kiritilmagan")
    if not _gemini_ok():
        return _ai_not_configured()

    blocked = _run_filter(patient_data)
    if blocked:
        return blocked

    def event_stream():
        try:
            for chunk in doctor_consult_stream(patient_data, query, task_type, language):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.exception("SSE stream error: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


# ---------------------------------------------------------------------------
# Debug: test Gemini (GET /api/ai/test-gemini/) вЂ” haqiqiy xatolikni ko'rish
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([AllowAny])
def test_gemini(request):
    """Test Gemini API; returns ok + message or error detail for debugging."""
    key = (getattr(settings, "GEMINI_API_KEY", None) or "").strip()
    if not key:
        return Response({"ok": False, "error": "GEMINI_API_KEY .env da yo'q yoki bo'sh"}, status=503)
    try:
        from .gemini_utils import _get_client, _call_gemini, GEMINI_FLASH
        client = _get_client()
        if not client:
            return Response({"ok": False, "error": "Client yaratib bo'lmadi (import/key)"}, status=503)
        text = _call_gemini("Javobingiz: salom. Faqat shu so'zni yozing.", GEMINI_FLASH, response_mime_type=None)
        return Response({"ok": True, "message": "Gemini ishlayapti", "sample": (text or "")[:200]})
    except Exception as e:
        logger.exception("test_gemini: %s", e)
        return Response({"ok": False, "error": str(e)}, status=500)


# ---------------------------------------------------------------------------
# Basic AI endpoints (used by analysis flow; AllowAny so flow works before login)
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def generate_clarifying_questions(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor shikoyatlari kiritilmagan")
    if not _gemini_ok():
        return Response({"success": True, "data": [], "warning": "AI backend da sozlanmagan."})
    try:
        questions = gemini_utils.generate_clarifying_questions(patient_data)
        return Response({"success": True, "data": questions})
    except Exception as exc:
        logger.exception("Clarifying questions error: %s", exc)
        # Return 200 with empty list so flow continues; frontend can show fallback
        return Response({"success": True, "data": [], "warning": str(exc)[:200]})


@api_view(["POST"])
@permission_classes([AllowAny])
def recommend_specialists(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor ma'lumotlari kiritilmagan")
    if not _gemini_ok():
        return Response({"success": True, "data": {"recommendations": []}, "warning": "AI backend da sozlanmagan."})
    try:
        recs = gemini_utils.recommend_specialists(patient_data)
        if not recs:
            return Response({"success": True, "data": {"recommendations": []}, "warning": "AI tavsiya qaytarmadi."})
        return Response({"success": True, "data": {"recommendations": recs}})
    except Exception as exc:
        logger.exception("Recommend specialists error: %s", exc)
        return Response({"success": True, "data": {"recommendations": []}, "warning": str(exc)[:200]})


@api_view(["POST"])
@permission_classes([AllowAny])
def generate_diagnoses(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor ma'lumotlari kiritilmagan")
    if not _gemini_ok():
        return Response({"success": True, "data": [], "warning": "AI backend da sozlanmagan."})

    blocked = _run_filter(patient_data)
    if blocked:
        return blocked

    try:
        data = gemini_utils.generate_diagnoses(patient_data)
        if not data:
            return Response({"success": True, "data": [], "warning": "AI tashxis qaytarmadi."})
        return Response({"success": True, "data": data})
    except Exception as exc:
        logger.exception("Generate diagnoses error: %s", exc)
        return Response({"success": True, "data": [], "warning": str(exc)[:200]})


# ---------------------------------------------------------------------------
# Autonomous treatment endpoints
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_autonomous_protocol(request):
    patient_data = _pd(request)
    language     = request.data.get("language", "uz-L")
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor ma'lumotlari kiritilmagan")
    if not _gemini_ok():
        return _ai_not_configured()
    try:
        return Response({"success": True, "data": autonomous_generator.generate_autonomous_protocol(patient_data, language)})
    except Exception as exc:
        logger.exception("Autonomous protocol error: %s", exc)
        return _err(500, "Avtonom protokol yaratishda xatolik")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def make_clinical_decision(request):
    patient_data = _pd(request)
    language     = request.data.get("language", "uz-L")
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor ma'lumotlari kiritilmagan")
    if not _gemini_ok():
        return _ai_not_configured()
    try:
        return Response({"success": True, "data": clinical_decision_engine.make_autonomous_decision(patient_data, language)})
    except Exception as exc:
        logger.exception("Clinical decision error: %s", exc)
        return _err(500, "Klinik qaror qabul qilishda xatolik")


# ---------------------------------------------------------------------------
# Monitoring endpoints
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_monitoring(request):
    pid    = request.data.get("protocol_id")
    pd_    = request.data.get("patient_data")
    plan   = request.data.get("treatment_plan")
    if not all([pid, pd_, plan]):
        return _err(400, "Kerakli ma'lumotlar to'liq emas")
    try:
        sid = continuous_monitoring.start_monitoring_session(pid, pd_, plan)
        return Response({"success": True, "data": {"session_id": sid, "message": "Monitoring boshlandi"}})
    except Exception as exc:
        logger.exception("Start monitoring error: %s", exc)
        return _err(500, "Monitoringni boshlashda xatolik")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def record_vital_signs(request):
    sid  = request.data.get("session_id")
    vita = request.data.get("vital_data")
    if not sid or not vita:
        return _err(400, "Sessiya ID yoki vital ma'lumotlari kiritilmagan")
    try:
        analysis = continuous_monitoring.record_vital_signs(sid, vita)
        if "error" in analysis:
            return _err(400, analysis["error"])
        return Response({"success": True, "data": analysis})
    except Exception as exc:
        logger.exception("Record vital signs error: %s", exc)
        return _err(500, "Vital belgilarni yozishda xatolik")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stop_monitoring(request, session_id):
    try:
        ok = continuous_monitoring.stop_monitoring_session(session_id)
        if ok:
            return Response({"success": True, "data": {"message": "Monitoring to'xtatildi"}})
        return _err(404, "Monitoring sessiyasi topilmadi")
    except Exception as exc:
        logger.exception("Stop monitoring error: %s", exc)
        return _err(500, "Monitoringni to'xtatishda xatolik")


# ---------------------------------------------------------------------------
# Learning endpoints
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def record_treatment_outcome(request):
    pid = request.data.get("protocol_id")
    pd_ = request.data.get("patient_data")
    out = request.data.get("outcome_data")
    if not all([pid, pd_, out]):
        return _err(400, "Kerakli ma'lumotlar to'liq emas")
    try:
        return Response({"success": True, "data": self_learning_system.analyze_protocol_outcome(pid, pd_, out)})
    except Exception as exc:
        logger.exception("Record outcome error: %s", exc)
        return _err(500, "Natijalarni yozishda xatolik")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def get_improved_protocol(request):
    pd_  = request.data.get("patient_data")
    base = request.data.get("base_protocol")
    if not pd_ or not base:
        return _err(400, "Bemor ma'lumotlari yoki asosiy protokol kiritilmagan")
    try:
        return Response({"success": True, "data": self_learning_system.get_improved_protocol_template(pd_, base)})
    except Exception as exc:
        logger.exception("Improved protocol error: %s", exc)
        return _err(500, "Yaxshilangan protokolni olishda xatolik")


# (Monitoring AI endpoints removed вЂ” monitoring platform o'chirilgan)