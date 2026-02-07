"""
Gemini API helpers for AI Services.
Uses real Gemini; no mock data.
"""
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

genai = None
if getattr(settings, 'GEMINI_API_KEY', None):
    try:
        import google.generativeai as _genai
        _genai.configure(api_key=settings.GEMINI_API_KEY)
        genai = _genai
    except ImportError:
        pass

# Model names (use 1.5 if 3.x not available on server)
GEMINI_FLASH = getattr(settings, 'GEMINI_MODEL_FLASH', 'gemini-1.5-flash')
GEMINI_PRO = getattr(settings, 'GEMINI_MODEL_PRO', 'gemini-1.5-pro')

# Valid specialist names for recommendations (must match frontend AIModel enum)
SPECIALIST_NAMES = [
    'Gemini', 'Claude', 'GPT-4o', 'Llama 3', 'Grok',
    'Allergist', 'Anesthesiology', 'Dermatologist', 'Emergency', 'Family Medicine',
    'Gastroenterologist', 'Geneticist', 'Geriatrician', 'Hematologist', 'Infectious',
    'Internal Medicine', 'Nephrologist', 'ObGyn', 'Ophthalmologist', 'Orthopedic',
    'Otolaryngologist', 'Pathologist', 'Pediatrician', 'Pharmacologist', 'Physiatrist',
    'Plastic Surgeon', 'Psychiatrist', 'Pulmonologist', 'Rheumatologist', 'Surgeon', 'Urologist',
    'Neonatologist', 'Neurosurgeon', 'Cardiothoracic Surgeon', 'Vascular Surgeon', 'Traumatologist',
    'Toxicologist', 'Sports Medicine', 'Sleep Medicine', 'Pain Management', 'Nutritionist',
    'Immunologist', 'Hepatologist', 'Epidemiologist', 'Dentist', 'Maxillofacial',
    'Proctologist', 'Mammologist', 'Phthisiatrician', 'Narcologist', 'Psychotherapist',
    'Sexologist', 'Vertebrologist',
]


def _patient_text(patient_data):
    """Build plain text summary of patient data (no base64)."""
    d = patient_data or {}
    parts = [
        f"Bemor: {d.get('firstName', '')} {d.get('lastName', '')}, {d.get('age', '')} yosh, {d.get('gender', '')}.",
        f"Shikoyatlar: {d.get('complaints', '')}",
    ]
    if d.get('history'):
        parts.append(f"Anamnez: {d['history']}")
    if d.get('objectiveData'):
        parts.append(f"Ob'ektiv: {d['objectiveData']}")
    if d.get('labResults'):
        parts.append(f"Lab: {d['labResults']}")
    if d.get('allergies'):
        parts.append(f"Allergiya: {d['allergies']}")
    if d.get('currentMedications'):
        parts.append(f"Dori-darmonlar: {d['currentMedications']}")
    if d.get('familyHistory'):
        parts.append(f"Oila anamnezi: {d['familyHistory']}")
    if d.get('additionalInfo'):
        parts.append(f"Qo'shimcha: {d['additionalInfo']}")
    return "\n".join(parts)


def _call_gemini(prompt, model_name=GEMINI_FLASH, response_mime_type=None):
    if not genai:
        raise RuntimeError("Gemini API key sozlanmagan")
    model = genai.GenerativeModel(model_name)
    config = {"temperature": 0.1}
    if response_mime_type:
        config["response_mime_type"] = response_mime_type
    response = model.generate_content(prompt, generation_config=config)
    if not response.text:
        raise ValueError("Gemini bo'sh javob qaytardi")
    return response.text.strip()


def generate_clarifying_questions(patient_data):
    """
    Generate 3-8 clarifying questions based on patient data.
    
    Args:
        patient_data (dict): Patient clinical data
    
    Returns:
        list[str]: List of clarifying questions in Uzbek
    
    Raises:
        RuntimeError: If Gemini API fails
    """
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
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Gemini clarifying_questions: invalid JSON %s", raw[:200])
        return []
    if isinstance(data, list):
        return [str(q) for q in data if q][:8]
    return []


def recommend_specialists(patient_data):
    """
    Recommend 5-8 specialists based on patient case.
    
    Args:
        patient_data (dict): Patient clinical data
    
    Returns:
        list[dict]: Specialists with 'model' (name) and 'reason' (justification)
    
    Raises:
        RuntimeError: If Gemini API fails
    """
    text = _patient_text(patient_data)
    names_str = ", ".join(SPECIALIST_NAMES[:40])  # first 40 to fit context
    prompt = f"""Bemor ma'lumotlari:
{text}

Ushbu klinik holat uchun 5–6 ta mutaxassis tanlang. Faqat quyidagi nomlardan tanlang (boshqa yozma): {names_str}.
Har biri uchun qisqa sabab bering. Javobni aniq quyidagi formatda JSON qaytaring:
{{ "recommendations": [ {{ "model": "Nom exactly from list", "reason": "Sabab" }} ] }}
O'zbek tilida (Lotin)."""
    raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Gemini recommend_specialists: invalid JSON %s", raw[:200])
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
            out.append({"model": model, "reason": (r.get("reason") or "Holatga mos.")[:200]})
    return out[:8]


def generate_diagnoses(patient_data):
    """
    Generate 3-8 differential diagnoses with probabilities.
    
    Args:
        patient_data (dict): Patient clinical data
    
    Returns:
        list[dict]: Diagnoses with name, probability, justification, reasoningChain, etc.
    
    Raises:
        RuntimeError: If Gemini API fails
    """
    text = _patient_text(patient_data)
    prompt = f"""Bemor ma'lumotlari:
{text}

3–5 ta eng ehtimol differensial tashxis chiqaring. O'ZBEKISTON SSV klinik protokollari kontekstida.
Har biri uchun: name (o'zbekcha), probability (0–100), justification, evidenceLevel (High/Moderate/Low), reasoningChain (qisqa qadamlar massivi), uzbekProtocolMatch (SSV protokoliga muvofiqlik).
Javobni faqat JSON massiv qilib qaytaring, masalan:
[ {{ "name": "...", "probability": 70, "justification": "...", "evidenceLevel": "High", "reasoningChain": ["...", "..."], "uzbekProtocolMatch": "..." }} ]
O'zbek tilida (Lotin)."""
    raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Gemini generate_diagnoses: invalid JSON %s", raw[:200])
        return []
    if not isinstance(data, list):
        data = [data] if isinstance(data, dict) else []
    out = []
    for d in data[:8]:
        name = (d.get("name") or "Tashxis").strip()
        prob = int(d.get("probability", 50))
        prob = max(0, min(100, prob))
        out.append({
            "name": name,
            "probability": prob,
            "justification": (d.get("justification") or "")[:500],
            "evidenceLevel": (d.get("evidenceLevel") or "Moderate")[:50],
            "reasoningChain": d.get("reasoningChain") or [],
            "uzbekProtocolMatch": (d.get("uzbekProtocolMatch") or "")[:300],
        })
    return out
