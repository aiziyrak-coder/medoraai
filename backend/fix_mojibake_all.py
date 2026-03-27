# Fix all mojibake in backend. Run: python fix_mojibake_all.py
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))

def fix(s):
    # Em dash / dash mojibake ( -  or  - ) -> " - "
    s = s.replace('\u0432\u0402\u2014', ' - ')
    s = s.replace('\u0432\u0402\u201c', ' - ')
    s = s.replace('\u0432\u0402\u201d', ' - ')
    s = s.replace('\u0432\u0402"', ' - ')
    # Bullet (UTF-8 mojibake) -> "- "
    s = s.replace('\u0432\u0402\u0451', '- ')
    # Apostrophe mojibake (o'rnida, qo'shildi, etc.)
    s = s.replace('o\u0432\u0402\u0092', "o'")
    s = s.replace('qo\u0432\u0402\u0092', "qo'")
    s = s.replace('so\u0432\u0402\u0092', "so'")
    s = s.replace('to\u0432\u0402\u0092', "to'")
    s = s.replace('bo\u0432\u0402\u0092', "bo'")
    s = s.replace("ta\u0432\u0402\u2122", "ta'")
    s = s.replace('o\u0432\u0402\u0092sha', "o'sha")
    s = s.replace('\u0432\u0402\u0092chirilgan', "'chirilgan")
    s = s.replace('\u0432\u0402\u0092shildi', "'shildi")
    s = s.replace('\u0432\u0402\u0092rnatiladi', "'rnatiladi")
    s = s.replace('\u0432\u0402\u0092rovlarda', "'rovlarda")
    s = s.replace('\u0432\u0402\u0092liq', "'liq")
    s = s.replace('\u0432\u0402\u0092lsangiz', "'lsangiz")
    s = s.replace('\u0432\u0402\u0092lgan', "'lgan")
    s = s.replace('\u0432\u0402\u0092minlangan', "'minlangan")
    s = s.replace('to\u0432\u0402\u0092liq', "to'liq")
    # Long separator lines: replace the 3-char mojibake with single dash
    s = s.replace('\u0432\u201c\u0402', '-')
    # Degree sign: Cyrillic В (U+0412) + ° -> just °
    s = s.replace('\u0412\u00b0', '\u00b0')
    return s

count = 0
for dirpath, _, files in os.walk(ROOT):
    for f in files:
        if not f.endswith(('.py', '.md', '.example', '.txt')):
            continue
        path = os.path.join(dirpath, f)
        try:
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
        except Exception:
            continue
        new_content = fix(content)
        if new_content != content:
            with open(path, 'w', encoding='utf-8') as file:
                file.write(new_content)
            count += 1
            print(path)
print('Updated', count, 'files')
