"""
Konsilium xarajatini kamaytirish (masshtab: minglab sessiyalar).
Tashxis sifati: Phase 3 (konsensus) va generate_diagnoses — doim diagnosis model (Sonnet).
"""
from __future__ import annotations

import json
from typing import Any

from django.conf import settings


def ai_cost_mode() -> str:
    return (getattr(settings, "AI_COST_MODE", "scale") or "scale").strip().lower()


def consilium_agent_limit() -> int:
    """Scale rejimida 3 ta agent — tezroq konsilium."""
    mode = ai_cost_mode()
    default = 3 if mode in ("scale", "economy") else 4
    try:
        n = int(getattr(settings, "CONSILIUM_AGENT_LIMIT", default) or default)
    except (TypeError, ValueError):
        n = default
    return max(2, min(4, n))


def phase_timeout_sec() -> int:
    return {"scale": 38, "economy": 42, "balanced": 50, "quality": 55}.get(
        ai_cost_mode(), 38
    )


def skip_phase2_debate() -> bool:
    """Scale/economy: Phase 2 LLM chaqiruvlarini o'tkazib yuborish."""
    return ai_cost_mode() in ("scale", "economy")


def default_max_tokens() -> int:
    return {
        "scale": 3072,
        "economy": 3072,
        "balanced": 4096,
        "quality": 8192,
    }.get(ai_cost_mode(), 3072)


def phase1_max_tokens() -> int:
    return {"scale": 1800, "economy": 2200, "balanced": 2800, "quality": 4096}.get(
        ai_cost_mode(), 1800
    )


def phase2_max_tokens() -> int:
    return {"scale": 2000, "economy": 2400, "balanced": 3200, "quality": 4500}.get(
        ai_cost_mode(), 2000
    )


def phase3_max_tokens() -> int:
    return {"scale": 3200, "economy": 4000, "balanced": 6144, "quality": 10000}.get(
        ai_cost_mode(), 3200
    )


def pharma_max_tokens() -> int:
    return {"scale": 900, "economy": 1100, "balanced": 1600, "quality": 2800}.get(
        ai_cost_mode(), 900
    )


def _str_clip(val: Any, n: int) -> str:
    return str(val or "")[:n]


def compact_phase1(rows: list[dict]) -> list[dict[str, Any]]:
    """P3 uchun zich, lekin dalilni saqlagan xulosa."""
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        rc = r.get("reasoning_chain") or r.get("reasoningChain") or []
        if isinstance(rc, list):
            rc = [_str_clip(x, 320) for x in rc[:6]]
        evidence = r.get("supporting_evidence") or []
        if isinstance(evidence, list):
            evidence = [_str_clip(x, 220) for x in evidence[:6]]
        diff = []
        for d in (r.get("differential") or [])[:4]:
            if not isinstance(d, dict):
                continue
            diff.append({
                "name": _str_clip(d.get("name"), 140),
                "p": d.get("probability"),
                "reason": _str_clip(d.get("reason"), 200),
            })
        tests = [_str_clip(x, 180) for x in (r.get("recommended_tests") or [])[:4]]
        out.append({
            "agent_id": r.get("agent_id"),
            "primary_diagnosis": _str_clip(r.get("primary_diagnosis"), 280),
            "probability": r.get("probability"),
            "reasoning_chain": rc,
            "supporting_evidence": evidence,
            "differential": diff,
            "recommended_tests": tests,
            "initial_treatment_notes": _str_clip(r.get("initial_treatment_notes"), 350),
            "red_flags": [_str_clip(x, 180) for x in (r.get("red_flags") or [])[:4]],
            "confidence": r.get("confidence"),
            "evidence_level": r.get("evidence_level"),
        })
    return out


def compact_phase2(rows: list[dict]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        refs = []
        for ref in (r.get("refutations") or [])[:5]:
            if not isinstance(ref, dict):
                continue
            refs.append({
                "target": ref.get("target_agent_id"),
                "target_dx": _str_clip(ref.get("target_diagnosis"), 180),
                "strength": ref.get("strength"),
                "refutation": _str_clip(ref.get("refutation"), 400),
            })
        defense = r.get("defense") or {}
        def_arg = ""
        def_ev = ""
        if isinstance(defense, dict):
            def_arg = _str_clip(defense.get("argument"), 350)
            def_ev = _str_clip(defense.get("new_evidence"), 280)
        accepted = []
        for a in (r.get("accepted_from_others") or [])[:3]:
            if not isinstance(a, dict):
                continue
            accepted.append({
                "from": a.get("agent_id"),
                "point": _str_clip(a.get("point"), 150),
            })
        out.append({
            "agent_id": r.get("agent_id"),
            "revised_diagnosis": _str_clip(r.get("revised_diagnosis"), 280),
            "revised_probability": r.get("revised_probability"),
            "refutations": refs,
            "defense": def_arg,
            "new_evidence": def_ev,
            "accepted": accepted,
            "key_argument": _str_clip(r.get("key_argument"), 400),
        })
    return out


def dumps_compact(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
