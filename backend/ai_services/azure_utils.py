"""
AI backend: Gemini-only (Azure/OpenAI removed).
All call_model / _call_gemini use Google Gemini when GEMINI_API_KEY is set.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

# When True, all AI calls use Gemini (gemini_utils). No Azure/OpenAI.
USE_GEMINI = bool(getattr(settings, "GEMINI_API_KEY", None))

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
        return AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )
    except ImportError as exc:
        raise RuntimeError(
            "openai paketi o'rnatilmagan. 'pip install openai' ni bajaring."
        ) from exc


def _get_client(deployment_key: str) -> "AzureOpenAI":  # type: ignore[name-defined]
    """Return a cached AzureOpenAI client. Not used when USE_GEMINI."""
    if USE_GEMINI:
        raise RuntimeError("Azure is disabled; only Gemini is used. Set GEMINI_API_KEY in .env")
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

def _deployment_to_gemini_model(deployment_name: str):
    """Map Azure deployment name to Gemini model (pro or flash)."""
    from . import gemini_utils
    n = (deployment_name or "").lower()
    if "mini" in n or "flash" in n or "deepseek" in n:
        return gemini_utils.GEMINI_FLASH
    return gemini_utils.GEMINI_PRO


def call_model(
    deployment_name: str,
    messages: list[dict[str, Any]],
    response_json: bool = False,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    stream: bool = False,
) -> str:
    """
    Call AI model. When GEMINI_API_KEY is set, uses Gemini; otherwise Azure (legacy).
    """
    if USE_GEMINI:
        from . import gemini_utils
        parts = []
        for m in messages:
            role = (m.get("role") or "user").lower()
            content = (m.get("content") or "").strip()
            if not content:
                continue
            if role == "system":
                parts.append(f"[Tizim]: {content}")
            else:
                parts.append(content)
        prompt = "\n\n".join(parts)
        model = _deployment_to_gemini_model(deployment_name)
        mime = "application/json" if response_json else None
        return gemini_utils._call_gemini(prompt, model_name=model, response_mime_type=mime)

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

def parse_json(raw: str, context: str = "") -> dict | list:
    """Parse JSON from model response, with markdown-fence cleanup."""
    cleaned = raw.strip()
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
        return {}


# ---------------------------------------------------------------------------
# Patient text builder
# ---------------------------------------------------------------------------

def patient_text(patient_data: dict) -> str:
    """Build plain-text patient summary (no base64)."""
    d = patient_data or {}
    parts = [
        f"Bemor: {d.get('firstName','')} {d.get('lastName','')}, "
        f"{d.get('age','')} yosh, {d.get('gender','')}.",
        f"Shikoyatlar: {d.get('complaints','')}",
    ]
    for key, label in [
        ("history",            "Anamnez"),
        ("objectiveData",      "Ob'ektiv"),
        ("labResults",         "Lab"),
        ("allergies",          "Allergiya"),
        ("currentMedications", "Dori-darmonlar"),
        ("familyHistory",      "Oila anamnezi"),
        ("additionalInfo",     "Qo'shimcha"),
    ]:
        if d.get(key):
            parts.append(f"{label}: {d[key]}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Backwards-compatible shims for files that still import old names
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str, model_name: str | None = None,
                 response_mime_type: str | None = None) -> str:
    """Shim: uses Gemini when GEMINI_API_KEY is set, else Azure."""
    if USE_GEMINI:
        from . import gemini_utils
        model = gemini_utils.GEMINI_PRO
        if model_name:
            n = model_name.lower()
            if "flash" in n or "mini" in n:
                model = gemini_utils.GEMINI_FLASH
        return gemini_utils._call_gemini(prompt, model_name=model, response_mime_type=response_mime_type)
    is_json = response_mime_type == "application/json"
    deployment = _map_old_model(model_name)
    msgs = build_messages(
        "Siz professional tibbiy AI yordamchisiz. O'zbekiston SSV protokollariga muvofiq javob bering.",
        prompt,
        want_json=is_json,
    )
    return call_model(deployment, msgs, response_json=is_json, max_tokens=4096)


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
    # Legacy names
    "Gemini", "Claude", "Grok",
]


def generate_clarifying_questions(patient_data: dict) -> list[str]:
    if USE_GEMINI:
        from . import gemini_utils
        return gemini_utils.generate_clarifying_questions(patient_data)
    text = patient_text(patient_data)
    prompt = (
        f"Bemor:\n{text}\n\n"
        "3 - 5 ta QISQA, ANIQ aniqlashtiruvchi savol yozing.\n"
        "PRIORITY 1: Allergiya, dori-darmonlar, homiladorlik.\n"
        "PRIORITY 2: Vital belgilar, lab qiymatlari.\n"
        "PRIORITY 3: Simptomlar davomiyligi, oila anamnezi.\n"
        "Mavjud ma'lumotlar uchun savol bermang.\n"
        'JSON: {"questions": ["Savol 1?", "Savol 2?"]}'
    )
    msgs = build_messages(
        "Tibbiy yordamchi AI. O'zbek tilida (Lotin) javob ber.",
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


def recommend_specialists(
    patient_data: dict,
    differential_diagnoses: list | None = None,
) -> list[dict]:
    text = patient_text(patient_data)
    names = ", ".join(SPECIALIST_NAMES[:40])
    dd_block = ""
    if differential_diagnoses:
        lines = []
        for d in differential_diagnoses[:8]:
            if isinstance(d, dict):
                nm = str(d.get("name", "?"))
                pr = d.get("probability", "")
                j = str(d.get("justification", ""))[:400]
                lines.append(f"- {nm} (~{pr}%): {j}")
            else:
                lines.append(f"- {d}")
        dd_block = (
            "\n\nDIFFERENSIAL TASHXISLAR (konsilium uchun asos — mutaxassislarni aynan shu yo'nalishlarga moslang):\n"
            + "\n".join(lines)
            + "\n"
        )
    prompt = (
        f"Bemor:\n{text}\n{dd_block}\n"
        "Vazifa: Yuqoridagi holat va (agar berilgan bo'lsa) differensial tashxislarga ASOSLANIB, "
        "5–6 ta mutaxassisni tanlang. Har safar bir xil \"umumiy\" jamoani takrorlamang — "
        "kasallikka tegishli organ tizimi va nazariy holat bo'yicha kerakli profillar "
        "(masalan: buyrak + qon — Nephrologist + Hematologist; yurak — kardiologik AI; nafas — Pulmonologist).\n"
        f"Faqat quyidagi nomlardan tanlang: {names}.\n"
        'Har biri uchun qisqa sabab: {"recommendations": [{"model": "Nom", "reason": "Nega aynan bu mutaxassis"}]}'
    )
    msgs = build_messages(
        "Tibbiy maslahatchisi. O'zbek tilida (Lotin).",
        prompt, want_json=True,
    )
    raw = call_model(Deployments.gpt4o(), msgs, response_json=True)
    data = parse_json(raw, "recommend_specialists")
    if not isinstance(data, dict):
        return []
    recs = data.get("recommendations") or []
    out = []
    for r in recs:
        model = (r.get("model") or "").strip()
        if model not in SPECIALIST_NAMES:
            for n in SPECIALIST_NAMES:
                if n.lower() in model.lower() or model.lower() in n.lower():
                    model = n
                    break
        if model in SPECIALIST_NAMES:
            out.append({"model": model, "reason": str(r.get("reason") or "")[:200]})
    return out[:8]


def generate_diagnoses(patient_data: dict) -> list[dict]:
    if USE_GEMINI:
        from . import gemini_utils
        return gemini_utils.generate_diagnoses(patient_data)
    text = patient_text(patient_data)
    prompt = (
        f"Bemor:\n{text}\n\n"
        "3 - 5 ta eng ehtimol differensial tashxis. O'ZBEKISTON SSV protokollari.\n"
        '{"diagnoses": [{"name":"...","probability":70,"justification":"...","evidenceLevel":"High","reasoningChain":["..."],"uzbekProtocolMatch":"..."}]}'
    )
    msgs = build_messages(
        "Yuqori malakali tibbiy AI. O'zbek tilida (Lotin).",
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