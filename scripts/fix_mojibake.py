# -*- coding: utf-8 -*-
"""Replace mojibake and special Unicode with safe ASCII across the repo."""
import os
import re

# Pairs: (regex pattern, replacement). Use raw strings.
REPLACEMENTS = [
    (re.compile(r'\u2014'), ' - '),   #  - 
    (re.compile(r'\u2013'), ' - '),   #  - 
    (re.compile(r'вЂ"'), ' - '),       # mojibake em dash (3 chars)
    (re.compile(r'вЂў'), ' - '),       # bullet mojibake
    (re.compile(r'вњ…'), '[+]'),       # checkmark mojibake
    (re.compile(r'в†''), ' -> '),      # arrow (note: second quote may be special)
    (re.compile(r'No. '), 'No.'),       # numero
    (re.compile(r'вќЊ'), '[-]'),       # X mark mojibake
    (re.compile(r'в[\u201C\u201D]Ђ'), '-'),
    (re.compile(r'рџљЂ'), '[!]'),
    (re.compile(r"рџ'¤"), ''),
    (re.compile(r'рџ["\u201C]\s*±'), ''),
    (re.compile(r'рџ''ЁвЂЌвљ- пёЏ'), ''),
    (re.compile(r"рџ'°"), ''),
    (re.compile(r'рџ"…'), ''),
    (re.compile(r'вљ пёЏ'), ''),
]

def fix_content(text):
    for pattern, repl in REPLACEMENTS:
        text = pattern.sub(repl, text)
    return text

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    exts = ('.py', '.ts', '.tsx', '.js', '.css', '.html', '.json', '.md')
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ('node_modules', '__pycache__', '.git', 'dist')]
        for f in filenames:
            if not f.endswith(exts):
                continue
            path = os.path.join(dirpath, f)
            try:
                with open(path, 'r', encoding='utf-8') as fp:
                    content = fp.read()
            except Exception:
                continue
            new_content = fix_content(content)
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as fp:
                    fp.write(new_content)
                print('Fixed:', path)

if __name__ == '__main__':
    main()
