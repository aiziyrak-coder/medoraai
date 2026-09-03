"""Farg'ona JSTI Ziyrak URL patterns  -  /api/ziyrak/*"""
from django.urls import path

from .emergency_views import emergency_triage_view
from .views import (
    run_consilium_view,
    doctor_support_view,
    doctor_support_stream_view,
    generate_clarifying_questions,
    recommend_specialists,
    generate_diagnoses,
    clinical_tool_view,
)
from .ziyrak_views import (
    session_create, session_end, session_info,
    speech_test, speech_token, speech_stt, speech_tts,
    transcript_add, transcript_get,
    ziyrak_chat_view, ziyrak_chat_stream_view,
    consultation_diagnosis_view,
    surgery_session_create, surgery_voice_command,
    surgery_emergency, surgery_log_get,
    ziyrak_inference_view,
    ziyrak_compliance_status_view,
    ziyrak_compliance_audit_view,
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
    # FJSTI Ziyrak AI gateway
    path("inference/",                         ziyrak_inference_view,         name="inference"),
    path("compliance/status/",                 ziyrak_compliance_status_view, name="compliance_status"),
    path("compliance/audit/",                  ziyrak_compliance_audit_view,  name="compliance_audit"),
    # Klinik AI (brauzer faqat /api/ziyrak/* ga murojaat qiladi)
    path("consilium/",                         run_consilium_view,            name="consilium"),
    path("doctor-support/",                    doctor_support_view,           name="doctor_support"),
    path("doctor-stream/",                     doctor_support_stream_view,    name="doctor_stream"),
    path("clarifying-questions/",              generate_clarifying_questions, name="clarifying_questions"),
    path("recommend-specialists/",             recommend_specialists,         name="recommend_specialists"),
    path("generate-diagnoses/",                generate_diagnoses,            name="generate_diagnoses"),
    path("tools/<str:tool_name>/",             clinical_tool_view,            name="clinical_tool"),

    # -- 103 Tezkor triaj ---------------------------------------------
    path("emergency-triage/", emergency_triage_view, name="ziyrak_emergency_triage"),
]