"""Farg'ona JSTI Jarvis URL patterns."""
from django.urls import path
from .jarvis_views import (
    session_create, session_end, session_info,
    speech_token, speech_stt, speech_tts, speech_test,
    transcript_add, transcript_get,
    jarvis_chat_view, jarvis_chat_stream_view,
    consultation_diagnosis_view,
)

app_name = "jarvis"

urlpatterns = [
    # Session
    path("session/create/",          session_create,  name="session_create"),
    path("session/<str:session_id>/end/",   session_end,   name="session_end"),
    path("session/<str:session_id>/info/",  session_info,  name="session_info"),

    # Speech
    path("speech/token/",            speech_token,    name="speech_token"),
    path("speech/stt/",              speech_stt,      name="speech_stt"),
    path("speech/tts/",              speech_tts,      name="speech_tts"),
    path("speech/test/",             speech_test,     name="speech_test"),

    # Transcript
    path("transcript/add/",          transcript_add,  name="transcript_add"),
    path("transcript/<str:session_id>/", transcript_get, name="transcript_get"),

    # Chat
    path("chat/",                    jarvis_chat_view,         name="chat"),
    path("chat/stream/",             jarvis_chat_stream_view,  name="chat_stream"),

    # Diagnosis
    path("diagnosis/",               consultation_diagnosis_view, name="diagnosis"),
]