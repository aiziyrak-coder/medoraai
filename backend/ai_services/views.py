"""
AI Services Views — Azure AI Foundry
  - /ai/consilium/       → Multi-Agent Consilium (5 professor, 3 faza)
  - /ai/doctor-support/  → Doctor Support Mode (GPT-4o, tezkor)
  - /ai/doctor-stream/   → Doctor Support SSE stream
  - Legacy endpoints     → qolgan endpointlar (backwards-compat)
"""
import json
import logging

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .azure_utils import (
    generate_clarifying_questions as azure_clarifying,
    recommend_specialists          as azure_recommend,
    generate_diagnoses             as azure_diagnoses,
)
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


def _azure_ok() -> bool:
    return bool(
        getattr(settings, "AZURE_OPENAI_ENDPOINT", None)
        and getattr(settings, "AZURE_OPENAI_API_KEY", None)
    )


def _err(code: int, msg: str):
    return Response({"success": False, "error": {"code": code, "message": msg}},
                    status=code)


def _azure_not_configured():
    return _err(503, "Azure AI xizmati sozlanmagan")


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
    if not _azure_ok():
        return _azure_not_configured()

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
    if not _azure_ok():
        return _azure_not_configured()
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
    if not _azure_ok():
        return _azure_not_configured()

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
# Basic AI endpoints (used by old frontend code)
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_clarifying_questions(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor shikoyatlari kiritilmagan")
    if not _azure_ok():
        return _azure_not_configured()
    try:
        return Response({"success": True, "data": azure_clarifying(patient_data)})
    except Exception as exc:
        logger.exception("Clarifying questions error: %s", exc)
        return _err(500, "Savollar yaratishda xatolik")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def recommend_specialists(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor ma'lumotlari kiritilmagan")
    if not _azure_ok():
        return _azure_not_configured()
    try:
        recs = azure_recommend(patient_data)
        return Response({"success": True, "data": {"recommendations": recs}})
    except Exception as exc:
        logger.exception("Recommend specialists error: %s", exc)
        return _err(500, "Mutaxassislar tavsiyasida xatolik")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_diagnoses(request):
    patient_data = _pd(request)
    if not patient_data or not patient_data.get("complaints"):
        return _err(400, "Bemor ma'lumotlari kiritilmagan")
    if not _azure_ok():
        return _azure_not_configured()

    blocked = _run_filter(patient_data)
    if blocked:
        return blocked

    try:
        return Response({"success": True, "data": azure_diagnoses(patient_data)})
    except Exception as exc:
        logger.exception("Generate diagnoses error: %s", exc)
        return _err(500, "Tashxis yaratishda xatolik")


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
    if not _azure_ok():
        return _azure_not_configured()
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
    if not _azure_ok():
        return _azure_not_configured()
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


# --- MONITORING AI ENDPOINTS (vitals/alarms asosida Gemini tahlil) ---

def _check_gemini():
    if not getattr(settings, "GEMINI_API_KEY", None):
        return Response(
            {"success": False, "error": {"code": 503, "message": "AI xizmati sozlanmagan"}},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return None


def _pm_id_from_request(request, required=True):
    pm_id = request.data.get("patient_monitor_id") or request.query_params.get("patient_monitor_id")
    if pm_id is not None:
        try:
            return int(pm_id), None
        except (TypeError, ValueError):
            pass
    if required:
        return None, Response(
            {"success": False, "error": {"code": 400, "message": "patient_monitor_id kerak"}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None, None


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def monitoring_ai_risk_score(request):
    """POST/GET /api/ai/monitoring/risk-score/ – yomonlashuv xavfi."""
    err = _check_gemini()
    if err:
        return err
    pm_id, err_resp = _pm_id_from_request(request)
    if err_resp:
        return err_resp
    from .monitoring_ai import get_risk_score
    from_ts = request.data.get("from") or request.query_params.get("from")
    to_ts = request.data.get("to") or request.query_params.get("to")
    data = get_risk_score(pm_id, from_ts=from_ts, to_ts=to_ts)
    if data.get("error"):
        return Response({"success": False, "error": {"message": data["error"]}}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"success": True, "data": data})


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def monitoring_ai_explain_alarm(request):
    """POST/GET /api/ai/monitoring/explain-alarm/ – alarm tushuntirishi."""
    err = _check_gemini()
    if err:
        return err
    alarm_id = request.data.get("alarm_id") or request.query_params.get("alarm_id")
    if alarm_id is not None:
        try:
            alarm_id = int(alarm_id)
        except (TypeError, ValueError):
            alarm_id = None
    if not alarm_id:
        return Response(
            {"success": False, "error": {"message": "alarm_id kerak"}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    from .monitoring_ai import explain_alarm
    data = explain_alarm(alarm_id=alarm_id)
    return Response({"success": True, "data": data})


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def monitoring_ai_daily_summary(request):
    """POST/GET /api/ai/monitoring/daily-summary/ – kunlik xulosa."""
    err = _check_gemini()
    if err:
        return err
    pm_id, err_resp = _pm_id_from_request(request)
    if err_resp:
        return err_resp
    date_str = request.data.get("date") or request.query_params.get("date")
    from .monitoring_ai import get_daily_summary
    data = get_daily_summary(pm_id, date_str=date_str)
    return Response({"success": True, "data": data})


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def monitoring_ai_draft_note(request):
    """POST/GET /api/ai/monitoring/draft-note/ – eslatma qoralamasi."""
    err = _check_gemini()
    if err:
        return err
    pm_id, err_resp = _pm_id_from_request(request)
    if err_resp:
        return err_resp
    note_type = request.data.get("type") or request.query_params.get("type") or "handover"
    from .monitoring_ai import get_draft_note
    data = get_draft_note(pm_id, note_type=note_type)
    return Response({"success": True, "data": data})


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def monitoring_ai_trend_prediction(request):
    """POST/GET /api/ai/monitoring/trend-prediction/ – trend bashorat (SpO2/nafas)."""
    err = _check_gemini()
    if err:
        return err
    pm_id, err_resp = _pm_id_from_request(request)
    if err_resp:
        return err_resp
    metric = request.data.get("metric") or request.query_params.get("metric") or "spo2"
    horizon = request.data.get("horizon_minutes") or request.query_params.get("horizon_minutes") or 60
    try:
        horizon = int(horizon)
    except (TypeError, ValueError):
        horizon = 60
    from .monitoring_ai import get_trend_prediction
    data = get_trend_prediction(pm_id, metric=metric, horizon_minutes=horizon)
    return Response({"success": True, "data": data})


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def monitoring_ai_early_warning(request):
    """POST/GET /api/ai/monitoring/early-warning/ – sepsis erta ogohlantirish."""
    err = _check_gemini()
    if err:
        return err
    pm_id, err_resp = _pm_id_from_request(request)
    if err_resp:
        return err_resp
    from_ts = request.data.get("from") or request.query_params.get("from")
    to_ts = request.data.get("to") or request.query_params.get("to")
    from .monitoring_ai import get_sepsis_early_warning
    data = get_sepsis_early_warning(pm_id, from_ts=from_ts, to_ts=to_ts)
    return Response({"success": True, "data": data})


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def monitoring_ai_suggest_thresholds(request):
    """POST/GET /api/ai/monitoring/suggest-thresholds/ – alarm chegaralari taklifi."""
    err = _check_gemini()
    if err:
        return err
    pm_id, err_resp = _pm_id_from_request(request)
    if err_resp:
        return err_resp
    from .monitoring_ai import get_suggested_thresholds
    data = get_suggested_thresholds(pm_id)
    return Response({"success": True, "data": data})


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def monitoring_ai_mortality_prediction(request):
    """POST/GET /api/ai/monitoring/mortality-prediction/ – o'lim xavfi bashorati (qo'llab-quvvatlash)."""
    err = _check_gemini()
    if err:
        return err
    pm_id, err_resp = _pm_id_from_request(request)
    if err_resp:
        return err_resp
    from_ts = request.data.get("from") or request.query_params.get("from")
    to_ts = request.data.get("to") or request.query_params.get("to")
    from .monitoring_ai import get_mortality_prediction
    data = get_mortality_prediction(pm_id, from_ts=from_ts, to_ts=to_ts)
    return Response({"success": True, "data": data})
