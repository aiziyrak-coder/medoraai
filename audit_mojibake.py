#!/usr/bin/env python3
"""
Platform-wide mojibake audit: replace all known corrupted characters with clean ASCII/Latin.
Run from repo root: python audit_mojibake.py
"""
import os
import re

# (pattern, replacement) - order matters for overlapping cases
REPLACEMENTS = [
    # Em dash / en dash mojibake -> " - "
    (re.compile(r'\u0432\u0402["\u201c\u201d]\s*'), ' - '),
    (re.compile(r'\u0432\u0402\u2014'), ' - '),
    # Bullet mojibake -> "- "
    (re.compile(r'\u0432\u0402\u0451'), '- '),
    # Apostrophe mojibake (o'chirilgan, qo'shildi, etc.)
    (re.compile(r'o\u0432\u0402\u0092'), "o'"),
    (re.compile(r'qo\u0432\u0402\u0092'), "qo'"),
    (re.compile(r'so\u0432\u0402\u0092'), "so'"),
    (re.compile(r'to\u0432\u0402\u0092'), "to'"),
    (re.compile(r'bo\u0432\u0402\u0092'), "bo'"),
    (re.compile(r'ta\u0432\u0402\u2122'), "ta'"),
    (re.compile(r'o\u0432\u0402\u0092sha'), "o'sha"),
    (re.compile(r'\u0432\u0402\u0092chirilgan'), "'chirilgan"),
    (re.compile(r'\u0432\u0402\u0092shilgan'), "'shilgan"),
    (re.compile(r'\u0432\u0402\u0092rnatiladi'), "'rnatiladi"),
    (re.compile(r'\u0432\u0402\u0092rovlarda'), "'rovlarda"),
    (re.compile(r'\u0432\u0402\u0092liq'), "'liq"),
    (re.compile(r'\u0432\u0402\u0092lsangiz'), "'lsangiz"),
    (re.compile(r'\u0432\u0402\u0092lgan'), "'lgan"),
]

# Literal string replacements (for raw bytes that might be in files)
LITERAL_REPLACEMENTS = [
    ('\u0432\u0402\u2014', ' - '),   # вЂ" (em dash)
    ('\u0432\u0402\u0451', '- '),    # вЂў (bullet)
    ('\u0432\u0402"', ' - '),
    ('\u0432\u0402\u201c', ' - '),
    ('\u0432\u0402\u201d', ' - '),
]

def fix_content(content):
    out = content
    for pat, repl in REPLACEMENTS:
        out = pat.sub(repl, out)
    for old, new in LITERAL_REPLACEMENTS:
        out = out.replace(old, new)
    # Common mojibake sequences (if file was saved with wrong encoding)
    out = re.sub(r'\u0432\u0402[\u2014\u2013\u201c\u201d"]\s*', ' - ', out)
    out = re.sub(r'\u0432\u0402\u0451\s*', '- ', out)
    return out

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    backend = os.path.join(root, 'backend')
    frontend = os.path.join(root, 'frontend')
    fixed_count = 0
    for base, ext in [(backend, ('.py', '.md', '.txt', '.example')), (frontend, ('.ts', '.tsx', '.js', '.jsx', '.cjs', '.json', '.html', '.css'))]:
        if not os.path.isdir(base):
            continue
        for dirpath, _, filenames in os.walk(base):
            for f in filenames:
                if not f.endswith(ext):
                    continue
                path = os.path.join(dirpath, f)
                try:
                    with open(path, 'r', encoding='utf-8') as file:
                        content = file.read()
                except Exception:
                    continue
                new_content = fix_content(content)
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as file:
                        file.write(new_content)
                    fixed_count += 1
                    print(path)
    print('Total files updated:', fixed_count)

if __name__ == '__main__':
    main()
