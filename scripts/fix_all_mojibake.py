#!/usr/bin/env python3
"""
Platform-wide mojibake cleanup: replace corrupted Unicode with ASCII equivalents.
Run from repo root: python scripts/fix_all_mojibake.py
"""
import os

# (old, new) string replacements - order matters
REPLACEMENTS = [
    ('\u0432\u0402\u2014', ' - '),   # mojibake em dash
    ('\u0432\u0402\u201C', ' - '),
    ('\u0432\u0402\u201D', ' - '),
    ('\u0432\u0402\u2022', '- '),    # mojibake bullet
    ('\u0432\u2020\u2018', ' -> '),  # mojibake arrow
    ('\u0432\u2020\u2019', ' -> '),
    ('\u0432\u201E\u2013', 'No. '),  # mojibake numero
    ('\u2014', ' - '),   # em dash
    ('\u2013', ' - '),   # en dash
    ('\u2022', '- '),    # bullet
    ('\u2192', ' -> '),  # right arrow
]

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            s = f.read()
    except Exception:
        return False
    orig = s
    for old, new in REPLACEMENTS:
        s = s.replace(old, new)
    if s != orig:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(s)
        return True
    return False

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    exts = {'.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.md', '.cjs', '.env.example'}
    skip_dirs = {'node_modules', '__pycache__', '.git', 'dist', 'build', '.venv', 'venv'}
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for name in filenames:
            if os.path.splitext(name)[1] in exts:
                path = os.path.join(dirpath, name)
                if 'scripts' in path and path.endswith('fix_all_mojibake.py'):
                    continue
                if fix_file(path):
                    print(path)
                    count += 1
    print('Total files updated:', count)

if __name__ == '__main__':
    main()
