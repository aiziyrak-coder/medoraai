/**
 * Platform-wide mojibake audit: replace ALL garbled/special Unicode with safe ASCII.
 * Run from repo root: node scripts/fix-mojibake-audit.mjs
 */
import fs from 'fs';
import path from 'path';

const replacements = [
  // Em dash / en dash mojibake (UTF-8 misinterpreted)
  [/\u2014/g, ' - '],   // —
  [/\u2013/g, ' - '],   // –
  [/\u2014/g, ' - '],   // — em dash
  [/\u2013/g, ' - '],   // – en dash
  [/\u0432\u0402\u201C/g, ' - '],  // вЂ" mojibake for —
  [/\u0432\u0402\u0458/g, ' - '],  // вЂў bullet mojibake
  [/\u0432\u045E\u2026/g, '[+]'],  // вњ… checkmark mojibake
  [/\u0432\u2020\u2018/g, ' -> '], // в†' arrow mojibake
  [/\u0432\u201E\u2013/g, 'No.'],  // в„– numero mojibake
  // Emoji mojibake (рџ... ) -> plain
  [/\u0440\u0462\u045B\u0402/g, '[!]'],
  [/\u0440\u0462[\u2018\u0027]\u00A4/g, ''],
  [/\u0440\u0462[\u201C\u0022]\u00B1/g, ''],
  [/\u0440\u0462[\u2018\u0027]\u0401\u0432\u0402\u040C\u0432\u0459\u2022\u043F\u0454\u0463/g, ''],
  [/\u0440\u0462[\u2018\u0027]\u00B0/g, ''],
  [/\u0440\u0462[\u201C\u0022]\u2026/g, ''],
  [/\u0440\u0462\u00A7\s*/g, ''],
  // Ellipsis
  [/\u2026/g, '...'],
  // Multiplication sign (can render wrong)
  [/\u00D7/g, 'x'],
  // Check/cross symbols
  [/\u2713/g, '+'],
  [/\u2714/g, '+'],
  [/\u2715/g, 'x'],
  [/\u2716/g, 'x'],
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [regex, replacement] of replacements) {
    const newContent = content.replace(regex, replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', filePath);
  }
}

function walkDir(dir, extList) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '__pycache__' && e.name !== '.git' && e.name !== 'dist')
        walkDir(full, extList);
    } else if (extList.some(ext => e.name.endsWith(ext))) {
      fixFile(full);
    }
  }
}

const root = path.resolve(process.cwd());
console.log('Mojibake audit from', root);
walkDir(path.join(root, 'frontend', 'src'), ['.ts', '.tsx', '.js', '.jsx', '.css']);
walkDir(path.join(root, 'frontend'), ['.html', '.json']);
walkDir(path.join(root, 'backend'), ['.py', '.md', '.env.example']);
console.log('Done.');
