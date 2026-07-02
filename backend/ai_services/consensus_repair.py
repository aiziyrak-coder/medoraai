"""
Konsilium Phase 3 natijasi buzilsa yoki bo'sh qolsa — P1/P2 dan kuchli fallback.
"""
from __future__ import annotations

import re
from typing import Any


def _s(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


_BAD_NAMES = frozenset({
    "",
    "tashxis aniqlanmadi",
    "aniqlanmadi",
    "noma'lum",
    "nomalum",
    "timeout",
    "tahlil muvaffaqiyatsiz",
    "unknown",
})

_BAD_TREATMENT_MARKERS = (
    "shifokor tasdiqlashi kerak",
    "konsensus davolash rejasi",
    "kiritilmagan",
    "aniqlanmadi",
    "ma'lumot yo'q",
)

_GENERIC_AGREEMENT_MARKERS = (
    "dalillar phase 1–2 mutaxassis tahlillari",
    "dalillar phase 1-2 mutaxassis tahlillari",
    "refutation og'irligi asosida birlashtirildi",
    "konsilium munozarasi yakunida asosiy tashxis:",
)


def _is_bad_name(name: str) -> bool:
    n = _s(name).lower()
    if n in _BAD_NAMES:
        return True
    if len(n) < 3:
        return True
    return "muvaffaqiyatsiz" in n or n == "timeout"


def _agent_weight(weights: dict[str, float], agent_id: str) -> float:
    try:
        return float(weights.get(agent_id, 1.0))
    except (TypeError, ValueError):
        return 1.0


def _best_from_phases(p1: list[dict], p2: list[dict], weights: dict[str, float]) -> dict:
    """Eng yuqori og'irlik+ehtimollik bilan tashxis."""
    candidates: list[tuple[float, dict]] = []

    for r in p2 or []:
        if not isinstance(r, dict):
            continue
        aid = _s(r.get("agent_id"))
        name = _s(r.get("revised_diagnosis"))
        if _is_bad_name(name):
            continue
        try:
            prob = float(r.get("revised_probability") or 0)
        except (TypeError, ValueError):
            prob = 0.0
        if prob <= 0:
            prob = 70.0
        score = _agent_weight(weights, aid) * prob
        justification = _s(r.get("key_argument"))
        defense = r.get("defense") or {}
        if isinstance(defense, dict):
            if not justification:
                justification = _s(defense.get("argument"))
            new_ev = _s(defense.get("new_evidence"))
            if new_ev:
                justification = (justification + " " + new_ev).strip()
        candidates.append((score, {
            "name": name,
            "probability": int(min(97, max(55, round(prob)))),
            "justification": justification[:1200] or "Munozara natijasida yangilangan tashxis.",
            "evidence_level": "B",
            "reasoning_chain": [justification[:400]] if justification else [],
        }))

    for r in p1 or []:
        if not isinstance(r, dict):
            continue
        aid = _s(r.get("agent_id"))
        name = _s(r.get("primary_diagnosis"))
        if _is_bad_name(name):
            continue
        try:
            prob = float(r.get("probability") or 0)
        except (TypeError, ValueError):
            prob = 0.0
        if prob <= 0:
            prob = 75.0
        score = _agent_weight(weights, aid) * prob * 0.95
        chain = r.get("reasoning_chain") or []
        if not isinstance(chain, list):
            chain = []
        justification = _s(chain[0]) if chain else _s(r.get("initial_treatment_notes"))
        candidates.append((score, {
            "name": name,
            "probability": int(min(97, max(50, round(prob)))),
            "justification": justification[:1200] or "Mustaqil tahlil asosidagi tashxis.",
            "evidence_level": _s(r.get("evidence_level") or "B"),
            "reasoning_chain": [_s(x) for x in chain[:6] if _s(x)],
            "uzbek_protocol_match": _s(r.get("uzbek_protocol_match")),
        }))

    if not candidates:
        return {}
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def _collect_differentials(p1: list[dict], primary_name: str) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    primary_l = primary_name.lower()
    for r in p1 or []:
        if not isinstance(r, dict):
            continue
        for d in r.get("differential") or []:
            if not isinstance(d, dict):
                continue
            nm = _s(d.get("name"))
            if not nm or _is_bad_name(nm) or nm.lower() == primary_l:
                continue
            if nm.lower() in seen:
                continue
            seen.add(nm.lower())
            try:
                p = int(d.get("probability") or 15)
            except (TypeError, ValueError):
                p = 15
            out.append({
                "name": nm,
                "probability": max(3, min(40, p)),
                "reason": _s(d.get("reason"))[:500] or "Differensial tashxis.",
            })
        pname = _s(r.get("primary_diagnosis"))
        if pname and not _is_bad_name(pname) and pname.lower() != primary_l and pname.lower() not in seen:
            seen.add(pname.lower())
            try:
                p = int(r.get("probability") or 20)
            except (TypeError, ValueError):
                p = 20
            out.append({
                "name": pname,
                "probability": max(5, min(35, p)),
                "reason": "Boshqa mutaxassis mustaqil tahlili.",
            })
    return out[:4]


def _collect_rejected_hypotheses(
    consensus: dict,
    p1: list[dict],
    p2: list[dict],
    primary: str,
) -> list[dict]:
    """P3, P2 refutation va P1 differensiallardan rad etilgan gipotezalar."""
    seen: set[str] = set()
    out: list[dict] = []
    primary_l = primary.lower()

    def add(name: str, reason: str) -> None:
        nm = _s(name)
        if _is_bad_name(nm):
            return
        if primary_l and nm.lower() == primary_l:
            return
        key = nm.lower()
        if key in seen:
            return
        seen.add(key)
        rs = _s(reason)[:600]
        out.append({
            "name": nm,
            "reason": rs or "Konsilium munozarasi natijasida rad etilgan differensial gipoteza.",
        })

    for item in consensus.get("rejected_hypotheses") or []:
        if isinstance(item, dict):
            add(_s(item.get("name")), _s(item.get("reason")))

    for r in p2 or []:
        if not isinstance(r, dict):
            continue
        for ref in r.get("refutations") or []:
            if not isinstance(ref, dict):
                continue
            target = _s(ref.get("target_diagnosis"))
            refutation = _s(ref.get("refutation"))
            strength = _s(ref.get("strength"))
            reason = refutation
            if strength:
                reason = f"[{strength}] {reason}".strip()
            add(target, reason or "Phase 2 munozarasida refutation bilan rad etildi.")

    for r in p2 or []:
        if not isinstance(r, dict):
            continue
        revised = _s(r.get("revised_diagnosis"))
        if revised and primary_l and revised.lower() != primary_l:
            add(
                revised,
                _s(r.get("key_argument"))
                or "Munozara yakunida asosiy konsensus tashxisi sifatida tanlanmadi.",
            )

    for r in p1 or []:
        if not isinstance(r, dict):
            continue
        pname = _s(r.get("primary_diagnosis"))
        if pname and primary_l and pname.lower() != primary_l:
            add(
                pname,
                "Boshqa mutaxassis mustaqil tahlilidagi muqobil tashxis; konsensus asosiy variantni tanladi.",
            )

    for d in _collect_differentials(p1, primary):
        add(d["name"], d.get("reason", ""))

    for d in (
        consensus.get("differential_diagnoses")
        or consensus.get("differentialDiagnoses")
        or []
    ):
        if not isinstance(d, dict):
            continue
        add(
            _s(d.get("name")),
            _s(d.get("reason")) or "Differensial sifatida qoldirildi, asosiy tashxis ustun.",
        )

    for d in consensus.get("dissenting_opinions") or []:
        if isinstance(d, dict):
            add(
                _s(d.get("diagnosis") or d.get("name")),
                _s(d.get("reason") or d.get("argument")),
            )
        elif isinstance(d, str):
            add(d, "Konsensusga qo'shilmagan mutaxassis fikri.")

    return out[:6]


def _collect_tests(p1: list[dict], p2: list[dict]) -> list[str]:
    tests: list[str] = []
    seen: set[str] = set()
    for r in p1 or []:
        for t in r.get("recommended_tests") or []:
            ts = _s(t)
            if ts and ts.lower() not in seen:
                seen.add(ts.lower())
                tests.append(ts[:300])
    for r in p2 or []:
        defense = r.get("defense") or {}
        if isinstance(defense, dict):
            ev = _s(defense.get("new_evidence"))
            if "tekshir" in ev.lower() or "test" in ev.lower() or "uzi" in ev.lower():
                if ev.lower() not in seen:
                    seen.add(ev.lower())
                    tests.append(ev[:300])
    return tests[:12]


def _is_usable_treatment_step(step: str) -> bool:
    s = _s(step)
    if len(s) < 10:
        return False
    low = s.lower()
    if any(m in low for m in _BAD_TREATMENT_MARKERS):
        return False
    return True


def _plan_item_to_str(item: Any) -> str:
    if isinstance(item, dict):
        return _s(
            item.get("step")
            or item.get("details")
            or item.get("action")
            or item.get("description")
            or item.get("text")
        )
    return _s(item)


def _split_treatment_text(text: str) -> list[str]:
    raw = _s(text)
    if not raw:
        return []
    parts: list[str] = []
    for chunk in raw.replace(";", "\n").split("\n"):
        line = chunk.strip()
        if not line:
            continue
        line = line.lstrip("0123456789.-) ").strip()
        if line:
            parts.append(line)
    return parts if parts else [raw]


def _synthesize_treatment_steps(primary: str, consensus: dict) -> list[str]:
    """Oxirgi zaxira: tashxis, tekshiruv va dorilardan aniq qadamlar."""
    if _is_bad_name(primary):
        primary = "asosiy klinik holat"
    steps: list[str] = []
    tests = [_s(t) for t in (consensus.get("recommended_tests") or [])[:4] if _s(t)]
    if tests:
        steps.append(
            f"1-qadam: {primary} bo'yicha tashxisni tasdiqlash — {', '.join(tests)}."
        )
    else:
        steps.append(
            f"1-qadam: {primary} bo'yicha klinik holatni baholash va zarur laboratoriya/instrumental tekshiruvlarni belgilash."
        )

    meds = [m for m in (consensus.get("medications") or []) if isinstance(m, dict)]
    if meds:
        for i, m in enumerate(meds[:3], start=2):
            nm = _s(m.get("name") or m.get("generic"))
            if not nm:
                continue
            dose = _s(m.get("dosage"))
            freq = _s(m.get("frequency"))
            instr = _s(m.get("instructions"))
            line = nm
            if dose:
                line += f" {dose}"
            if freq:
                line += f", {freq}"
            if instr:
                line += f" ({instr})"
            steps.append(f"{i}-qadam: Farmakoterapiya — {line}.")
    else:
        steps.append(
            f"2-qadam: {primary} uchun SSV protokoliga muvofiq farmakologik va farmakologik bo'lmagan davolashni boshlash."
        )

    fu = _s(consensus.get("follow_up_plan"))
    if fu:
        steps.append(f"{len(steps) + 1}-qadam: Kuzatuv — {fu}")
    else:
        steps.append(
            f"{len(steps) + 1}-qadam: Davolash samaradorligi, xavfsizlik va nojo'ya ta'sirlar bo'yicha 2–4 hafta ichida qayta ko'rish."
        )
    return steps[:8]


def _collect_treatment_plan(
    p1: list[dict],
    p2: list[dict],
    consensus: dict,
    primary: str,
) -> list[str]:
    """P3, P1/P2 va dorilardan davolash rejasini yig'adi."""
    seen: set[str] = set()
    out: list[str] = []

    def add(step: str) -> None:
        st = _s(step)
        if not _is_usable_treatment_step(st):
            return
        key = st.lower()[:100]
        if key in seen:
            return
        seen.add(key)
        out.append(st[:500])

    for item in consensus.get("treatment_plan") or []:
        text = _plan_item_to_str(item)
        for part in _split_treatment_text(text):
            add(part)

    for item in consensus.get("non_pharmacological") or consensus.get("nonPharmacological") or []:
        add(f"Farmakologik bo'lmagan choralar: {_s(item)}")

    fu = _s(consensus.get("follow_up_plan") or consensus.get("followUpPlan"))
    if fu:
        add(f"Kuzatuv rejasi: {fu}")

    for r in p1 or []:
        for part in _split_treatment_text(_s(r.get("initial_treatment_notes"))):
            add(part)

    for r in p2 or []:
        defense = r.get("defense") or {}
        if isinstance(defense, dict):
            for part in _split_treatment_text(_s(defense.get("argument"))):
                if any(w in part.lower() for w in ("davolash", "terapiya", "dori", "rejim", "tavsiya", "kuzatuv")):
                    add(part)
            ev = _s(defense.get("new_evidence"))
            if ev and any(w in ev.lower() for w in ("davolash", "terapiya", "dori", "kuzatuv", "tekshir")):
                add(ev)
        ka = _s(r.get("key_argument"))
        if ka and any(w in ka.lower() for w in ("davolash", "terapiya", "dori", "rejim", "kuzatuv")):
            add(ka)

    for m in (consensus.get("medications") or [])[:6]:
        if not isinstance(m, dict):
            continue
        nm = _s(m.get("name") or m.get("generic"))
        if not nm:
            continue
        dose = _s(m.get("dosage"))
        freq = _s(m.get("frequency"))
        timing = _s(m.get("timing"))
        instr = _s(m.get("instructions"))
        line = nm
        if dose:
            line += f" — {dose}"
        if freq:
            line += f", {freq}"
        if timing:
            line += f" ({timing})"
        if instr:
            line += f". {instr}"
        add(f"Dori-darmon: {line}")

    tests = [_s(t) for t in (consensus.get("recommended_tests") or [])[:4] if _s(t)]
    if len(out) < 2 and tests:
        add(f"Zarur tekshiruvlar: {', '.join(tests)}.")

    if len(out) < 2:
        out = _synthesize_treatment_steps(primary, consensus)
    elif len(out) < 3 and primary and not _is_bad_name(primary):
        synth = _synthesize_treatment_steps(primary, consensus)
        for step in synth:
            add(step)

    return out[:8]


def _is_generic_agreement(text: str) -> bool:
    low = _s(text).lower()
    if not low:
        return True
    if len(low) < 50 and "munozara" not in low and "bahs" not in low and "gipoteza" not in low:
        return True
    hits = sum(1 for m in _GENERIC_AGREEMENT_MARKERS if m in low)
    return hits >= 1 and "kelishuv" not in low and "rad etilgan" not in low


def build_unexpected_findings(
    consensus: dict,
    p1: list[dict],
    p2: list[dict],
    primary: str,
) -> str:
    """Munozara, rad etilgan gipotezalar va differensiallardan batafsil xulosa."""
    from .debate_format import format_debate_synthesis

    sections: list[str] = []
    seen_blocks: set[str] = set()

    def add_block(title: str, body: str) -> None:
        b = _s(body)
        if not b or len(b) < 8:
            return
        key = b.lower()[:80]
        if key in seen_blocks:
            return
        seen_blocks.add(key)
        sections.append(f"▸ {title}\n{b}")

    existing = _s(
        consensus.get("unexpected_findings")
        or consensus.get("unexpectedFindings")
    )
    agreement = _s(consensus.get("agreement_summary") or consensus.get("agreementSummary"))

    if existing and not _is_generic_agreement(existing):
        add_block("KUTILMAGAN TOPILMALAR VA MUNOZARA XULOSASI", existing)
    elif agreement and not _is_generic_agreement(agreement):
        add_block("MUNOZARA XULOSASI", agreement)

    synth = consensus.get("debate_synthesis") or consensus.get("debateSynthesis")
    if isinstance(synth, dict):
        synth_text = format_debate_synthesis(synth)
        if synth_text:
            add_block("KONSILIUM MUNOZARASI TAHLILI", synth_text)

    rejected = consensus.get("rejected_hypotheses") or []
    rej_lines: list[str] = []
    for r in rejected[:5]:
        if not isinstance(r, dict):
            continue
        nm = _s(r.get("name"))
        rs = _s(r.get("reason"))
        if nm:
            rej_lines.append(f"• {nm}" + (f" — {rs}" if rs else ""))
    if rej_lines:
        add_block("RAD ETILGAN GIPOTEZALAR", "\n".join(rej_lines))

    diff_lines: list[str] = []
    for d in (consensus.get("differential_diagnoses") or consensus.get("differentialDiagnoses") or [])[:4]:
        if not isinstance(d, dict):
            continue
        nm = _s(d.get("name"))
        rs = _s(d.get("reason"))
        if nm:
            diff_lines.append(f"• {nm}" + (f" (ehtimol: {d.get('probability', '?')}%)" if d.get("probability") else "") + (f" — {rs}" if rs else ""))
    if not diff_lines and primary:
        for d in _collect_differentials(p1, primary)[:4]:
            diff_lines.append(f"• {d['name']} — {d.get('reason', 'differensial variant')}")
    if diff_lines:
        add_block("KO'RIB CHIQILGAN MUQOBIL TASHXISLAR", "\n".join(diff_lines))

    ref_lines: list[str] = []
    for r in p2 or []:
        if not isinstance(r, dict):
            continue
        for ref in r.get("refutations") or []:
            if not isinstance(ref, dict):
                continue
            target = _s(ref.get("target_diagnosis"))
            refutation = _s(ref.get("refutation"))
            strength = _s(ref.get("strength"))
            if target and refutation:
                tag = f"[{strength}] " if strength else ""
                ref_lines.append(f"• {tag}{target}: {refutation[:280]}")
    if ref_lines:
        add_block("MUNOZARADA INKOR YOKI ZAIFLATILGAN DALILLAR", "\n".join(ref_lines[:6]))

    dissent_lines: list[str] = []
    for d in consensus.get("dissenting_opinions") or []:
        if isinstance(d, dict):
            dissent_lines.append(
                f"• {_s(d.get('diagnosis') or d.get('name'))}: {_s(d.get('reason') or d.get('argument'))}"
            )
        elif isinstance(d, str) and _s(d):
            dissent_lines.append(f"• {_s(d)}")
    if dissent_lines:
        add_block("KONSENSUSGA QO'SHILMAGAN FIKRLAR", "\n".join(dissent_lines[:4]))

    alt_dx: list[str] = []
    primary_l = primary.lower() if primary else ""
    for r in p1 or []:
        if not isinstance(r, dict):
            continue
        pname = _s(r.get("primary_diagnosis"))
        if pname and primary_l and pname.lower() != primary_l and not _is_bad_name(pname):
            chain = r.get("reasoning_chain") or []
            hint = _s(chain[0])[:120] if chain else ""
            alt_dx.append(f"• {pname}" + (f" — {hint}" if hint else ""))
        for rf in r.get("red_flags") or []:
            rf_s = _s(rf)
            if rf_s:
                add_block("SHOSHILINCH / MUHIM BELGI", rf_s)
    if alt_dx:
        add_block("PHASE 1 MUSTAQIL TASHXISLAR (farqli nuqtai nazarlar)", "\n".join(alt_dx[:5]))

    cd = consensus.get("consensus_diagnosis") or {}
    if isinstance(cd, dict):
        just = _s(cd.get("justification"))
        if just and len(just) > 40:
            add_block("ASOSIY KONSENSUS DALILLARI", just[:900])

    if len("\n".join(sections)) < 100 and primary:
        add_block(
            "YAKUNIY XULOSA",
            f"Asosiy tashxis: {primary}. Konsilium Phase 1–2 mutaxassis tahlillari, "
            "refutation va og'irliklar hisobga olingan holda yakuniy qaror qabul qilindi.",
        )

    return "\n\n".join(sections)[:4500]


_BAD_MED_NAMES = frozenset({
    "",
    "dori",
    "doza",
    "tabletka",
    "tavsiya",
    "dori-darmon",
    "farmakoterapiya",
    "unknown",
})


def _is_usable_med(m: dict) -> bool:
    name = _s(m.get("name") or m.get("generic"))
    if len(name) < 2:
        return False
    return name.lower() not in _BAD_MED_NAMES


def _normalize_med_dict(m: dict) -> dict:
    notes = _s(m.get("notes") or m.get("instructions"))
    instr = _s(m.get("instructions") or m.get("notes"))
    return {
        "name": _s(m.get("name") or m.get("generic"))[:120],
        "generic": _s(m.get("generic") or m.get("name"))[:120],
        "dosage": _s(m.get("dosage"))[:200],
        "frequency": _s(m.get("frequency"))[:120],
        "duration": _s(m.get("duration"))[:120],
        "timing": _s(m.get("timing"))[:120],
        "instructions": instr[:400],
        "notes": notes[:500],
        "contraindications": _s(m.get("contraindications"))[:300],
        "local_availability": _s(
            m.get("local_availability") or m.get("localAvailability") or "O'zbekistonda mavjud"
        )[:200],
    }


def _parse_med_from_line(text: str) -> dict | None:
    """Davolash rejasi yoki mutaxassis matnidan dori qatorini ajratadi."""
    raw = _s(text)
    if not raw:
        return None
    low = raw.lower()
    if not any(w in low for w in ("farmakoterapiya", "dori", "mg", "mcg", "iu", "tablet", "kapsul", "ml")):
        return None

    t = re.sub(r"^\d+-qadam:\s*", "", raw, flags=re.I).strip()
    t = re.sub(
        r"^(?:farmakoterapiya|dori[- ]?darmon)\s*[—\-:]\s*",
        "",
        t,
        flags=re.I,
    ).strip()

    name = ""
    dosage = ""
    m = re.match(r"^(.+?)\s*[—\-]\s*(.+)$", t)
    if m:
        name, dosage = m.group(1).strip(), m.group(2).strip()
    else:
        m2 = re.match(
            r"^([A-Za-zА-Яа-яЁёO'ʻG'g'\-\s]{2,40}?)\s+(\d[\d\s./\-–]*(mg|mcg|g|ml|IU|ME|tab).*)",
            t,
            flags=re.I,
        )
        if m2:
            name, dosage = m2.group(1).strip().rstrip(","), m2.group(2).strip()
        elif "(" in t and ")" in t:
            name = t.split("(")[0].strip()
            dosage = t[len(name):].strip(" -—:")
        else:
            parts = re.split(r"[.;]", t, maxsplit=1)
            name = parts[0].strip()
            dosage = parts[1].strip() if len(parts) > 1 else ""

    if len(name) < 2 or name.lower() in _BAD_MED_NAMES:
        return None
    if not dosage and len(name) > 60:
        return None
    return _normalize_med_dict({"name": name, "dosage": dosage, "instructions": dosage})


def _collect_medications(
    consensus: dict,
    p1: list[dict],
    p2: list[dict],
) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []

    def add(m: dict | None) -> None:
        if not m or not _is_usable_med(m):
            return
        key = _s(m.get("name")).lower()
        if key in seen:
            return
        seen.add(key)
        out.append(_normalize_med_dict(m))

    for m in consensus.get("medications") or consensus.get("medication_recommendations") or []:
        if isinstance(m, dict):
            add(m)

    for item in consensus.get("treatment_plan") or []:
        text = _plan_item_to_str(item)
        add(_parse_med_from_line(text))

    for r in p1 or []:
        for part in _split_treatment_text(_s(r.get("initial_treatment_notes"))):
            add(_parse_med_from_line(part))

    for r in p2 or []:
        defense = r.get("defense") or {}
        if isinstance(defense, dict):
            for part in _split_treatment_text(_s(defense.get("argument"))):
                add(_parse_med_from_line(part))
        for part in _split_treatment_text(_s(r.get("key_argument"))):
            add(_parse_med_from_line(part))

    return out[:8]


def _synthesize_medications(primary: str, consensus: dict) -> list[dict]:
    """Oxirgi zaxira: davolash rejasi qadamlaridan dori nomlarini ajratish."""
    if _is_bad_name(primary):
        primary = "asosiy klinik holat"
    meds: list[dict] = []
    for step in consensus.get("treatment_plan") or []:
        text = _plan_item_to_str(step)
        if not text:
            continue
        for chunk in re.split(r"[,;]| va ", text):
            parsed = _parse_med_from_line(chunk)
            if parsed:
                meds.append(parsed)
            elif re.search(r"\b(mg|mcg|IU|tablet)\b", chunk, re.I):
                words = chunk.strip()
                if 5 < len(words) < 120:
                    meds.append(_normalize_med_dict({
                        "name": words[:80],
                        "dosage": "",
                        "notes": f"{primary} bo'yicha konsilium tavsiyasi.",
                    }))
        if len(meds) >= 3:
            break
    if not meds:
        meds.append(_normalize_med_dict({
            "name": primary[:100],
            "dosage": "SSV protokoliga muvofiq individual",
            "notes": (
                f"{primary} uchun O'zbekiston SSV klinik protokoliga muvofiq "
                "farmakoterapiya belgilanadi. Aniq savdo nomi va doza — "
                "tashxis tasdiqlangach shifokor tomonidan yoziladi."
            ),
        }))
    return meds[:6]


def ensure_medications(
    consensus: dict,
    p1: list[dict],
    p2: list[dict],
    primary: str = "",
) -> list[dict]:
    """Mavjud dorilarni tekshiradi; bo'sh bo'lsa P1/P2/rejadan to'ldiradi."""
    primary = primary or _s((consensus.get("consensus_diagnosis") or {}).get("name"))
    usable = [
        _normalize_med_dict(m)
        for m in (consensus.get("medications") or [])
        if isinstance(m, dict) and _is_usable_med(m)
    ]
    if len(usable) >= 1:
        return usable[:8]
    collected = _collect_medications(consensus, p1, p2)
    if collected:
        return collected
    return _synthesize_medications(primary, consensus)


def ensure_treatment_plan(
    consensus: dict,
    p1: list[dict],
    p2: list[dict],
    primary: str = "",
) -> list[str]:
    """Mavjud rejani tekshiradi; yetarli bo'lmasa P1/P2/P3 dan to'ldiradi."""
    primary = primary or _s((consensus.get("consensus_diagnosis") or {}).get("name"))
    usable: list[str] = []
    for item in consensus.get("treatment_plan") or []:
        text = _plan_item_to_str(item)
        for part in _split_treatment_text(text):
            if _is_usable_treatment_step(part):
                usable.append(part[:500])
    if len(usable) >= 2:
        return usable[:8]
    plan = _collect_treatment_plan(p1, p2, consensus, primary)
    return plan if plan else _synthesize_treatment_steps(primary or "klinik holat", consensus)


def _normalize_consensus_diagnosis_obj(consensus: dict) -> dict:
    cd = consensus.get("consensus_diagnosis") or consensus.get("consensusDiagnosis")
    if isinstance(cd, list) and cd:
        first = cd[0]
        if isinstance(first, dict):
            return first
        if isinstance(first, str):
            return {"name": first, "probability": 70}
    if isinstance(cd, dict):
        return cd
    if isinstance(cd, str) and cd.strip():
        return {"name": cd.strip(), "probability": 70}
    # Ba'zan model tekis JSON qaytaradi
    if _s(consensus.get("name")) and not cd:
        return {
            "name": _s(consensus.get("name")),
            "probability": consensus.get("probability", 70),
            "justification": _s(consensus.get("justification")),
        }
    return {}


def ensure_consensus_from_phases(
    consensus: dict,
    p1: list[dict],
    p2: list[dict],
    weights: dict[str, float],
    language: str = "uz-L",
) -> dict:
    """P3 buzilgan/bo'sh bo'lsa P1/P2 dan to'ldiradi."""
    if not isinstance(consensus, dict):
        consensus = {}

    cd = _normalize_consensus_diagnosis_obj(consensus)
    if _is_bad_name(_s(cd.get("name"))):
        fallback = _best_from_phases(p1, p2, weights)
        if fallback:
            cd = {**fallback, **{k: v for k, v in cd.items() if v and k != "name"}}
    consensus["consensus_diagnosis"] = cd

    primary = _s(cd.get("name"))
    if not consensus.get("differential_diagnoses") and not consensus.get("differentialDiagnoses"):
        diffs = _collect_differentials(p1, primary)
        if diffs:
            consensus["differential_diagnoses"] = diffs

    if not consensus.get("recommended_tests"):
        tests = _collect_tests(p1, p2)
        if tests:
            consensus["recommended_tests"] = tests

    consensus["treatment_plan"] = ensure_treatment_plan(consensus, p1, p2, primary)
    consensus["medications"] = ensure_medications(consensus, p1, p2, primary)

    rejected = _collect_rejected_hypotheses(consensus, p1, p2, primary)
    if rejected:
        consensus["rejected_hypotheses"] = rejected

    unexpected = build_unexpected_findings(consensus, p1, p2, primary)
    if unexpected:
        consensus["unexpected_findings"] = unexpected
        if not _s(consensus.get("agreement_summary")) or _is_generic_agreement(
            _s(consensus.get("agreement_summary"))
        ):
            consensus["agreement_summary"] = unexpected[:2000]

    if primary and not _s(cd.get("justification")):
        cd["justification"] = _s(consensus.get("agreement_summary"))[:800]
        consensus["consensus_diagnosis"] = cd

    consensus = ensure_nutrition_prevention(consensus, language_hint=language)
    consensus = ensure_related_research(consensus, language_hint=language)
    return consensus


def ensure_related_research(consensus: dict, language_hint: str = "uz-L") -> dict:
    """Xalqaro dalil manbalari bo'sh qolmasin."""
    if not isinstance(consensus, dict):
        return consensus
    existing = consensus.get("related_research") or consensus.get("relatedResearch") or []
    if isinstance(existing, list) and len(existing) >= 4:
        return consensus
    cd = consensus.get("consensus_diagnosis") or {}
    diag = _s(cd.get("name") if isinstance(cd, dict) else "") or "klinik holat"
    from .evidence_sources import build_fast_research_sources
    from .diagnosis_enrichment import _merge_research
    _merge_research(consensus, build_fast_research_sources(diag, language_hint, ""))
    return consensus


def ensure_nutrition_prevention(consensus: dict, language_hint: str = "uz-L") -> dict:
    """Ovqatlanish va profilaktika bo'sh qolmasin — tashxisga mos fallback yoki to'ldirish."""
    if not isinstance(consensus, dict):
        return consensus

    cd = consensus.get("consensus_diagnosis") or {}
    diag = _s(cd.get("name") if isinstance(cd, dict) else "") or "asosiy tashxis"

    np = consensus.get("nutrition_prevention") or consensus.get("nutritionPrevention")
    existing_dietary: list[str] = []
    existing_prevention: list[str] = []
    existing_intro = ""
    existing_disclaimer = ""
    existing_individual: list[dict] = []
    if isinstance(np, dict):
        existing_dietary = [str(x).strip() for x in (np.get("dietary_guidelines") or np.get("dietaryGuidelines") or []) if str(x).strip()]
        existing_prevention = [str(x).strip() for x in (np.get("prevention_measures") or np.get("preventionMeasures") or []) if str(x).strip()]
        existing_intro = str(np.get("intro") or "").strip()
        existing_disclaimer = str(np.get("disclaimer") or "").strip()
        raw_ind = np.get("individual_diet_by_diagnosis") or np.get("individualDietByDiagnosis")
        if isinstance(raw_ind, list):
            existing_individual = [x for x in raw_ind if isinstance(x, dict)]
        if len(existing_dietary) >= 3 and len(existing_prevention) >= 3:
            return consensus

    lang = (language_hint or "uz-L").split("-")[0]
    if lang == "ru":
        intro = (
            f"Рекомендации по питанию и профилактике для «{diag}» основаны на принципах "
            f"ВОЗ, международных руководствах и национальных протоколах МЗ РУз."
        )
        disclaimer = "Индивидуальная диета — только после консультации врача/диетолога."
        dietary = [
            f"Сбалансированное питание с акцентом на овощи, цельнозерновые и нежирный белок ({diag})",
            "Ограничение избытка соли (<5 г/сут) и добавленного сахара (ВОЗ)",
            "Достаточное потребление воды в течение дня",
            "Дробное питание, избегать переедания и поздних тяжёлых приёмов пищи",
            "Ограничить жареное, копчёное и ультрапереработанные продукты",
        ]
        prevention = [
            "Регулярная умеренная физическая активность (150 мин/нед, ВОЗ)",
            "Контроль веса, АД, глюкозы и липидов по показаниям",
            "Своевременные скрининги и диспансерное наблюдение",
            "Отказ от курения и ограничение алкоголя",
            "Соблюдение режима сна и снижение хронического стресса",
        ]
    elif lang == "en":
        intro = (
            f"Diet and prevention for «{diag}» align with WHO principles, international "
            f"guidelines (ESC/ADA/NICE) and Uzbekistan national protocols."
        )
        disclaimer = "Individual diet plans require physician/dietitian consultation."
        dietary = [
            f"Balanced plate: vegetables, whole grains, lean protein for {diag}",
            "Limit salt (<5 g/day) and added sugars (WHO)",
            "Adequate daily hydration",
            "Regular meal timing; avoid late heavy meals",
            "Reduce fried, smoked and ultra-processed foods",
        ]
        prevention = [
            "Moderate physical activity ≥150 min/week (WHO)",
            "Monitor weight, BP, glucose and lipids as indicated",
            "Scheduled screenings and follow-up visits",
            "Smoking cessation; limit alcohol",
            "Sleep hygiene and stress reduction",
        ]
    else:
        intro = (
            f"«{diag}» uchun to'g'ri ovqatlanish va profilaktika tavsiyalari WHO, "
            f"xalqaro qo'llanmalar (ESC/ADA/NICE) va O'zbekiston SSV protokollari "
            f"asosida shakllantirildi."
        )
        disclaimer = "Individual parhez va doimiy kuzatuv uchun shifokor/dietolog maslahati shart."
        dietary = [
            f"Kunlik ratsion: sabzavot, to'liq don, oz yog'li oqsil ({diag} uchun mos)",
            "Tuz va qo'shilgan shakarni cheklash — kuniga 5 g dan kam (WHO)",
            "Kun bo'yi yetarli suv ichish",
            "Muntazam ovqatlanish vaqti; kechki og'ir ovqatdan saqlanish",
            "Qovurilgan, dymli va ultra-qayta ishlangan mahsulotlarni kamaytirish",
        ]
        prevention = [
            "Haftasiga kamida 150 daqiqa o'rtacha jismoniy faollik (WHO)",
            "Vazn, qon bosimi, glyukoza va lipidlar nazorati (ko'rsatma bo'yicha)",
            "Rejalashtirilgan skrining va dispanser kuzatuv",
            "Chekishni tashlash; alkogolni cheklash",
            "Uyqu rejimi va stressni kamaytirish",
        ]

    individual = [{
        "diagnosis": diag,
        "allowed_foods": dietary[:3],
        "restricted_foods": [
            "Ortiqcha tuz va shakarli ichimliklar",
            "Juda yog'li va qovurilgan taomlar",
            "Spirtli ichimliklar (shifokor ruxsatisiz)",
        ],
        "meal_plan_notes": f"«{diag}» uchun kunlik ovqatlanish individual holatga qarab moslashtiriladi.",
    }]

    consensus["nutrition_prevention"] = {
        "intro": existing_intro or intro,
        "disclaimer": existing_disclaimer or disclaimer,
        "dietary_guidelines": existing_dietary if len(existing_dietary) >= 3 else dietary,
        "prevention_measures": existing_prevention if len(existing_prevention) >= 3 else prevention,
        "individual_diet_by_diagnosis": existing_individual if existing_individual else individual,
    }
    return consensus
