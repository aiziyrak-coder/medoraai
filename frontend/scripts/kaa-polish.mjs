import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractKV } from './extract-locale-keys.mjs';

const localesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');

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
    if (!re.test(text)) continue;
    text = text.replace(re, `$1${escVal(value)}$2`);
    count++;
  }
  fs.writeFileSync(fp, text, 'utf8');
  console.log(`${file}: ${count} keys`);
}

// Hand-crafted Karakalpak for tmpl keys that automated pass missed
const tmplFixes = {
  tmpl_neuro_comp_5: 'Tutqınıw (epileptikalıq) shablonları, húshten óziniń, qısqa waqıt.',
  tmpl_neuro_comp_7: 'Júz nervi paralizi, mimika buzılıwı, bir tárepde.',
  tmpl_neuro_comp_9: 'Jadıwazlıq kemeyiwi, diqqat jıynaw qiyınlıǵı, jaqın waqıt hodiselerin unutadı.',
  tmpl_endo_comp_0: 'Shashıw, kúp suw ish, tez-tez sidik (poliuriya), diabet alomatları.',
  tmpl_endo_comp_15: 'Osteoporoz, suyak sinisi qawıpı.',
  tmpl_uro_comp_6: 'Toshakta sidik ushlab tura almaydı.',
  tmpl_uro_comp_7: 'Jınısiy funkciya buzılıwı, erektil disfunktsiya.',
  tmpl_uro_comp_8: 'Prostata úlkenlegen, LUTS alomatları.',
  tmpl_reuma_comp_6: 'Osteoporoz, suyak sinisi qawıpı.',
  tmpl_psych_comp_15: 'Birinshi ret psixoz — keng qamrovlı psixiatriyalıq bahalaw shoshılınsh.',
  tmpl_gastro_hist_0: 'Shikoyatlar taxminan 6 ay burın baslanǵan, asta-sekin kúshayip baradı.',
  tmpl_cardio_hist_2: 'Temeki shekew stajı 10 jıldan artıq.',
  tmpl_therapist_hist_2: 'Ishtaha joq, salmaǵ túsken, kúshsizlik — xronikalıq yamasa jańa.',
  tmpl_endo_hist_6: 'Gipoglikemiya epizodları baqlanǵan, sebebi anıqlanbaǵan.',
  tmpl_nephro_hist_1: 'Qan basımı kop jıldan beri joq basqarılmaydı.',
  tmpl_derma_hist_4: 'Steroid kremler uzaq paydalanılǵan.',
  tmpl_ent_hist_1: 'Eshitish kemeygen, apparat paydalanadı.',
};

// Global Uzbek → Karakalpak word fixes for remaining tmpl strings
const uzL = extractKV('uzL.ts');
const kaa = extractKV('kaa.ts');
const kaaPolish = { ...tmplFixes };

const wordFixes = [
  [/Jigar/g, 'Peyen'],
  [/jigar/g, 'peyen'],
  [/Qusish/g, 'Qusıw'],
  [/qusish/g, 'qusıw'],
  [/shikoyatlar/g, 'shikayatlar'],
  [/shikoyat/g, 'shikayat'],
  [/boshlangan/g, 'baslanǵan'],
  [/boshlangan/g, 'baslanǵan'],
  [/ovqat/g, 'awqat'],
  [/Ovqat/g, 'Awqat'],
  [/bormoqda/g, 'baradı'],
  [/qilmoqda/g, 'etip atır'],
  [/qilgan/g, 'etken'],
  [/qiladi/g, 'etedi'],
  [/qilmaslik/g, 'etpew'],
  [/qilmaydi/g, 'etpeydi'],
  [/qilmagan/g, 'etpemegen'],
  [/bo'lgan/g, 'bolǵan'],
  [/bo'ldi/g, 'boldı'],
  [/bo'lishi/g, 'bolıwı'],
  [/bo'lish/g, 'bolıw'],
  [/o'tkazgan/g, 'ótken'],
  [/o'tgan/g, 'ótken'],
  [/o'zgargan/g, 'ózgergen'],
  [/o'zgarishi/g, 'ózgerisi'],
  [/o'lchaganda/g, 'ólshegende'],
  [/ko'p/g, 'kóp'],
  [/ko'rinadi/g, 'kórinedi'],
  [/yo'qotish/g, 'jóqotıw'],
  [/yo'qoladi/g, 'jóq boladı'],
  [/tez-tez/g, 'tez-tez'],
  [/harakatda/g, 'hárekette'],
  [/harakati/g, 'háreketi'],
  [/harakat/g, 'háreket'],
  [/tushgan/g, 'túsken'],
  [/tushishi/g, 'túsishi'],
  [/kattalashgan/g, 'úlkenlegen'],
  [/pasayishi/g, 'kemeyiwi'],
  [/pasaygan/g, 'kemeygen'],
  [/kuchayib/g, 'kúshayip'],
  [/kuchaygan/g, 'kúshayǵan'],
  [/kuchayadi/g, 'kúshayadı'],
  [/davolan/g, 'emlen'],
  [/davolash/g, 'emlew'],
  [/davolangan/g, 'emlengen'],
  [/tekshiruv/g, 'tekseriw'],
  [/tekshirilgan/g, 'tekserilgen'],
  [/natijasi/g, 'nátiyjesi'],
  [/natijalari/g, 'nátiyjeleri'],
  [/mavjud/g, 'bar'],
  [/kerak/g, 'kerek'],
  [/uchun/g, 'ushın'],
  [/bilan/g, 'menen'],
  [/yoki/g, 'yamasa'],
  [/ va /g, ' hám '],
  [/qorin/g, 'qarıw'],
  [/Qorin/g, 'Qarıw'],
  [/bosh /g, 'bas '],
  [/Bosh /g, 'Bas '],
  [/yurak/g, 'júrek'],
  [/Yurak/g, 'Júrek'],
  [/nafas/g, 'dem'],
  [/Nafas/g, 'Dem'],
  [/og'riq/g, 'awırıq'],
  [/og'rig'i/g, 'awırıǵı'],
  [/ko'krak/g, 'kókrak'],
  [/ko'ngil/g, 'kóngil'],
  [/ko'z/g, 'kóz'],
  [/ko'rish/g, 'kóriw'],
  [/o't /g, 'ót '],
  [/o't/g, 'ót'],
  [/bo'g'im/g, 'bóǵim'],
  [/bo'yin/g, 'boyın'],
  [/kechasi/g, 'ke she'],
  [/ertalab/g, 'ertennen'],
  [/tunda/g, 'túnde'],
  [/uyda/g, 'úyde'],
  [/oilada/g, 'úydegi'],
  [/bemor/g, 'nawqas'],
  [/shifokor/g, 'shıpaker'],
  [/kasallik/g, 'kesellik'],
  [/surunkali/g, 'xronikalıq'],
  [/o'tkir/g, 'ótkir'],
  [/O'tkir/g, 'Ótkir'],
];

for (const k of Object.keys(kaa)) {
  if (!k.startsWith('tmpl_') || kaaPolish[k]) continue;
  let v = kaa[k];
  for (const [re, rep] of wordFixes) v = v.replace(re, rep);
  if (v !== kaa[k]) kaaPolish[k] = v;
}

patchLocale('kaa.ts', kaaPolish);

// uz-L / uz-C / ru / kaa small UI fixes
patchLocale('uzL.ts', {
  appName: "Farg'ona JSTI",
  auth_mode_monitoring: 'Monitoring',
  specialty_moderator: 'Moderator',
  final_report_monitoring: 'Kuzatuv',
  years_short: 'y.',
  dashboard_ai_online: 'AI ONLAYN',
});

patchLocale('uzC.ts', {
  assistant_phone_placeholder: '+998...',
  'unknown_diagnosis': 'Номаълум ташхис',
});

patchLocale('ru.ts', {
  vital_spo2: 'SpO2 (насыщение)',
  vitals_label_spo2: 'SpO2',
  tv_video_url_placeholder: 'https://video1.mp4, https://video2.mp4',
  assistant_phone_placeholder: '+998...',
  landing_footer_api: 'API',
  mobile_block_intro_end: '.',
});

patchLocale('kaa.ts', {
  landing_feature_consultium: 'AI Konsilium',
  auth_mode_monitoring: 'Monitoring',
  specialty_moderator: 'Moderator',
  final_report_monitoring: 'Baqlaw',
  dashboard_ai_online: 'AI ONLAYN',
  nav_archive: 'Arxiv',
  nav_training: 'Trening',
  auth_mode_clinic: 'Klinika',
  auth_mode_staff: 'Registrator',
  auth_phone_placeholder: '+998 XX XXX XX XX',
  auth_password_label: 'Parol',
  auth_attention: 'DIQQAT:',
  auth_terms: 'Shartlar',
  auth_privacy: 'Maxfiylik',
  auth_agree_prefix: 'Men',
  ecg_rhythm: 'Ritm',
  ecg_morphology: 'Morfologiya',
  vital_pulse: 'Puls',
});

console.log('Polish done.');
