"""
AI backend: DeepSeek when DEEPSEEK_API_KEY is set; else legacy Azure.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

# When True, all text AI calls use OpenAI (claude_utils shim).
USE_OPENAI_TEXT = bool(getattr(settings, "OPENAI_API_KEY", None))
USE_CLAUDE = USE_OPENAI_TEXT  # backwards-compat alias
USE_GEMINI = USE_CLAUDE  # backwards-compat alias (deprecated)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _cfg(key: str, default: str = "") -> str:
    """Read a setting; raise RuntimeError if required and missing."""
    val = getattr(settings, key, default)
    return val or default


def _require_cfg(key: str) -> str:
    val = _cfg(key)
    if not val:
        raise RuntimeError(
            f"Azure AI sozlanmagan: '{key}' settings.py yoki .env da topilmadi."
        )
    return val


# ---------------------------------------------------------------------------
# Client factory  -  har bir deployment uchun alohida instance
# ---------------------------------------------------------------------------

_clients: dict[str, Any] = {}   # deployment_key в†’ AzureOpenAI instance


def _make_client(endpoint: str, api_key: str, api_version: str):
    """Create a fresh AzureOpenAI client."""
    try:
        from openai import AzureOpenAI
        from .claude_utils import _max_retries, _request_timeout_sec
        # timeout/max_retries — SDK default'i (600s, 2 retry) gunicorn'ning 180s
        # worker timeout'idan ancha katta. Sozlash: AI_REQUEST_TIMEOUT_SEC / AI_MAX_RETRIES.
        return AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            timeout=_request_timeout_sec(),
            max_retries=_max_retries(),
        )
    except ImportError as exc:
        raise RuntimeError(
            "openai paketi o'rnatilmagan. 'pip install openai' ni bajaring."
        ) from exc


def _get_client(deployment_key: str) -> "AzureOpenAI":  # type: ignore[name-defined]
    """Return a cached AzureOpenAI client. Not used when USE_CLAUDE."""
    if USE_CLAUDE:
        raise RuntimeError("Azure is disabled; OpenAI is used. Set OPENAI_API_KEY in .env")
    if deployment_key not in _clients:
        endpoint   = _require_cfg("AZURE_OPENAI_ENDPOINT")
        api_key    = _require_cfg("AZURE_OPENAI_API_KEY")
        api_version = _cfg("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        _clients[deployment_key] = _make_client(endpoint, api_key, api_version)
        logger.debug("AzureOpenAI client created for deployment_key='%s'", deployment_key)
    return _clients[deployment_key]


# ---------------------------------------------------------------------------
# Deployment name constants (settings-driven, with fallback defaults)
# ---------------------------------------------------------------------------

def _deploy_name(setting_key: str, default: str) -> str:
    return _cfg(setting_key, default)


class Deployments:
    """Centralized deployment-name registry."""

    @staticmethod
    def gpt4o()    -> str: return _deploy_name("AZURE_DEPLOY_GPT4O",    "FJSTI-gpt4o")
    @staticmethod
    def deepseek() -> str: return _deploy_name("AZURE_DEPLOY_DEEPSEEK", "FJSTI-deepseek")
    @staticmethod
    def llama()    -> str: return _deploy_name("AZURE_DEPLOY_LLAMA",    "FJSTI-llama")
    @staticmethod
    def mistral()  -> str: return _deploy_name("AZURE_DEPLOY_MISTRAL",  "FJSTI-mistral")
    @staticmethod
    def mini()     -> str: return _deploy_name("AZURE_DEPLOY_MINI",     "FJSTI-mini")


# Keep module-level callables for backwards-compat imports
DEPLOY_GPT4O    = Deployments.gpt4o
DEPLOY_DEEPSEEK = Deployments.deepseek
DEPLOY_LLAMA    = Deployments.llama
DEPLOY_MISTRAL  = Deployments.mistral
DEPLOY_MINI     = Deployments.mini


# ---------------------------------------------------------------------------
# Public client accessors  (one per model role)
# ---------------------------------------------------------------------------

def gpt4o_client():
    """Orchestrator / Rais  -  GPT-4o"""
    return _get_client("gpt4o")

def deepseek_client():
    """Mantiqiy Tahlilchi  -  DeepSeek"""
    return _get_client("deepseek")

def llama_client():
    """Faktik Ma'lumotlar Bazasi  -  Llama 3.3"""
    return _get_client("llama")

def mistral_client():
    """Klinik Protokollar Eksperti  -  Mistral"""
    return _get_client("mistral")

def mini_client():
    """Tezkor Tahlilchi  -  GPT-4o-mini"""
    return _get_client("mini")


# ---------------------------------------------------------------------------
# Core call helper
# ---------------------------------------------------------------------------

def _deployment_to_claude_model(deployment_name: str):
    """Map deployment role → Claude tier (Haiku munozara, Sonnet konsensus)."""
    from . import claude_utils
    n = (deployment_name or "").lower()
    if "gpt4o" in n and "mini" not in n:
        return claude_utils._model_diagnosis()
    return claude_utils._model_fast()


def stream_model(
    deployment_name: str,
    messages: list[dict[str, Any]],
    response_json: bool = False,
    temperature: float = 0.1,
    max_tokens: int = 4096,
):
    """
    Matn bo'laklarini (delta) yield qiladi.

    call_model() dan farqi: javob to'liq tayyor bo'lishini kutmaydi. Bu SSE
    uchun muhim — aks holda butun javob bitta ulkan bo'lak bo'lib ketadi va
    proxy/klient tomonda uzilib qolish ehtimoli oshadi.

    Stream imkonsiz bo'lsa (klient yo'q yoki provayder qo'llamaydi) —
    call_model() ga tushib, natijani bitta bo'lak sifatida qaytaradi.
    """
    if USE_CLAUDE:
        from . import claude_utils
        client = claude_utils._get_client()
        if client is not None:
            model = claude_utils._resolve_model(_deployment_to_claude_model(deployment_name))
            kwargs: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
            }
            if response_json:
                kwargs["response_format"] = {"type": "json_object"}
            try:
                for chunk in client.chat.completions.create(**kwargs):
                    choices = getattr(chunk, "choices", None)
                    if not choices:
                        continue
                    delta = getattr(choices[0].delta, "content", None) or ""
                    if delta:
                        yield delta
                return
            except Exception as exc:
                logger.warning("stream_model: streaming failed (%s), falling back", exc)

    text = call_model(deployment_name, messages, response_json, temperature, max_tokens)
    if text:
        yield text


def call_model(
    deployment_name: str,
    messages: list[dict[str, Any]],
    response_json: bool = False,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    stream: bool = False,
) -> str:
    """
    Call AI model. When OPENAI_API_KEY is set, uses OpenAI; otherwise Azure (legacy).
    """
    if USE_CLAUDE:
        from . import claude_utils
        system_parts = []
        user_parts = []
        for m in messages:
            role = (m.get("role") or "user").lower()
            content = (m.get("content") or "").strip()
            if not content:
                continue
            if role == "system":
                system_parts.append(content)
            else:
                user_parts.append(content)
        prompt = "\n\n".join(user_parts)
        system = "\n\n".join(system_parts) or None
        model = _deployment_to_claude_model(deployment_name)
        mime = "application/json" if response_json else None
        return claude_utils._call_claude(
            prompt,
            model_name=model,
            response_mime_type=mime,
            system=system,
            max_output_tokens=max_tokens,
        )

    # Legacy Azure path
    deploy_to_client = {
        Deployments.gpt4o():    gpt4o_client,
        Deployments.deepseek(): deepseek_client,
        Deployments.llama():    llama_client,
        Deployments.mistral():  mistral_client,
        Deployments.mini():     mini_client,
    }
    client_factory = deploy_to_client.get(deployment_name, gpt4o_client)
    client = client_factory()
    kwargs: dict[str, Any] = {
        "model": deployment_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_json:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        resp = client.chat.completions.create(**kwargs)
        return (resp.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.error("Azure call failed (deployment=%s): %s", deployment_name, exc)
        raise RuntimeError(f"Azure OpenAI xatosi [{deployment_name}]: {exc}") from exc


# ---------------------------------------------------------------------------
# Convenience: build_messages helper
# ---------------------------------------------------------------------------

def build_messages(
    system: str,
    user: str,
    want_json: bool = False,
) -> list[dict[str, str]]:
    """Build a standard [system, user] messages list."""
    if want_json:
        user = user + "\n\nMuhim: Javobni FAQAT toza JSON formatida qaytaring."
    return [
        {"role": "system", "content": system},
        {"role": "user",   "content": user},
    ]


# ---------------------------------------------------------------------------
# JSON parse helper
# ---------------------------------------------------------------------------

class JSONParseError(ValueError):
    """Model javobi JSON emas (yoki token limitida kesilgan).

    Muhim: bo'sh {} bilan ADASHTIRMASLIK uchun alohida xato. `{}` — "model
    hech narsa topmadi" degani, bu xato esa "model javobi buzilgan" degani.
    """

    def __init__(self, context: str = "", raw: str = ""):
        self.context = context
        self.raw = raw
        super().__init__(
            f"Model JSON javobini o'qib bo'lmadi{f' ({context})' if context else ''}"
        )


def parse_json(raw: str, context: str = "", strict: bool = False) -> dict | list:
    """Parse JSON from model response, with markdown-fence cleanup.

    strict=True bo'lsa — muvaffaqiyatsizlikda JSONParseError ko'tariladi.
    strict=False (default) — eski xatti-harakat: {} qaytaradi (mavjud
    chaqiruvchilar buzilmasligi uchun).
    """
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        lines = [l for l in cleaned.splitlines() if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    for start in ("{", "["):
        idx = cleaned.find(start)
        if idx >= 0:
            try:
                return json.loads(cleaned[idx:])
            except json.JSONDecodeError:
                pass
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("parse_json failed%s: %s", f" ({context})" if context else "", cleaned[:300])
        if strict:
            raise JSONParseError(context, cleaned[:300]) from None
        return {}


# ---------------------------------------------------------------------------
# Patient text builder
# ---------------------------------------------------------------------------

def patient_text(patient_data: dict, extra: dict | None = None) -> str:
    """Build plain-text patient summary (no base64)."""
    from .clinical_context import build_clinical_context
    return build_clinical_context(patient_data, extra)


# ---------------------------------------------------------------------------
# Backwards-compatible shims for files that still import old names
# ---------------------------------------------------------------------------

def _call_claude(prompt: str, model_name: str | None = None,
                 response_mime_type: str | None = None) -> str:
    """Shim: uses OpenAI when OPENAI_API_KEY is set, else Azure."""
    if USE_CLAUDE:
        from . import claude_utils
        model = claude_utils._model_pro()
        if model_name:
            n = str(model_name).lower()
            if "sonnet" in n or "flash" in n or "mini" in n or "haiku" in n:
                model = claude_utils._model_fast()
        return claude_utils._call_claude(prompt, model_name=model, response_mime_type=response_mime_type)

    # OPENAI_API_KEY yo'q — ilgari jimgina None qaytarardi va chaqiruvchida
    # raw.replace(...) AttributeError bilan yiqilardi. Endi aniq xato beriladi.
    is_json = response_mime_type == "application/json"
    deployment = _map_old_model(model_name)
    msgs = build_messages(
        "Siz professional tibbiy AI yordamchisiz. O'zbekiston SSV protokollariga muvofiq javob bering.",
        prompt,
        want_json=is_json,
    )
    return call_model(deployment, msgs, response_json=is_json, max_tokens=4096)


def _call_gemini(prompt: str, model_name: str | None = None,
                 response_mime_type: str | None = None) -> str:
    """Deprecated alias for _call_claude."""
    return _call_claude(prompt, model_name=model_name, response_mime_type=response_mime_type)


def _map_old_model(name: str | None) -> str:
    if not name:
        return Deployments.gpt4o()
    n = name.lower()
    if "flash-lite" in n or "mini" in n or ("flash" in n and "pro" not in n):
        return Deployments.mini()
    return Deployments.gpt4o()


# ---------------------------------------------------------------------------
# Public API functions (used by views.py)
# ---------------------------------------------------------------------------

SPECIALIST_NAMES: list[str] = [
    "GPT-4o", "DeepSeek", "Llama 3", "Mistral",
    "Allergist", "Anesthesiology", "Dermatologist", "Emergency", "Family Medicine",
    "Gastroenterologist", "Geneticist", "Geriatrician", "Hematologist", "Infectious",
    "Internal Medicine", "Nephrologist", "ObGyn", "Ophthalmologist", "Orthopedic",
    "Otolaryngologist", "Pathologist", "Pediatrician", "Pharmacologist", "Physiatrist",
    "Plastic Surgeon", "Psychiatrist", "Pulmonologist", "Rheumatologist", "Surgeon",
    "Urologist", "Neonatologist", "Neurosurgeon", "Cardiothoracic Surgeon",
    "Vascular Surgeon", "Traumatologist", "Toxicologist", "Sports Medicine",
    "Sleep Medicine", "Pain Management", "Nutritionist", "Immunologist",
    "Hepatologist", "Epidemiologist", "Dentist", "Maxillofacial",
    "Proctologist", "Mammologist", "Phthisiatrician", "Narcologist",
    "Psychotherapist", "Sexologist", "Vertebrologist",
    "Claude", "Grok",
]


def generate_clarifying_questions(patient_data: dict, language: str = "uz-L") -> list[str]:
    if USE_CLAUDE:
        from . import claude_utils
        try:
            return claude_utils.generate_clarifying_questions(patient_data, language)
        except TypeError:
            return claude_utils.generate_clarifying_questions(patient_data)
    from .debate_format import lang_label, normalize_language, output_language_rule
    language = normalize_language(
        language or patient_data.get("language") or patient_data.get("preferredLanguage") or "uz-L"
    )
    text = patient_text(patient_data)
    prompt = (
        f"Bemor:\n{text}\n\n"
        "3 - 5 ta QISQA, ANIQ aniqlashtiruvchi savol yozing.\n"
        "PRIORITY 1: Allergiya, dori-darmonlar, homiladorlik.\n"
        "PRIORITY 2: Vital belgilar, lab qiymatlari.\n"
        "PRIORITY 3: Simptomlar davomiyligi, oila anamnezi.\n"
        "Mavjud ma'lumotlar uchun savol bermang.\n"
        f"OUTPUT LANGUAGE: {lang_label(language)}.\n"
        'JSON: {"questions": ["Savol 1?", "Savol 2?"]}'
    )
    msgs = build_messages(
        f"Tibbiy yordamchi AI.\n{output_language_rule(language)}",
        prompt, want_json=True,
    )
    raw = call_model(Deployments.mini(), msgs, response_json=True)
    data = parse_json(raw, "clarifying_questions")
    if isinstance(data, dict):
        qs = data.get("questions") or []
    elif isinstance(data, list):
        qs = data
    else:
        qs = []
    return [str(q) for q in qs if q][:8]


def recommend_specialists_fast(patient_data: dict, differential_diagnoses: list | None = None) -> list[dict]:
    """TEZKOR mutaxassis tavsiyasi — faqat kasallikka tegishli profillar."""
    from .specialist_routing import recommend_specialists_scored
    return recommend_specialists_scored(patient_data, differential_diagnoses)


def recommend_specialists(
    patient_data: dict,
    differential_diagnoses: list | None = None,
) -> list[dict]:
    """AI-based specialist recommendation (slow but comprehensive)"""
    return recommend_specialists_fast(patient_data, differential_diagnoses)


def generate_diagnoses(patient_data: dict, language: str = "uz-L") -> list[dict]:
    if USE_CLAUDE:
        from . import claude_utils
        try:
            return claude_utils.generate_diagnoses(patient_data, language)
        except TypeError:
            return claude_utils.generate_diagnoses(patient_data)
    from .debate_format import lang_label, normalize_language, output_language_rule
    language = normalize_language(
        language or patient_data.get("language") or patient_data.get("preferredLanguage") or "uz-L"
    )
    text = patient_text(patient_data)
    prompt = (
        f"Bemor:\n{text}\n\n"
        "3 - 5 ta eng ehtimol differensial tashxis. O'ZBEKISTON SSV protokollari.\n"
        f"OUTPUT LANGUAGE: {lang_label(language)}.\n"
        '{"diagnoses": [{"name":"...","probability":70,"justification":"...","evidenceLevel":"High","reasoningChain":["..."],"uzbekProtocolMatch":"..."}]}'
    )
    msgs = build_messages(
        f"Yuqori malakali tibbiy AI.\n{output_language_rule(language)}",
        prompt, want_json=True,
    )
    raw = call_model(Deployments.gpt4o(), msgs, response_json=True, max_tokens=3000)
    data = parse_json(raw, "generate_diagnoses")
    items = data.get("diagnoses", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    out = []
    for d in items[:8]:
        prob = max(0, min(100, int(d.get("probability", 50))))
        out.append({
            "name":               str(d.get("name", "Tashxis")),
            "probability":        prob,
            "justification":      str(d.get("justification", ""))[:500],
            "evidenceLevel":      str(d.get("evidenceLevel", "Moderate"))[:50],
            "reasoningChain":     d.get("reasoningChain") or [],
            "uzbekProtocolMatch": str(d.get("uzbekProtocolMatch", ""))[:300],
        })
    return out