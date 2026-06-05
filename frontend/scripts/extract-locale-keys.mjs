import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const localesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');

export function extractKV(file) {
  const text = fs.readFileSync(path.join(localesDir, file), 'utf8');
  const map = {};
  const re = /^\s+([a-zA-Z0-9_'-]+):\s+(?:'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)")/gm;
  let m;
  while ((m = re.exec(text))) {
    const val = (m[2] ?? m[3] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"');
    map[m[1]] = val;
  }
  return map;
}

if (process.argv[1]?.endsWith('extract-locale-keys.mjs')) {
  const files = ['en.ts', 'uzL.ts', 'uzC.ts', 'ru.ts', 'kaa.ts'];
  const data = Object.fromEntries(files.map((f) => [f, extractKV(f)]));
  const enKeys = Object.keys(data['en.ts']);
  for (const f of files) {
    if (f === 'en.ts') continue;
    const missing = enKeys.filter((k) => !data[f][k]);
    console.log(`${f}: ${missing.length} missing vs en`);
    if (missing.length) console.log(missing.join('\n'));
  }
}
