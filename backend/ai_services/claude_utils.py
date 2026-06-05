"""
Anthropic Claude API helpers for AI Services.
Uses anthropic SDK. API key from settings.ANTHROPIC_API_KEY.
"""
import hashlib
import json
import logging
import re

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

_client = None

def _ai_cost_mode():
    return (getattr(settings, "AI_COST_MODE", "scale") or "scale").strip().lower()


def _default_max_tokens():
    return {
        "scale": 2048,
        "economy": 2048,
        "balanced": 3072,
        "quality": 8192,
    }.get(_ai_cost_mode(), 2048)


def _haiku_model():
    return getattr(settings, "CLAUDE_MODEL_HAIKU", "claude-haiku-4-5-20251001")


def _use_sonnet_diagnosis():
    return bool(getattr(settings, "CLAUDE_USE_SONNET_DIAGNOSIS", False))


def _model_fast():
    haiku = _haiku_model()
    if _ai_cost_mode() in ("scale", "economy"):
        return haiku
    return getattr(settings, "CLAUDE_MODEL_FAST", "claude-sonnet-4-6")


def _model_pro():
    mode = _ai_cost_mode()
    if mode == "quality":
        return getattr(settings, "CLAUDE_MODEL_PRO", "claude-opus-4-7")
    if mode == "balanced":
        return getattr(settings, "CLAUDE_MODEL_FAST", "claude-sonnet-4-6")
    if _use_sonnet_diagnosis() and mode == "scale":
        return getattr(settings, "CLAUDE_MODEL_FAST", "claude-sonnet-4-6")
    return _haiku_model()


def _model_diagnosis():
    """Default: Haiku (arzon). Sonnet faqat CLAUDE_USE_SONNET_DIAGNOSIS=true."""
    return _model_pro()


def _cache_key(prefix: str, text: str) -> str:
    digest = hashlib.sha256((text or "").encode("utf-8", errors="ignore")).hexdigest()[:32]
    return f"claude:{prefix}:{digest}"


# Module-level aliases (resolved at call time via helpers)
CLAUDE_FAST = "claude-sonnet-4-6"
CLAUDE_PRO = "claude-opus-4-7"

SPECIALIST_ALIASES = {
    "Claude-Cardio": "Cardiologist",
    "Claude": "Neurologist",
    "GPT-4o": "Radiologist",
    "Llama 3": "Oncologist",
    "Grok": "Endocrinologist",
}

SPECIALIST_NAMES = [
    "Cardiologist", "Neurologist", "Radiologist", "Oncologist", "Endocrinologist",
    "Allergist", "Anesthesiology", "Dermatologist", "Emergency", "Family Medicine",
    "Gastroenterologist", "Geneticist", "Geriatrician", "Hematologist", "Infectious",
    "Internal Medicine", "Nephrologist", "ObGyn", "Ophthalmologist", "Orthopedic",
    "Otolaryngologist", "Pathologist", "Pediatrician", "Pharmacologist", "Physiatrist",
    "Plastic Surgeon", "Psychiatrist", "Pulmonologist", "Rheumatologist", "Surgeon", "Urologist",
    "Neonatologist", "Neurosurgeon", "Cardiothoracic Surgeon", "Vascular Surgeon", "Traumatologist",
    "Toxicologist", "Sports Medicine", "Sleep Medicine", "Pain Management", "Nutritionist",
    "Immunologist", "Hepatologist", "Epidemiologist", "Dentist", "Maxillofacial",
    "Proctologist", "Mammologist", "Phthisiatrician", "Narcologist", "Psychotherapist",
    "Sexologist", "Vertebrologist",
    "Andrologist", "Angiologist", "Palliative Care", "Transfusiologist", "Microbiologist",
    "Occupational Medicine", "Reproductive Medicine", "Clinical Biochemist",
    "Physical Therapist", "Speech Therapist",
]


def _normalize_specialist_model(model: str) -> str:
    m = (model or "").strip()
    return SPECIALIST_ALIASES.get(m, m)


def _get_client():
    global _client
    if _client is not None:
        return _client
    key = (getattr(settings, "ANTHROPIC_API_KEY", None) or "").strip()
    if not key:
        return None
    try:
        import anthropic
        _client = anthropic.Anthropic(api_key=key)
        return _client
    except ImportError:
        logger.warning("anthropic not installed: pip install anthropic")
        return None


def _patient_text(patient_data, extra=None):
    from .clinical_context import build_clinical_context
    return build_clinical_context(patient_data, extra)


def _response_text(response):
    parts = []
    for block in getattr(response, "content", None) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(str(text))
    return "".join(parts).strip()


def _resolve_model(model_name):
    if model_name in (CLAUDE_FAST, CLAUDE_PRO):
        return _model_fast() if model_name == CLAUDE_FAST else _model_pro()
    return model_name or _model_pro()


def _call_claude(
    prompt,
    model_name=CLAUDE_FAST,
    response_mime_type=None,
    max_output_tokens=None,
    system=None,
):
    if max_output_tokens is None:
        max_output_tokens = _default_max_tokens()
    """Call Claude Messages API. Returns response text."""
    client = _get_client()
    if not client:
        raise RuntimeError("Claude API kaliti sozlanmagan. ANTHROPIC_API_KEY ni .env ga kiriting.")

    user_content = prompt
    if response_mime_type == "application/json" and isinstance(prompt, str):
        if "faqat json" not in prompt.lower() and "only json" not in prompt.lower():
            user_content = f"{prompt}\n\nMuhim: Javobni FAQAT toza JSON formatida qaytaring."

    kwargs = {
        "model": _resolve_model(model_name),
        "max_tokens": max_output_tokens,
        "temperature": 0.1,
        "messages": [{"role": "user", "content": user_content}],
    }
    if system:
        kwargs["system"] = system

    try:
        response = client.messages.create(**kwargs)
    except Exception as e:
        logger.exception("Claude API xatosi: %s", e)
        raise

    text = _response_text(response)
    if not text:
        raise ValueError("Claude bo'sh javob qaytardi")
    return text


def generate_clarifying_questions(patient_data):
    if _get_client() is None:
        raise RuntimeError(
            "Claude API kaliti sozlanmagan. ANTHROPIC_API_KEY ni backend/.env ga kiriting."
        )
    text = _patient_text(patient_data)
    cache_key = _cache_key("clarify", text)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    prompt = f"""Siz tibbiy yordamchi AI siz. Bemor ma'lumotlari:
{text}

QAT'IY QOIDA: Har bir savol FAQAT yuqoridagi SHIKOYAT (complaints) matnida tilga olingan aniq belgi, kasallik yoki simptom haqida bo'lsin.
TAQIQLANGAN: Umumiy tibbiy savollar, shablon savollar, shikoyatda tilga olinmagan mavzular.

3–5 ta qisqa savol. Javobni faqat JSON massiv: ["Savol 1?", "Savol 2?"]. O'zbek tilida (Lotin)."""
    raw = None
    last_exc = None
    for model in (CLAUDE_FAST, CLAUDE_PRO):
        if model == CLAUDE_PRO and _ai_cost_mode() != "quality":
            continue
        try:
            raw = _call_claude(
                prompt,
                model,
                response_mime_type="application/json",
                max_output_tokens=1024,
            )
            break
        except Exception as e:
            last_exc = e
            logger.warning("Claude clarifying_questions (model=%s) failed: %s", model, e)
    if not raw and last_exc is not None:
        raise last_exc
    if not raw:
        return []

    raw = (raw or "").replace("```json", "").replace("```", "").replace("```text", "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("Claude clarifying_questions: invalid JSON (error=%s), raw=%s", e, raw[:500])
        match = re.search(r"\[[\s\S]*\]", raw)
        if match:
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                return []
        else:
            return []
    if isinstance(data, list):
        out = [str(q) for q in data if q][:8]
    elif isinstance(data, dict) and "questions" in data:
        out = [str(q) for q in data["questions"] if q][:8]
    else:
        out = []
    if out:
        cache.set(cache_key, out, timeout=3600)
    return out


def recommend_specialists(patient_data):
    if _get_client() is None:
        raise RuntimeError("Claude API kaliti sozlanmagan. ANTHROPIC_API_KEY ni .env ga kiriting.")
    text = _patient_text(patient_data)
    names_str = ", ".join(SPECIALIST_NAMES[:40])
    prompt = f"""Bemor ma'lumotlari:
{text}

Ushbu klinik holat uchun 6–8 ta mutaxassis tanlang. Faqat quyidagi nomlardan: {names_str}.
Har biri uchun qisqa sabab. JSON:
{{ "recommendations": [ {{ "model": "Nom exactly from list", "reason": "Sabab" }} ] }}
O'zbek tilida (Lotin)."""
    last_exc = None
    for model_name in (CLAUDE_FAST, CLAUDE_PRO):
        if model_name == CLAUDE_PRO and _ai_cost_mode() != "quality":
            continue
        try:
            raw = _call_claude(
                prompt,
                model_name,
                response_mime_type="application/json",
                max_output_tokens=1536,
            )
            raw = (raw or "").replace("```json", "").replace("```", "").strip()
            data = json.loads(raw)
            recs = (data or {}).get("recommendations") or []
            out = []
            for r in recs:
                model = _normalize_specialist_model((r.get("model") or "").strip())
                if model not in SPECIALIST_NAMES:
                    for n in SPECIALIST_NAMES:
                        if n.lower() in model.lower() or model.lower() in n.lower():
                            model = n
                            break
                if model in SPECIALIST_NAMES:
                    out.append({"model": model, "reason": (r.get("reason") or "Holatga mos.")[:200]})
            if out:
                return out[:8]
        except Exception as e:
            last_exc = e
            logger.warning("Claude recommend_specialists (model=%s) failed: %s", model_name, e)
    if last_exc is not None:
        raise last_exc
    return []


def generate_diagnoses(patient_data):
    client = _get_client()
    if not client:
        return []
    text = _patient_text(patient_data)
    prompt = f"""Bemor ma'lumotlari:
{text}

3–5 ta eng ehtimol differensial tashxis. O'ZBEKISTON SSV klinik protokollari kontekstida.
Har biri: name, probability (0–100), justification, evidenceLevel, reasoningChain, uzbekProtocolMatch.
Javobni faqat JSON massiv:
[ {{ "name": "...", "probability": 70, "justification": "...", "evidenceLevel": "High", "reasoningChain": ["..."], "uzbekProtocolMatch": "..." }} ]
O'zbek tilida (Lotin)."""

    model_order = [_model_diagnosis()]
    if _ai_cost_mode() in ("quality", "balanced") and _model_fast() not in model_order:
        model_order.append(_model_fast())

    for model_name in model_order:
        try:
            raw = _call_claude(
                prompt,
                model_name,
                response_mime_type="application/json",
                max_output_tokens=min(_default_max_tokens(), 3072),
            )
            raw = (raw or "").replace("```json", "").replace("```", "").strip()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                match = re.search(r"\[[\s\S]*\]", raw)
                if not match:
                    continue
                data = json.loads(match.group(0))

            if not isinstance(data, list):
                data = [data] if isinstance(data, dict) else []
            out = []
            for d in data[:8]:
                if not isinstance(d, dict):
                    continue
                name = (d.get("name") or "Tashxis").strip()
                prob = max(0, min(100, int(d.get("probability", 50))))
                rc = d.get("reasoningChain")
                if isinstance(rc, list):
                    reasoning_chain = [str(x).strip() for x in rc if str(x).strip()]
                elif isinstance(rc, str) and rc.strip():
                    reasoning_chain = [rc.strip()]
                else:
                    reasoning_chain = []
                out.append({
                    "name": name,
                    "probability": prob,
                    "justification": (d.get("justification") or "")[:500],
                    "evidenceLevel": (d.get("evidenceLevel") or "Moderate")[:50],
                    "reasoningChain": reasoning_chain,
                    "uzbekProtocolMatch": (d.get("uzbekProtocolMatch") or "")[:300],
                })
            if out:
                return out
        except Exception as e:
            logger.warning("Claude generate_diagnoses (model=%s) failed: %s", model_name, e)
    return []
