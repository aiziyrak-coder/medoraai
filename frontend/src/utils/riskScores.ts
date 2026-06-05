/** Klinik xavf shkalalari — deterministik hisoblash (AI faqat talqin uchun). */

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
  const uz =
    score === 0
      ? 'Past insult xavfi (~0% yiliga). Antikoagulyant odatda ko\'rsatilmaydi.'
      : score === 1
        ? 'O\'rta-past xavf. Individual baholash kerak.'
        : score >= 2
          ? `Yuqori insult xavfi (taxminan ${score >= 4 ? '4-8' : '2-4'}% yiliga). Antikoagulyant terapiyani ko\'rib chiqing.`
          : '';
  if (lang.startsWith('en')) {
    if (score === 0) return 'Low stroke risk (~0%/year). Anticoagulation usually not indicated.';
    if (score === 1) return 'Low-moderate risk. Individual assessment needed.';
    return `Elevated stroke risk. Consider anticoagulation (score ${score}).`;
  }
  return uz;
}

export function calculateHeart(input: HeartScoreInput): number {
  let score = 0;
  const histMap = { highly: 2, moderate: 1, slightly: 1, none: 0 };
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
    if (score <= 3) return `HEART ${score}: Low risk (~1-2% MACE). Outpatient follow-up may be appropriate.`;
    if (score <= 6) return `HEART ${score}: Moderate risk. Observation and serial troponin/ECG recommended.`;
    return `HEART ${score}: High risk. Urgent cardiology evaluation and admission considered.`;
  }
  if (score <= 3) return `HEART ${score}: Past xavf (~1-2% MACE). Ambulator kuzatuv mumkin.`;
  if (score <= 6) return `HEART ${score}: O'rta xavf. Kuzatuv va qayta troponin/EKG tavsiya etiladi.`;
  return `HEART ${score}: Yuqori xavf. Shoshilinch kardiologik baholash va statsionar ko'rib chiqiladi.`;
}

/** ASCVD — soddalashtirilgan Framingham-ga yaqin ball (0-20+) */
export type AscvdInput = {
  age: number;
  male: boolean;
  smoker: boolean;
  diabetes: boolean;
  systolicBp: number;
  onHypertensionTreatment: boolean;
  totalCholesterol: number;
  hdl: number;
};

export function calculateAscvdSimplified(input: AscvdInput): number {
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

export function interpretAscvd(score: number, lang: string): string {
  if (lang.startsWith('en')) {
    if (score <= 4) return `ASCVD risk points ${score}: lower category — lifestyle and periodic lipid panel.`;
    if (score <= 8) return `ASCVD risk points ${score}: moderate — statin and risk factor control per guidelines.`;
    return `ASCVD risk points ${score}: high — intensive lipid lowering and cardiology follow-up.`;
  }
  if (score <= 4) return `ASCVD ball ${score}: pastroq kategoriya — hayot tarzi va lipid panel muntazam.`;
  if (score <= 8) return `ASCVD ball ${score}: o'rta — statin va xavf omillarini nazorat qiling.`;
  return `ASCVD ball ${score}: yuqori — intensiv lipid pasaytirish va kardiolog kuzatuvi.`;
}
