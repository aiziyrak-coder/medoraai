"""AiDoktor-Ziyrak URL patterns вЂ” /api/ziyrak/*"""
from django.urls import path
from .ziyrak_views import (
    session_create, session_end, session_info,
    speech_test, speech_token, speech_stt, speech_tts,
    transcript_add, transcript_get,
    ziyrak_chat_view, ziyrak_chat_stream_view,
    consultation_diagnosis_view,
    surgery_session_create, surgery_voice_command,
    surgery_emergency, surgery_log_get,
)

app_name = "ziyrak"

urlpatterns = [
    # Session
    path("session/create/",                    session_create,                name="session_create"),
    path("session/<str:session_id>/end/",      session_end,                   name="session_end"),
    path("session/<str:session_id>/info/",     session_info,                  name="session_info"),
    # Speech
    path("speech/test/",                       speech_test,                   name="speech_test"),
    path("speech/token/",                      speech_token,                  name="speech_token"),
    path("speech/stt/",                        speech_stt,                    name="speech_stt"),
    path("speech/tts/",                        speech_tts,                    name="speech_tts"),
    # Transcript
    path("transcript/add/",                    transcript_add,                name="transcript_add"),
    path("transcript/<str:session_id>/",       transcript_get,                name="transcript_get"),
    # Chat
    path("chat/",                              ziyrak_chat_view,              name="chat"),
    path("chat/stream/",                       ziyrak_chat_stream_view,       name="chat_stream"),
    # Diagnosis
    path("diagnosis/",                         consultation_diagnosis_view,   name="diagnosis"),
    # Surgery Mode
    path("surgery/session/create/",            surgery_session_create,        name="surgery_session"),
    path("surgery/command/",                   surgery_voice_command,         name="surgery_command"),
    path("surgery/emergency/",                 surgery_emergency,             name="surgery_emergency"),
    path("surgery/log/<str:session_id>/",      surgery_log_get,               name="surgery_log"),
]