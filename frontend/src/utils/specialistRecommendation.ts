/**
 * Shikoyat/kasallik matniga asoslangan TEZKOR mutaxassis taklifi (AI kutishsiz - 0ms).
 * Kasallikdan kelib chiqib 6-10 ta TEGISHLI mutaxassis tanlanadi; har xil holatlar uchun har xil jamoa.
 * Xuddi qo'shimcha savollar kabi DARHOL chiqadi!
 */

import { AIModel } from '../constants/specialists';
import type { Diagnosis, PatientData } from '../types';

/** Shikoyat kalit so'zlari -> mutaxassis(lar) — kengaytirilgan ro'yxat, kasallik bo'yicha farq qiladi */
const KEYWORD_TO_SPECIALISTS: { keywords: RegExp; models: AIModel[] }[] = [
  // Yurak-qon tomir (kengaytirilgan kalit so'zlar)
  { keywords: /\b(yurak|qon\s*bosimi|puls|aritmiya|stenokardiya|infarkt|kardiolog|gipertoniya|gipotoniya|blokada|tachycardia|bradikardiya|kardiomiopatiya|yurak\s*yetishmovchilik|koronar|stent|bypass|ekg|elektrokardiogram|qon\s*tomir|ateroskleroz|varikoz|tromb|emboliya|insuffitsiensiya|angina|miokard|perikard|endokard|сердце|сердцебиение|давление|аритмия|стенокардия|инфаркт|кардиолог|гипертония|гипотония|ишемия|миокард|перикард|эндокард|heart|chest\s*pain|blood\s*pressure|arrhythmia|angina|myocardial|cardiac|coronary|jurek|qan\s*basımı|aritmiya|infarkt|kardiolog)\b/i, models: [AIModel.GEMINI] },
  // Nerv tizimi (kengaytirilgan)
  { keywords: /\b(bosh\s*og'riq|bosh\s*ogriq|nevrolog|falaj|paralich|epilepsiya|stroke|migren|bell\s*palsy|yuz\s*falaj|miasteniya|parkinson|altsgeymer|dementsiya|demensiya|neyropatiya|radikulit|iskeymiya|miya|orqa\s*miya|asab|nevrit|polinevrit)\b/i, models: [AIModel.CLAUDE, AIModel.GERIATRICIAN] },
  // Radiologiya / tasvir
  { keywords: /\b(rentgen|röntgen|ct|mrt|mri|tasvir|radiolog|skaner|ushlash|ultratovush|usk|diagnostik\s*tasvir|tomografiya|fluorografiya|mammografiya|angiografiya|рентген|кт|мрт|узи|узд|радиолог|томография|флюорография|маммография|ангиография|xray|x-ray|ultrasound|radiology|scan|imaging|tomography|rentgen|uzi|utt|súwret|radiolog)\b/i, models: [AIModel.GPT] },
  // Onkologiya (kengaytirilgan)
  { keywords: /\b(o'sma|saraton|onkolog|metastaz|karcinoma|tumor|o'sma|xemoterapiya|radiatsiya\s*davolash|biopsiya|sitologik|gistologik|leykemiya|limfoma|melanoma|blastoma|neoplazm|опухоль|рак|онколог|метастаз|карцинома|химиотерапия|лучевая|биопсия|лейкоз|лимфома|меланома|cancer|oncolog|metastasis|carcinoma|chemotherapy|radiation|biopsy|leukemia|lymphoma|sarat[aá]n|ósimta|onkolog|metastaz)\b/i, models: [AIModel.LLAMA] },
  // Endokrin (kengaytirilgan)
  { keywords: /\b(qand|gormon|qalqonsimon|tiroid|endokrin|diabet|giperglikemiya|gipoglikemiya|insulin|qandli\s*diabet|tiroidektomiya|gipotireoz|gipertireoz|tiroidit|qalqonsimon\s*bezi|paratireoid|buyrak\s*usti\s*bezi|adrenal|kortizol|сахар|гормон|щитовид|эндокрин|диабет|гипергликемия|гипогликемия|инсулин|гипотиреоз|гипертиреоз|адренал|кортизол|diabetes|thyroid|endocrine|hyperglycemia|hypoglycemia|hormone|insulin|qant|diabet|gormon|qalqansha)\b/i, models: [AIModel.GROK] },
  // Nafas o'pka (kengaytirilgan)
  { keywords: /\b(nafas|o'pka|bronx|pnevmoniya|astma|spo2|bronxit|tuberkulez|sil|o'pka\s*kasallik|plevrit|emfizema|xo'lli\s*bronx|o'pka\s*yetishmovchilik|kortikal\s*nafas|asfiksiya|otr|nafas\s*yo'llari|traxeya|laringit|faringit|bronxial\s*astma|дыхание|одышка|легк|бронх|пневмония|астма|бронхит|туберкулез|плеврит|эмфизема|трахея|ларингит|фарингит|breath|dyspnea|lung|pneumonia|asthma|bronchitis|tuberculosis|pleurisy|emphysema|respiratory|nafas|ókpe|bronx|pnevmoniya|astma)\b/i, models: [AIModel.PULMONOLOGIST] },
  { keywords: /\b(sil|ftiziatr|tuberkulez|o'pka\s*sili|koch|mycobacterium)\b/i, models: [AIModel.PHTHISIATRICIAN] },
  // Ovqat hazm, jigar (kengaytirilgan)
  { keywords: /\b(jigar|oshqozon|ichak|gastrit|gepatit|pankreas|cirroz|o't\s*pufak|dispepsiya|reflyuks|oqizish|qorin\s*og'riq|kolit|enterit|yara|duodenit|ezofagit|pankreatit|xolesistit|xolangit|gastroezofageal|qizilo'ngach|me'da|печен|желудок|кишеч|гастрит|гепатит|панкреас|цирроз|желчный|диспепсия|рефлюкс|живот|колит|язва|панкреатит|холецистит|liver|stomach|bowel|intestinal|gastritis|hepatitis|pancreas|cirrhosis|reflux|abdominal|colitis|ulcer|pancreatitis|jiger|asqazan|ishek|qarın|gepatit)\b/i, models: [AIModel.GASTRO] },
  { keywords: /\b(jigar\s*sirrozi|gepatit\s*c|gepatit\s*b|jigar\s*yetishmovchilik|hepatolog|fibroz|portokaval)\b/i, models: [AIModel.HEPATOLOGIST] },
  // Buyrak (kengaytirilgan)
  { keywords: /\b(buyrak|siydik|nefrit|dializ|kreatinin|uremiya|piyelonefrit|glomerulonefrit|buyrak\s*yetishmovchilik|nefrotik\s*sindrom|urolitiyaz|buyrak\s*toshi|hemodializ|peritoneal\s*dializ|почка|моча|нефрит|диализ|креатинин|уремия|пиелонефрит|гломерулонефрит|нефрот|камни\s*в\s*почках|kidney|urine|nephritis|dialysis|creatinine|pyelonephritis|glomerulonephritis|renal|búyrek|sidik|nefrit|dializ)\b/i, models: [AIModel.NEPHROLOGIST] },
  // Urologiya (kengaytirilgan)
  { keywords: /\b(siydik\s*yo'li|urolog|prostat|tsistit|bovak|erektil|prostatit|adenoma\s*prostata|siydik\s*tutish|nozlar|uretrit|orxit|epididimit)\b/i, models: [AIModel.UROLOGIST] },
  // Teri (kengaytirilgan)
  { keywords: /\b(teri|dermato|qichima|ekzema|psoriaz|dermatit|qotish|toj|qizil\s*yuguruk|ushoq|leykoderma|skleroderma|fungus|zamburug'|mikozi|dermatomitsit|кожа|зуд|экзема|псориаз|дерматит|сыпь|грибок|skin|itch|eczema|psoriasis|dermatitis|rash|fungal|teri|qıshıw|ekzema|tóspe)\b/i, models: [AIModel.DERMATOLOGIST] },
  // Allergiya (kengaytirilgan)
  { keywords: /\b(allergiya|reaksiya|qichish|antigen|anafilaksiya|allergen|antihistamin|urtikariya|angionevrotik|shish|gipersensitiv)\b/i, models: [AIModel.ALLERGIST] },
  // Ortopediya, suyak, bo'yin (kengaytirilgan)
  { keywords: /\b(suyak|tizza|bo'yin|bel|ortoped|artroz|artrit|shish\s*tizza|burilish|sinish|vertebra|umurtqa|bo'g'im|mushak|tendinit|bursit|sinovit|osteoporoz|osteoxondroz|skolioz|kifoz|lordoz)\b/i, models: [AIModel.ORTHOPEDIC] },
  { keywords: /\b(vertebra|umurtqa|bel\s*og'riq|disk\s*herniya|radikulopatiya|spinal|orqa\s*miya)\b/i, models: [AIModel.VERTEBROLOGIST] },
  // Ko'z (kengaytirilgan)
  { keywords: /\b(ko'z|retina|glaukoma|katarakta|kon'yunktivit|ko'rish|oftalmolog|blefarit|xalazion|mayda|ko'z\s*ostini|makula|degeneratsiya|diabetik\s*retinopatiya)\b/i, models: [AIModel.OPHTHALMOLOGIST] },
  // LOR (kengaytirilgan)
  { keywords: /\b(quloq|tomoq|burun|lor|tonzillit|otit|sinusit|labirintit|eshitish|otolaringolog|rinit|faringit|laringit|traxeit|adenoidit|angina|bezlar|farinhgeal|maxilla\s*bo'shliq)\b/i, models: [AIModel.OTOLARYNGOLOGIST] },
  // Ruhiyat (depressiya, anksiyete — demensiya nevrologiyada)
  { keywords: /\b(psix|depressiya|ruhiy|stress|anksiyete|shizofreniya|bipolyar|nevroz|panika|fobiya)\b/i, models: [AIModel.PSYCHIATRIST] },
  // Obstetrika, pediatriya (kengaytirilgan)
  { keywords: /\b(homilador|tug'ruq|obstetr|bachadon|qisqa\s*muddat|tug'ish|homila|platsenta|chesarevo|sech|sezoar|abort|tushish|homiladorlik|gestoz|eklampsiya|preeklampsiya|беремен|роды|акушер|матка|плод|плацента|кесар|аборт|гестоз|эклампсия|pregnan|delivery|obstetric|uterus|fetus|placenta|cesarean|miscarriage|pre[- ]?eclampsia|hámile|tuwıw|bachadon|homila)\b/i, models: [AIModel.OBGYN] },
  { keywords: /\b(bola|chaqaloq|pediatr|bola\s*kasallik|yosh\s*bemor|go'dak|maktab\s*yoshi|qizcha|o'g'ilcha|bolalar|emlash|ребенок|детск|педиатр|младенец|вакцинац|child|children|pediatric|infant|baby|vaccination|bala|shaqalaq|pediatr|emlew)\b/i, models: [AIModel.PEDIATRICIAN] },
  // Farmakologiya
  { keywords: /\b(dori|darmon|doza|aralashuv|nojo'ya\s*ta'sir|farmakolog|dorixona|retsept|tabletk|in'ekts|infuz|antibiotik)\b/i, models: [AIModel.PHARMACOLOGIST] },
  // Shoshilinch
  { keywords: /\b(shoshilinch|jiddiy|urgent|krizis|reanimatsiya|tez\s*yordam|travma|qon\s*ketish|shok|koma)\b/i, models: [AIModel.EMERGENCY] },
  // Yuqumli (kengaytirilgan)
  { keywords: /\b(yuqumli|infeksiya|virus|bakteriya|covid|sepsis|issiqlik\s*isitma|gripp|arpa|o'lat|vabo|toshma|tifi|bezgak|malyariya|zoonoz|epidemiya)\b/i, models: [AIModel.INFECTIOUS] },
  // Revmatologiya (kengaytirilgan)
  { keywords: /\b(revmatik|bo'g'im|lyupus|revmatoid|artrit|kollagenoz|skleroderma|dermatomiozit|vaskulit|podagra|revmatizm)\b/i, models: [AIModel.RHEUMATOLOGIST] },
  // Qon (kengaytirilgan)
  { keywords: /\b(qon|anemiya|leykemiya|gemoglobin|trombosit|koagulopatiya|gemofiliya|talasemiya|eritrosit|leykos|tromb|gematolog)\b/i, models: [AIModel.HEMATOLOGIST] },
  // Immunologiya
  { keywords: /\b(immun|autoimmun|immunitet|vaksina|immunolog|antitanacha|immunodefitsit)\b/i, models: [AIModel.IMMUNOLOGIST] },
  // Jarrohlik (kengaytirilgan)
  { keywords: /\b(appenditsit|peritonit|jarrohlik|operatsiya|chandiq|xonadon|o't\s*ochish|gastrektomiya|kolon|resektsiya|jarroh|operativ)\b/i, models: [AIModel.SURGEON] },
  // Travmatologiya
  { keywords: /\b(jarohat|travma|sinish|burilish|shikastlanish|chirmashuv|joyidan\s*chiqish|travmatolog)\b/i, models: [AIModel.TRAUMATOLOGIST] },
  // Genetika
  { keywords: /\b(genetik|irsiy|kromosoma|mutatsiya|genetik|gen|nasl|davolovchi\s*genetik)\b/i, models: [AIModel.GENETICIST] },
  // Og'riq
  { keywords: /\b(og'riq|kronik\s*og'riq|og'riq\s*boshqarish|og'riqsizlantirish|analgetik)\b/i, models: [AIModel.PAIN_MANAGEMENT] },
  // Uyqu
  { keywords: /\b(uyqu|insomniya|apnoe|uxlash|uyqu\s*buzilish|narcolepsiya)\b/i, models: [AIModel.SLEEP_MEDICINE] },
  // Oziqalanuvchanlik
  { keywords: /\b(oziq|parhez|vitamin|ozuqaviy|ozish|semizlik|diyetolog|oziqlanish)\b/i, models: [AIModel.NUTRITIONIST] },
  // Stomatologiya
  { keywords: /\b(tish|og'iz|stomatolog|gingivit|karies|periodont|til|tish\s*og'riq)\b/i, models: [AIModel.DENTIST] },
  // Proktologiya
  { keywords: /\b(ichak\s*past|proktolog|hemoroy|boshiq|anal\s*kanal|to'g'ri\s*ichak)\b/i, models: [AIModel.PROCTOLOGIST] },
  // Mammologiya
  { keywords: /\b(ko'krak|mammolog|o'sma\s*ko'krak|sut\s*bezi|mastit|fibroadenoma)\b/i, models: [AIModel.MAMMOLOGIST] },
  // Neyroxirurgiya
  { keywords: /\b(neyroxirurg|miya\s*jarrohligi|bosh\s*miya\s*operatsiya|orqa\s*miya\s*jarrohlik|intrakranial)\b/i, models: [AIModel.NEUROSURGEON] },
  // Kardioxirurgiya
  { keywords: /\b(kardioxirurg|yurak\s*jarrohligi|aorta\s*jarrohlik|koronar\s*bypass|klapan\s*almashtirish)\b/i, models: [AIModel.CARDIO_SURGEON] },
  // Torakal jarrohlik
  { keywords: /\b(torakal|o'pka\s*jarrohligi|ko'krak\s*qafasi\s*jarrohlik)\b/i, models: [AIModel.CARDIO_SURGEON] },
];

/** DDx nomlaridan mutaxassis skorlash */
const DDX_TO_SPECIALISTS: { pattern: RegExp; models: AIModel[] }[] = [
  { pattern: /nefr|renal|kidney|buyrak/i, models: [AIModel.NEPHROLOGIST] },
  { pattern: /kardio|yurak|koronar|infarkt|aritm/i, models: [AIModel.GEMINI] },
  { pattern: /nevro|insult|stroke|epilep|demen|parkinson/i, models: [AIModel.CLAUDE] },
  { pattern: /pulmon|pnevmon|astma|nafas|o'pka/i, models: [AIModel.PULMONOLOGIST] },
  { pattern: /gastro|jigar|hepat|pankreat|oshqozon/i, models: [AIModel.GASTRO] },
  { pattern: /diabet|endokrin|tireoid|tiroid|gormon/i, models: [AIModel.GROK] },
  { pattern: /onko|saraton|cancer|tumor|leykem/i, models: [AIModel.LLAMA, AIModel.HEMATOLOGIST] },
  { pattern: /psix|depress|anksiyet/i, models: [AIModel.PSYCHIATRIST] },
];

function scoreSpecialists(text: string, diagnoses: Diagnosis[] = []): Map<AIModel, number> {
  const scores = new Map<AIModel, number>();

  const add = (models: AIModel[], pts: number) => {
    for (const m of models) {
      scores.set(m, (scores.get(m) ?? 0) + pts);
    }
  };

  for (const { keywords, models } of KEYWORD_TO_SPECIALISTS) {
    if (keywords.test(text)) add(models, 3);
  }

  for (const d of diagnoses) {
    const dxText = `${d.name || ''} ${d.justification || ''}`;
    for (const { pattern, models } of DDX_TO_SPECIALISTS) {
      if (pattern.test(dxText)) add(models, 4);
    }
  }

  return scores;
}

/**
 * Bemorning barcha ma'lumotlarini bitta matnga birlashtiradi.
 * Bu orqali mutaxassis tanlashda ko'proq ma'lumotlar hisobga olinadi.
 */
function buildFullPatientText(data: PatientData): string {
  const parts: string[] = [];
  
  // Asosiy shikoyatlar
  if (data.complaints) parts.push(data.complaints);
  
  // Qo'shimcha ma'lumotlar
  if (data.additionalInfo) parts.push(data.additionalInfo);
  
  // Ob'ektiv ma'lumotlar (vital ko'rsatkichlar)
  if (data.objectiveData) parts.push(data.objectiveData);
  
  // Laboratoriya natijalari
  if (data.labResults) parts.push(data.labResults);
  
  // Kasallik tarixi (anamnez)
  if (data.history) parts.push(data.history);
  
  // Allergiyalar
  if (data.allergies) parts.push(data.allergies);
  
  // Doimiy dorilar
  if (data.currentMedications) parts.push(data.currentMedications);
  
  // Oila tarixi
  if (data.familyHistory) parts.push(data.familyHistory);
  
  // Uzoq muddatli klinik qaydlar
  if (data.longitudinalClinicalNotes) parts.push(data.longitudinalClinicalNotes);
  
  // Farmakogenomika hisoboti
  if (data.pharmacogenomicsReport) parts.push(data.pharmacogenomicsReport);
  
  return parts.join(' ');
}

/**
 * Bemor ma'lumotlari asosida faqat tegishli mutaxassislarni qaytaradi (3–8 ta).
 */
export function getSpecialistsFromComplaint(
  data: PatientData | string,
  diagnoses: Diagnosis[] = [],
): { model: AIModel; reason: string }[] {
  const text = typeof data === 'string'
    ? (data || '').trim()
    : buildFullPatientText(data).trim();

  const scores = scoreSpecialists(text, diagnoses);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    return [{ model: AIModel.INTERNAL_MEDICINE, reason: 'Umumiy klinik baholash' }];
  }

  const out: { model: AIModel; reason: string }[] = [];
  for (const [model, pts] of ranked.slice(0, 8)) {
    const reason = pts >= 4 ? 'Kasallik/DDx bo\'yicha tavsiya' : 'Kasallik bo\'yicha tavsiya';
    out.push({ model, reason });
  }

  // Dorilar bo'lsa farmakolog qo'shiladi
  if (/\b(dori|darmon|doza|antibiotik|retsept|tabletk)\b/i.test(text)) {
    if (!out.some((r) => r.model === AIModel.PHARMACOLOGIST)) {
      out.push({ model: AIModel.PHARMACOLOGIST, reason: 'Dori-darmonlar mavjud' });
    }
  }

  return out.slice(0, 8);
}

/** API/DDx dan kelgan tavsiyalarni faqat asosiy ro'yxatga mos bo'lsa qo'shadi */
export function mergeSpecialistRecommendations(
  primary: { model: AIModel; reason: string }[],
  refinement: { model: AIModel; reason: string }[],
  max = 8,
): { model: AIModel; reason: string }[] {
  const seen = new Set<AIModel>();
  const primaryModels = new Set(primary.map((r) => r.model));
  const out: { model: AIModel; reason: string }[] = [];

  for (const r of primary) {
    if (!r?.model || seen.has(r.model)) continue;
    seen.add(r.model);
    out.push({ model: r.model, reason: (r.reason || '').trim() || 'Tavsiya' });
  }

  for (const r of refinement) {
    if (!r?.model || seen.has(r.model)) continue;
    // Faqat DDx asosida kelgan yoki asosiy bilan bog'liq tavsiyalar
    const isDdx = /ddx|differensial|tashxis/i.test(r.reason || '');
    if (!isDdx && !primaryModels.has(r.model)) continue;
    seen.add(r.model);
    out.push({ model: r.model, reason: (r.reason || '').trim() || 'Tavsiya' });
  }

  return out.slice(0, max);
}
