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
    return {"scale": 1400, "economy": 1600, "balanced": 2000, "quality": 2500}.get(
        ai_cost_mode(), 1400
    )


def phase2_max_tokens() -> int:
    return {"scale": 1600, "economy": 1800, "balanced": 2200, "quality": 3000}.get(
        ai_cost_mode(), 1600
    )


def phase3_max_tokens() -> int:
    return {"scale": 5120, "economy": 4096, "balanced": 6144, "quality": 8000}.get(
        ai_cost_mode(), 5120
    )


def compact_phase1(rows: list[dict]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        rc = r.get("reasoning_chain") or r.get("reasoningChain") or []
        if isinstance(rc, list):
            rc = [str(x)[:200] for x in rc[:3]]
        out.append(
            {
                "agent_id": r.get("agent_id"),
                "primary_diagnosis": (r.get("primary_diagnosis") or "")[:200],
                "probability": r.get("probability"),
                "reasoning_chain": rc,
                "red_flags": (r.get("red_flags") or [])[:2],
                "confidence": r.get("confidence"),
            }
        )
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
            refs.append(
                {
                    "target": ref.get("target_agent_id"),
                    "strength": ref.get("strength"),
                    "refutation": str(ref.get("refutation") or "")[:180],
                }
            )
        out.append(
            {
                "agent_id": r.get("agent_id"),
                "revised_diagnosis": (r.get("revised_diagnosis") or "")[:200],
                "revised_probability": r.get("revised_probability"),
                "refutations": refs,
                "key_argument": str(r.get("key_argument") or "")[:200],
            }
        )
    return out


def dumps_compact(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
