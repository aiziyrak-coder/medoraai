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
7. Dalil darajasi va foizlarni JSON ichida saqlang; foydalanuvchiga ko'rinadigan matnda
   «Ishonch», «Dalil darajasi A/B/C», «90%» kabi meta-yozuvlar ISHLATMANG.
8. Ob'ektiv, lab va tasvir (EKG/UZI/rengen) mavjud bo'lsa — ularni shikoyatdan ustun qo'llang.
9. MKB-10 kodlari faqat yakuniy hisobot uchun; munozara matnida alohida «TASHXIS (F01.9)» bloklari YO'Q.
10. Munozarada faqat klinik fikr, fakt, tavsiya va tanqid — qisqa va amaliy.
"""

DEEP_CLINICAL_HINT = (
    "Javob FAQAT JSON. Har band CHUQUR va AMALIY bo'lsin: aniq klinik qiymat (raqam+birlik), "
    "mexanizm yoki patofiziologik bog'liqlik, keyingi qadam. Bo'sh iboralar ('ehtimol', "
    "'ko'rib chiqildi', 'umuman olganda') YO'Q — har satr foydali klinik ma'lumot bersin."
)

# Eski nom bilan moslik
DENSE_JSON_HINT = DEEP_CLINICAL_HINT

DEBATE_INTENSITY_RULES = """
KONSILIUM CHANGI (MAJBURIY — YUMSHOQ EMAS):
1. Boshqa mutaxassis tashxisi boshqacha bo'lsa — KAMIDA 2 ta refutation (1 ta STRONG + 1 ta MODERATE/WEAK).
2. Har refutation: bemorning ANIQ ko'rsatkichi + patofiziologik/mexanistik sabab + nima uchun zaif.
3. Himoya (defense): o'z ixtisosligingizdan KAMIDA 2 ta yangi fakt — boshqalarning jumlasini KO'CHIRMAN.
4. accepted_from_others: kamida 1 ta band (agar haqiqatan qabul qilsangiz) — aniq qaysi fakt va kimning dalili.
5. key_argument: 2-3 jumla — eng kuchli klinik dalil + manba URL + amaliy oqibat.
6. revised_diagnosis o'zgarsa — nima o'zgartirdi (qaysi refutation/dalil) yozing.
7. Umumiy gaplar taqiqlangan — har band bemor uchun amaliy qiymat bersin.
"""

P1_DENSITY_RULES = """
PHASE 1 CHUQURLIK (MAJBURIY):
- reasoning_chain: kamida 5-6 qadam — har biri: bemor fakti → klinik talqin → xulosa.
- supporting_evidence: kamida 5 ta — vital, lab, anamnez, tasvir yoki dori tarixidan ANIQ qiymatlar.
- differential: kamida 2 ta alternativ — faqat klinik sabab (foiz va A/B/C matnda YO'Q).
- recommended_tests: kamida 3 ta + klinik indikatsiya.
- red_flags: kamida 1 ta (agar mavjud bo'lsa) — shoshilinch harakat bilan.
- initial_treatment_notes: kamida 2 jumla — o'z ixtisosligingizdan aniq tavsiya.
"""

SPECIALIST_THINKING_MANDATE = """
MUTAXASSIS FIKRLASHI (MAKSIMAL CHUQURLIK):
1. Sizning javobingiz boshqa mutaxassislardan FARQ qilishi kerak — o'z noyob klinik burchagingiz.
2. Har da'vo bemor ma'lumotidagi ANIQ faktdan boshlansin (raqam, vaqt, dori, simptom).
3. Tashxis nomi bir xil bo'lsa ham — dalillar, tekshiruvlar va xavf nuqtalari BOSHQA bo'lsin.
4. Yetarli ma'lumot bo'lmasa — qaysi qo'shimcha ma'lumot/tekshiruv kerakligini aniq yozing.
5. Har bir tavsiya amaliy: nima qilish, qachon, qanday monitoring.
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
        "SIZNING BURCHAGINGIZ (Nevrolog/mantiq): neyrologik simptomlar, uyqu-arousal, kognitiv, "
        "neuromuskulyar, markaziy vs periferik ajratish. MAJBURIY chiqaring: differensial mantiq "
        "zanjiri (5+ qadam), neyrologik red flag, agar kerak bo'lsa EMG/EEG/polisomnografiya. "
        "Boshqa mutaxassis aytmagan neyrologik mexanizmni izohlang."
    ),
    "llama": (
        "SIZNING BURCHAGINGIZ (Onkolog/EBM): malign xavf, paraneoplastik sindrom, metastaz, "
        "survival/prognostik omillar. MAJBURIY: evidence level (A/B/C), qaysi screening kerak, "
        "qaysi onkologik gipoteza rad etiladi va nega. Onkologiya bo'lmasa ham — EBM asosida "
        "o'z tekshiruv va kuzatuv rejangizni bering."
    ),
    "mistral": (
        "SIZNING BURCHAGINGIZ (Protokol/SSV): O'zbekiston SSV protokol raqami/nomi, majburiy "
        "diagnostik algoritm, xavf stratifikatsiyasi, statsionar vs ambulator. MAJBURIY: "
        "protokolga mos/qarshi qaysi qadam, qaysi tekshiruv protokolda majburiy, qaysi "
        "davolash bosqichi tavsiya etiladi."
    ),
    "mini": (
        "SIZNING BURCHAGINGIZ (Farmakolog): har bir dori uchun doza, DDI, kontrendikatsiya, "
        "monitoring (qon, jigar, buyrak), O'zbekistonda mavjud savdo nomi. MAJBURIY: "
        "xavfli kombinatsiya, pediatrik/geriatrik tuzatish, alternativ preparat, "
        "nojo'ya ta'sir profilaksi rejasi."
    ),
    "gpt4o": (
        "SIZNING BURCHAGINGIZ (Kengash raisi): munozarani sintez qiling — har mutaxassisning "
        "eng kuchli dalilini og'irlik bilan birlashtiring; zaif dalillarni rad eting."
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
    """Mustaqil faza — faqat klinik fikr va amaliy tavsiyalar (foiz/MKB meta yo'q)."""
    sections: list[str] = []

    reasoning = format_reasoning_steps(p1r.get("reasoning_chain"))
    if reasoning:
        sections.append(f"▸ KLINIK FIKR\n{reasoning}")

    evidence = format_bullet_items(p1r.get("supporting_evidence"))
    if evidence:
        sections.append(f"▸ MUHIM FAKTLAR\n{evidence}")

    notes = _clean_step_text(p1r.get("initial_treatment_notes", ""))
    if notes:
        sections.append(f"▸ TAVSIYA\n{notes}")

    tests = format_bullet_items(p1r.get("recommended_tests"))
    if tests:
        sections.append(f"▸ TEKSHIRUV\n{tests}")

    reds = format_bullet_items(p1r.get("red_flags"))
    if reds:
        sections.append(f"▸ SHOSHILINCH BELGI\n{reds}")

    diff_lines: list[str] = []
    for d in p1r.get("differential") or []:
        if not isinstance(d, dict):
            continue
        nm = _clean_step_text(d.get("name", ""))
        if not nm:
            continue
        rs = _clean_step_text(d.get("reason", ""))
        diff_lines.append(f"  • {nm}" + (f" — {rs}" if rs else ""))
    if diff_lines:
        sections.append("▸ BOSHQA EHTIMOLLAR\n" + "\n".join(diff_lines))

    if not sections:
        diag = _clean_step_text(p1r.get("primary_diagnosis", ""))
        if diag:
            sections.append(f"▸ KLINIK FIKR\n{diag}")

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
        sections.append(f"▸ YANGILANGAN FIKR\n{revised}")

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
    diag_lines: list[str] = []
    if isinstance(cd, dict) and cd.get("name"):
        icd = _clean_step_text(cd.get("icd10", ""))
        icd_desc = _clean_step_text(cd.get("icd10_description", ""))
        prob = cd.get("probability")
        prob_s = f" — {prob}%" if prob is not None else ""
        line = f"1. {_clean_step_text(cd['name'])}"
        if icd:
            line += f" (MKB-10: {icd}"
            if icd_desc:
                line += f" — {icd_desc}"
            line += ")"
        line += prob_s
        diag_lines.append(line)
    diffs = consensus.get("differential_diagnoses") or []
    if isinstance(diffs, list):
        for idx, d in enumerate(diffs[:4], start=2):
            if not isinstance(d, dict) or not d.get("name"):
                continue
            icd = _clean_step_text(d.get("icd10", ""))
            icd_desc = _clean_step_text(d.get("icd10_description", ""))
            prob = d.get("probability")
            prob_s = f" — {prob}%" if prob is not None else ""
            line = f"{idx}. {_clean_step_text(d['name'])}"
            if icd:
                line += f" (MKB-10: {icd}"
                if icd_desc:
                    line += f" — {icd_desc}"
                line += ")"
            line += prob_s
            diag_lines.append(line)
    if diag_lines:
        sections.append("▸ YAKUNIY TASHXISLAR (MKB-10)\n" + "\n".join(diag_lines))
        just = _clean_step_text(cd.get("justification", "")) if isinstance(cd, dict) else ""
        if just:
            sections.append(f"▸ ASOS (asosiy tashxis)\n{just}")

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
        sections.append(f"▸ YANGILANGAN FIKR\n{revised}")
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
