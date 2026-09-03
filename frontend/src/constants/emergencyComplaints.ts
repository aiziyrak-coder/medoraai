/**
 * 103 — Tezkor triaj uchun shikoyatlar katalogi.
 *
 * Maqsad: feldsher yozmasin — bossin. Shuning uchun ro'yxat 103 brigadasi
 * amalda uchratadigan chaqiruv sabablariga qarab tuzilgan.
 *
 * `critical: true` — hayotga xavf ehtimoli yuqori shikoyat. UI uni ajratib
 * ko'rsatadi va ro'yxat boshiga chiqaradi.
 */

export interface EmergencyComplaint {
  id: string;
  /** O'zbekcha (lotin) — asosiy */
  uz: string;
  /** Ruscha — brigadalar orasida keng ishlatiladi */
  ru: string;
  critical?: boolean;
}

export interface EmergencyComplaintGroup {
  id: string;
  uz: string;
  ru: string;
  icon: string;
  items: EmergencyComplaint[];
}

export const EMERGENCY_COMPLAINT_GROUPS: EmergencyComplaintGroup[] = [
  {
    id: 'cardio',
    uz: 'Yurak va qon tomir',
    ru: 'Сердце и сосуды',
    icon: '❤️',
    items: [
      { id: 'chest_pain',        uz: "Ko'krak qafasida og'riq",           ru: 'Боль в грудной клетке',        critical: true },
      { id: 'chest_pressure',    uz: "Ko'krakni bosish, siqish hissi",    ru: 'Давящая боль за грудиной',     critical: true },
      { id: 'palpitations',      uz: 'Yurak tez urishi',                  ru: 'Учащённое сердцебиение' },
      { id: 'irregular_beat',    uz: 'Yurak notekis urishi',              ru: 'Перебои в работе сердца' },
      { id: 'bp_high',           uz: "Qon bosimi ko'tarilgan",            ru: 'Повышенное давление' },
      { id: 'bp_low',            uz: 'Qon bosimi tushgan',                ru: 'Пониженное давление',          critical: true },
      { id: 'syncope',           uz: 'Hushdan ketish',                    ru: 'Обморок',                      critical: true },
      { id: 'leg_edema',         uz: 'Oyoqlarda shish',                   ru: 'Отёки ног' },
      { id: 'cold_sweat',        uz: 'Sovuq ter, rangi oqarish',          ru: 'Холодный пот, бледность',      critical: true },
    ],
  },
  {
    id: 'resp',
    uz: 'Nafas olish',
    ru: 'Дыхание',
    icon: '🫁',
    items: [
      { id: 'dyspnea',           uz: 'Nafas qisishi',                     ru: 'Одышка',                       critical: true },
      { id: 'suffocation',       uz: "Bo'g'ilish, havo yetishmasligi",    ru: 'Удушье',                       critical: true },
      { id: 'wheezing',          uz: 'Xirillash, hushtaksimon nafas',     ru: 'Свистящее дыхание' },
      { id: 'cough_dry',         uz: "Quruq yo'tal",                      ru: 'Сухой кашель' },
      { id: 'cough_sputum',      uz: "Balg'amli yo'tal",                  ru: 'Кашель с мокротой' },
      { id: 'hemoptysis',        uz: 'Qon tuflash',                       ru: 'Кровохарканье',                critical: true },
      { id: 'choking_object',    uz: "Yot jism tiqilib qolgan",           ru: 'Инородное тело в дыхательных путях', critical: true },
      { id: 'asthma_attack',     uz: 'Astma xuruji',                      ru: 'Приступ астмы',                critical: true },
    ],
  },
  {
    id: 'neuro',
    uz: 'Nevrologik',
    ru: 'Неврология',
    icon: '🧠',
    items: [
      { id: 'unconscious',       uz: 'Hushsiz holat',                     ru: 'Без сознания',                 critical: true },
      { id: 'seizure',           uz: 'Tirishish (talvasa)',               ru: 'Судороги',                     critical: true },
      { id: 'speech_slurred',    uz: 'Nutq buzilgan',                     ru: 'Нарушение речи',               critical: true },
      { id: 'face_droop',        uz: 'Yuzning bir tomoni osilgan',        ru: 'Асимметрия лица',              critical: true },
      { id: 'limb_weakness',     uz: "Qo'l-oyoq kuchsizligi, falaj",      ru: 'Слабость в конечностях',       critical: true },
      { id: 'headache_sudden',   uz: "To'satdan kuchli bosh og'rig'i",    ru: 'Внезапная сильная головная боль', critical: true },
      { id: 'headache',          uz: "Bosh og'rig'i",                     ru: 'Головная боль' },
      { id: 'dizziness',         uz: 'Bosh aylanishi',                    ru: 'Головокружение' },
      { id: 'confusion',         uz: 'Chalkash ong, adashish',            ru: 'Спутанность сознания',         critical: true },
      { id: 'vision_loss',       uz: "Ko'rish buzilishi",                 ru: 'Нарушение зрения' },
      { id: 'numbness',          uz: 'Uvishish, sezgi yo‘qolishi',   ru: 'Онемение' },
    ],
  },
  {
    id: 'abdo',
    uz: 'Qorin va ovqat hazm',
    ru: 'Живот и ЖКТ',
    icon: '🩺',
    items: [
      { id: 'abd_pain',          uz: "Qorin og'rig'i",                    ru: 'Боль в животе' },
      { id: 'abd_pain_severe',   uz: "Kuchli qorin og'rig'i",             ru: 'Сильная боль в животе',        critical: true },
      { id: 'abd_rigid',         uz: 'Qorin taxtadek qattiq',             ru: 'Доскообразный живот',          critical: true },
      { id: 'nausea',            uz: 'Ko‘ngil aynishi',              ru: 'Тошнота' },
      { id: 'vomiting',          uz: 'Qusish',                            ru: 'Рвота' },
      { id: 'vomit_blood',       uz: 'Qon qusish',                        ru: 'Рвота кровью',                 critical: true },
      { id: 'diarrhea',          uz: 'Ich ketishi',                       ru: 'Диарея' },
      { id: 'blood_stool',       uz: 'Najasda qon',                       ru: 'Кровь в стуле',                critical: true },
      { id: 'constipation',      uz: 'Qabziyat, gaz chiqmasligi',         ru: 'Запор, не отходят газы' },
      { id: 'jaundice',          uz: 'Sariqlik',                          ru: 'Желтуха' },
    ],
  },
  {
    id: 'trauma',
    uz: 'Travma va jarohat',
    ru: 'Травмы',
    icon: '🚑',
    items: [
      { id: 'fall',              uz: 'Yiqilish',                          ru: 'Падение' },
      { id: 'road_accident',     uz: 'Yo‘l-transport hodisasi',      ru: 'ДТП',                          critical: true },
      { id: 'head_injury',       uz: 'Bosh jarohati',                     ru: 'Травма головы',                critical: true },
      { id: 'fracture',          uz: 'Suyak sinishi gumoni',              ru: 'Подозрение на перелом' },
      { id: 'bleeding_heavy',    uz: 'Kuchli qon ketish',                 ru: 'Сильное кровотечение',         critical: true },
      { id: 'wound',             uz: 'Ochiq yara, kesilish',              ru: 'Открытая рана' },
      { id: 'burn',              uz: 'Kuyish',                            ru: 'Ожог' },
      { id: 'spine_injury',      uz: 'Umurtqa jarohati gumoni',           ru: 'Подозрение на травму позвоночника', critical: true },
      { id: 'drowning',          uz: 'Suvga cho‘kish',               ru: 'Утопление',                    critical: true },
      { id: 'electric',          uz: 'Elektr toki urishi',                ru: 'Электротравма',                critical: true },
    ],
  },
  {
    id: 'infection',
    uz: 'Isitma va infeksiya',
    ru: 'Лихорадка и инфекции',
    icon: '🌡️',
    items: [
      { id: 'fever_high',        uz: 'Yuqori harorat (39°C dan yuqori)',  ru: 'Высокая температура (>39°C)' },
      { id: 'fever',             uz: 'Harorat ko‘tarilgan',          ru: 'Повышенная температура' },
      { id: 'chills',            uz: 'Titroq, qaltirash',                 ru: 'Озноб' },
      { id: 'rash_fever',        uz: 'Isitma bilan toshma',               ru: 'Сыпь с лихорадкой',            critical: true },
      { id: 'neck_stiff',        uz: 'Bo‘yin qotishi',               ru: 'Ригидность затылочных мышц',   critical: true },
      { id: 'sore_throat',       uz: 'Tomoq og‘rig‘i',          ru: 'Боль в горле' },
    ],
  },
  {
    id: 'tox',
    uz: 'Zaharlanish',
    ru: 'Отравления',
    icon: '☠️',
    items: [
      { id: 'poison_drug',       uz: 'Dori bilan zaharlanish',            ru: 'Отравление лекарствами',       critical: true },
      { id: 'poison_alcohol',    uz: 'Alkogol bilan zaharlanish',         ru: 'Алкогольное отравление',       critical: true },
      { id: 'poison_food',       uz: 'Oziq-ovqat zaharlanishi',           ru: 'Пищевое отравление' },
      { id: 'poison_co',         uz: 'Is gazi (uglerod oksidi)',          ru: 'Отравление угарным газом',     critical: true },
      { id: 'poison_pesticide',  uz: 'Pestitsid, kimyoviy modda',         ru: 'Отравление пестицидами',       critical: true },
      { id: 'snake_bite',        uz: 'Ilon chaqishi',                     ru: 'Укус змеи',                    critical: true },
      { id: 'insect_bite',       uz: 'Hasharot chaqishi',                 ru: 'Укус насекомого' },
    ],
  },
  {
    id: 'allergy',
    uz: 'Allergiya',
    ru: 'Аллергия',
    icon: '⚠️',
    items: [
      { id: 'anaphylaxis',       uz: 'Anafilaksiya gumoni',               ru: 'Подозрение на анафилаксию',    critical: true },
      { id: 'quincke',           uz: 'Kvinke shishi (yuz, lab, til)',     ru: 'Отёк Квинке',                  critical: true },
      { id: 'urticaria',         uz: 'Eshakemi, qichishish',              ru: 'Крапивница, зуд' },
      { id: 'rash',              uz: 'Terida toshma',                     ru: 'Сыпь на коже' },
    ],
  },
  {
    id: 'uro',
    uz: 'Siydik yo‘llari',
    ru: 'Мочевыделение',
    icon: '💧',
    items: [
      { id: 'urine_retention',   uz: 'Siydik tutilishi',                  ru: 'Задержка мочи',                critical: true },
      { id: 'renal_colic',       uz: 'Buyrak sanchig‘i',             ru: 'Почечная колика' },
      { id: 'blood_urine',       uz: 'Siydikda qon',                      ru: 'Кровь в моче' },
      { id: 'dysuria',           uz: 'Siyishda og‘riq',              ru: 'Боль при мочеиспускании' },
    ],
  },
  {
    id: 'endo',
    uz: 'Diabet va endokrin',
    ru: 'Диабет и эндокринология',
    icon: '🩸',
    items: [
      { id: 'hypoglycemia',      uz: 'Qandi tushgan (gipoglikemiya)',     ru: 'Гипогликемия',                 critical: true },
      { id: 'hyperglycemia',     uz: 'Qandi ko‘tarilgan',            ru: 'Гипергликемия',                critical: true },
      { id: 'thirst_polyuria',   uz: 'Kuchli chanqoq, tez-tez siyish',    ru: 'Жажда, частое мочеиспускание' },
    ],
  },
  {
    id: 'obgyn',
    uz: 'Homiladorlik va ginekologiya',
    ru: 'Беременность и гинекология',
    icon: '🤰',
    items: [
      { id: 'labor',             uz: 'Tug‘ruq boshlangan',           ru: 'Начало родов',                 critical: true },
      { id: 'preg_bleeding',     uz: 'Homiladorlikda qon ketish',         ru: 'Кровотечение при беременности', critical: true },
      { id: 'preg_abd_pain',     uz: 'Homiladorlikda qorin og‘rig‘i', ru: 'Боль в животе при беременности', critical: true },
      { id: 'eclampsia',         uz: 'Homiladorlikda tirishish',          ru: 'Судороги при беременности',    critical: true },
      { id: 'gyn_bleeding',      uz: 'Bachadondan qon ketish',            ru: 'Маточное кровотечение',        critical: true },
    ],
  },
  {
    id: 'peds',
    uz: 'Bolalar',
    ru: 'Дети',
    icon: '👶',
    items: [
      { id: 'child_fever',       uz: 'Bolada yuqori harorat',             ru: 'Высокая температура у ребёнка' },
      { id: 'child_seizure',     uz: 'Bolada tirishish',                  ru: 'Судороги у ребёнка',           critical: true },
      { id: 'child_breathing',   uz: 'Bolada nafas qisishi',              ru: 'Одышка у ребёнка',             critical: true },
      { id: 'child_dehydration', uz: 'Bolada suvsizlanish',               ru: 'Обезвоживание у ребёнка',      critical: true },
      { id: 'child_lethargy',    uz: 'Bola sust, uyg‘onmayapti',     ru: 'Ребёнок вялый, не реагирует',  critical: true },
      { id: 'child_vomiting',    uz: 'Bolada qusish, ich ketishi',        ru: 'Рвота и понос у ребёнка' },
      { id: 'child_cry',         uz: 'To‘xtovsiz yig‘lash',     ru: 'Безутешный плач' },
    ],
  },
  {
    id: 'psych',
    uz: 'Psixiatrik',
    ru: 'Психиатрия',
    icon: '🧩',
    items: [
      { id: 'agitation',         uz: 'Kuchli qo‘zg‘alish, agressiya', ru: 'Психомоторное возбуждение', critical: true },
      { id: 'suicide_attempt',   uz: 'O‘z joniga qasd urinishi',     ru: 'Суицидальная попытка',         critical: true },
      { id: 'panic',             uz: 'Vahima xuruji',                     ru: 'Паническая атака' },
      { id: 'hallucination',     uz: 'Alahsirash, gallyutsinatsiya',      ru: 'Галлюцинации' },
    ],
  },
  {
    id: 'general',
    uz: 'Umumiy holat',
    ru: 'Общее состояние',
    icon: '📋',
    items: [
      { id: 'weakness',          uz: 'Umumiy holsizlik',                  ru: 'Общая слабость' },
      { id: 'back_pain',         uz: 'Bel og‘rig‘i',            ru: 'Боль в спине' },
      { id: 'joint_pain',        uz: 'Bo‘g‘im og‘rig‘i', ru: 'Боль в суставах' },
      { id: 'no_appetite',       uz: 'Ishtaha yo‘qligi',             ru: 'Отсутствие аппетита' },
      { id: 'hypothermia',       uz: 'Sovqotish, tana harorati past',     ru: 'Переохлаждение',               critical: true },
      { id: 'heat_stroke',       uz: 'Issiq urishi',                      ru: 'Тепловой удар',                critical: true },
    ],
  },
];

/** Barcha shikoyatlar tekis ro'yxat sifatida (qidiruv uchun). */
export const ALL_EMERGENCY_COMPLAINTS: EmergencyComplaint[] =
  EMERGENCY_COMPLAINT_GROUPS.flatMap(g => g.items);

/** Hayotga xavf ehtimoli yuqori shikoyatlar — UI ularni tepaga chiqaradi. */
export const CRITICAL_COMPLAINTS: EmergencyComplaint[] =
  ALL_EMERGENCY_COMPLAINTS.filter(c => c.critical);

export const YOSH_GURUHLARI = [
  { id: 'infant',  uz: 'Chaqaloq',  ru: 'Младенец', hint: '0-1' },
  { id: 'child',   uz: 'Bola',      ru: 'Ребёнок',  hint: '1-12' },
  { id: 'teen',    uz: "O'smir",    ru: 'Подросток', hint: '12-18' },
  { id: 'adult',   uz: 'Kattalar',  ru: 'Взрослый', hint: '18-65' },
  { id: 'elderly', uz: 'Keksa',     ru: 'Пожилой',  hint: '65+' },
] as const;

export type AgeBandId = typeof YOSH_GURUHLARI[number]['id'];

/** Shikoyat matnini joriy tilga qarab tanlaydi. */
export const complaintLabel = (c: EmergencyComplaint, language: string): string =>
  language === 'ru' ? c.ru : c.uz;
