import { AIModel } from '../constants/specialists';
import type { Diagnosis, PatientData } from '../types';

/**
 * API muvaffaqiyatsiz bo'lganda: shikoyat va DDx matnidan turli mutaxassislarni tanlash
 * (har doim bir xil 6 ta "umumiy" profil emas).
 */
export function inferFallbackSpecialists(
  patientData: PatientData,
  diagnoses: Diagnosis[]
): { model: AIModel; reason: string }[] {
  const blob = [
    patientData.complaints || '',
    patientData.history || '',
    patientData.labResults || '',
    ...diagnoses.map((d) => `${d.name} ${d.justification || ''}`),
  ]
    .join(' ')
    .toLowerCase();

  const out: { model: AIModel; reason: string }[] = [];
  const seen = new Set<AIModel>();

  const add = (m: AIModel, reason: string) => {
    if (seen.has(m) || out.length >= 8) return;
    seen.add(m);
    out.push({ model: m, reason });
  };

  // Differensial tashxis nomlari (ingliz/o'zbek aralashimi mumkin)
  for (const d of diagnoses.slice(0, 6)) {
    const n = (d.name || '').toLowerCase();
    if (/nefr|renal|kidney|buyrak|glomerul|dializ|creatinine/i.test(n)) {
      add(AIModel.NEPHROLOGIST, 'DDx: buyrak kasalligi / nefrologiya');
    }
    if (/gemat|anem|iron|ferritin|b12|folat|qon yetishmov|hemoglobin|hb\b/i.test(n)) {
      add(AIModel.HEMATOLOGIST, 'DDx: gematologik holat / anemiya');
    }
    if (/kardio|yurak|koronar|giperton|aritm|insult|stroke|infarkt/i.test(n)) {
      add(AIModel.GEMINI, 'DDx: yurak-qon tomir tizimi');
    }
    if (/pulmon|nafas|pnevmon|copd|astma|plevra/i.test(n)) {
      add(AIModel.PULMONOLOGIST, 'DDx: nafas yo‘llari / pulmonologiya');
    }
    if (/gastro|oshqozon|ichak|jigar|hepat|pankreat|б\/а|ж\/а/i.test(n)) {
      add(AIModel.GASTRO, 'DDx: gastroenterologiya');
    }
    if (/diabet|gliukoz|insulin|qand|эндокрин|tireoid/i.test(n)) {
      add(AIModel.GROK, 'DDx: endokrin / metabolik');
    }
    if (/onko|saraton|tumor|neoplasm/i.test(n)) {
      add(AIModel.LLAMA, 'DDx: onkologik baholash');
    }
    if (/infeks|sepsis|pireksiya|лихорадк/i.test(n)) {
      add(AIModel.INFECTIOUS, 'DDx: infeksion holat');
    }
  }

  // Shikoyat va laborator — qisqa kalit so‘zlar
  if (/buyrak|dializ|creatinine|креатинин|edema|shish|proteinur/i.test(blob)) {
    add(AIModel.NEPHROLOGIST, 'Klinik kontekst: buyrak / suyuq muvozanat');
  }
  if (/gemoglobin|anem|ferritin|gemat|qon yetishmov/i.test(blob)) {
    add(AIModel.HEMATOLOGIST, 'Klinik kontekst: qon / gematologiya');
  }
  if (/yurak|ko'krak|og'riq|ekg|giperton|aritm|tachikard/i.test(blob)) {
    add(AIModel.GEMINI, 'Klinik kontekst: kardiologiya');
  }
  if (/nafas|dispnoe|oksigen|spo2|o'pka/i.test(blob)) {
    add(AIModel.PULMONOLOGIST, 'Klinik kontekst: nafas yetishmovchiligi');
  }

  const pool: AIModel[] = [
    AIModel.INTERNAL_MEDICINE,
    AIModel.EMERGENCY,
    AIModel.FAMILY_MEDICINE,
    AIModel.PULMONOLOGIST,
    AIModel.GASTRO,
    AIModel.NEPHROLOGIST,
    AIModel.HEMATOLOGIST,
    AIModel.GEMINI,
    AIModel.CLAUDE,
    AIModel.GPT,
  ];
  for (const m of pool) {
    add(m, 'Keng konsilium uchun qo‘llab-quvvatlovchi profil');
    if (out.length >= 6) break;
  }

  return out.slice(0, 8);
}
