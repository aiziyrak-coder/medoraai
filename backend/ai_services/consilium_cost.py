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
    """Frontend jamoa 4–10; backend professor agentlari doim 4."""
    try:
        n = int(getattr(settings, "CONSILIUM_AGENT_LIMIT", 4) or 4)
    except (TypeError, ValueError):
        n = 4
    return max(4, min(10, n))


def default_max_tokens() -> int:
    return {
        "scale": 2048,
        "economy": 2048,
        "balanced": 3072,
        "quality": 8192,
    }.get(ai_cost_mode(), 2048)


def phase1_max_tokens() -> int:
    return {"scale": 1500, "economy": 1600, "balanced": 2000, "quality": 2800}.get(
        ai_cost_mode(), 1500
    )


def phase2_max_tokens() -> int:
    return {"scale": 1600, "economy": 1700, "balanced": 2200, "quality": 3200}.get(
        ai_cost_mode(), 1600
    )


def phase3_max_tokens() -> int:
    return {"scale": 4096, "economy": 3584, "balanced": 5120, "quality": 8000}.get(
        ai_cost_mode(), 4096
    )


def pharma_max_tokens() -> int:
    return {"scale": 1200, "economy": 1500, "balanced": 2000, "quality": 2500}.get(
        ai_cost_mode(), 1200
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
            rc = [_str_clip(x, 180) for x in rc[:4]]
        evidence = r.get("supporting_evidence") or []
        if isinstance(evidence, list):
            evidence = [_str_clip(x, 130) for x in evidence[:4]]
        diff = []
        for d in (r.get("differential") or [])[:3]:
            if not isinstance(d, dict):
                continue
            diff.append({
                "name": _str_clip(d.get("name"), 90),
                "p": d.get("probability"),
                "reason": _str_clip(d.get("reason"), 100),
            })
        out.append({
            "agent_id": r.get("agent_id"),
            "primary_diagnosis": _str_clip(r.get("primary_diagnosis"), 180),
            "probability": r.get("probability"),
            "reasoning_chain": rc,
            "supporting_evidence": evidence,
            "differential": diff,
            "red_flags": [_str_clip(x, 120) for x in (r.get("red_flags") or [])[:3]],
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
        for ref in (r.get("refutations") or [])[:4]:
            if not isinstance(ref, dict):
                continue
            refs.append({
                "target": ref.get("target_agent_id"),
                "target_dx": _str_clip(ref.get("target_diagnosis"), 100),
                "strength": ref.get("strength"),
                "refutation": _str_clip(ref.get("refutation"), 200),
            })
        defense = r.get("defense") or {}
        def_arg = ""
        def_ev = ""
        if isinstance(defense, dict):
            def_arg = _str_clip(defense.get("argument"), 180)
            def_ev = _str_clip(defense.get("new_evidence"), 150)
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
            "revised_diagnosis": _str_clip(r.get("revised_diagnosis"), 180),
            "revised_probability": r.get("revised_probability"),
            "refutations": refs,
            "defense": def_arg,
            "new_evidence": def_ev,
            "accepted": accepted,
            "key_argument": _str_clip(r.get("key_argument"), 180),
        })
    return out


def dumps_compact(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
