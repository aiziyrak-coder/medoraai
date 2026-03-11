"""
AiDoktor-Jarvis API Views
========================
Endpoint'lar:

  POST /api/ZIYRAK/session/create/       в†’ Yangi sessiya ochish
  POST /api/ZIYRAK/session/<id>/end/     в†’ Sessiyani yopish
  GET  /api/ZIYRAK/session/<id>/info/    в†’ Sessiya ma'lumoti

  POST /api/ZIYRAK/speech/token/         в†’ Azure Speech SDK tokeni
  POST /api/ZIYRAK/speech/stt/           в†’ Audio в†’ matn (batch)
  POST /api/ZIYRAK/speech/tts/           в†’ Matn в†’ MP3 audio (base64)

  POST /api/ZIYRAK/transcript/add/       в†’ Transkript bo'lagini saqlash
  GET  /api/ZIYRAK/transcript/<id>/      в†’ To'liq transkriptni olish

  POST /api/ZIYRAK/chat/                 в†’ Interaktiv chat (sync)
  POST /api/ZIYRAK/chat/stream/          в†’ Interaktiv chat (SSE stream)

  POST /api/ZIYRAK/diagnosis/            в†’ Konsultatsiya tashxisi (yakunida)
"""

import json
import logging

from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .ZIYRAK_engine import (
    create_session, get_session, end_session,
    get_session_info, add_transcript_to_session,
    ZIYRAK_chat, ZIYRAK_chat_stream,
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
    return Response({"success": False, "error": {"code": code, "message": msg}},
                    status=code)


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Session management
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def session_create(request):
    """
    POST /api/ZIYRAK/session/create/
    Body: { language?, patient_data? }
    """
    language     = request.data.get("language", "uz-L")
    patient_data = request.data.get("patient_data") or {}
    doctor_id    = str(request.user.id)

    try:
        session = create_session(doctor_id, language, patient_data)
        return Response({
            "success":    True,
            "data": {
                "session_id": session.session_id,
                "language":   session.language,
                "created_at": session.created_at,
            },
        })
    except Exception as exc:
        logger.exception("Session create error: %s", exc)
        return _err(500, f"Sessiya ochishda xatolik: {exc}")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def session_end(request, session_id: str):
    """POST /api/ZIYRAK/session/<id>/end/"""
    try:
        ok = end_session(session_id)
        return Response({"success": True, "data": {"ended": ok}})
    except Exception as exc:
        logger.exception("Session end error: %s", exc)
        return _err(500, str(exc))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_info(request, session_id: str):
    """GET /api/ZIYRAK/session/<id>/info/"""
    info = get_session_info(session_id)
    if "error" in info:
        return _err(404, info["error"])
    return Response({"success": True, "data": info})


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Speech services
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def speech_token(request):
    """
    POST /api/ZIYRAK/speech/token/
    Frontend Azure Speech SDK uchun vaqtinchalik token.
    """
    try:
        token_data = get_speech_token()
        return Response({"success": True, "data": token_data})
    except RuntimeError as exc:
        return _err(503, str(exc))
    except Exception as exc:
        logger.exception("Speech token error: %s", exc)
        return _err(500, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def speech_stt(request):
    """
    POST /api/ZIYRAK/speech/stt/
    Body (multipart): audio_file=<file>, language=uz-L, format=wav
    Body (JSON):      audio_base64=<b64>, language=uz-L, format=wav
    """
    language     = request.data.get("language", "uz-L")
    audio_format = request.data.get("format", "wav")

    # Multipart yoki base64
    audio_data = None
    if "audio_file" in request.FILES:
        audio_data = request.FILES["audio_file"].read()
    elif "audio_base64" in request.data:
        import base64
        try:
            audio_data = base64.b64decode(request.data["audio_base64"])
        except Exception:
            return _err(400, "audio_base64 noto'g'ri base64 format")

    if not audio_data:
        return _err(400, "audio_file yoki audio_base64 talab qilinadi")

    try:
        result = transcribe_audio(audio_data, language, audio_format)
        return Response({"success": True, "data": result})
    except RuntimeError as exc:
        return _err(503, str(exc))
    except Exception as exc:
        logger.exception("STT error: %s", exc)
        return _err(500, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def speech_tts(request):
    """
    POST /api/ZIYRAK/speech/tts/
    Body: { text, language?, rate?, voice_mode? }
    Returns: { audio_base64: "...", format: "mp3" }
    """
    text      = request.data.get("text", "")
    language  = request.data.get("language", "uz-L")
    rate      = request.data.get("rate", "0%")
    voice_mode = request.data.get("voice_mode", True)

    if not text or not text.strip():
        return _err(400, "Matn bo'sh bo'lmasligi kerak")

    # Voice mode uchun tezroq o'qish
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
    except Exception as exc:
        logger.exception("TTS error: %s", exc)
        return _err(500, str(exc))


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Transcript management
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def transcript_add(request):
    """
    POST /api/ZIYRAK/transcript/add/
    Body: { session_id, text, speaker? }
    speaker: "doctor" | "patient" | "system"
    """
    session_id = request.data.get("session_id", "")
    text       = request.data.get("text", "")
    speaker    = request.data.get("speaker", "unknown")

    if not session_id:
        return _err(400, "session_id talab qilinadi")
    if not text or not text.strip():
        return Response({"success": True, "data": {"saved": False, "empty": True}})

    try:
        result = add_transcript_to_session(session_id, text, speaker)
        return Response({"success": True, "data": result})
    except Exception as exc:
        logger.exception("Transcript add error: %s", exc)
        return _err(500, str(exc))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def transcript_get(request, session_id: str):
    """GET /api/ZIYRAK/transcript/<session_id>/"""
    try:
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
    except Exception as exc:
        logger.exception("Transcript get error: %s", exc)
        return _err(500, str(exc))


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# ZIYRAK Chat
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ZIYRAK_chat_view(request):
    """
    POST /api/ZIYRAK/chat/
    Body: { session_id, message, voice_mode? }
    """
    session_id   = request.data.get("session_id", "")
    message      = request.data.get("message", "")
    voice_mode   = request.data.get("voice_mode", True)
    with_tts     = request.data.get("with_tts", False)
    language     = request.data.get("language", "uz-L")

    if not session_id:
        return _err(400, "session_id talab qilinadi")
    if not message or not message.strip():
        return _err(400, "message talab qilinadi")

    try:
        result = ZIYRAK_chat(session_id, message, voice_mode=bool(voice_mode))

        # TTS so'ralsa, audio ham qo'sh
        if with_tts and result.get("text"):
            try:
                result["audio_base64"] = synthesize_speech_b64(result["text"], language)
                result["audio_format"] = "mp3"
            except Exception as tts_exc:
                logger.warning("TTS failed for chat response: %s", tts_exc)
                result["audio_base64"] = None

        return Response({"success": True, "data": result})

    except ValueError as exc:
        return _err(404, str(exc))
    except RuntimeError as exc:
        return _err(503, str(exc))
    except Exception as exc:
        logger.exception("ZIYRAK chat error: %s", exc)
        return _err(500, str(exc))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ZIYRAK_chat_stream_view(request):
    """
    POST /api/ZIYRAK/chat/stream/
    Returns: text/event-stream (SSE)
    Body: { session_id, message, voice_mode? }
    """
    session_id = request.data.get("session_id", "")
    message    = request.data.get("message", "")
    voice_mode = request.data.get("voice_mode", True)

    if not session_id:
        return _err(400, "session_id talab qilinadi")
    if not message or not message.strip():
        return _err(400, "message talab qilinadi")

    def event_stream():
        try:
            full_text = ""
            for chunk in ZIYRAK_chat_stream(session_id, message, voice_mode=bool(voice_mode)):
                full_text += chunk
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"

            # Final event with metadata
            critical = any(kw in full_text.lower() for kw in
                           ["shoshilinch", "kritik", "103", "СЃСЂРѕС‡РЅРѕ", "emergency"])
            yield f"data: {json.dumps({'done': True, 'is_critical': critical}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as exc:
            logger.exception("ZIYRAK SSE stream error: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"]     = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Auto-Diagnosis
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def speech_test(request):
    """
    GET /api/ZIYRAK/speech/test/
    Azure Speech ulanishini tekshirish + mavjud ovoz profillari.
    """
    conn = test_connection()
    return Response({
        "success":       conn["status"] == "ok",
        "data": {
            "connection":    conn,
            "voice_profiles": {
                lang: {
                    "locale": p["locale"],
                    "voice":  p["voice"],
                    "name":   p["name"],
                }
                for lang, p in VOICE_PROFILES.items()
            },
        },
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def consultation_diagnosis_view(request):
    """
    POST /api/ZIYRAK/diagnosis/
    Body: { session_id, language? }
    Konsultatsiya yakunida suhbat asosida tashxis generatsiya qilish.
    """
    session_id = request.data.get("session_id", "")
    language   = request.data.get("language", "uz-L")

    if not session_id:
        return _err(400, "session_id talab qilinadi")

    try:
        result = generate_consultation_diagnosis(session_id, language)
        if "error" in result and len(result) <= 2:
            return _err(422, result["error"])
        return Response({"success": True, "data": result})

    except RuntimeError as exc:
        return _err(503, str(exc))
    except Exception as exc:
        logger.exception("Diagnosis generation error: %s", exc)
        return _err(500, str(exc))

