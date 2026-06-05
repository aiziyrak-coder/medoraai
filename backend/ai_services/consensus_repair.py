"""
Konsilium Phase 3 natijasi buzilsa yoki bo'sh qolsa — P1/P2 dan kuchli fallback.
"""
from __future__ import annotations

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


def _collect_treatment(p1: list[dict], consensus: dict) -> list[str]:
    plan = list(consensus.get("treatment_plan") or [])
    if plan:
        return [str(x) for x in plan if _s(x)]
    notes: list[str] = []
    for r in p1 or []:
        n = _s(r.get("initial_treatment_notes"))
        if n:
            notes.append(n[:400])
    meds = consensus.get("medications") or []
    if isinstance(meds, list):
        for m in meds[:5]:
            if not isinstance(m, dict):
                continue
            nm = _s(m.get("name") or m.get("generic"))
            dose = _s(m.get("dosage"))
            if nm:
                notes.append(f"{nm}" + (f" — {dose}" if dose else ""))
    return notes[:8] if notes else ["Konsensus davolash rejasi — shifokor tasdiqlashi kerak."]


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

    if not consensus.get("treatment_plan"):
        consensus["treatment_plan"] = _collect_treatment(p1, consensus)

    if not _s(consensus.get("agreement_summary")):
        synth = consensus.get("debate_synthesis") or consensus.get("debateSynthesis")
        if isinstance(synth, dict) and _s(synth.get("summary")):
            consensus["agreement_summary"] = _s(synth.get("summary"))
        elif primary:
            consensus["agreement_summary"] = (
                f"Konsilium munozarasi yakunida asosiy tashxis: {primary}. "
                "Dalillar Phase 1–2 mutaxassis tahlillari va refutation og'irligi asosida birlashtirildi."
            )

    if not consensus.get("rejected_hypotheses"):
        rejected = []
        for r in p1 or []:
            pname = _s(r.get("primary_diagnosis"))
            if pname and primary and pname.lower() != primary.lower() and not _is_bad_name(pname):
                rejected.append({
                    "name": pname,
                    "reason": "Yuqori og'irlikdagi konsensus dalillari asosida ikkinchi darajali gipoteza.",
                })
        if rejected:
            consensus["rejected_hypotheses"] = rejected[:4]

    if primary and not _s(cd.get("justification")):
        cd["justification"] = _s(consensus.get("agreement_summary"))[:800]
        consensus["consensus_diagnosis"] = cd

    return consensus
