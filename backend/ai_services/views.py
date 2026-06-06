"""
AI Services Views  -  Azure AI Foundry
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
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from accounts.permissions import IsAuthenticatedWithSubscription
from rest_framework.response import Response

from . import claude_utils
from .multi_agent_system     import run_consilium
from .doctor_support         import (
    doctor_consult, doctor_consult_stream,
    TASK_QUICK_CONSULT, TASK_DIAGNOSIS, TASK_TREATMENT,
    TASK_DRUG_CHECK, TASK_LAB_INTERPRET, TASK_FOLLOW_UP,
)
from .physiology_filter      import check as physiology_check
from .autonomous_protocol_generator import autonomous_generator
from .clinical_decision_engine      import clinical_decision_engine
from .self_learning_system          import self_learning_system
from .azure_utils import recommend_specialists as azure_recommend

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pd(request):
    return request.data.get("patient_data") or {}


def _claude_ok() -> bool:
    return bool(
        getattr(settings, "DEEPSEEK_API_KEY", None) or getattr(settings, "ANTHROPIC_API_KEY", None)
    )


def _err(code: int, msg: str):
    return Response({"success": False, "error": {"code": code, "message": msg}},
                    status=code)


def _ai_not_configured():
    return _err(503, "AI xizmati sozlanmagan. Iltimos, DEEPSEEK_API_KEY ni .env faylga kiriting.")


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
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
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
    if not _claude_ok():
        return _ai_not_configured()

    # Physiology / Logic Gate filter
    blocked = _run_filter(patient_data)
    if blocked:
        return blocked

    try:
        from .clinical_completeness import validate_consilium_minimum, score_clinical_completeness
        from .clinical_red_flags import evaluate_red_flags

        allow_incomplete = bool(request.data.get("allow_incomplete"))
        validation = validate_consilium_minimum(patient_data, allow_incomplete=allow_incomplete)
        completeness = validation.get("completeness") or score_clinical_completeness(patient_data)
        if not validation.get("ok"):
            msg = validation.get("blocked_reason") or "; ".join(validation.get("errors") or [])
            return _err(400, msg or "Klinik ma'lumotlar yetarli emas")

        extra = {
            "differential_diagnoses": request.data.get("differential_diagnoses"),
            "specialist_debate_summary": (
                request.data.get("specialist_debate_summary")
                or patient_data.get("specialistDebateSummary")
            ),
            "regional_context": (
                request.data.get("regional_context")
                or patient_data.get("regionalContext")
            ),
        }

        red_flags = evaluate_red_flags(patient_data)
        result = run_consilium(patient_data, language, extra=extra)
        if red_flags and isinstance(result, dict):
            result.setdefault("clinical_red_flags", red_flags)
        return Response({
            "success": True,
            "data": result,
            "clinical_red_flags": red_flags,
            "clinical_completeness": completeness,
        })
    except Exception as exc:
        logger.exception("Consilium error: %s", exc)
        return _err(500, f"Konsilium xatosi: {exc}")


# Backwards-compat alias
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
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
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
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
    if not _claude_ok():
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
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
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
    if not _claude_ok():
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
# Klinik vositalar (POST /api/ai/tools/<tool_name>/)
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
def clinical_tool_view(request, tool_name: str):
    """guideline-search, drug-interactions, ecg, uzi-utt, icd10, lab-interpret, ..."""
    from .clinical_tools import TOOL_HANDLERS

    if not _claude_ok():
        return _ai_not_configured()
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        return _err(404, f"Noma'lum vosita: {tool_name}")
    language = request.data.get("language", "uz-L")
    try:
        data = handler(request.data, language)
        return Response({"success": True, "data": data})
    except json.JSONDecodeError as exc:
        logger.exception("Clinical tool JSON error (%s): %s", tool_name, exc)
        return _err(500, "AI javobi JSON formatida emas")
    except Exception as exc:
        logger.exception("Clinical tool error (%s): %s", tool_name, exc)
        return _err(500, str(exc)[:300])


# ---------------------------------------------------------------------------
# Debug: test Claude (GET /api/ai/test-claude/)
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([AllowAny])
def test_claude(request):
    """Test Claude API; faqat DEBUG yoki staff uchun."""
    if not getattr(settings, "DEBUG", False):
        if not getattr(request.user, "is_authenticated", False) or not getattr(request.user, "is_staff", False):
            return Response({"ok": False, "error": "Forbidden"}, status=403)
    key = (
        getattr(settings, "DEEPSEEK_API_KEY", None) or getattr(settings, "ANTHROPIC_API_KEY", None) or ""
    ).strip()
    if not key:
        return Response({"ok": False, "error": "DEEPSEEK_API_KEY .env da yo'q yoki bo'sh"}, status=503)
    try:
        from .claude_utils import _get_client, _call_claude, CLAUDE_FAST
        client = _get_client()
        if not client:
            return Response({"ok": False, "error": "Client yaratib bo'lmadi (import/key)"}, status=503)
        text = _call_claude("Javobingiz: salom. Faqat shu so'zni yozing.", CLAUDE_FAST, response_mime_type=None)
        return Response({"ok": True, "message": "DeepSeek ishlayapti", "sample": (text or "")[:200]})
    except Exception as e:
        logger.exception("test_claude: %s", e)
        return Response({"ok": False, "error": str(e)}, status=500)


# ---------------------------------------------------------------------------
# Basic AI endpoints (autentifikatsiya + faol obuna talab qilinadi)
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
def generate_clarifying_questions(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor shikoyatlari kiritilmagan")
    if not _claude_ok():
        return Response({"success": True, "data": [], "warning": "AI backend da sozlanmagan."})
    try:
        questions = claude_utils.generate_clarifying_questions(patient_data)
        return Response({"success": True, "data": questions})
    except Exception as exc:
        logger.exception("Clarifying questions error: %s", exc)
        # Return 200 with empty list so flow continues; frontend can show fallback
        return Response({"success": True, "data": [], "warning": str(exc)[:200]})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
def recommend_specialists(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor ma'lumotlari kiritilmagan")
    if not _claude_ok():
        return Response({"success": True, "data": {"recommendations": []}, "warning": "AI backend da sozlanmagan."})
    try:
        dd = request.data.get("differential_diagnoses") or request.data.get("diagnoses")
        if dd is not None and not isinstance(dd, list):
            dd = []
        recs = azure_recommend(patient_data, differential_diagnoses=dd or None)
        return Response({"success": True, "data": {"recommendations": recs}})
    except Exception as exc:
        logger.exception("Recommend specialists error: %s", exc)
        return Response({"success": True, "data": {"recommendations": []}, "warning": str(exc)[:200]})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAuthenticatedWithSubscription])
def generate_diagnoses(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor ma'lumotlari kiritilmagan")
    if not _claude_ok():
        return Response({"success": True, "data": [], "warning": "AI backend da sozlanmagan."})

    blocked = _run_filter(patient_data)
    if blocked:
        return blocked

    try:
        data = claude_utils.generate_diagnoses(patient_data)
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
    if not _claude_ok():
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
    if not _claude_ok():
        return _ai_not_configured()
    try:
        return Response({"success": True, "data": clinical_decision_engine.make_autonomous_decision(patient_data, language)})
    except Exception as exc:
        logger.exception("Clinical decision error: %s", exc)
        return _err(500, "Klinik qaror qabul qilishda xatolik")


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