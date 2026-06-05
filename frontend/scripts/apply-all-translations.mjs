import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractKV } from './extract-locale-keys.mjs';
import { uzLToKaa } from './uzl-to-kaa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');

function latinUzToCyrl(text) {
  let s = text;
  const multi = [
    ["O'", 'Ў'], ["o'", 'ў'], ["G'", 'Ғ'], ["g'", 'ғ'],
    ['Sh', 'Ш'], ['sh', 'ш'], ['Ch', 'Ч'], ['ch', 'ч'],
    ['Ng', 'Нг'], ['ng', 'нг'], ['Yo', 'Ё'], ['yo', 'ё'],
    ['Yu', 'Ю'], ['yu', 'ю'], ['Ya', 'Я'], ['ya', 'я'],
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

function escVal(val) {
  if (val.includes("'") && !val.includes('"')) return `"${val.replace(/"/g, '\\"')}"`;
  return `'${val.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function patchLocale(file, updates) {
  const fp = path.join(localesDir, file);
  let text = fs.readFileSync(fp, 'utf8');
  let count = 0;
  for (const [key, value] of Object.entries(updates)) {
    const k = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `'${key}'`;
    const re = new RegExp(`^(\\s+${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s+)(?:'(?:\\\\'|[^'])*'|"(?:\\\\"|[^"])*")(,?)`, 'm');
    if (!re.test(text)) {
      console.warn(`  missing key in ${file}: ${key}`);
      continue;
    }
    text = text.replace(re, `$1${escVal(value)}$2`);
    count++;
  }
  fs.writeFileSync(fp, text, 'utf8');
  console.log(`${file}: patched ${count}/${Object.keys(updates).length}`);
}

const en = extractKV('en.ts');
const uzL = extractKV('uzL.ts');
const ru = extractKV('ru.ts');

// --- uz-C: Cyrillic from uz-L ---
const uzCUpdates = {};
for (const k of Object.keys(en)) {
  const uzC = extractKV('uzC.ts')[k];
  const uzLv = uzL[k];
  if (uzLv && uzC === uzLv) uzCUpdates[k] = latinUzToCyrl(uzLv);
}
// Manual polish
Object.assign(uzCUpdates, {
  mod_checkup_title: 'Check-up ва профилактика',
  dashboard_ai_online: 'AI ОНЛАЙН',
  vital_spo2: 'СпО2',
  assistant_phone_placeholder: '+998...',
  pdf_product_brand_footer: 'AiDoktor — Фарғона ЖСТИ',
  'unknown_diagnosis': 'Номаълум ташхис',
});

// --- uz-L: Uzbek Latin from en where still English ---
const uzLUpdates = {
  appName: "Farg'ona JSTI",
  landing_feature_consultium: 'AI Konsilium',
  ecg_pr_interval: 'PR intervali',
  ecg_qt_interval: 'QT intervali',
  auth_mode_monitoring: 'Monitoring',
  auth_faq: 'Ko\'p so\'raladigan savollar',
  specialty_moderator: 'Moderator',
  final_report_monitoring: 'Monitoring',
  mod_checkup_title: 'Check-up va profilaktika',
  vitals_label_sys: 'SYS',
  vitals_label_dia: 'DIA',
  vitals_label_temp: 'Harorat',
  vitals_label_spo2: 'SpO2',
  tv_video_url_placeholder: 'https://video1.mp4, https://video2.mp4',
  assistant_phone_placeholder: '+998...',
  landing_footer_api: 'API',
  landing_footer_blog: 'Blog',
  testimonial_1_name: 'Dr. A. Karimov',
  testimonial_2_name: 'Dr. S. Umarova',
  pdf_lab: 'Laboratoriya',
  pdf_product_brand_footer: 'AiDoktor — Farg\'ona JSTI',
  years_short: 'y.',
  dashboard_ai_online: 'AI ONLAYN',
};

// --- ru: Russian where still English ---
const ruUpdates = {
  appName: 'Фаргона ЖСТИ',
  vital_spo2: 'SpO2',
  auth_faq: 'Часто задаваемые вопросы',
  mod_checkup_title: 'Check-up и профилактика',
  vitals_label_sys: 'САД',
  vitals_label_dia: 'ДАД',
  vitals_label_spo2: 'SpO2',
  tv_video_url_placeholder: 'https://video1.mp4, https://video2.mp4',
  assistant_phone_placeholder: '+998...',
  landing_footer_api: 'API',
  mobile_block_intro_end: '.',
  pdf_product_brand_footer: 'AiDoktor — Фаргона ЖСТИ',
};

// --- kaa: UI + non-tmpl from uz-L converter + manual ---
const kaa = extractKV('kaa.ts');
const kaaUpdates = {};

const kaaManual = {
  landing_feature_consultium: 'AI Konsilium',
  landing_feature_ecg: 'EKG tahlili',
  landing_how_step1_p4: 'Qosımsha: EKG, rentgen, KT/MRT súwretleri',
  landing_how_step2: 'AI tahlil',
  landing_footer_platform: 'Platforma',
  landing_footer_company: 'Kompaniya',
  specialty_gastro: 'Gastroenterologiya',
  specialty_cardio: 'Kardiologiya',
  specialty_neuro: 'Nevrologiya',
  specialty_therapist: 'Terapiya',
  specialty_endo: 'Endokrinologiya',
  specialty_pulmo: 'Pulmonologiya',
  specialty_nephro: 'Nefrologiya',
  specialty_derma: 'Dermatologiya',
  specialty_ortho: 'Ortopediya / Travmatologiya',
  specialty_gynec: 'Ginekologiya',
  specialty_uro: 'Urologiya',
  specialty_ophth: 'Oftalmologiya',
  specialty_ent: 'LOR',
  specialty_reuma: 'Revmatologiya',
  ecg_rhythm: 'Ritm',
  ecg_heart_rate: 'Júrek urıwı',
  ecg_pr_interval: 'PR intervalı',
  ecg_qt_interval: 'QT intervalı',
  ecg_morphology: 'Morfologiya',
  vital_pulse: 'Puls',
  vital_spo2: 'SpO2',
  vital_bp: 'Qan basımı',
  vital_respiration: 'Dem alıw',
  tool_abbreviation_placeholder: 'Mısalı: MI, CHF, COPD...',
  tool_coding_title: 'Medicina kodlaw (ICD-10)',
  tool_insurance_procedure_label: 'Prosedura',
  tool_risk_score_label: 'Ball',
  nav_archive: 'Arxiv',
  nav_training: 'Trening',
  auth_mode_clinic: 'Klinika',
  auth_mode_staff: 'Registrator',
  auth_mode_monitoring: 'Monitoring',
  auth_phone_placeholder: '+998 XX XXX XX XX',
  auth_password_label: 'Parol',
  auth_attention: 'DIQQAT:',
  auth_terms: 'Shartlar',
  auth_privacy: 'Maxfiylik',
  auth_faq: 'Kóp berilgen sawollar',
  auth_agree_prefix: 'Men',
  specialty_cardiology: 'Kardiologiya',
  specialty_neurology: 'Nevrologiya',
  specialty_radiology: 'Radiologiya',
  specialty_oncology: 'Onkologiya',
  specialty_endocrinology: 'Endokrinologiya',
  mod_checkup_title: 'Check-up hám profilaktika',
  dashboard_ai_online: 'AI ONLINE',
  landing_footer_api: 'API',
  landing_footer_blog: 'Blog',
  testimonial_1_name: 'Dr. A. Karimov',
  testimonial_2_name: 'Dr. S. Umarova',
  pdf_product_brand_footer: 'AiDoktor — Farg\'ona JSTI',
  years_short: 'j.',
  final_report_monitoring: 'Monitoring',
  specialty_moderator: 'Moderator',
};

for (const [k, v] of Object.entries(kaaManual)) kaaUpdates[k] = v;

for (const k of Object.keys(en)) {
  if (k.startsWith('tmpl_')) continue;
  if (kaa[k] && uzL[k] && kaa[k] === uzL[k] && !kaaUpdates[k]) {
    kaaUpdates[k] = uzLToKaa(uzL[k]);
  }
}

// Regenerate ALL tmpl_* from uz-L with Karakalpak converter
for (const k of Object.keys(en)) {
  if (!k.startsWith('tmpl_')) continue;
  if (uzL[k]) kaaUpdates[k] = uzLToKaa(uzL[k]);
}

// Post-fix common converter artifacts in kaa
for (const k of Object.keys(kaaUpdates)) {
  let v = kaaUpdates[k];
  v = v
    .replace(/cawarcawash/g, 'shálǵawsızlanıw')
    .replace(/kecawasi/g, 'ke she')
    .replace(/ishtaba/g, 'ishtaha')
    .replace(/awayz/g, 'ayallıq')
    .replace(/awayallarda/g, 'ayallarda')
    .replace(/cawap/g, 'sol')
    .replace(/pufakcawalar/g, 'puşakchalar')
    .replace(/qorincawa/g, 'qarıw')
    .replace(/ortiqcawa/g, 'artıq')
    .replace(/báwrek emes, peyen/g, 'peyen')
    .replace(/teriде/g, 'teride')
    .replace(/túnде/g, 'túnde')
    .replace(/kucawayadi/g, 'kúshayadı')
    .replace(/kucawaygan/g, 'kúshayǵan');
  kaaUpdates[k] = v;
}

patchLocale('uzC.ts', uzCUpdates);
patchLocale('uzL.ts', uzLUpdates);
patchLocale('ru.ts', ruUpdates);
patchLocale('kaa.ts', kaaUpdates);
console.log('Done.');
