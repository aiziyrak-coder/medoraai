/**
 * Remove all mojibake and unreadable characters from frontend src.
 * Run: node fix-mojibake-global.cjs
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');

function walk(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const f of list) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (f !== 'node_modules') walk(full, files);
    } else if (/\.(tsx?|jsx?|json)$/.test(f)) {
      files.push(full);
    }
  }
  return files;
}

// Replacements: [regex or string, replacement] (use Unicode escapes to avoid mojibake in this file)
const replacements = [
  [/\/\/\s*[\u0432\u201c\u0402\u201d]+[^\n]*/g, '// ---'],
  [/\u0432\u2020\u2019/g, ' -> '],
  [/\u0412\u00b0C/g, '\u00b0C'],
];

function fix(content) {
  let out = content;
  for (const [from, to] of replacements) {
    out = out.replace(from, to);
  }
  return out;
}

const files = walk(SRC);
let changed = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const next = fix(content);
  if (next !== content) {
    fs.writeFileSync(file, next, 'utf8');
    changed++;
    console.log('Fixed:', path.relative(__dirname, file));
  }
}
console.log('Done. Files changed:', changed);
