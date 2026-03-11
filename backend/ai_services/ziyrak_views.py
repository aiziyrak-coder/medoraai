"""
AiDoktor-Ziyrak API Views
========================
Endpoint'lar: /api/ziyrak/*

  POST /api/ziyrak/session/create/
  POST /api/ziyrak/session/<id>/end/
  GET  /api/ziyrak/session/<id>/info/
  GET  /api/ziyrak/speech/test/
  POST /api/ziyrak/speech/token/
  POST /api/ziyrak/speech/stt/
  POST /api/ziyrak/speech/tts/
  POST /api/ziyrak/transcript/add/
  GET  /api/ziyrak/transcript/<id>/
  POST /api/ziyrak/chat/
  POST /api/ziyrak/chat/stream/
  POST /api/ziyrak/diagnosis/
  POST /api/ziyrak/surgery/session/create/
  POST /api/ziyrak/surgery/command/
  POST /api/ziyrak/surgery/emergency/
  GET  /api/ziyrak/surgery/log/<id>/
"""

import json
import logging

from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .ziyrak_engine import (
    create_session, get_session, end_session,
    get_session_info, add_transcript_to_session,
    ziyrak_chat, ziyrak_chat_stream,
    generate_consultation_diagnosis,
)
from .speech_service import (
    get_speech_token,
    transcribe_audio,
    synthesize_speech_b64,
    load_transcript,
    get_full_transcript_text,
    test_connection,
    VOICE_PROFILES,
)
from .anatomy_guard import AnatomyGuard

logger = logging.getLogger(__name__)


def _err(code: int, msg: str):
    return Response(
        {"success": False, "error": {"code": code, "message": msg}},
        status=code,
    )


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Session
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def session_create(request):
    """POST /api/ziyrak/session/create/"""
    language     = request.data.get("language", "uz-L")
    patient_data = request.data.get("patient_data") or {}
    mode         = request.data.get("mode", "standard")
    doctor_id    = str(request.user.id)
    try:
        session = create_session(doctor_id, language, patient_data, mode)
        return Response({
            "success": True,
            "data": {
                "session_id": session.session_id,
                "language":   session.language,
                "mode":       session.mode,
                "created_at": session.created_at,
                "greeting":   "Men AiDoktor platformasining raqamli yordamchisi - Ziyrakman.",
            },
        })
    except Exception as exc:
        logger.exception("Session create error: %s", exc)
        return _err(500, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def session_end(request, session_id: str):
    """POST /api/ziyrak/session/<id>/end/"""
    ok = end_session(session_id)
    return Response({"success": True, "data": {"ended": ok}})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_info(request, session_id: str):
    """GET /api/ziyrak/session/<id>/info/"""
    info = get_session_info(session_id)
    if "error" in info:
        return _err(404, info["error"])
    return Response({"success": True, "data": info})


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Speech
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def speech_test(request):
    """GET /api/ziyrak/speech/test/ вЂ” Azure ulanish tekshiruvi"""
    conn = test_connection()
    return Response({
        "success": conn["status"] == "ok",
        "data": {
            "connection":    conn,
            "voice_profiles": {
                lang: {"locale": p["locale"], "voice": p["voice"], "name": p["name"]}
                for lang, p in VOICE_PROFILES.items()
            },
        },
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def speech_token(request):
    """POST /api/ziyrak/speech/token/ вЂ” Frontend SDK tokeni"""
    try:
        return Response({"success": True, "data": get_speech_token()})
    except RuntimeError as exc:
        return _err(503, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def speech_stt(request):
    """POST /api/ziyrak/speech/stt/ вЂ” Audio в†’ matn"""
    language     = request.data.get("language", "uz-L")
    audio_format = request.data.get("format", "wav")
    audio_data   = None

    if "audio_file" in request.FILES:
        audio_data = request.FILES["audio_file"].read()
    elif "audio_base64" in request.data:
        import base64
        try:
            audio_data = base64.b64decode(request.data["audio_base64"])
        except Exception:
            return _err(400, "audio_base64 noto'g'ri format")

    if not audio_data:
        return _err(400, "audio_file yoki audio_base64 talab qilinadi")

    try:
        result = transcribe_audio(audio_data, language, audio_format)
        return Response({"success": True, "data": result})
    except RuntimeError as exc:
        return _err(503, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def speech_tts(request):
    """POST /api/ziyrak/speech/tts/ вЂ” Matn в†’ MP3 audio"""
    text       = request.data.get("text", "")
    language   = request.data.get("language", "uz-L")
    rate       = request.data.get("rate", "0%")
    voice_mode = request.data.get("voice_mode", True)

    if not text.strip():
        return _err(400, "Matn bo'sh bo'lmasligi kerak")

    if voice_mode:
        rate = "+5%"

    try:
        audio_b64 = synthesize_speech_b64(text, language)
        return Response({
            "success": True,
            "data": {
                "audio_base64": audio_b64,
                "format":       "mp3",
                "language":     language,
                "char_count":   len(text),
            },
        })
    except RuntimeError as exc:
        return _err(503, str(exc))


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Transcript
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def transcript_add(request):
    """POST /api/ziyrak/transcript/add/"""
    session_id = request.data.get("session_id", "")
    text       = request.data.get("text", "")
    speaker    = request.data.get("speaker", "unknown")

    if not session_id:
        return _err(400, "session_id talab qilinadi")
    if not text.strip():
        return Response({"success": True, "data": {"saved": False}})

    result = add_transcript_to_session(session_id, text, speaker)
    return Response({"success": True, "data": result})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def transcript_get(request, session_id: str):
    """GET /api/ziyrak/transcript/<session_id>/"""
    records = load_transcript(session_id)
    full    = get_full_transcript_text(session_id)
    return Response({
        "success": True,
        "data": {
            "session_id": session_id,
            "records":    records,
            "full_text":  full,
            "word_count": len(full.split()),
        },
    })


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Chat
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ziyrak_chat_view(request):
    """POST /api/ziyrak/chat/"""
    session_id = request.data.get("session_id", "")
    message    = request.data.get("message", "")
    voice_mode = request.data.get("voice_mode", True)
    with_tts   = request.data.get("with_tts", False)
    language   = request.data.get("language", "uz-L")

    if not session_id:
        return _err(400, "session_id talab qilinadi")
    if not message.strip():
        return _err(400, "message talab qilinadi")

    try:
        result = ziyrak_chat(session_id, message, voice_mode=bool(voice_mode))

        if with_tts and result.get("text"):
            try:
                result["audio_base64"] = synthesize_speech_b64(result["text"], language)
                result["audio_format"] = "mp3"
            except Exception as e:
                logger.warning("TTS failed: %s", e)
                result["audio_base64"] = None

        return Response({"success": True, "data": result})
    except ValueError as exc:
        return _err(404, str(exc))
    except RuntimeError as exc:
        return _err(503, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ziyrak_chat_stream_view(request):
    """POST /api/ziyrak/chat/stream/ вЂ” SSE"""
    session_id = request.data.get("session_id", "")
    message    = request.data.get("message", "")
    voice_mode = request.data.get("voice_mode", True)

    if not session_id:
        return _err(400, "session_id talab qilinadi")
    if not message.strip():
        return _err(400, "message talab qilinadi")

    def event_stream():
        full_text = ""
        try:
            for chunk in ziyrak_chat_stream(session_id, message, voice_mode=bool(voice_mode)):
                full_text += chunk
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            critical = any(kw in full_text.lower() for kw in
                           ["shoshilinch", "kritik", "103", "emergency"])
            yield f"data: {json.dumps({'done': True, 'is_critical': critical}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.exception("Ziyrak SSE error: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"]     = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Diagnosis
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def consultation_diagnosis_view(request):
    """POST /api/ziyrak/diagnosis/"""
    session_id = request.data.get("session_id", "")
    language   = request.data.get("language", "uz-L")

    if not session_id:
        return _err(400, "session_id talab qilinadi")

    result = generate_consultation_diagnosis(session_id, language)
    if "error" in result and len(result) <= 2:
        return _err(422, result["error"])
    return Response({"success": True, "data": result})


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Surgery Mode endpoints  (ziyrak_surgery.py dan import qilinadi)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def surgery_session_create(request):
    """POST /api/ziyrak/surgery/session/create/"""
    from .ziyrak_surgery import create_surgery_session
    language  = request.data.get("language", "uz-L")
    doctor_id = str(request.user.id)
    op_type   = request.data.get("operation_type", "Umumiy jarrohlik")
    try:
        session = create_surgery_session(doctor_id, language, op_type)
        return Response({"success": True, "data": session})
    except Exception as exc:
        logger.exception("Surgery session error: %s", exc)
        return _err(500, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def surgery_voice_command(request):
    """POST /api/ziyrak/surgery/command/ вЂ” Ovozli buyruq"""
    from .ziyrak_surgery import process_surgery_command
    session_id = request.data.get("session_id", "")
    command    = request.data.get("command", "")
    language   = request.data.get("language", "uz-L")
    with_tts   = request.data.get("with_tts", True)

    if not session_id or not command:
        return _err(400, "session_id va command talab qilinadi")

    try:
        result = process_surgery_command(session_id, command, language)
        if with_tts and result.get("response"):
            try:
                result["audio_base64"] = synthesize_speech_b64(result["response"], language)
            except Exception:
                result["audio_base64"] = None
        return Response({"success": True, "data": result})
    except Exception as exc:
        logger.exception("Surgery command error: %s", exc)
        return _err(500, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def surgery_emergency(request):
    """POST /api/ziyrak/surgery/emergency/ вЂ” Favqulodda protokol"""
    from .ziyrak_surgery import handle_emergency
    session_id    = request.data.get("session_id", "")
    emergency_type = request.data.get("emergency_type", "")
    language      = request.data.get("language", "uz-L")
    with_tts      = request.data.get("with_tts", True)

    if not emergency_type:
        return _err(400, "emergency_type talab qilinadi")

    try:
        result = handle_emergency(session_id, emergency_type, language)
        if with_tts and result.get("protocol_summary"):
            try:
                result["audio_base64"] = synthesize_speech_b64(
                    result["protocol_summary"], language
                )
            except Exception:
                result["audio_base64"] = None
        return Response({"success": True, "data": result})
    except Exception as exc:
        logger.exception("Surgery emergency error: %s", exc)
        return _err(500, str(exc))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def surgery_log_get(request, session_id: str):
    """GET /api/ziyrak/surgery/log/<session_id>/"""
    from .ziyrak_surgery import get_surgery_log
    log = get_surgery_log(session_id)
    return Response({"success": True, "data": log})