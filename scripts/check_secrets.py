#!/usr/bin/env python3
"""
Sirlarni kuzatilayotgan fayllarda topib, CI'ni yiqitadi.

Nega kerak: parol va API kalitlar `.env` da emas, `.md` va `.ps1` fayllar
ichiga qo'lda yozilgan edi — `.gitignore` bunga yordam bermaydi. Bu skript
o'sha xatoning qaytishini to'xtatadi.

Ishga tushirish:  python scripts/check_secrets.py
Chiqish kodi:     0 — toza, 1 — sir topildi
"""
from __future__ import annotations

import re
import subprocess
import sys

# (nom, naqsh) — naqsh sirning SHAKLINI qidiradi, sirning o'zi bu yerda yozilmaydi.
PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Google API kaliti",      re.compile(r"AIza[0-9A-Za-z_\-]{35}")),
    ("Telegram bot tokeni",    re.compile(r"\b\d{8,12}:AA[0-9A-Za-z_\-]{30,}")),
    ("OpenAI/Anthropic kalit", re.compile(r"\b(?:sk|sk-ant)-[0-9A-Za-z_\-]{20,}")),
    ("AWS kirish kaliti",      re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Django insecure kalit",  re.compile(r"django-insecure-[0-9A-Za-z_\-@#%^&*+=]{10,}")),
    ("Xususiy kalit bloki",    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("SSH parol bayrog'i",     re.compile(r"(?:plink|pscp|sshpass)[^\n]{0,80}?-(?:pw|p)\s+(?!\$|\"?\$)[A-Za-z0-9!@#%^&*]{6,}")),
    ("Kodda parol tayinlash",  re.compile(
        r"(?i)\b(?:password|passwd|parol|secret_key|api_key|token)\s*[=:]\s*['\"][A-Za-z0-9!@#%^&*_\-]{8,}['\"]")),
]

# Namuna/shablon fayllar va bu skriptning o'zi tekshirilmaydi.
SKIP_FILES = {"scripts/check_secrets.py"}
SKIP_SUFFIX = (".env.example", "package-lock.json", ".min.js", ".map")
SKIP_DIRS = ("node_modules/", "dist/", ".git/")

# To'g'ri yozilgan o'rindoshlar — sir emas.
PLACEHOLDER = re.compile(
    r"(?i)\$\{?\w+\}?|\$env:|os\.environ|process\.env|<[a-z_]+>|your[-_]|xxx+|placeholder|example"
    r"|change[-_]?(?:this|me|in)|dev[-_]key|test[-_]only|\.\.\."
)


def csv_has_password_column(path: str) -> bool:
    """CSV parol ustuni — eksport qilingan hisob ma'lumotlari."""
    if not path.lower().endswith(".csv"):
        return False
    try:
        with open(path, encoding="utf-8-sig", errors="ignore") as fh:
            header = fh.readline().lower()
    except OSError:
        return False
    return any(c in header for c in ("parol", "password", "passwd", "пароль"))


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], capture_output=True, text=True, check=True
    ).stdout
    return [f for f in out.splitlines() if f.strip()]


def should_skip(path: str) -> bool:
    if path in SKIP_FILES or path.endswith(SKIP_SUFFIX):
        return True
    return any(d in path for d in SKIP_DIRS)


def main() -> int:
    findings: list[tuple[str, int, str, str]] = []

    for path in tracked_files():
        if should_skip(path):
            continue
        try:
            with open(path, encoding="utf-8", errors="ignore") as fh:
                lines = fh.readlines()
        except OSError:
            continue

        if csv_has_password_column(path):
            findings.append((path, 1, "Parol ustunli CSV", "<hisob ma'lumotlari>"))
            continue

        for num, line in enumerate(lines, 1):
            if len(line) > 2000:
                continue
            for name, pattern in PATTERNS:
                m = pattern.search(line)
                if not m:
                    continue
                # O'rindosh bo'lsa — o'tkazamiz
                if PLACEHOLDER.search(m.group(0)):
                    continue
                findings.append((path, num, name, m.group(0)[:12] + "..."))
                break

    if not findings:
        print("Sir topilmadi — toza.")
        return 0

    print(f"XATO: {len(findings)} ta ehtimoliy sir topildi:\n")
    for path, num, name, sample in findings:
        print(f"  {path}:{num}  [{name}]  {sample}")
    print(
        "\nSirni kodga yozmang. Muhit o'zgaruvchisi (.env) orqali bering."
        "\nAgar bu noto'g'ri signal bo'lsa — scripts/check_secrets.py dagi"
        " PLACEHOLDER naqshiga mos yozing yoki SKIP ro'yxatiga qo'shing."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
