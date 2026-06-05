"""
Profilaktik check-up — qoidalar (SSV/xalqaro) + AI shaxsiylashtirish.
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


def _pubmed(term: str) -> str:
    return f"https://pubmed.ncbi.nlm.nih.gov/?term={quote(term)}"


def _age_int(age: str) -> int:
    try:
        return max(0, min(120, int(str(age).strip())))
    except (TypeError, ValueError):
        return 0


def _bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes", "ha")
    return bool(val)


def baseline_screenings(payload: dict) -> list[dict]:
    """Yosh, jins va xavf omillariga asoslangan minimal skrining to'plami."""
    age = _age_int(payload.get("age"))
    gender = (str(payload.get("gender") or "").strip().lower())
    female = gender in ("female", "ayol", "f")
    male = gender in ("male", "erkak", "m")
    smoking = _bool(payload.get("smoking"))
    diabetes = _bool(payload.get("diabetes"))
    hypertension = _bool(payload.get("hypertension"))
    obesity = _bool(payload.get("obesity"))
    family_cancer = _bool(payload.get("familyHistoryCancer"))
    conditions = (str(payload.get("conditions") or "").lower())

    if diabetes or "diabet" in conditions:
        diabetes = True
    if hypertension or "giperton" in conditions or "hypertens" in conditions:
        hypertension = True

    items: list[dict] = []

    def add(
        name: str,
        frequency: str,
        reason: str,
        priority: str = "medium",
        category: str = "general",
        source: str = "SSV / WHO",
        url: str = "",
    ):
        items.append({
            "screeningName": name,
            "frequency": frequency,
            "reason": reason,
            "priority": priority,
            "category": category,
            "guidelineSource": source,
            "sourceUrl": url or _pubmed(name),
        })

    if age < 1:
        add("Pediatr patronaj va emlanish jadvali", "SSV jadvali bo'yicha", "Bolalar profilaktikasi", "high", "vaccination", "SSV")
        return items

    if age < 18:
        add("Bolalar sog'lig'i tekshiruvi (o'sish, rivojlanish)", "Yillik", "Pediatrik profilaktika", "high", "general", "SSV")
        add("Emlanish holati tekshiruvi", "Jadval bo'yicha", "O'zbekiston emlanish kalendari", "high", "vaccination", "SSV")
        if age >= 11:
            add("Qon bosimi o'lchash", "Yillik", "Surunkali kasalliklarni erta aniqlash", "medium", "cardiovascular")
        return items

    add("Umumiy klinik ko'rik va vital ko'rsatkichlar", "Yillik", "Asosiy profilaktik ko'rik", "high", "general", "SSV")
    add("Qon bosimi o'lchash", "Yillik (yoki 6 oy — gipertoniya bo'lsa)", "Gipertensiya skriningi", "high" if hypertension else "medium", "cardiovascular", "USPSTF", _pubmed("hypertension screening"))

    if age >= 18:
        add("BMI va vazn nazorati", "Har ko'rikda", "Semizlik va metabolik xavf", "medium", "metabolic")

    if age >= 35 or obesity or diabetes:
        add("Qandli diabet skriningi (glukoza/HbA1c)", "Har 1-3 yil", "Diabet xavfi", "high" if diabetes or obesity else "medium", "metabolic", "ADA", _pubmed("diabetes screening"))

    if age >= 40 or hypertension or diabetes or smoking:
        add("Lipid panel (xolesterin)", "Har 4-5 yil (xavf yuqori bo'lsa tezroq)", "Yurak-qon tomir xavfi", "high" if smoking or diabetes else "medium", "cardiovascular", "ACC/AHA")

    if age >= 45:
        add("Kolorektal rak skriningi (FIT yoki kolonoskopiya)", "Har 10 yil (usulga qarab)", "Kolorektal rak erta aniqlash", "high" if family_cancer else "medium", "cancer", "USPSTF", _pubmed("colorectal cancer screening"))

    if female and 21 <= age <= 65:
        add("Servikal rak skriningi (PAP/HPV)", "Har 3-5 yil", "Serviks saratoni profilaktikasi", "high", "cancer", "WHO", _pubmed("cervical cancer screening"))

    if female and age >= 40:
        add("Mammografiya (mammary skrining)", "Har 1-2 yil", "Ko'krak bezi saratoni skriningi", "high" if family_cancer else "medium", "cancer", "WHO/SSV", _pubmed("breast cancer screening mammography"))

    if male and age >= 50:
        add("Prostata (PSA) — shifokor bilan muhokama", "Individual", "Prostata saratoni xavfi", "medium", "cancer", "USPSTF", _pubmed("prostate cancer screening PSA"))

    if smoking and age >= 50:
        add("O'pka rak skriningi (past dozali KT)", "Yillik (20 paket-yil bo'lsa)", "Chekish anamnezi", "high", "cancer", "USPSTF", _pubmed("lung cancer screening LDCT"))

    if age >= 65:
        add("Ko'rish (glaukoma/katarakta) skriningi", "Har 1-2 yil", "Keksalikda ko'rish buzilishi", "medium", "general")
        add("Suyak zichligi (osteoporoz) — xavf bo'lsa", "Har 2 yil", "Fraktura xavfi", "medium", "general", "WHO")

    add("Hepatit B/C skriningi (endemik hudud)", "Bir martalik yoki xavf bo'lsa", "O'zbekiston endemik kontekst", "medium", "infectious", "WHO", _pubmed("hepatitis B screening"))
    add("Tuberkulyoz skriningi (Mantoux/IGRA — xavf guruhida)", "Xavf bo'lsa", "NTS epidemiologiyasi", "medium", "infectious", "SSV")
    add("Tish va og'iz bo'shlig'i ko'rigi", "Yillik", "Stomatologik profilaktika", "low", "dental")
    add("Ruhiy salomatlik (depressiya/anxiety) skriningi", "Yillik (xavf bo'lsa)", "Umumiy aholi salomatligi", "low", "mental", "WHO", _pubmed("depression screening adults"))

    return items


def baseline_vaccinations(age: int, gender: str) -> list[dict]:
    vacs = []
    if age >= 18:
        vacs.append({"vaccine": "Qrip (influenza)", "schedule": "Yillik", "reason": "Mavsumiy infeksiya profilaktikasi", "priority": "medium"})
    if age >= 50:
        vacs.append({"vaccine": "Pnevmokok", "schedule": "SSV jadvali bo'yicha", "reason": "Pnevmokok infeksiyasi", "priority": "medium"})
    if age >= 65:
        vacs.append({"vaccine": "Zoster (qaysar chaqmas)", "schedule": "2 doza (jadval)", "reason": "Keksalarda qaysar chaqmas xavfi", "priority": "low"})
    vacs.append({"vaccine": "Qizamiq-qizilcha-qo'tish (revaksinatsiya kerak bo'lsa)", "schedule": "Immun holat bo'yicha", "reason": "Kollektiv immunitet", "priority": "low"})
    return vacs


def compute_risk_level(payload: dict, age: int) -> tuple[str, list[str]]:
    factors = []
    score = 0
    if _bool(payload.get("smoking")):
        factors.append("Chekish")
        score += 2
    if _bool(payload.get("diabetes")):
        factors.append("Qandli diabet")
        score += 2
    if _bool(payload.get("hypertension")):
        factors.append("Arterial gipertenziya")
        score += 1
    if _bool(payload.get("obesity")):
        factors.append("Semizlik / ortiqcha vazn")
        score += 1
    if _bool(payload.get("familyHistoryCancer")):
        factors.append("Oilaviy onkologik anamnez")
        score += 2
    if age >= 60:
        score += 1
    if score >= 4:
        return "high", factors
    if score >= 2:
        return "moderate", factors
    return "low", factors


def merge_screenings(baseline: list[dict], ai_list: list[dict]) -> list[dict]:
    seen = {s.get("screeningName", "").strip().lower() for s in baseline}
    merged = list(baseline)
    for item in ai_list:
        if not isinstance(item, dict):
            continue
        name = str(item.get("screeningName") or item.get("screening_name") or "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        merged.append({
            "screeningName": name,
            "frequency": str(item.get("frequency") or ""),
            "reason": str(item.get("reason") or ""),
            "priority": str(item.get("priority") or "medium").lower(),
            "category": str(item.get("category") or "general"),
            "guidelineSource": str(item.get("guidelineSource") or item.get("guideline_source") or ""),
            "sourceUrl": str(item.get("sourceUrl") or item.get("source_url") or _pubmed(name)),
            "nextSuggested": str(item.get("nextSuggested") or item.get("next_suggested") or ""),
            "evidenceLevel": str(item.get("evidenceLevel") or item.get("evidence_level") or ""),
        })
    priority_order = {"high": 0, "medium": 1, "low": 2}
    merged.sort(key=lambda x: priority_order.get(str(x.get("priority", "medium")).lower(), 1))
    return merged


def generate_check_up_plan(payload: dict, language: str = "uz-L") -> dict:
    from . import claude_utils

    age = _age_int(payload.get("age"))
    if age <= 0:
        raise ValueError("Yosh noto'g'ri")

    risk_level, risk_factors = compute_risk_level(payload, age)
    baseline = baseline_screenings(payload)
    vaccinations = baseline_vaccinations(age, str(payload.get("gender") or ""))

    lang = LANG_LABELS.get(language, LANG_LABELS["uz-L"])
    context = {
        "age": age,
        "gender": payload.get("gender") or "noma'lum",
        "conditions": payload.get("conditions") or "sog'lom",
        "smoking": _bool(payload.get("smoking")),
        "diabetes": _bool(payload.get("diabetes")),
        "hypertension": _bool(payload.get("hypertension")),
        "obesity": _bool(payload.get("obesity")),
        "familyHistoryCancer": _bool(payload.get("familyHistoryCancer")),
        "riskLevel": risk_level,
        "riskFactors": risk_factors,
    }

    prompt = (
        f"Siz profilaktika va skrining mutaxassisisiz. O'zbekiston SSV, WHO, USPSTF, ESC qo'llanmalariga asoslaning.\n"
        f"Bemor konteksti: {json.dumps(context, ensure_ascii=False)}\n"
        f"Til: {lang}.\n"
        "Mavjud bazaviy skrininglar allaqachon qo'shilgan — siz QO'SHIMCHA shaxsiylashtirilgan tavsiyalar bering.\n"
        "FAQAT JSON:\n"
        "{\n"
        '  "summary": "2-4 jumla umumiy profilaktik xulosa",\n'
        '  "recommendations": [{"screeningName":"","frequency":"","reason":"","priority":"high|medium|low",'
        '"category":"cardiovascular|metabolic|cancer|infectious|general|vaccination|dental|mental",'
        '"guidelineSource":"SSV/WHO/...","sourceUrl":"https://...","nextSuggested":"masalan: 3 oy ichida","evidenceLevel":"A|B|C"}],\n'
        '  "preventionMeasures": ["..."],\n'
        '  "lifestylePlan": ["..."],\n'
        '  "labPanel": ["Umumiy qon, ..."],\n'
        '  "vaccinations": [{"vaccine":"","schedule":"","reason":"","priority":"high|medium|low"}],\n'
        '  "followUpTimeline": "keyingi 12 oy rejasi",\n'
        '  "urgentNotes": ["shoshilinch murojaat belgilari — agar bo\'lsa"],\n'
        '  "sources": [{"title":"protokol nomi","url":"https://..."}]\n'
        "}\n"
        "Kamida 3 ta qo'shimcha skrining yoki lab tavsiyasi (bazadan farqli). Manbalar bilan."
    )

    ai_data: dict = {}
    try:
        raw = claude_utils._call_claude(
            prompt,
            claude_utils.CLAUDE_FAST,
            response_mime_type="application/json",
            max_output_tokens=3500,
        )
        parsed = json.loads(raw.replace("```json", "").replace("```", "").strip())
        if isinstance(parsed, dict):
            ai_data = parsed
    except Exception as exc:
        logger.warning("Check-up AI enrichment failed: %s", exc)

    ai_recs = ai_data.get("recommendations") or []
    if not isinstance(ai_recs, list):
        ai_recs = []

    vaccinations_out = vaccinations
    ai_vac = ai_data.get("vaccinations")
    if isinstance(ai_vac, list) and ai_vac:
        seen_v = {v["vaccine"].lower() for v in vaccinations}
        for v in ai_vac:
            if not isinstance(v, dict):
                continue
            name = str(v.get("vaccine") or "").strip()
            if name and name.lower() not in seen_v:
                vaccinations_out.append({
                    "vaccine": name,
                    "schedule": str(v.get("schedule") or ""),
                    "reason": str(v.get("reason") or ""),
                    "priority": str(v.get("priority") or "medium"),
                })
                seen_v.add(name.lower())

    sources = ai_data.get("sources") or []
    if not isinstance(sources, list) or len(sources) < 2:
        sources = [
            {"title": "WHO Preventive Care", "url": _pubmed("WHO preventive health check")},
            {"title": "SSV O'zbekiston skrining", "url": _pubmed("Uzbekistan screening guidelines")},
        ]

    summary = str(ai_data.get("summary") or "").strip()
    if not summary:
        summary = (
            f"{age} yoshli bemorda profilaktik xavf darajasi: {risk_level}. "
            f"SSV va xalqaro standartlar bo'yicha {len(baseline)} ta asosiy skrining tavsiya etiladi."
        )

    default_prevention = [
        "Muntazam jismoniy faollik (haftasiga kamida 150 daqiqa o'rtacha intensivlik)",
        "Muvozanatli ovqatlanish — tuz, qand va yog'ni cheklash",
        "Yetarli uyqu (7–8 soat) va stressni boshqarish",
        "Chekishdan voz kechish yoki hech qachon boshlamaslik",
        "Yillik profilaktik shifokor ko'rigi",
    ]
    default_lifestyle = [
        "Kunlik 1.5–2 L suyuqlik iste'moli",
        "Kunlik qadamlar monitoringi (maqsad: 7000+)",
        "Alkogolni o'rtacha dozada cheklash yoki iste'mol qilmaslik",
    ]
    if smoking:
        default_lifestyle.insert(0, "Chekishni to'xtatish dasturi — shifokor bilan reja tuzing")
    default_labs = [
        "Umumiy qon tahlili (CBC)",
        "Qand (glukoza) yoki HbA1c",
        "Lipid panel (LDL, HDL, triglitserid)",
        "Jigar funksiyasi (ALT, AST)",
        "Buyrak funksiyasi (kreatinin, eGFR)",
        "Siydik umumiy tahlili",
    ]

    prevention = [str(x) for x in (ai_data.get("preventionMeasures") or []) if x][:12]
    lifestyle = [str(x) for x in (ai_data.get("lifestylePlan") or []) if x][:10]
    labs = [str(x) for x in (ai_data.get("labPanel") or []) if x][:12]
    if not prevention:
        prevention = default_prevention
    if not lifestyle:
        lifestyle = default_lifestyle
    if not labs:
        labs = default_labs

    return {
        "summary": summary,
        "riskLevel": risk_level,
        "riskFactors": risk_factors,
        "recommendations": merge_screenings(baseline, ai_recs),
        "preventionMeasures": prevention,
        "lifestylePlan": lifestyle,
        "labPanel": labs,
        "vaccinations": vaccinations_out,
        "followUpTimeline": str(ai_data.get("followUpTimeline") or "12 oy ichida profilaktik ko'rikni takrorlang."),
        "urgentNotes": [str(x) for x in (ai_data.get("urgentNotes") or []) if x][:6],
        "sources": [
            {"title": str(s.get("title") or "Manba"), "url": str(s.get("url") or _pubmed("preventive"))}
            for s in sources
            if isinstance(s, dict)
        ][:8],
    }
