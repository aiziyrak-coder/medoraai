import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractKV } from './extract-locale-keys.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');
const LABEL = 'i18n parity sync';

function latinUzToCyrl(text) {
  let s = text;
  const multi = [
    ["O'", 'Ў'],
    ["o'", 'ў'],
    ["G'", 'Ғ'],
    ["g'", 'ғ'],
    ['Sh', 'Ш'],
    ['sh', 'ш'],
    ['Ch', 'Ч'],
    ['ch', 'ч'],
    ['Ng', 'Нг'],
    ['ng', 'нг'],
    ['Yo', 'Ё'],
    ['yo', 'ё'],
    ['Yu', 'Ю'],
    ['yu', 'ю'],
    ['Ya', 'Я'],
    ['ya', 'я'],
    ['Ye', 'Е'],
    ['ye', 'е'],
  ];
  for (const [a, b] of multi) s = s.split(a).join(b);
  const map = {
    A: 'А', B: 'Б', D: 'Д', E: 'Е', F: 'Ф', G: 'Г', H: 'Ҳ', I: 'И', J: 'Ж',
    K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', Q: 'Қ', R: 'Р', S: 'С',
    T: 'Т', U: 'У', V: 'В', X: 'Х', Y: 'Й', Z: 'З',
    a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж',
    k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с',
    t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', "'": 'ъ',
  };
  return s.replace(/[A-Za-z']/g, (ch) => map[ch] ?? ch);
}

function escSingle(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatEntry(key, value) {
  const k = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `'${key}'`;
  if (value.includes("'") && !value.includes('"')) {
    return `  ${k}: "${value.replace(/"/g, '\\"')}",`;
  }
  return `  ${k}: '${escSingle(value)}',`;
}

function appendBlock(file, block) {
  const fp = path.join(localesDir, file);
  let text = fs.readFileSync(fp, 'utf8');
  if (text.includes(`// ${LABEL}`)) {
    console.log(`${file}: already synced`);
    return;
  }
  text = text.replace(/\n};\s*$/, `\n\n  // ${LABEL}\n${block}\n};\n`);
  fs.writeFileSync(fp, text, 'utf8');
  console.log(`${file}: added ${block.split('\n').length} lines`);
}

const en = extractKV('en.ts');
const uzL = extractKV('uzL.ts');
const uzC = extractKV('uzC.ts');

const uzCOverrides = {
  consilium_analyzing: 'Профессорлар мустақил таҳлил қилмоқда...',
  consilium_time_estimate: 'Бу жараён 30–90 сония давом этиши мумкин',
  phase_1_independent: '1-фаза: Мустақил таҳлил',
  phase_2_debate: '2-фаза: Баҳслар (cross-examination)',
  phase_3_consensus: '3-фаза: Консенсус хулосаси',
  mobile_blocker_title: 'Қурилма мос келмади',
  mobile_blocker_desc: 'Ҳурматли фойдаланувчи, тўлиқ функционалдан фойдаланиш учун',
  mobile_blocker_device_hint: 'орқали киринг',
  mobile_blocker_device_computer: 'Компьютер',
  mobile_blocker_device_tablet: 'Планшет',
  mobile_blocker_phone_note: 'Телефон орқали фақат',
  mobile_blocker_doctor: 'Шифокор',
  mobile_blocker_registrar: 'Регистратор',
  mobile_blocker_modes: 'режимидан фойдаланиш мумкин.',
  mobile_blocker_back_login: '← Login саҳифасига қайтиш',
  specialist_name_cardiologist: 'Кардиолог',
  specialist_name_neurologist: 'Невролог',
  specialist_name_radiologist: 'Радиолог',
  specialist_name_oncologist: 'Онколог',
  specialist_name_endocrinologist: 'Ендокринолог',
  'specialist_name_claude-cardio': 'Кардиолог АИ (Claude)',
};

const uzCMissing = Object.keys(en).filter((k) => !uzC[k]);
const uzCBlock = uzCMissing
  .map((k) => {
    const raw = uzCOverrides[k] || latinUzToCyrl(uzL[k] || en[k]);
    return formatEntry(k, raw);
  })
  .join('\n');

const ruOverrides = {
  specialist_name_cardiologist: 'Кардиолог',
  specialist_name_neurologist: 'Невролог',
  specialist_name_radiologist: 'Рентгенолог',
  specialist_name_oncologist: 'Онколог',
  specialist_name_endocrinologist: 'Эндокринолог',
  'specialist_name_claude-cardio': 'Кардиолог ИИ (Claude)',
};
const ruMissing = Object.keys(en).filter((k) => !extractKV('ru.ts')[k]);
const ruBlock = ruMissing.map((k) => formatEntry(k, ruOverrides[k] || en[k])).join('\n');

const kaaOverrides = {
  specialist_name_cardiologist: 'Kardiolog',
  specialist_name_neurologist: 'Nevrolog',
  specialist_name_radiologist: 'Radiolog',
  specialist_name_oncologist: 'Onkolog',
  specialist_name_endocrinologist: 'Endokrinolog',
  'specialist_name_gpt-4o': 'Radiolog AI (GPT-4o)',
  'specialist_name_claude-cardio': 'Kardiolog AI (Claude)',
};
const kaaMissing = Object.keys(en).filter((k) => !extractKV('kaa.ts')[k]);
const kaaBlock = kaaMissing.map((k) => formatEntry(k, kaaOverrides[k] || en[k])).join('\n');

appendBlock('uzC.ts', uzCBlock);
appendBlock('ru.ts', ruBlock);
appendBlock('kaa.ts', kaaBlock);
console.log('Done.');
