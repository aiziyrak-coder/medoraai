"""
Klinik vositalar — backend AI (DeepSeek).
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import quote

logger = logging.getLogger(__name__)

LANG_LABELS = {
    "uz-L": "O'zbek (lotin)",
    "uz-C": "O'zbek (kirill)",
    "ru": "Rus",
    "en": "Ingliz",
    "kaa": "Qoraqalpoq",
}


def _lang(language: str) -> str:
    return LANG_LABELS.get(language or "uz-L", LANG_LABELS["uz-L"])


def strip_plain_text_markdown(text: str) -> str:
    """Bemor/oila tushuntirishida markdown belgilarini olib tashlaydi."""
    s = str(text or "")
    if not s.strip():
        return ""
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    s = s.replace("**", "")
    s = re.sub(r"__([^_]+)__", r"\1", s)
    s = s.replace("__", "")
    s = re.sub(r"^#{1,6}\s+", "", s, flags=re.MULTILINE)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _parse_json(raw: str) -> Any:
    text = (raw or "").replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"[\[{][\s\S]*[\]}]", text)
        if match:
            return json.loads(match.group(0))
        raise


def _call_text(prompt: str, system: str | None = None, max_tokens: int = 2048) -> str:
    from . import claude_utils

    return claude_utils._call_claude(
        prompt,
        claude_utils.CLAUDE_FAST,
        system=system,
        max_output_tokens=max_tokens,
    )


def _call_json(prompt: str, system: str | None = None, max_tokens: int = 2048) -> Any:
    raw = _call_text(prompt, system=system, max_tokens=max_tokens)
    return _parse_json(raw)


def _pubmed_url(term: str) -> str:
    return f"https://pubmed.ncbi.nlm.nih.gov/?term={quote(term)}"


def _try_vision(prompt: str, b64: str, mime: str, max_tokens: int = 2500) -> str | None:
    from django.conf import settings
    from . import claude_utils

    client = claude_utils._get_client()
    if not client or not b64:
        return None
    mime = (mime or "image/jpeg").strip()
    data_url = f"data:{mime};base64,{b64}"
    messages: list[dict[str, Any]] = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }
    ]
    try:
        resp = client.chat.completions.create(
            model=getattr(settings, "DEEPSEEK_MODEL_FAST", "deepseek-chat"),
            messages=messages,
            temperature=0.1,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception as exc:
        logger.warning("Vision call failed, fallback to text: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

def guideline_search(query: str, language: str) -> dict:
    lang = _lang(language)
    prompt = (
        f"Klinik qo'llanma bo'yicha '{query}' mavzusida xulosa yozing. "
        f"O'zbekiston SSV protokollari, WHO, ESC, ADA, NICE va boshqa xalqaro standartlarni hisobga oling. "
        f"Til: {lang}. "
        'FAQAT JSON: {"summary":"...","sources":[{"title":"protokol yoki jurnal","url":"https://...","snippet":"1 jumla"}]} '
        "sources kamida 3 ta, har birida ishlaydigan https URL (PubMed qidiruv ham bo'lishi mumkin)."
    )
    data = _call_json(prompt, max_tokens=3000)
    if not isinstance(data, dict):
        data = {"summary": str(data), "sources": []}
    sources = data.get("sources") or []
    if not isinstance(sources, list) or len(sources) < 2:
        term = quote(query)
        sources = [
            {"title": f"PubMed: {query}", "url": _pubmed_url(query), "snippet": "Maqolalar qidiruvi"},
            {"title": "WHO guidelines", "url": _pubmed_url(f"WHO {query} guideline"), "snippet": "Xalqaro qo'llanmalar"},
            {"title": "SSV O'zbekiston klinik protokollari", "url": _pubmed_url(f"Uzbekistan clinical protocol {query}"), "snippet": "Milliy protokollar"},
        ]
    return {"summary": str(data.get("summary") or ""), "sources": sources[:8]}


def drug_interactions(drugs: list[str], language: str) -> dict:
    lang = _lang(language)
    drug_list = ", ".join(d for d in drugs if d)
    prompt = (
        f"Dorilar o'zaro ta'siri: {drug_list}. Til: {lang}. "
        'FAQAT JSON: {"severity":"High|Moderate|Low|None","description":"...","clinicalSignificance":"...",'
        '"recommendations":["..."]}. severity inglizcha enum.'
    )
    raw = _call_json(prompt, max_tokens=2500)
    if not isinstance(raw, dict):
        raw = {}
    sev = str(raw.get("severity") or "Moderate")
    recs = raw.get("recommendations") or []
    if not isinstance(recs, list):
        recs = []
    return {
        "severity": sev,
        "description": str(raw.get("description") or ""),
        "clinicalSignificance": str(raw.get("clinicalSignificance") or ""),
        "recommendations": [str(r) for r in recs if r][:10],
    }


def ecg_analyze(b64: str, mime: str, language: str) -> dict:
    lang = _lang(language)
    prompt = (
        f"Siz kardiologsiz. EKG tasvirini tahlil qiling. Til: {lang}. "
        'FAQAT JSON: {"rhythm":"","heartRate":"","prInterval":"","qrsDuration":"","qtInterval":"",'
        '"axis":"","morphology":"","interpretation":""}. '
        "Aniq bo'lmagan parametrlarni 'aniqlanmadi' deb yozing."
    )
    vision_raw = _try_vision(prompt, b64, mime)
    if vision_raw:
        try:
            return _parse_json(vision_raw)
        except Exception:
            pass
    text = _call_text(
        f"{prompt}\n\nEslatma: tasvir piksellari mavjud emas; fayl turi {mime}. "
        "Umumiy EKG o'qish tamoyillariga asoslangan ehtiyotkor dastlabki xulosa bering.",
        max_tokens=1800,
    )
    try:
        return _parse_json(text)
    except Exception:
        return {
            "rhythm": "aniqlanmadi",
            "heartRate": "aniqlanmadi",
            "prInterval": "aniqlanmadi",
            "qrsDuration": "aniqlanmadi",
            "qtInterval": "aniqlanmadi",
            "axis": "aniqlanmadi",
            "morphology": "aniqlanmadi",
            "interpretation": text[:1500],
        }


def uzi_utt_analyze(
    files: list[dict[str, Any]],
    language: str,
    clinical_context: str = "",
) -> dict:
    lang = _lang(language)
    names = ", ".join(str(f.get("fileName") or f.get("name") or "fayl") for f in files[:6])
    ctx = (clinical_context or "").strip()
    schema = (
        '{"studyType":"","regionOrOrgan":"","techniqueNotes":"","keyFindings":[],"measurements":"",'
        '"impression":"","clinicalConclusion":"","recommendations":[],"differentialDiagnosis":"",'
        '"limitations":"","urgencyLevel":"routine|soon|urgent|emergent"}'
    )
    prompt = (
        f"UZI/UTT/rentgen/PDF tahlil. Fayllar: {names}. Klinik kontekst: {ctx[:800]}. Til: {lang}. "
        f"FAQAT JSON: {schema}"
    )
    first = files[0] if files else {}
    b64 = str(first.get("base64Data") or first.get("base64_data") or "").split(",")[-1]
    mime = str(first.get("mimeType") or first.get("mime_type") or "image/jpeg")
    vision_raw = _try_vision(prompt, b64, mime, max_tokens=3500) if b64 and "pdf" not in mime.lower() else None
    if vision_raw:
        try:
            return _parse_json(vision_raw)
        except Exception:
            pass
    return _call_json(
        f"{prompt}\n\nTasvir piksellari cheklangan — fayl nomi va kontekst asosida ehtiyotkor radiologik xulosa.",
        max_tokens=3500,
    )


def icd10_codes(diagnosis: str, language: str) -> list[dict]:
    lang = _lang(language)
    data = _call_json(
        f'ICD-10 kodlari "{diagnosis}" uchun. Til: {lang}. '
        'FAQAT JSON massiv: [{"code":"...","description":"..."}]',
        max_tokens=1200,
    )
    if not isinstance(data, list):
        return []
    out = []
    for item in data[:12]:
        if isinstance(item, dict) and item.get("code"):
            out.append({"code": str(item["code"]), "description": str(item.get("description") or "")})
    return out


def lab_interpret(lab_value: str, language: str) -> str:
    lang = _lang(language)
    return _call_text(
        f'Laboratoriya natijasi: "{lab_value}". O\'zbekiston LITS/SI birliklari. Klinik ahamiyat. Til: {lang}.',
        max_tokens=1500,
    )


def patient_explain(clinical_text: str, language: str) -> str:
    lang = _lang(language)
    raw = _call_text(
        f'Murakkab tibbiy matnni bemor va oilasi uchun sodda tilda yozing: "{clinical_text}". '
        f"Til: {lang}. FAQAT oddiy matn — markdown YO'Q (** ## __ * ` belgilari ishlatmang). "
        "Sarlavhalar uchun qalin yozuv o'rniga yangi qator va qisqa sarlavha matni ishlating.",
        max_tokens=1500,
    )
    return strip_plain_text_markdown(raw)


def expand_abbrev(abbreviation: str, language: str) -> str:
    lang = _lang(language)
    return _call_text(
        f'Tibbiy qisqartma "{abbreviation}" — to\'liq shakl va ma\'nosi. Til: {lang}.',
        max_tokens=800,
    )


def discharge_summary(patient: dict, report: dict, language: str) -> str:
    lang = _lang(language)
    return _call_text(
        f"Kasalxonadan chiqish xulosasi. Bemor: {json.dumps(patient, ensure_ascii=False)[:3000]}. "
        f"Hisobot: {json.dumps(report, ensure_ascii=False)[:4000]}. Til: {lang}. Rasmiy tibbiy hujjat formati.",
        max_tokens=3000,
    )


def insurance_preauth(patient: dict, report: dict, procedure: str, language: str) -> str:
    lang = _lang(language)
    return _call_text(
        f"Sug'urta pre-auth xati. Muolaja: {procedure}. Bemor: {json.dumps(patient, ensure_ascii=False)[:2500]}. "
        f"Hisobot: {json.dumps(report, ensure_ascii=False)[:3000]}. Til: {lang}.",
        max_tokens=2500,
    )


def pediatric_dose(drug_name: str, weight_kg: float, language: str) -> dict:
    lang = _lang(language)
    data = _call_json(
        f"Pediatrik doza: {drug_name}, vazn {weight_kg} kg. mg/kg hisob-kitob ko'rsating. Til: {lang}. "
        'JSON: {"drugName":"","dose":"","calculation":"","warnings":[]}',
        max_tokens=1500,
    )
    if not isinstance(data, dict):
        data = {}
    warnings = data.get("warnings") or []
    return {
        "drugName": str(data.get("drugName") or drug_name),
        "dose": str(data.get("dose") or ""),
        "calculation": str(data.get("calculation") or ""),
        "warnings": [str(w) for w in warnings if w] if isinstance(warnings, list) else [],
    }


def risk_score_interpret(score_type: str, score_value: int | str, factors: dict, language: str) -> dict:
    lang = _lang(language)
    data = _call_json(
        f"{score_type} balli {score_value}. Omillar: {json.dumps(factors, ensure_ascii=False)}. "
        f"Klinik talqin va tavsiyalar. Til: {lang}. JSON: {{\"name\":\"\",\"score\":\"\",\"interpretation\":\"\"}}",
        max_tokens=1200,
    )
    if not isinstance(data, dict):
        data = {}
    return {
        "name": str(data.get("name") or score_type),
        "score": str(data.get("score") or score_value),
        "interpretation": str(data.get("interpretation") or ""),
    }


TOOL_HANDLERS = {
    "guideline-search": lambda body, lang: guideline_search(str(body.get("query") or ""), lang),
    "drug-interactions": lambda body, lang: drug_interactions(list(body.get("drugs") or []), lang),
    "ecg": lambda body, lang: ecg_analyze(
        str(body.get("base64Data") or body.get("base64_data") or "").split(",")[-1],
        str(body.get("mimeType") or body.get("mime_type") or "image/jpeg"),
        lang,
    ),
    "uzi-utt": lambda body, lang: uzi_utt_analyze(list(body.get("files") or []), lang, str(body.get("clinicalContext") or "")),
    "icd10": lambda body, lang: icd10_codes(str(body.get("diagnosis") or ""), lang),
    "lab-interpret": lambda body, lang: {"text": lab_interpret(str(body.get("labValue") or ""), lang)},
    "patient-explain": lambda body, lang: {"text": patient_explain(str(body.get("clinicalText") or ""), lang)},
    "abbreviation": lambda body, lang: {"text": expand_abbrev(str(body.get("abbreviation") or ""), lang)},
    "discharge-summary": lambda body, lang: {
        "text": discharge_summary(body.get("patientData") or {}, body.get("finalReport") or {}, lang)
    },
    "insurance-preauth": lambda body, lang: {
        "text": insurance_preauth(
            body.get("patientData") or {},
            body.get("finalReport") or {},
            str(body.get("procedure") or ""),
            lang,
        )
    },
    "pediatric-dose": lambda body, lang: pediatric_dose(
        str(body.get("drugName") or ""),
        float(body.get("weightKg") or body.get("weight_kg") or 0),
        lang,
    ),
    "risk-score": lambda body, lang: risk_score_interpret(
        str(body.get("scoreType") or ""),
        body.get("scoreValue") or body.get("score") or 0,
        body.get("factors") if isinstance(body.get("factors"), dict) else {},
        lang,
    ),
}
