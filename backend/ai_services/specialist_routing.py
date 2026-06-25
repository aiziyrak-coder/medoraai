"""
Kasallik kontekstiga mos mutaxassis va konsilium agentlarini tanlash.
AI chaqiruvsiz — deterministik kalit so'z + DDx skorlash.
"""
from __future__ import annotations

import re
from typing import Any

from .azure_utils import patient_text

# Frontend AIModel / API nomlari → backend professor agent id
_SPECIALIST_TO_AGENT: dict[str, list[str]] = {
    # Nevrologiya / mantiq
    "claude": ["deepseek"],
    "neurologist": ["deepseek"],
    "deepseek": ["deepseek"],
    "psychiatrist": ["deepseek"],
    "geriatrician": ["deepseek"],
    "sleep medicine": ["deepseek"],
    "neurosurgeon": ["deepseek"],
    # Onkologiya / dalil
    "llama": ["llama"],
    "llama 3": ["llama"],
    "oncologist": ["llama"],
    "hematologist": ["llama"],
    "pathologist": ["llama"],
    # Gastro / protokollar
    "gastroenterologist": ["mistral"],
    "gastro": ["mistral"],
    "hepatologist": ["mistral"],
    "proctologist": ["mistral"],
    "mistral": ["mistral"],
    # Farmakologiya
    "pharmacologist": ["mini"],
    "mini": ["mini"],
    "toxicologist": ["mini"],
    # Kardiologiya / terapiya → mantiq agenti
    "cardiologist": ["deepseek"],
    "gemini": ["deepseek"],
    "internal medicine": ["deepseek"],
    "family medicine": ["mistral"],
    # Nafas
    "pulmonologist": ["mistral"],
    "phthisiatrician": ["mistral"],
    # Endokrin / metabolik
    "endocrinologist": ["deepseek"],
    "grok": ["deepseek"],
    "nutritionist": ["mistral"],
    # Buyrak / urolog
    "nephrologist": ["mistral"],
    "urologist": ["mistral"],
    # Jarrohlik / travma
    "surgeon": ["llama"],
    "traumatologist": ["llama"],
    "orthopedic": ["llama"],
    # Ko'z / LOR / teri
    "ophthalmologist": ["deepseek"],
    "otolaryngologist": ["mistral"],
    "dermatologist": ["mistral"],
    "allergist": ["mini"],
    "immunologist": ["mini"],
    # Pediatriya / akusher
    "pediatrician": ["mistral"],
    "obgyn": ["mistral"],
    # Radiologiya
    "radiologist": ["llama"],
    "gpt": ["llama"],
    "gpt-4o": ["llama"],
    # Shoshilinch
    "emergency": ["deepseek", "mini"],
}

# Kasallik kalit so'zlari → frontend mutaxassis nomlari (API format)
_KEYWORD_SPECIALISTS: list[tuple[re.Pattern[str], list[str]]] = [
    (re.compile(r"\b(yurak|qon\s*bosimi|puls|aritmiya|stenokardiya|infarkt|kardiolog|gipertoniya|koronar|ekg|miokard)\b", re.I),
     ["Cardiologist", "Internal Medicine"]),
    (re.compile(r"\b(bosh\s*og'?riq|nevrolog|falaj|epilepsiya|insult|migren|parkinson|dementsiya|demensiya|altsgeymer|neyropatiya|radikulit|asab)\b", re.I),
     ["Neurologist", "Psychiatrist"]),
    (re.compile(r"\b(rentgen|mrt|mri|ct|tasvir|radiolog|uzi|utt|tomografiya)\b", re.I),
     ["Radiologist"]),
    (re.compile(r"\b(o'?sma|saraton|onkolog|metastaz|tumor|xemoterapiya|leykemiya|limfoma)\b", re.I),
     ["Oncologist", "Hematologist"]),
    (re.compile(r"\b(qand|gormon|tiroid|endokrin|diabet|insulin|giperglikemiya)\b", re.I),
     ["Endocrinologist"]),
    (re.compile(r"\b(nafas|o'?pka|bronx|pnevmoniya|astma|spo2|tuberkulez|sil)\b", re.I),
     ["Pulmonologist"]),
    (re.compile(r"\b(jigar|oshqozon|ichak|gastrit|gepatit|pankreas|cirroz|qorin)\b", re.I),
     ["Gastroenterologist"]),
    (re.compile(r"\b(buyrak|siydik|nefrit|dializ|kreatinin)\b", re.I),
     ["Nephrologist"]),
    (re.compile(r"\b(urolog|prostat|tsistit)\b", re.I),
     ["Urologist"]),
    (re.compile(r"\b(teri|dermato|qichima|ekzema|psoriaz)\b", re.I),
     ["Dermatologist"]),
    (re.compile(r"\b(allergiya|anafilaksiya|urtikariya)\b", re.I),
     ["Allergist"]),
    (re.compile(r"\b(suyak|tizza|bo'?yin|bel|ortoped|artroz|artrit|sinish)\b", re.I),
     ["Orthopedic", "Traumatologist"]),
    (re.compile(r"\b(ko'?z|glaukoma|katarakta|oftalmolog)\b", re.I),
     ["Ophthalmologist"]),
    (re.compile(r"\b(quloq|tomoq|burun|lor|tonzillit|otit|sinusit)\b", re.I),
     ["Otolaryngologist"]),
    (re.compile(r"\b(psix|depressiya|ruhiy|stress|anksiyete)\b", re.I),
     ["Psychiatrist"]),
    (re.compile(r"\b(homilador|tug'?ruq|bachadon|gestoz)\b", re.I),
     ["ObGyn"]),
    (re.compile(r"\b(bola|chaqaloq|pediatr)\b", re.I),
     ["Pediatrician"]),
    (re.compile(r"\b(dori|darmon|doza|antibiotik|retsept)\b", re.I),
     ["Pharmacologist"]),
    (re.compile(r"\b(shoshilinch|krizis|reanimatsiya|travma|qon\s*ketish)\b", re.I),
     ["Emergency"]),
    (re.compile(r"\b(yuqumli|infeksiya|virus|covid|sepsis)\b", re.I),
     ["Infectious"]),
    (re.compile(r"\b(revmatik|lyupus|revmatoid|podagra)\b", re.I),
     ["Rheumatologist"]),
    (re.compile(r"\b(appenditsit|jarrohlik|operatsiya)\b", re.I),
     ["Surgeon"]),
]

_DDX_PATTERNS: list[tuple[re.Pattern[str], list[str]]] = [
    (re.compile(r"nefr|renal|kidney|buyrak", re.I), ["Nephrologist"]),
    (re.compile(r"kardio|yurak|koronar|infarkt|aritm", re.I), ["Cardiologist"]),
    (re.compile(r"nevro|insult|stroke|epilep|demen|parkinson", re.I), ["Neurologist"]),
    (re.compile(r"pulmon|pnevmon|astma|nafas|o'?pka", re.I), ["Pulmonologist"]),
    (re.compile(r"gastro|jigar|hepat|pankreat|oshqozon", re.I), ["Gastroenterologist"]),
    (re.compile(r"diabet|endokrin|tireoid|tiroid|gormon", re.I), ["Endocrinologist"]),
    (re.compile(r"onko|saraton|cancer|tumor|leykem", re.I), ["Oncologist"]),
    (re.compile(r"psix|depress|anksiyet", re.I), ["Psychiatrist"]),
    (re.compile(r"gemat|anem|leykem", re.I), ["Hematologist"]),
]


def _norm_specialist_key(name: str) -> str:
    return re.sub(r"[\s_-]+", " ", str(name or "").strip().lower())


def _score_specialists(text: str, diagnoses: list | None = None) -> dict[str, int]:
    scores: dict[str, int] = {}
    blob = (text or "").strip()
    if not blob:
        return scores

    def add(models: list[str], pts: int) -> None:
        for m in models:
            scores[m] = scores.get(m, 0) + pts

    for pattern, models in _KEYWORD_SPECIALISTS:
        if pattern.search(blob):
            add(models, 3)

    for dx in diagnoses or []:
        if not isinstance(dx, dict):
            continue
        dx_text = f"{dx.get('name', '')} {dx.get('justification', '')}"
        for pattern, models in _DDX_PATTERNS:
            if pattern.search(dx_text):
                add(models, 4)

    return scores


def recommend_specialists_scored(
    patient_data: dict,
    differential_diagnoses: list | None = None,
    *,
    min_count: int = 3,
    max_count: int = 8,
) -> list[dict[str, str]]:
    """Faqat tegishli mutaxassislarni qaytaradi — aloqasiz default to'ldirish yo'q."""
    text = patient_text(patient_data)
    scores = _score_specialists(text, differential_diagnoses)

    if not scores:
        return [{"model": "Internal Medicine", "reason": "Umumiy klinik baholash"}]

    ranked = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    out: list[dict[str, str]] = []
    for model, pts in ranked[:max_count]:
        reason = "Kasallik bo'yicha tavsiya" if pts >= 3 else "DDx bo'yicha tavsiya"
        out.append({"model": model, "reason": reason})

    if len(out) < min_count and "Internal Medicine" not in {r["model"] for r in out}:
        out.append({"model": "Internal Medicine", "reason": "Asosiy klinik koordinator"})

    return out[:max_count]


def agent_ids_for_specialists(
    selected_specialists: list[Any] | None,
    patient_data: dict | None = None,
    differential_diagnoses: list | None = None,
) -> list[str]:
    """Tanlangan mutaxassislardan backend professor agent idlari."""
    ids: list[str] = []
    seen: set[str] = set()

    def push(agent_id: str) -> None:
        if agent_id and agent_id not in seen:
            seen.add(agent_id)
            ids.append(agent_id)

    for raw in selected_specialists or []:
        key = _norm_specialist_key(str(raw))
        for agent_id in _SPECIALIST_TO_AGENT.get(key, []):
            push(agent_id)

    if len(ids) < 2 and patient_data:
        recs = recommend_specialists_scored(patient_data, differential_diagnoses, max_count=6)
        for rec in recs:
            key = _norm_specialist_key(rec.get("model", ""))
            for agent_id in _SPECIALIST_TO_AGENT.get(key, []):
                push(agent_id)

    meds = str((patient_data or {}).get("currentMedications") or "").strip()
    if meds and "mini" not in seen:
        push("mini")

    if not ids:
        return ["deepseek", "mistral", "mini"]

    return ids[:4]
