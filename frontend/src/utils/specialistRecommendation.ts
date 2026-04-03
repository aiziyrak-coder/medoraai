/**
 * Shikoyat/kasallik matniga asoslangan TEZKOR mutaxassis taklifi (AI kutishsiz - 0ms).
 * Kasallikdan kelib chiqib 6-10 ta TEGISHLI mutaxassis tanlanadi; har xil holatlar uchun har xil jamoa.
 * Xuddi qo'shimcha savollar kabi DARHOL chiqadi!
 */

import { AIModel } from '../constants/specialists';
import type { PatientData } from '../types';

/** Shikoyat kalit so'zlari -> mutaxassis(lar) — kengaytirilgan ro'yxat, kasallik bo'yicha farq qiladi */
const KEYWORD_TO_SPECIALISTS: { keywords: RegExp; models: AIModel[] }[] = [
  // Yurak-qon tomir (kengaytirilgan kalit so'zlar)
  { keywords: /\b(yurak|qon\s*bosimi|puls|aritmiya|stenokardiya|infarkt|kardiolog|gipertoniya|gipotoniya|blokada|tachycardia|bradikardiya|kardiomiopatiya|yurak\s*yetishmovchilik|koronar|stent|bypass|ekg|elektrokardiogram|qon\s*tomir|ateroskleroz|varikoz|tromb|emboliya|insuffitsiensiya|angina|miokard|perikard|endokard)\b/i, models: [AIModel.GEMINI] },
  // Nerv tizimi (kengaytirilgan)
  { keywords: /\b(bosh\s*og'riq|bosh\s*ogriq|nevrolog|falaj|paralich|epilepsiya|stroke|migren|bell\s*palsy|yuz\s*falaj|miasteniya|parkinson|altsgeymer|dementsiya|neyropatiya|radikulit|iskeymiya|miya|orqa\s*miya|neyroxirurg|konuslar|psixonevrolog|asab|nevrit|polinevrit)\b/i, models: [AIModel.CLAUDE] },
  // Radiologiya / tasvir
  { keywords: /\b(rentgen|röntgen|ct|mrt|mri|tasvir|radiolog|skaner|ushlash|ultratovush|usk|diagnostik\s*tasvir|tomografiya|fluorografiya|mammografiya|angiografiya)\b/i, models: [AIModel.GPT] },
  // Onkologiya (kengaytirilgan)
  { keywords: /\b(o'sma|saraton|onkolog|metastaz|karcinoma|tumor|o'sma|xemoterapiya|radiatsiya\s*davolash|biopsiya|sitologik|gistologik|leykemiya|limfoma|melanoma|blastoma|neoplazm)\b/i, models: [AIModel.LLAMA] },
  // Endokrin (kengaytirilgan)
  { keywords: /\b(qand|gormon|qalqonsimon|tiroid|endokrin|diabet|giperglikemiya|gipoglikemiya|insulin|qandli\s*diabet|tiroidektomiya|gipotireoz|gipertireoz|tiroidit|qalqonsimon\s*bezi|paratireoid|buyrak\s*usti\s*bezi|adrenal|kortizol)\b/i, models: [AIModel.GROK] },
  // Nafas o'pka (kengaytirilgan)
  { keywords: /\b(nafas|o'pka|bronx|pnevmoniya|astma|spo2|bronxit|tuberkulez|sil|o'pka\s*kasallik|plevrit|emfizema|xo'lli\s*bronx|o'pka\s*yetishmovchilik|kortikal\s*nafas|asfiksiya|otr|nafas\s*yo'llari|traxeya|laringit|faringit|bronxial\s*astma)\b/i, models: [AIModel.PULMONOLOGIST] },
  { keywords: /\b(sil|ftiziatr|tuberkulez|o'pka\s*sili|koch|mycobacterium)\b/i, models: [AIModel.PHTHISIATRICIAN] },
  // Ovqat hazm, jigar (kengaytirilgan)
  { keywords: /\b(jigar|oshqozon|ichak|gastrit|gepatit|pankreas|cirroz|o't\s*pufak|dispepsiya|reflyuks|oqizish|qorin\s*og'riq|kolit|enterit|yara|duodenit|ezofagit|pankreatit|xolesistit|xolangit|gastroezofageal|qizilo'ngach|me'da)\b/i, models: [AIModel.GASTRO] },
  { keywords: /\b(jigar\s*sirrozi|gepatit\s*c|gepatit\s*b|jigar\s*yetishmovchilik|hepatolog|fibroz|portokaval)\b/i, models: [AIModel.HEPATOLOGIST] },
  // Buyrak (kengaytirilgan)
  { keywords: /\b(buyrak|siydik|nefrit|dializ|kreatinin|uremiya|piyelonefrit|glomerulonefrit|buyrak\s*yetishmovchilik|nefrotik\s*sindrom|urolitiyaz|buyrak\s*toshi|hemodializ|peritoneal\s*dializ)\b/i, models: [AIModel.NEPHROLOGIST] },
  // Urologiya (kengaytirilgan)
  { keywords: /\b(siydik\s*yo'li|urolog|prostat|tsistit|bovak|erektil|prostatit|adenoma\s*prostata|siydik\s*tutish|nozlar|uretrit|orxit|epididimit)\b/i, models: [AIModel.UROLOGIST] },
  // Teri (kengaytirilgan)
  { keywords: /\b(teri|dermato|qichima|ekzema|psoriaz|dermatit|qotish|toj|qizil\s*yuguruk|ushoq|leykoderma|skleroderma|fungus|zamburug'|mikozi|dermatomitsit)\b/i, models: [AIModel.DERMATOLOGIST] },
  // Allergiya (kengaytirilgan)
  { keywords: /\b(allergiya|reaksiya|qichish|antigen|anafilaksiya|allergen|antihistamin|urtikariya|angionevrotik|shish|gipersensitiv)\b/i, models: [AIModel.ALLERGIST] },
  // Ortopediya, suyak, bo'yin (kengaytirilgan)
  { keywords: /\b(suyak|tizza|bo'yin|bel|ortoped|artroz|artrit|shish\s*tizza|burilish|sinish|vertebra|umurtqa|bo'g'im|mushak|tendinit|bursit|sinovit|osteoporoz|osteoxondroz|skolioz|kifoz|lordoz)\b/i, models: [AIModel.ORTHOPEDIC] },
  { keywords: /\b(vertebra|umurtqa|bel\s*og'riq|disk\s*herniya|radikulopatiya|spinal|orqa\s*miya)\b/i, models: [AIModel.VERTEBROLOGIST] },
  // Ko'z (kengaytirilgan)
  { keywords: /\b(ko'z|retina|glaukoma|katarakta|kon'yunktivit|ko'rish|oftalmolog|blefarit|xalazion|mayda|ko'z\s*ostini|makula|degeneratsiya|diabetik\s*retinopatiya)\b/i, models: [AIModel.OPHTHALMOLOGIST] },
  // LOR (kengaytirilgan)
  { keywords: /\b(quloq|tomoq|burun|lor|tonzillit|otit|sinusit|labirintit|eshitish|otolaringolog|rinit|faringit|laringit|traxeit|adenoidit|angina|bezlar|farinhgeal|maxilla\s*bo'shliq)\b/i, models: [AIModel.OTOLARYNGOLOGIST] },
  // Ruhiyat (kengaytirilgan)
  { keywords: /\b(psix|depressiya|ruhiy|stress|anksiyete|shizofreniya|bipolyar|psixolog|psixoterapevt|nevroz|panika|fobiya|obsessiv|manik|demensiya|autizm)\b/i, models: [AIModel.PSYCHIATRIST] },
  // Obstetrika, pediatriya (kengaytirilgan)
  { keywords: /\b(homilador|tug'ruq|obstetr|bachadon|qisqa\s*muddat|tug'ish|homila|platsenta|chesarevo|sech|sezoar|abort|tushish|homiladorlik|gestoz|eklampsiya|preeklampsiya)\b/i, models: [AIModel.OBGYN] },
  { keywords: /\b(bola|chaqaloq|pediatr|bola\s*kasallik|yosh\s*bemor|go'dak|maktab\s*yoshi|qizcha|o'g'ilcha|bolalar|emlash)\b/i, models: [AIModel.PEDIATRICIAN] },
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

/** Barcha mutaxassislar (tizimdan tashqari) — to'ldirishda xilma-xil tanlash uchun */
const ALL_SPECIALISTS: AIModel[] = Object.values(AIModel).filter(m => m !== AIModel.SYSTEM);

/** Shikoyat matnidan oddiy hash (raqam) — bir xil shikoyat uchun bir xil tartib */
function simpleHash(str: string): number {
  let h = 0;
  const s = (str || '').trim();
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
 * Bemorning barcha ma'lumotlari asosida 6–10 ta tegishli mutaxassisni aniqlaydi.
 * Har xil kasalliklar uchun har xil jamoa; bir xil standart jamoa takrorlanmaydi.
 * 
 * @param data - Bemor ma'lumotlari (PatientData) yoki shikoyat matni (string - orqaga moslik uchun)
 */
export function getSpecialistsFromComplaint(data: PatientData | string): { model: AIModel; reason: string }[] {
  // Orqaga moslik: string uzatilsa, faqat shu matnni ishlatish
  const text = typeof data === 'string' 
    ? (data || '').trim()
    : buildFullPatientText(data).trim();
  
  const seen = new Set<AIModel>();
  const result: { model: AIModel; reason: string }[] = [];

  // 1-QADAM: Kasallik bo'yicha aniq mutaxassislarni topish
  for (const { keywords, models } of KEYWORD_TO_SPECIALISTS) {
    if (!keywords.test(text)) continue;
    for (const model of models) {
      if (seen.has(model)) continue;
      seen.add(model);
      result.push({ model, reason: 'Kasallik bo\'yicha tavsiya' });
    }
  }

  // 2-QADAM: Faqat hech qanday kalit so'z topilmasa — umumiy konsilium asoslari (kasallikka oid bo'lmagan "to'ldiruvchi" kam)
  if (result.length === 0) {
    const defaultModels: AIModel[] = [
      AIModel.INTERNAL_MEDICINE,
      AIModel.FAMILY_MEDICINE,
      AIModel.GEMINI,
      AIModel.PHARMACOLOGIST,
      AIModel.EMERGENCY,
    ];
    for (const model of defaultModels) {
      if (result.length >= 6) break;
      if (seen.has(model)) continue;
      seen.add(model);
      result.push({ model, reason: 'Umumiy klinik konsilium' });
    }
  } else if (result.length < 4) {
    // Kamida 4 ta tanlash uchun: faqat mavjud yo'nalishni qo'llab-quvvatlovchi profillar
    const support: AIModel[] = [AIModel.INTERNAL_MEDICINE, AIModel.FAMILY_MEDICINE, AIModel.PHARMACOLOGIST];
    for (const model of support) {
      if (result.length >= 4) break;
      if (seen.has(model)) continue;
      seen.add(model);
      result.push({ model, reason: 'Asosiy holat bilan bog\'liq qo\'llab-quvvatlash' });
    }
  }

  return result.slice(0, 10);
}

/** API/DDx dan kelgan tavsiyalarni birinchi o'ringa qo'shib, takrorlarni olib tashlaydi */
export function mergeSpecialistRecommendations(
  primary: { model: AIModel; reason: string }[],
  refinement: { model: AIModel; reason: string }[],
  max = 12,
): { model: AIModel; reason: string }[] {
  const seen = new Set<AIModel>();
  const out: { model: AIModel; reason: string }[] = [];
  for (const list of [refinement, primary]) {
    for (const r of list) {
      if (!r?.model || seen.has(r.model)) continue;
      seen.add(r.model);
      out.push({ model: r.model, reason: (r.reason || '').trim() || 'Tavsiya' });
    }
  }
  return out.slice(0, max);
}
