"""
Azure Speech Services вЂ” STT & TTS  (Production-Ready)
=======================================================
Region  : swedencentral
Endpoint: https://swedencentral.api.cognitive.microsoft.com/

REST API asosida (SDK o'rnatishsiz):
  вЂў STT  вЂ“ audio в†’ matn  (batch)
  вЂў TTS  вЂ“ matn в†’ MP3 audio (O'zbek + Rus + English neural voices)
  вЂў Token вЂ“ Frontend Azure Speech SDK uchun vaqtinchalik auth token

Ovoz profillari (Azure Neural TTS):
  uz-UZ  в†’ uz-UZ-MadinaNeural     (ayol, O'zbek)
  ru-RU  в†’ ru-RU-SvetlanaNeural   (ayol, Rus)
  en-US  в†’ en-US-JennyNeural      (ayol, English)
  kk-KZ  в†’ kk-KZ-AigulNeural     (Qoraqolpoq вЂ” Azure qo'llasa, aks holda Rus)
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Config helpers
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def _key() -> str:
    return getattr(settings, "AZURE_SPEECH_KEY", "") or ""

def _region() -> str:
    return getattr(settings, "AZURE_SPEECH_REGION", "swedencentral") or "swedencentral"

def _base_endpoint() -> str:
    """Custom endpoint (swedencentral) yoki default region endpoint."""
    custom = getattr(settings, "AZURE_SPEECH_ENDPOINT", "")
    if custom:
        return custom.rstrip("/")
    return f"https://{_region()}.api.cognitive.microsoft.com"

def _stt_endpoint() -> str:
    return f"https://{_region()}.stt.speech.microsoft.com"

def _tts_endpoint() -> str:
    return f"https://{_region()}.tts.speech.microsoft.com"

def _token_endpoint() -> str:
    return f"{_base_endpoint()}/sts/v1.0/issueToken"


def _check_config() -> None:
    if not _key():
        raise RuntimeError(
            "Azure Speech sozlanmagan: AZURE_SPEECH_KEY .env faylida topilmadi."
        )


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Voice profiles (Azure Neural TTS)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

VOICE_PROFILES: dict[str, dict] = {
    "uz-L": {
        "locale": "uz-UZ",
        "voice":  "uz-UZ-MadinaNeural",
        "lang":   "uz-UZ",
        "name":   "Madina (O'zbek)",
    },
    "uz-C": {
        "locale": "uz-UZ",
        "voice":  "uz-UZ-MadinaNeural",
        "lang":   "uz-UZ",
        "name":   "Madina (O'zbek Kirill)",
    },
    "ru": {
        "locale": "ru-RU",
        "voice":  "ru-RU-SvetlanaNeural",
        "lang":   "ru-RU",
        "name":   "Svetlana (Rus)",
    },
    "en": {
        "locale": "en-US",
        "voice":  "en-US-JennyNeural",
        "lang":   "en-US",
        "name":   "Jenny (English)",
    },
    "kaa": {
        "locale": "ru-RU",
        "voice":  "ru-RU-SvetlanaNeural",   # Qoraqolpoq uchun Rus fallback
        "lang":   "ru-RU",
        "name":   "Svetlana (Karakalpak fallback)",
    },
}

STT_LOCALE_MAP: dict[str, str] = {
    "uz-L": "uz-UZ",
    "uz-C": "uz-UZ",
    "ru":   "ru-RU",
    "en":   "en-US",
    "kaa":  "kk-KZ",
}


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Auth Token (Frontend SDK uchun)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def get_speech_token() -> dict:
    """
    Frontend Azure Speech SDK uchun 10 daqiqalik auth token.
    Kesh: 9 daqiqa (Django cache).

    Returns:
        {
          "token":       "eyJ...",
          "region":      "swedencentral",
          "endpoint":    "https://swedencentral...",
          "expires_in":  540,
        }
    """
    _check_config()
    cache_key = f"az_speech_token_{_region()}"
    cached    = cache.get(cache_key)
    if cached:
        return cached

    try:
        resp = requests.post(
            _token_endpoint(),
            headers={"Ocp-Apim-Subscription-Key": _key()},
            timeout=10,
        )
        resp.raise_for_status()
        token = resp.text.strip()
    except requests.RequestException as exc:
        logger.error("Speech token request failed: %s", exc)
        raise RuntimeError(f"Azure Speech token olishda xatolik: {exc}") from exc

    result = {
        "token":      token,
        "region":     _region(),
        "endpoint":   _base_endpoint(),
        "expires_in": 540,
    }
    cache.set(cache_key, result, timeout=540)
    logger.info("Azure Speech token yangilandi: region=%s", _region())
    return result


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# STT вЂ” Batch  (audio bytes в†’ matn)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def transcribe_audio(
    audio_data:   bytes,
    language:     str = "uz-L",
    audio_format: str = "wav",
) -> dict:
    """
    Azure Speech STT: audio bytes в†’ matn.

    Args:
        audio_data:   WAV / OGG / WebM audio bytes.
        language:     Dastur tili kodi (uz-L, ru, en ...).
        audio_format: "wav" | "ogg" | "webm" | "mp3"

    Returns:
        {
          "text":        "Tanilgan matn",
          "confidence":  0.95,
          "duration_ms": 1200,
          "status":      "success" | "no_match" | "error",
          "locale":      "uz-UZ",
        }
    """
    _check_config()

    locale = STT_LOCALE_MAP.get(language, "uz-UZ")
    url    = (
        f"{_stt_endpoint()}/speech/recognition/conversation/"
        f"cognitiveservices/v1"
        f"?language={locale}"
        f"&format=detailed"
        f"&profanity=raw"
    )

    # Content-Type mapping
    content_type_map = {
        "wav":  "audio/wav; codecs=audio/pcm; samplerate=16000",
        "ogg":  "audio/ogg; codecs=opus",
        "webm": "audio/webm; codecs=opus",
        "mp3":  "audio/mpeg",
        "m4a":  "audio/mp4",
    }
    content_type = content_type_map.get(audio_format.lower(), "audio/wav")

    headers = {
        "Ocp-Apim-Subscription-Key": _key(),
        "Content-Type":              content_type,
        "Accept":                    "application/json",
    }

    t0 = time.monotonic()
    try:
        resp = requests.post(url, headers=headers, data=audio_data, timeout=60)
        resp.raise_for_status()
        data = resp.json()
    except requests.HTTPError as exc:
        logger.error("STT HTTP error %s: %s", resp.status_code, exc)
        raise RuntimeError(f"STT HTTP {resp.status_code}: {resp.text[:200]}") from exc
    except requests.RequestException as exc:
        logger.error("STT request failed: %s", exc)
        raise RuntimeError(f"STT so'rovida xatolik: {exc}") from exc

    elapsed_ms = round((time.monotonic() - t0) * 1000)
    status     = data.get("RecognitionStatus", "Error")

    if status == "Success":
        nbest = data.get("NBest", [{}])
        best  = nbest[0] if nbest else {}
        text  = best.get("Display") or best.get("Lexical") or ""
        return {
            "text":        text.strip(),
            "confidence":  round(best.get("Confidence", 0.0), 3),
            "duration_ms": elapsed_ms,
            "status":      "success",
            "locale":      locale,
        }
    elif status == "NoMatch":
        return {
            "text":        "",
            "confidence":  0.0,
            "duration_ms": elapsed_ms,
            "status":      "no_match",
            "locale":      locale,
        }
    else:
        logger.warning("STT status=%s | data=%s", status, data)
        return {
            "text":        "",
            "confidence":  0.0,
            "duration_ms": elapsed_ms,
            "status":      status.lower(),
            "locale":      locale,
        }


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# TTS вЂ” Matn в†’ Audio bytes (MP3)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def synthesize_speech(
    text:     str,
    language: str = "uz-L",
    rate:     str = "0%",
    pitch:    str = "0%",
    volume:   str = "100%",
    fmt:      str = "audio-24khz-48kbitrate-mono-mp3",
) -> bytes:
    """
    Azure Neural TTS: matn в†’ MP3 audio bytes.

    Args:
        text:     O'qiladigan matn (max 3000 belgi).
        language: Til kodi (uz-L, ru, en, kaa).
        rate:     Nutq tezligi: "-20%" вЂ“ "+20%" yoki "slow"/"fast".
        pitch:    Ovoz toni: "-10Hz" вЂ“ "+10Hz".
        volume:   Ovoz balandligi: "0" вЂ“ "100%".
        fmt:      Azure audio output format.

    Returns:
        MP3 audio bytes.

    Raises:
        RuntimeError: Azure xatolik yoki tarmoq muammosi.
    """
    _check_config()

    profile = VOICE_PROFILES.get(language, VOICE_PROFILES["uz-L"])

    # Max uzunlik cheklash
    if len(text) > 3000:
        text = text[:2990] + "..."

    ssml = f"""<speak version='1.0' xml:lang='{profile["lang"]}'>
  <voice xml:lang='{profile["lang"]}' name='{profile["voice"]}'>
    <prosody rate='{rate}' pitch='{pitch}' volume='{volume}'>
      {_escape_xml(text)}
    </prosody>
  </voice>
</speak>"""

    url = f"{_tts_endpoint()}/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": _key(),
        "Content-Type":              "application/ssml+xml",
        "X-Microsoft-OutputFormat":  fmt,
        "User-Agent":                "FargonaJSTI-Jarvis/3.0",
    }

    try:
        resp = requests.post(
            url,
            headers = headers,
            data    = ssml.encode("utf-8"),
            timeout = 30,
        )
        resp.raise_for_status()
    except requests.HTTPError as exc:
        logger.error("TTS HTTP error %s: %s", resp.status_code, resp.text[:200])
        raise RuntimeError(f"TTS HTTP {resp.status_code}: {resp.text[:200]}") from exc
    except requests.RequestException as exc:
        logger.error("TTS request failed: %s", exc)
        raise RuntimeError(f"TTS so'rovida xatolik: {exc}") from exc

    logger.debug("TTS OK: lang=%s voice=%s chars=%d bytes=%d",
                 language, profile["voice"], len(text), len(resp.content))
    return resp.content


def synthesize_speech_b64(text: str, language: str = "uz-L") -> str:
    """TTS в†’ base64 encoded MP3 string (JSON API uchun)."""
    audio = synthesize_speech(text, language)
    return base64.b64encode(audio).decode("utf-8")


def _escape_xml(text: str) -> str:
    return (
        text.replace("&",  "&amp;")
            .replace("<",  "&lt;")
            .replace(">",  "&gt;")
            .replace('"',  "&quot;")
            .replace("'",  "&apos;")
    )


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Transkript fayl xotirasi
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def _transcript_dir() -> Path:
    base = Path(getattr(settings, "MEDIA_ROOT", "/tmp/FJSTI_media"))
    d    = base / "transcripts"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _safe_filename(session_id: str) -> str:
    h    = hashlib.sha256(session_id.encode()).hexdigest()[:16]
    safe = "".join(c for c in session_id if c.isalnum() or c in "-_")[:32]
    return f"{safe}_{h}"


def save_transcript_chunk(
    session_id: str,
    chunk:      str,
    speaker:    str            = "unknown",
    timestamp:  Optional[float] = None,
) -> None:
    """Konsultatsiya transkript bo'lagini .jsonl faylga qo'shib yozish."""
    if not session_id or not chunk.strip():
        return
    ts    = timestamp or time.time()
    entry = {"t": round(ts, 2), "speaker": speaker, "text": chunk.strip()}
    path  = _transcript_dir() / f"{_safe_filename(session_id)}.jsonl"
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def load_transcript(session_id: str) -> list[dict]:
    """Sessiyaning barcha transkript yozuvlarini qaytarish."""
    path = _transcript_dir() / f"{_safe_filename(session_id)}.jsonl"
    if not path.exists():
        return []
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return records


def get_full_transcript_text(session_id: str) -> str:
    """Barcha yozuvlarni bitta formatlangan matn sifatida qaytarish."""
    records = load_transcript(session_id)
    lines   = []
    for r in records:
        speaker = r.get("speaker", "?").upper()
        text    = r.get("text", "")
        if text:
            lines.append(f"[{speaker}]: {text}")
    return "\n".join(lines)


def delete_transcript(session_id: str) -> bool:
    """Maxfiylik: transkript faylini o'chirish."""
    path = _transcript_dir() / f"{_safe_filename(session_id)}.jsonl"
    if path.exists():
        path.unlink()
        logger.info("Transcript deleted: %s", session_id)
        return True
    return False


# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Quick connectivity test (debug uchun)
# в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

def test_connection() -> dict:
    """
    Azure Speech ulanishini tekshirish.
    Management API ga ping вЂ” kalit to'g'riligini tasdiqlaydi.
    """
    _check_config()
    try:
        token_data = get_speech_token()
        return {
            "status":   "ok",
            "region":   token_data["region"],
            "endpoint": token_data["endpoint"],
            "message":  "Azure Speech Services ulanish muvaffaqiyatli",
        }
    except Exception as exc:
        return {
            "status":  "error",
            "message": str(exc),
        }