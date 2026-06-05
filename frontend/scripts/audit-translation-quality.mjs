import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractKV } from './extract-locale-keys.mjs';

const localesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');
const files = ['en.ts', 'uzL.ts', 'uzC.ts', 'ru.ts', 'kaa.ts'];
const data = Object.fromEntries(files.map((f) => [f, extractKV(f)]));
const enKeys = Object.keys(data['en.ts']);

// Keys where non-en locale equals en (likely untranslated)
for (const f of files) {
  if (f === 'en.ts') continue;
  const sameAsEn = enKeys.filter((k) => data[f][k] && data[f][k] === data['en.ts'][k]);
  const tmpl = sameAsEn.filter((k) => k.startsWith('tmpl_'));
  const other = sameAsEn.filter((k) => !k.startsWith('tmpl_'));
  console.log(`\n${f}: ${sameAsEn.length} identical to en (${tmpl.length} tmpl, ${other.length} other)`);
  if (other.length) console.log('  other:', other.slice(0, 30).join(', '), other.length > 30 ? '...' : '');
}

// kaa keys identical to uzL (copied Uzbek)
const kaaFromUzL = enKeys.filter((k) => data['kaa.ts'][k] && data['uzL.ts'][k] && data['kaa.ts'][k] === data['uzL.ts'][k]);
console.log(`\nkaa identical to uzL: ${kaaFromUzL.length}`);
console.log(kaaFromUzL.filter((k) => k.startsWith('tmpl_')).length, 'tmpl');
console.log(kaaFromUzL.filter((k) => !k.startsWith('tmpl_')).slice(0, 40).join(', '));

// uzC identical to uzL (should be cyrillic)
const uzCFromUzL = enKeys.filter((k) => data['uzC.ts'][k] && data['uzL.ts'][k] && data['uzC.ts'][k] === data['uzL.ts'][k]);
console.log(`\nuzC identical to uzL: ${uzCFromUzL.length}`);
