"""
Gemini API helpers for AI Services.
Uses google-genai (official SDK). API key from settings.GEMINI_API_KEY.
"""
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Lazy client (api_key stripped in settings)
_client = None

def _get_client():
    global _client
    if _client is not None:
        return _client
    key = getattr(settings, "GEMINI_API_KEY", None) or ""
    key = (key or "").strip()
    if not key:
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=key)
        return _client
    except ImportError:
        logger.warning("google-genai not installed: pip install google-genai")
        return None

# Model names (Gemini 1.5 free tier)
GEMINI_FLASH = getattr(settings, "GEMINI_MODEL_FLASH", "gemini-1.5-flash")
GEMINI_PRO = getattr(settings, "GEMINI_MODEL_PRO", "gemini-1.5-pro")

SPECIALIST_NAMES = [
    "Gemini", "Claude", "GPT-4o", "Llama 3", "Grok",
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
]


def _patient_text(patient_data):
    """Build plain text summary of patient data (no base64)."""
    d = patient_data or {}
    parts = [
        f"Bemor: {d.get('firstName', '')} {d.get('lastName', '')}, {d.get('age', '')} yosh, {d.get('gender', '')}.",
        f"Shikoyatlar: {d.get('complaints', '')}",
    ]
    if d.get("history"):
        parts.append(f"Anamnez: {d['history']}")
    if d.get("objectiveData"):
        parts.append(f"Ob'ektiv: {d['objectiveData']}")
    if d.get("labResults"):
        parts.append(f"Lab: {d['labResults']}")
    if d.get("allergies"):
        parts.append(f"Allergiya: {d['allergies']}")
    if d.get("currentMedications"):
        parts.append(f"Dori-darmonlar: {d['currentMedications']}")
    if d.get("familyHistory"):
        parts.append(f"Oila anamnezi: {d['familyHistory']}")
    if d.get("additionalInfo"):
        parts.append(f"Qo'shimcha: {d['additionalInfo']}")
    return "\n".join(parts)


def _call_gemini(prompt, model_name=GEMINI_FLASH, response_mime_type=None):
    """Call Gemini via google-genai Client. Returns response text."""
    client = _get_client()
    if not client:
        raise RuntimeError("Gemini API key sozlanmagan. GEMINI_API_KEY ni .env ga kiriting.")
    config = {"temperature": 0.1}
    if response_mime_type:
        config["response_mime_type"] = response_mime_type
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config,
        )
    except Exception as e:
        logger.exception("Gemini API xatosi: %s", e)
        raise
    text = getattr(response, "text", None) or ""
    if not (text and text.strip()):
        raise ValueError("Gemini bo'sh javob qaytardi")
    return text.strip()


def generate_clarifying_questions(patient_data):
    """
    Generate 3-8 clarifying questions. Returns [] on failure so frontend does not get 500.
    """
    try:
        text = _patient_text(patient_data)
        prompt = f"""Siz tibbiy yordamchi AI siz. Bemor ma'lumotlari:
{text}

Quyidagilarga asoslangan holda 3–5 ta QISQA, ANIQ aniqlashtiruvchi savol yozing.
PRIORITY 1: Allergiya, joriy dori-darmonlar, homiladorlik/emizish (agar mavzu bo'lsa).
PRIORITY 2: Vital belgilar (qon bosimi, puls, harorat), asosiy lab qiymatlari.
PRIORITY 3: Simptomlar davomiyligi, oldingi o'xshash epizodlar, oila anamnezi.

Mavjud ma'lumotlar uchun savol bermang. Javobni faqat JSON massiv sifatida qaytaring, masalan: ["Savol 1?", "Savol 2?"].
O'zbek tilida (Lotin)."""
        raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
        raw = (raw or "").replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(q) for q in data if q][:8]
        if isinstance(data, dict) and "questions" in data:
            return [str(q) for q in data["questions"] if q][:8]
        return []
    except json.JSONDecodeError:
        logger.warning("Gemini clarifying_questions: invalid JSON")
        return []
    except Exception:
        logger.exception("Gemini clarifying_questions failed")
        return []


def recommend_specialists(patient_data):
    """Recommend 5-8 specialists. Returns list of {model, reason}."""
    try:
        text = _patient_text(patient_data)
        names_str = ", ".join(SPECIALIST_NAMES[:40])
        prompt = f"""Bemor ma'lumotlari:
{text}

Ushbu klinik holat uchun 5–6 ta mutaxassis tanlang. Faqat quyidagi nomlardan: {names_str}.
Har biri uchun qisqa sabab bering. Javobni aniq quyidagi formatda JSON qaytaring:
{{ "recommendations": [ {{ "model": "Nom exactly from list", "reason": "Sabab" }} ] }}
O'zbek tilida (Lotin)."""
        raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
        raw = (raw or "").replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)
        recs = (data or {}).get("recommendations") or []
        out = []
        for r in recs:
            model = (r.get("model") or "").strip()
            if model not in SPECIALIST_NAMES:
                for n in SPECIALIST_NAMES:
                    if n.lower() in model.lower() or model.lower() in n.lower():
                        model = n
                        break
            if model in SPECIALIST_NAMES:
                out.append({"model": model, "reason": (r.get("reason") or "Holatga mos.")[:200]})
        return out[:8]
    except Exception:
        logger.exception("Gemini recommend_specialists failed")
        return []


def generate_diagnoses(patient_data):
    """Generate 3-8 differential diagnoses with probabilities."""
    try:
        text = _patient_text(patient_data)
        prompt = f"""Bemor ma'lumotlari:
{text}

3–5 ta eng ehtimol differensial tashxis. O'ZBEKISTON SSV klinik protokollari kontekstida.
Har biri uchun: name (o'zbekcha), probability (0–100), justification, evidenceLevel (High/Moderate/Low), reasoningChain (qisqa qadamlar massivi), uzbekProtocolMatch.
Javobni faqat JSON massiv qilib qaytaring, masalan:
[ {{ "name": "...", "probability": 70, "justification": "...", "evidenceLevel": "High", "reasoningChain": ["...", "..."], "uzbekProtocolMatch": "..." }} ]
O'zbek tilida (Lotin)."""
        raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
        raw = (raw or "").replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)
        if not isinstance(data, list):
            data = [data] if isinstance(data, dict) else []
        out = []
        for d in data[:8]:
            name = (d.get("name") or "Tashxis").strip()
            prob = max(0, min(100, int(d.get("probability", 50))))
            out.append({
                "name": name,
                "probability": prob,
                "justification": (d.get("justification") or "")[:500],
                "evidenceLevel": (d.get("evidenceLevel") or "Moderate")[:50],
                "reasoningChain": d.get("reasoningChain") or [],
                "uzbekProtocolMatch": (d.get("uzbekProtocolMatch") or "")[:300],
            })
        return out
    except Exception:
        logger.exception("Gemini generate_diagnoses failed")
        return []
