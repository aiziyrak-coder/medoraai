import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');
const srcDir = path.join(__dirname, '../src');

function extractKV(file) {
  const t = fs.readFileSync(path.join(localesDir, file), 'utf8');
  const map = {};
  const re = /^\s+([a-zA-Z0-9_'-]+):\s+'((?:\\'|[^'])*)'/gm;
  let m;
  while ((m = re.exec(t))) map[m[1]] = m[2].replace(/\\'/g, "'");
  return map;
}

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory() && e.name !== 'i18n') walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      const c = fs.readFileSync(p, 'utf8');
      const re = /t\(['"]([a-zA-Z0-9_]+)['"]\)/g;
      let m;
      while ((m = re.exec(c))) acc.push(m[1]);
    }
  }
}

const localeFiles = ['en.ts', 'uzL.ts', 'uzC.ts', 'ru.ts', 'kaa.ts'];
const data = Object.fromEntries(localeFiles.map((f) => [f, extractKV(f)]));

const used = new Set(walk(srcDir));
const missing = {};
for (const key of used) {
  for (const f of localeFiles) {
    if (!data[f][key]) {
      if (!missing[f]) missing[f] = [];
      missing[f].push(key);
    }
  }
}

for (const f of localeFiles) {
  const m = missing[f] || [];
  console.log(`${f}: missing from code t() ${m.length}`);
  if (m.length) console.log(m.join(', '));
}

const enKeys = new Set(Object.keys(data['en.ts']));
console.log('\n--- vs en.ts key parity ---');
for (const f of localeFiles) {
  if (f === 'en.ts') continue;
  const missingEn = [...enKeys].filter((k) => !data[f][k]);
  const extra = Object.keys(data[f]).filter((k) => !enKeys.has(k));
  console.log(`${f}: missing ${missingEn.length}, extra ${extra.length}`);
  if (missingEn.length) console.log('missing:', missingEn.join(', '));
}
