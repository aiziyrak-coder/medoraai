"""
AI helpers — OpenAI API (matn: konsilium, tashxis, savollar).
API key: settings.OPENAI_API_KEY
"""
import hashlib
import json
import logging
import re

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

_client = None

CLAUDE_FAST = "gpt-4o-mini"
CLAUDE_PRO = "gpt-4o"


def _api_key() -> str:
    return (getattr(settings, "OPENAI_API_KEY", None) or "").strip()


def _ai_cost_mode():
    return (getattr(settings, "AI_COST_MODE", "scale") or "scale").strip().lower()


def _default_max_tokens():
    return {
        "scale": 2048,
        "economy": 2048,
        "balanced": 3072,
        "quality": 8192,
    }.get(_ai_cost_mode(), 2048)


def _fast_model():
    return getattr(settings, "OPENAI_MODEL_FAST", None) or "gpt-4o-mini"


def _pro_model():
    return getattr(settings, "OPENAI_MODEL_PRO", None) or "gpt-4o"


def _model_fast():
    return _fast_model()


def _model_pro():
    mode = _ai_cost_mode()
    if mode in ("scale", "economy"):
        return _fast_model()
    if mode == "balanced":
        return _pro_model()
    return _pro_model()


def _model_diagnosis():
    mode = _ai_cost_mode()
    if mode in ("scale", "economy"):
        return _fast_model()
    return _pro_model()


def _cache_key(prefix: str, text: str) -> str:
    digest = hashlib.sha256((text or "").encode("utf-8", errors="ignore")).hexdigest()[:32]
    return f"openai:{prefix}:{digest}"


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
    key = _api_key()
    if not key:
        return None
    try:
        from openai import OpenAI

        base_url = (getattr(settings, "OPENAI_BASE_URL", None) or "").strip()
        kwargs: dict = {"api_key": key}
        if base_url:
            kwargs["base_url"] = base_url
        _client = OpenAI(**kwargs)
        return _client
    except ImportError:
        logger.warning("openai not installed: pip install openai")
        return None


def _patient_text(patient_data, extra=None):
    from .clinical_context import build_clinical_context
    return build_clinical_context(patient_data, extra)


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
    client = _get_client()
    if not client:
        raise RuntimeError(
            "OpenAI API kaliti sozlanmagan. OPENAI_API_KEY ni backend/.env ga kiriting."
        )

    user_content = prompt
    if response_mime_type == "application/json" and isinstance(prompt, str):
        if "faqat json" not in prompt.lower() and "only json" not in prompt.lower():
            user_content = f"{prompt}\n\nMuhim: Javobni FAQAT toza JSON formatida qaytaring."

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user_content})

    kwargs = {
        "model": _resolve_model(model_name),
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": max_output_tokens,
    }
    try:
        response = client.chat.completions.create(**kwargs)
    except Exception as e:
        logger.exception("OpenAI API xatosi: %s", e)
        raise

    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise ValueError("OpenAI bo'sh javob qaytardi")
    return text


def generate_clarifying_questions(patient_data):
    if _get_client() is None:
        raise RuntimeError(
            "OpenAI API kaliti sozlanmagan. OPENAI_API_KEY ni backend/.env ga kiriting."
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
    try:
        raw = _call_claude(
            prompt,
            CLAUDE_FAST,
            response_mime_type="application/json",
            max_output_tokens=768,
        )
    except Exception as e:
        logger.warning("OpenAI clarifying_questions failed: %s", e)
        return []

    raw = (raw or "").replace("```json", "").replace("```", "").replace("```text", "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("OpenAI clarifying_questions: invalid JSON (error=%s), raw=%s", e, raw[:500])
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
        raise RuntimeError(
            "OpenAI API kaliti sozlanmagan. OPENAI_API_KEY ni .env ga kiriting."
        )
    text = _patient_text(patient_data)
    names_str = ", ".join(SPECIALIST_NAMES[:40])
    prompt = f"""Bemor ma'lumotlari:
{text}

Ushbu klinik holat uchun 6–8 ta mutaxassis tanlang. Faqat quyidagi nomlardan: {names_str}.
Har biri uchun qisqa sabab. JSON:
{{ "recommendations": [ {{ "model": "Nom exactly from list", "reason": "Sabab" }} ] }}
O'zbek tilida (Lotin)."""
    try:
        raw = _call_claude(
            prompt,
            CLAUDE_FAST,
            response_mime_type="application/json",
            max_output_tokens=1024,
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
        logger.warning("OpenAI recommend_specialists failed: %s", e)
        raise
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

    try:
        raw = _call_claude(
            prompt,
            _model_diagnosis(),
            response_mime_type="application/json",
            max_output_tokens=min(_default_max_tokens(), 2048),
        )
        raw = (raw or "").replace("```json", "").replace("```", "").strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\[[\s\S]*\]", raw)
            if not match:
                return []
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
        return out
    except Exception as e:
        logger.warning("OpenAI generate_diagnoses failed: %s", e)
    return []
