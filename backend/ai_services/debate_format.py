"""
Konsilium munozarasi matnini foydalanuvchiga ko'rinadigan professional formatda yig'ish.
"""
from __future__ import annotations

import re
from typing import Any

# Promptlarga qo'shiladigan qat'iy qoidalar
CLINICAL_OUTPUT_RULES = """
KONSILIUM USLUBI (MAJBURIY — buzish MUMKIN EMAS):
1. Markdown (**qalin**, *, __) ISHLATMANG — faqat oddiy matn.
2. Mantiqiy zanjirda "->", "→" yoki strelka ISHLATMANG — har bir qadam ALOHIDA band.
3. Boshqa mutaxassislarga SHAXSIY ISM (Prof. ..., ism-familiya) bilan murojaat QILMANG —
   faqat mutaxassislik: "Nevrolog mutaxassisi", "Onkolog mutaxassisi", "Farmakolog mutaxassisi".
4. Har bir muhim klinik da'vo yoki tashxis bandi oxirida manba qavs ichida:
   (Protokol yoki jurnal nomi, https://to-liq-url).
5. supporting_evidence — aniq klinik FAKTLAR: vital (AB, puls, SpO2), lab qiymatlari, anamnez;
   umumiy gap va spekulyatsiya emas.
6. Yulduzcha (*), emoji va ichki AI/model nomlarini ISHLATMANG.
7. Dalil darajasi A/B/C va ishonch darajasini klinik jihatdan asoslab yozing.
8. Ob'ektiv, lab va tasvir (EKG/UZI/rengen) mavjud bo'lsa — ularni shikoyatdan ustun qo'llang.
"""

DENSE_JSON_HINT = (
    "Javob FAQAT JSON. Matn ZICH: har bandda aniq klinik qiymat (raqam+birlik). "
    "Bo'sh gap, 'ehtimol', 'ko'rib chiqildi' kabi so'zlarsiz. Ortiqcha tushuntirish YO'Q."
)

DEBATE_INTENSITY_RULES = """
KONSILIUM CHANGI (MAJBURIY):
1. Boshqa mutaxassis tashxisi boshqacha bo'lsa — KAMIDA 1 ta STRONG yoki MODERATE refutation yozing.
2. Boshqa mutaxassis dalili kuchli bo'lsa — accepted_from_others da aniq FAKT bilan qo'llab-quvvatlang.
3. Har refutation: bemorning ANIQ ko'rsatkichi + nima uchun zaif/noto'g'ri — boshqalarning jumlasini KO'CHIRMAN.
4. Himoya: o'z ixtisosligingizdan YANGI fakt — rais yoki boshqa mutaxassis gapini takrorlamang.
5. key_argument: faqat SIZNING eng kuchli klinik dalilingiz + manba URL.
6. Agar boshqalar bilan kelishsangiz ham — qaysi ANIQ fakt sizni ishontirganini yozing (umumiy gap emas).
"""

P1_DENSITY_RULES = """
PHASE 1 ZICHLIK (MAJBURIY):
- reasoning_chain: kamida 4 qadam, har biri bemor fakti + manba URL.
- supporting_evidence: kamida 4 ta — vital, lab, anamnez yoki tasvirdan aniq qiymatlar.
- differential: kamida 2 ta alternativ tashxis + ehtimollik + qisqa sabab.
- recommended_tests: kamida 2 ta + nima uchun (klinik indikatsiya).
"""

ANTI_REPETITION_RULES = """
TAKRORLASH TAQIQLANADI (MAJBURIY):
1. Bemor shikoyatini so'zma-so'z qayta yozmang — faqat o'z ixtisosligingizdan foydalanilgan faktlar.
2. Boshqa mutaxassis, rais yoki namuna matndagi jumlalarni KO'CHIRMAN — o'z mustaqil tahlil.
3. Umumiy konsensus jumlalar ("konsilium", "hamkasblar", "shikoyat asosida") YO'Q — faqat aniq klinik da'vo.
4. Har mutaxassis BOSHQA burchakdan qarashi kerak: bir xil tashxis nomi bo'lsa ham dalillar va tekshiruvlar farq qilsin.
5. Rais ochish nutqidagi bemor tavsifini takrorlamang — faqat o'z ixtisoslik nuqtai nazaringizni bering.
"""

AGENT_SPECIALTY_FOCUS: dict[str, str] = {
    "deepseek": (
        "SIZNING BURCHAGINGIZ (Nevrolog/mantiq): markaziy va periferik asab tizimi, uyqu-buzilishlar, "
        "neuromuskulyar, differensial mantiq zanjiri. Boshqalar aytgan tashxisni takrorlamang — "
        "o'z neuro-mantiqiy asoslaringizni yozing."
    ),
    "llama": (
        "SIZNING BURCHAGINGIZ (Onkolog/EBM): malign xavf, paraneoplastik sindromlar, meta-tahlil darajasi. "
        "Agar onkologik emas deb baholassangiz — aniq qaysi dalil bilan rad etasiz. "
        "Onkolog bo'lmagan holatda ham o'z tekshiruvlaringizni taklif qiling."
    ),
    "mistral": (
        "SIZNING BURCHAGINGIZ (Protokol/standart): O'zbekiston SSV protokoli, klinik yo'l, "
        "majburiy tekshiruvlar va xavf stratifikatsiyasi. Tashxisni takrorlamang — "
        "protokolga muvofiqlik yoki kamchilikni ko'rsating."
    ),
    "mini": (
        "SIZNING BURCHAGINGIZ (Farmakolog): dori, DDI, doza, nojo'ya ta'sir, kontrendikatsiya, "
        "O'zbekistonda mavjud preparatlar. Tashxis takrori emas — dori xavfi va monitoring rejasi."
    ),
    "gpt4o": (
        "SIZNING BURCHAGINGIZ (Kengash raisi): faqat yakunda qisqa sintez — alohida mutaxassis tahlili emas."
    ),
}


def _conf_label_uz(conf: str) -> str:
    m = {"HIGH": "Yuqori", "MEDIUM": "O'rtacha", "LOW": "Past"}
    key = str(conf or "").strip().upper()
    return m.get(key, str(conf or "").strip() or "—")


def _clean_step_text(step: str) -> str:
    s = str(step or "").strip()
    s = re.sub(r"\s*->\s*", " — ", s)
    s = re.sub(r"\s*→\s*", " — ", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    return s.strip()


_RECAP_LINE = re.compile(
    r"^(shikoyat|bemor\s+\d+\s*yosh|patient\s+is\s+\d+|erkak|ayol)[\s,:]",
    re.I,
)


def _filter_recap_lines(text: str) -> str:
    """Shikoyat/anamnez takrorini UI matnidan olib tashlash."""
    if not text:
        return text
    kept: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            kept.append(line)
            continue
        content = re.sub(r"^[\s•▸\d.]+", "", stripped)
        if _RECAP_LINE.search(content) and not re.search(
            r"\d+\s*(mmHg|mg|ml|/|min|L|%)", content, re.I
        ):
            continue
        kept.append(line)
    return "\n".join(kept)


def format_reasoning_steps(chain: Any) -> str:
    lines: list[str] = []
    if not isinstance(chain, list):
        return ""
    for i, raw in enumerate(chain, 1):
        step = _clean_step_text(raw)
        if step:
            lines.append(f"  {i}. {step}")
    return "\n".join(lines)


def format_bullet_items(items: Any, prefix: str = "  • ") -> str:
    if not isinstance(items, list):
        return ""
    lines: list[str] = []
    for raw in items:
        s = _clean_step_text(raw)
        if s:
            lines.append(f"{prefix}{s}")
    return "\n".join(lines)


def format_p1_debate_content(p1r: dict) -> str:
    sections: list[str] = []

    diag = _clean_step_text(p1r.get("primary_diagnosis", ""))
    if diag:
        sections.append(f"▸ TASHXIS\n{diag}")

    prob = p1r.get("probability", "")
    conf = _conf_label_uz(str(p1r.get("confidence", "")))
    evl = p1r.get("evidence_level", "")
    if prob or conf or evl:
        sections.append(
            f"▸ EHTIMOLLIK VA DALIL DARAJASI\n"
            f"{prob}% · Ishonch: {conf} · Dalil darajasi: {evl}"
        )

    reasoning = format_reasoning_steps(p1r.get("reasoning_chain"))
    if reasoning:
        sections.append(f"▸ KLINIK ASOSLAR\n{reasoning}")

    evidence = format_bullet_items(p1r.get("supporting_evidence"))
    if evidence:
        sections.append(f"▸ TASDIQLOVCHI FAKTLAR\n{evidence}")

    diff_lines: list[str] = []
    for d in p1r.get("differential") or []:
        if not isinstance(d, dict):
            continue
        nm = _clean_step_text(d.get("name", ""))
        if not nm:
            continue
        prob = d.get("probability")
        prob_s = f" ({prob}%)" if prob is not None else ""
        rs = _clean_step_text(d.get("reason", ""))
        diff_lines.append(f"  • {nm}{prob_s}" + (f" — {rs}" if rs else ""))
    if diff_lines:
        sections.append("▸ FARQLANUVCHI TASHXISLAR\n" + "\n".join(diff_lines))

    tests = format_bullet_items(p1r.get("recommended_tests"))
    if tests:
        sections.append(f"▸ TAVSIYA ETILGAN TEKSHIRUVLAR\n{tests}")

    reds = format_bullet_items(p1r.get("red_flags"))
    if reds:
        sections.append(f"▸ QIZIL BAYROQLAR\n{reds}")

    notes = _clean_step_text(p1r.get("initial_treatment_notes", ""))
    if notes:
        sections.append(f"▸ DASTLABKI TAVSIYA\n{notes}")

    return _filter_recap_lines("\n\n".join(sections))


def format_p2_debate_content(
    p2r: dict,
    specialty_resolver: Any,
) -> str:
    sections: list[str] = []

    ref_lines: list[str] = []
    for r in p2r.get("refutations") or []:
        if not isinstance(r, dict):
            continue
        target = specialty_resolver(str(r.get("target_agent_id", "")))
        body = _clean_step_text(r.get("refutation", ""))
        strength = str(r.get("strength", "")).strip().upper()
        tag = f"[{strength}] " if strength in ("STRONG", "MODERATE", "WEAK") else ""
        target_dx = _clean_step_text(r.get("target_diagnosis", ""))
        prefix = f"{target}"
        if target_dx:
            prefix = f"{target} («{target_dx}»)"
        if body:
            ref_lines.append(f"  • {tag}{prefix}: {body}")
    if ref_lines:
        sections.append("▸ TANQID VA JAVOB\n" + "\n".join(ref_lines))

    defense = p2r.get("defense") or {}
    if isinstance(defense, dict):
        arg = _clean_step_text(defense.get("argument", ""))
        new_ev = _clean_step_text(defense.get("new_evidence", ""))
        if arg:
            sections.append(f"▸ HIMOYA\n{arg}")
        if new_ev:
            sections.append(f"▸ QO'SHIMCHA DALIL\n{new_ev}")

    revised = _clean_step_text(p2r.get("revised_diagnosis", ""))
    if revised:
        prob = p2r.get("revised_probability")
        prob_s = f" ({prob}%)" if prob is not None else ""
        sections.append(f"▸ YANGILANGAN TASHXIS{prob_s}\n{revised}")

    accepted_lines: list[str] = []
    for a in p2r.get("accepted_from_others") or []:
        if not isinstance(a, dict):
            continue
        spec = specialty_resolver(str(a.get("agent_id", "")))
        pt = _clean_step_text(a.get("point", ""))
        if pt:
            accepted_lines.append(f"  • {spec}: {pt}")
    if accepted_lines:
        sections.append("▸ QABUL QILINGAN FIKRLAR\n" + "\n".join(accepted_lines))

    key_arg = _clean_step_text(p2r.get("key_argument", ""))
    if key_arg:
        sections.append(f"▸ ASOSIY KLINIK DALIL\n{key_arg}")

    endorse = format_bullet_items(p2r.get("endorsements"))
    if endorse:
        sections.append(f"▸ QO'LLAB-QUVVATLASH\n{endorse}")

    return _filter_recap_lines("\n\n".join(sections))


def format_specialist_roster(agents: list[Any]) -> str:
    """Konsiliumga chorlangan mutaxassislar ro'yxati."""
    lines: list[str] = []
    for agent in agents:
        fields = debate_author_fields(agent)
        lines.append(f"  • {fields['authorTitle']} — {fields['author']}")
    return "\n".join(lines)


def format_orchestrator_closing(consensus: dict) -> str:
    """Rais konsiliumni yopadi va yakuniy xulosa beradi."""
    if not isinstance(consensus, dict):
        return ""
    sections: list[str] = ["▸ KONSILIUM YOPILDI\nKengash muhokamasi yakunlandi. Quyida yakuniy klinik xulosa."]

    cd = consensus.get("consensus_diagnosis") or {}
    if isinstance(cd, dict) and cd.get("name"):
        icd = _clean_step_text(cd.get("icd10", ""))
        icd_s = f" (ICD-10: {icd})" if icd else ""
        prob = cd.get("probability")
        prob_s = f" — {prob}%" if prob is not None else ""
        sections.append(f"▸ YAKUNIY TASHXIS\n{_clean_step_text(cd['name'])}{icd_s}{prob_s}")
        just = _clean_step_text(cd.get("justification", ""))
        if just:
            sections.append(f"▸ ASOS\n{just}")

    treatment = consensus.get("treatment_plan") or []
    if isinstance(treatment, list) and treatment:
        block = format_bullet_items(treatment)
        if block:
            sections.append(f"▸ DAVOLASH REJASI\n{block}")

    tests = consensus.get("recommended_tests") or []
    if isinstance(tests, list) and tests:
        block = format_bullet_items(tests)
        if block:
            sections.append(f"▸ TAVSIYA ETILGAN TEKSHIRUVLAR\n{block}")

    follow = _clean_step_text(consensus.get("follow_up_plan", ""))
    if follow:
        sections.append(f"▸ KUZATUV REJASI\n{follow}")

    synth = consensus.get("debate_synthesis") or consensus.get("debateSynthesis")
    synth_text = format_debate_synthesis(synth) if synth else ""
    agreement = _clean_step_text(consensus.get("agreement_summary", ""))
    if synth_text:
        sections.append(synth_text)
    elif agreement:
        sections.append(f"▸ MUNOZARA XULOSASI\n{agreement}")

    dissent = format_bullet_items(consensus.get("dissenting_opinions"))
    if dissent:
        sections.append(f"▸ FARQLI FIKRLAR\n{dissent}")

    return "\n\n".join(sections)


def format_debate_synthesis(synthesis: dict) -> str:
    """Rais yakuniy munozara xulosasi."""
    if not isinstance(synthesis, dict):
        return ""
    sections: list[str] = []
    for key, title in (
        ("key_agreements", "KELISHUVLAR"),
        ("key_disputes_resolved", "HAL QILINGAN BAHSLAR"),
        ("winning_arguments", "G'OLIB DALILLAR"),
    ):
        block = format_bullet_items(synthesis.get(key))
        if block:
            sections.append(f"▸ {title}\n{block}")
    summary = _clean_step_text(synthesis.get("summary", ""))
    if summary:
        sections.insert(0, f"▸ KENGASH XULOSASI\n{summary}")
    return "\n\n".join(sections)


def agent_specialty_label(agent: Any, agent_id: str = "") -> str:
    """Professor shaxsiy ismi emas — mutaxassislik."""
    if agent is not None:
        spec = getattr(agent, "specialty", None) or (agent.get("specialty") if isinstance(agent, dict) else None)
        if spec:
            return str(spec).split(",")[0].strip()
        title = getattr(agent, "title", None) or (agent.get("title") if isinstance(agent, dict) else None)
        if title:
            return str(title).split("|")[0].strip()
    return "Hamkasb mutaxassis"


def format_consilium_initial(opinion: dict) -> str:
    """multi_agent_consilium mustaqil fikr maydonlarini umumiy formatga."""
    reasoning = opinion.get("reasoning_chain") or opinion.get("reasoning")
    if isinstance(reasoning, str) and reasoning.strip():
        reasoning = [reasoning]
    return format_p1_debate_content({
        "primary_diagnosis": opinion.get("primary_diagnosis", ""),
        "probability": opinion.get("probability", ""),
        "reasoning_chain": reasoning if isinstance(reasoning, list) else [],
        "supporting_evidence": opinion.get("supporting_evidence") or [],
        "red_flags": opinion.get("red_flags") or [],
        "recommended_tests": opinion.get("recommended_tests") or [],
        "initial_treatment_notes": opinion.get("initial_treatment") or opinion.get("initial_treatment_notes") or "",
        "confidence": opinion.get("confidence", "MEDIUM"),
        "evidence_level": opinion.get("evidence_level", "B"),
    })


def format_consilium_debate(debate: dict) -> str:
    sections: list[str] = []
    critique = _clean_step_text(debate.get("critique", ""))
    if critique:
        sections.append(f"▸ TANQID VA JAVOB\n{critique}")
    defense = _clean_step_text(debate.get("defense", ""))
    if defense:
        sections.append(f"▸ HIMOYA\n{defense}")
    revised = _clean_step_text(debate.get("revised_diagnosis", ""))
    if revised:
        prob = debate.get("revised_probability")
        prob_s = f" ({prob}%)" if prob is not None else ""
        sections.append(f"▸ YANGILANGAN TASHXIS{prob_s}\n{revised}")
    key = _clean_step_text(debate.get("key_argument", ""))
    if key:
        sections.append(f"▸ ASOSIY KLINIK DALIL\n{key}")
    return "\n\n".join(sections)


def debate_author_fields(agent: Any) -> dict[str, str]:
    """Munozara kartochkasi: ism emas, mutaxassislik."""
    specialty = agent_specialty_label(agent)
    title = getattr(agent, "title", "") or ""
    # "Prof. Ism" qismini olib tashlash — faqat lavozim qolsin
    title_clean = re.sub(r"Prof\.\s*[\w''\-]+\s*[\w''\-]+", "", str(title)).strip(" -|")
    return {
        "author": specialty,
        "authorTitle": title_clean or specialty,
    }
