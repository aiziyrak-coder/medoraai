/** Klinik xavf shkalalari — deterministik hisoblash (AI faqat talqin uchun).
 *  MUHIM: bu yerda yillik xavf foizlari qaytarilmaydi. Foiz qiymatlari faqat
 *  nashr etilgan rasmiy jadvallardan olinishi kerak — ular bu yerda tekshirilmagan. */

export type ChadsVascInput = {
  chf: boolean;
  hypertension: boolean;
  age: number;
  diabetes: boolean;
  strokeTia: boolean;
  vascularDisease: boolean;
  female: boolean;
};

export type HeartScoreInput = {
  history: 'highly' | 'moderate' | 'slightly' | 'none';
  ecg: 'significant' | 'nonspecific' | 'normal';
  age: number;
  riskFactors: number;
  troponin: 'elevated' | 'normal';
};

export function calculateChadsVasc(input: ChadsVascInput): number {
  let score = 0;
  if (input.chf) score += 1;
  if (input.hypertension) score += 1;
  if (input.age >= 75) score += 2;
  else if (input.age >= 65) score += 1;
  if (input.diabetes) score += 1;
  if (input.strokeTia) score += 2;
  if (input.vascularDisease) score += 1;
  if (input.female) score += 1;
  return score;
}

export function interpretChadsVasc(score: number, lang: string): string {
  if (lang.startsWith('en')) {
    const tail = 'Take the annual stroke risk from the published CHA2DS2-VASc table, not from this tool.';
    if (score === 0) return `CHA2DS2-VASc ${score}: low-risk category. Anticoagulation usually not indicated. ${tail}`;
    if (score === 1) return `CHA2DS2-VASc ${score}: low-to-moderate category. Individual assessment needed. ${tail}`;
    return `CHA2DS2-VASc ${score}: elevated-risk category. Consider anticoagulation. ${tail}`;
  }
  const tail = 'Yillik insult xavfi foizini ushbu vositadan emas, rasmiy CHA2DS2-VASc jadvalidan oling.';
  if (score === 0) return `CHA2DS2-VASc ${score}: past xavf toifasi. Antikoagulyant odatda ko'rsatilmaydi. ${tail}`;
  if (score === 1) return `CHA2DS2-VASc ${score}: o'rta-past toifa. Individual baholash kerak. ${tail}`;
  return `CHA2DS2-VASc ${score}: yuqori xavf toifasi. Antikoagulyant terapiyani ko'rib chiqing. ${tail}`;
}

export function calculateHeart(input: HeartScoreInput): number {
  let score = 0;
  const histMap = { highly: 2, moderate: 1, slightly: 0, none: 0 };
  const ecgMap = { significant: 2, nonspecific: 1, normal: 0 };
  score += histMap[input.history] ?? 0;
  score += ecgMap[input.ecg] ?? 0;
  if (input.age >= 65) score += 2;
  else if (input.age >= 45) score += 1;
  if (input.riskFactors >= 3) score += 2;
  else if (input.riskFactors >= 1) score += 1;
  if (input.troponin === 'elevated') score += 2;
  return score;
}

export function interpretHeart(score: number, lang: string): string {
  if (lang.startsWith('en')) {
    const tail = 'Take the MACE rate for this band from the published HEART score data, not from this tool.';
    if (score <= 3) return `HEART ${score}: low-risk band. Outpatient follow-up may be appropriate. ${tail}`;
    if (score <= 6) return `HEART ${score}: moderate-risk band. Observation and serial troponin/ECG recommended. ${tail}`;
    return `HEART ${score}: high-risk band. Urgent cardiology evaluation and admission considered. ${tail}`;
  }
  const tail = "MACE ko'rsatkichini ushbu vositadan emas, rasmiy HEART shkalasi manbasidan oling.";
  if (score <= 3) return `HEART ${score}: past xavf toifasi. Ambulator kuzatuv mumkin. ${tail}`;
  if (score <= 6) return `HEART ${score}: o'rta xavf toifasi. Kuzatuv va qayta troponin/EKG tavsiya etiladi. ${tail}`;
  return `HEART ${score}: yuqori xavf toifasi. Shoshilinch kardiologik baholash va statsionar ko'rib chiqiladi. ${tail}`;
}

/**
 * Yurak-qon tomir XAVF OMILLARI SKRINI — validatsiya qilinmagan ichki ball (0-20+).
 * Bu ASCVD Pooled Cohort Equations EMAS va boshqa biror nashr etilgan shkala emas:
 * bu shunchaki mavjud xavf omillarini sanab chiqadigan qo'pol saralash vositasi.
 * Hech qanday yillik voqea ehtimoli (%) qaytarilmaydi.
 */
export type CvRiskFactorInput = {
  age: number;
  male: boolean;
  smoker: boolean;
  diabetes: boolean;
  systolicBp: number;
  onHypertensionTreatment: boolean;
  totalCholesterol: number;
  hdl: number;
};

export function calculateCvRiskFactorScreen(input: CvRiskFactorInput): number {
  let pts = 0;
  if (input.age >= 70) pts += 4;
  else if (input.age >= 60) pts += 3;
  else if (input.age >= 50) pts += 2;
  else if (input.age >= 40) pts += 1;
  if (input.male) pts += 1;
  if (input.smoker) pts += 2;
  if (input.diabetes) pts += 2;
  const sbp = input.systolicBp;
  if (sbp >= 160) pts += 3;
  else if (sbp >= 140) pts += 2;
  else if (sbp >= 130) pts += 1;
  if (input.onHypertensionTreatment) pts += 1;
  if (input.totalCholesterol >= 240) pts += 2;
  else if (input.totalCholesterol >= 200) pts += 1;
  if (input.hdl < 40) pts += 1;
  return pts;
}

export function interpretCvRiskFactorScreen(score: number, lang: string): string {
  if (lang.startsWith('en')) {
    const tail =
      'This is a rough risk-factor screen, not a validated risk score. For a quantitative 10-year risk, use a validated calculator (e.g. ASCVD Pooled Cohort Equations or SCORE2).';
    if (score <= 4) return `Risk-factor screen ${score}: few risk factors — lifestyle advice and a periodic lipid panel. ${tail}`;
    if (score <= 8) return `Risk-factor screen ${score}: several risk factors — review lipid-lowering therapy and risk-factor control per guidelines. ${tail}`;
    return `Risk-factor screen ${score}: many risk factors — formal risk assessment and cardiology follow-up. ${tail}`;
  }
  const tail =
    "Bu qo'pol xavf omillari skrini, validatsiya qilingan shkala emas. Miqdoriy 10 yillik xavf uchun validatsiyalangan kalkulyatordan (masalan ASCVD Pooled Cohort Equations yoki SCORE2) foydalaning.";
  if (score <= 4) return `Xavf omillari skrini ${score}: omillar kam — hayot tarzi va muntazam lipid panel. ${tail}`;
  if (score <= 8) return `Xavf omillari skrini ${score}: bir nechta omil — lipid pasaytiruvchi terapiya va xavf omillari nazoratini ko'rib chiqing. ${tail}`;
  return `Xavf omillari skrini ${score}: omillar ko'p — rasmiy xavf baholash va kardiolog kuzatuvi. ${tail}`;
}
