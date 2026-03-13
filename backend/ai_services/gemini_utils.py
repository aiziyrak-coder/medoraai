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

# Pro/Flash modellar (settings/.env: GEMINI_MODEL_PRO, GEMINI_MODEL_FLASH)
GEMINI_FLASH = getattr(settings, "GEMINI_MODEL_FLASH", "gemini-2.0-flash-exp")
GEMINI_PRO = getattr(settings, "GEMINI_MODEL_PRO", "gemini-2.5-pro")

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


def _response_text(response):
    """Extract text from generate_content response (SDK compatibility)."""
    text = getattr(response, "text", None)
    if text and str(text).strip():
        return str(text).strip()
    candidates = getattr(response, "candidates", None) or []
    if candidates:
        content = getattr(candidates[0], "content", None)
        if content:
            parts = getattr(content, "parts", None) or []
            if parts and hasattr(parts[0], "text"):
                return (parts[0].text or "").strip()
    return ""


def _call_gemini(prompt, model_name=GEMINI_FLASH, response_mime_type=None, max_output_tokens=8192):
    """Call Gemini via google-genai Client. Returns response text."""
    client = _get_client()
    if not client:
        raise RuntimeError("Gemini API key sozlanmagan. GEMINI_API_KEY ni .env ga kiriting.")
    config = {"temperature": 0.1, "max_output_tokens": max_output_tokens}
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
    text = _response_text(response)
    if not text:
        raise ValueError("Gemini bo'sh javob qaytardi")
    return text


def generate_clarifying_questions(patient_data):
    """
    Generate 3-8 clarifying questions. Raises if API key missing or all Gemini attempts fail.
    """
    if _get_client() is None:
        raise RuntimeError("Gemini API kaliti sozlanmagan. Serverni boshqaruvchi GEMINI_API_KEY ni backend/.env ga kiritsin.")
    text = _patient_text(patient_data)
    prompt = f"""Siz tibbiy yordamchi AI siz. Bemor ma'lumotlari:
{text}

MAJBURIY: Savollar FAQAT bemor SHIKOYATI (complaints) va yuqoridagi klinik ma'lumotlardan kelib chiqishi kerak.
Umumiy yoki oldindan tayyorlangan savollar BERMANG. Har bir savol shikoyat/simptomlar bilan bevosita bog'liq bo'lsin.
Masalan: agar shikoyat "bosh og'rig'i" bo'lsa — davomiyligi, qanday og'riq, qachon kuchayadi va h.k. shikoyatga oid savollar.

3–5 ta qisqa, aniq savol yozing. Mavjud ma'lumotlar uchun savol bermang.
AMALIY: Har bir savol shifokor keyingi qadamni aniq qilishiga yordam bersin (davomiylik, og'riq xususiyati, qachon kuchayadi va h.k.).
ANIQLIK: Savollar faqat shikoyat va klinik kontekstga bevosita bog'liq bo'lsin; umumiy yoki shablon savollar bermang.
Javobni faqat JSON massiv: ["Savol 1?", "Savol 2?"]. O'zbek tilida (Lotin)."""
    raw = None
    last_exc = None
    for model in (GEMINI_PRO, GEMINI_FLASH):
        for use_json in (False, True):
            try:
                raw = _call_gemini(
                    prompt, model,
                    response_mime_type="application/json" if use_json else None,
                )
                break
            except Exception as e:
                last_exc = e
                logger.warning("Gemini clarifying_questions (model=%s, use_json=%s) failed: %s", model, use_json, e)
        if raw:
            break
    if not raw and last_exc is not None:
        raise last_exc
    if not raw:
        return []
    # Clean up markdown code blocks and extra whitespace
    raw = (raw or "").replace("```json", "").replace("```", "").replace("```text", "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("Gemini clarifying_questions: invalid JSON (error=%s), raw=%s", e, raw[:500])
        # Try to extract array from text using regex
        import re
        match = re.search(r'\[[\s\S]*\]', raw)
        if match:
            try:
                data = json.loads(match.group(0))
                logger.info("Successfully extracted JSON array from malformed response")
            except json.JSONDecodeError:
                return []
        else:
            return []
    if isinstance(data, list):
        return [str(q) for q in data if q][:8]
    if isinstance(data, dict) and "questions" in data:
        return [str(q) for q in data["questions"] if q][:8]
    return []


def recommend_specialists(patient_data):
    """Recommend 5-8 specialists. Raises if key missing or all Gemini attempts fail."""
    if _get_client() is None:
        raise RuntimeError("Gemini API kaliti sozlanmagan. GEMINI_API_KEY ni backend/.env ga kiriting.")
    text = _patient_text(patient_data)
    names_str = ", ".join(SPECIALIST_NAMES[:40])
    prompt = f"""Bemor ma'lumotlari:
{text}

Ushbu klinik holat uchun 5–6 ta mutaxassis tanlang. Faqat quyidagi nomlardan: {names_str}.
Har biri uchun qisqa, aniq sabab bering (shikoyat yoki holatga nima uchun shu mutaxassis kerak). Javobni aniq quyidagi formatda JSON qaytaring:
{{ "recommendations": [ {{ "model": "Nom exactly from list", "reason": "Sabab" }} ] }}
O'zbek tilida (Lotin)."""
    last_exc = None
    for model_name in (GEMINI_PRO, GEMINI_FLASH):
        for use_json in (True, False):
            try:
                raw = _call_gemini(
                    prompt, model_name,
                    response_mime_type="application/json" if use_json else None,
                )
                # Clean up markdown code blocks and extra whitespace
                raw = (raw or "").replace("```json", "").replace("```", "").replace("```text", "").strip()
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError as e:
                    logger.warning("Gemini recommend_specialists: invalid JSON (error=%s), raw=%s", e, raw[:500])
                    # Try to extract object from text using regex
                    import re
                    match = re.search(r'\{[\s\S]*\}', raw)
                    if match:
                        try:
                            data = json.loads(match.group(0))
                            logger.info("Successfully extracted JSON object from malformed response")
                        except json.JSONDecodeError:
                            raise
                    else:
                        raise
                
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
                if out:
                    return out[:8]
            except Exception as e:
                last_exc = e
                logger.warning("Gemini recommend_specialists (model=%s, json=%s) failed: %s", model_name, use_json, e)
    if last_exc is not None:
        raise last_exc
    return []


def generate_diagnoses(patient_data):
    """Generate 3-8 differential diagnoses with probabilities. Returns [] on failure."""
    client = _get_client()
    if not client:
        return []
    text = _patient_text(patient_data)
    prompt = f"""Bemor ma'lumotlari:
{text}

3–5 ta eng ehtimol differensial tashxis. O'ZBEKISTON SSV klinik protokollari kontekstida.
Har biri uchun: name (o'zbekcha), probability (0–100), justification, evidenceLevel (High/Moderate/Low), reasoningChain (qisqa qadamlar massivi), uzbekProtocolMatch.
AMALIY: justification va reasoningChain dalilli va qisqa bo'lsin; uzbekProtocolMatch da SSV protokol nomi yoki yo'nalishi keltiring (masalan: Arterial gipertenziya bo'yicha SSV protokoliga muvofiq).
ANIQLIK: probability ni dalil kuchiga mos qo'ying; ma'lumot yetishmasa pastroq bering. Eng ehtimolini birinchi qo'ying. reasoningChain da har qadam "nima uchun" javob bersin. Taxminiy tashxisni yakuniy deb yozmang.
Javobni faqat JSON massiv qilib qaytaring, masalan:
[ {{ "name": "...", "probability": 70, "justification": "...", "evidenceLevel": "High", "reasoningChain": ["...", "..."], "uzbekProtocolMatch": "..." }} ]
O'zbek tilida (Lotin)."""
    # Try Flash first with JSON only to stay under proxy/gunicorn timeout (~30s)
    for use_json in (True, False):
        try:
            raw = _call_gemini(
                prompt, GEMINI_FLASH,
                response_mime_type="application/json" if use_json else None,
            )
            # Clean up markdown code blocks and extra whitespace
            raw = (raw or "").replace("```json", "").replace("```", "").replace("```text", "").strip()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError as e:
                logger.warning("Gemini generate_diagnoses: invalid JSON (error=%s), raw=%s", e, raw[:500])
                # Try to extract array from text using regex
                import re
                match = re.search(r'\[[\s\S]*\]', raw)
                if match:
                    try:
                        data = json.loads(match.group(0))
                        logger.info("Successfully extracted JSON array from malformed response")
                    except json.JSONDecodeError:
                        continue
                else:
                    continue
            
            if not isinstance(data, list):
                data = [data] if isinstance(data, dict) else []
            out = []
            for d in data[:8]:
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
            logger.warning("Gemini generate_diagnoses (flash, json=%s) failed: %s", use_json, e)
    return []
