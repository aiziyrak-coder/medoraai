"""FJSTI Ziyrak — loglardan tashqi AI provayder izlarini olib tashlash."""
from __future__ import annotations

import logging
import re

_REDACT_PATTERNS = (
    re.compile(r"openai\.com[^\s]*", re.I),
    re.compile(r"api\.deepseek\.com[^\s]*", re.I),
    re.compile(r"deepseek[-_]?(?:chat|reasoner|api|key)", re.I),
    re.compile(r"openai[-_]?(?:api|key|gpt)", re.I),
    re.compile(r"gpt-4o(?:-mini)?", re.I),
    re.compile(r"anthropic[^\s]*", re.I),
    re.compile(r"azure[-_]?openai[^\s]*", re.I),
    re.compile(r"sk-[A-Za-z0-9]{10,}", re.I),
)


def sanitize_log_text(text: str) -> str:
    if not text:
        return text
    out = str(text)
    for pat in _REDACT_PATTERNS:
        out = pat.sub("[FJSTI-Ziyrak]", out)
    return out


class ZiyrakLogSanitizerFilter(logging.Filter):
    """Console/fayl loglarida tashqi provayder nomlarini yashirish."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if record.msg:
                record.msg = sanitize_log_text(str(record.msg))
            if record.args:
                record.args = tuple(
                    sanitize_log_text(str(a)) if isinstance(a, str) else a
                    for a in record.args
                )
        except Exception:
            pass
        return True
