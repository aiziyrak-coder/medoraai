/**
 * Shikoyat matniga asoslangan tezkor mutaxassis taklifi (AI kutishsiz).
 * 6–10 ta mutaxassisni murakkablik past bo'lganda darhol qaytaradi.
 */

import { AIModel } from '../constants/specialists';

/** Shikoyat kalit so'zlari -> mutaxassis(lar) */
const KEYWORD_TO_SPECIALISTS: { keywords: RegExp; models: AIModel[] }[] = [
  { keywords: /\b(yurak|qon\s*bosimi|puls|aritmiya|stenokardiya|infarkt|kardiolog)\b/i, models: [AIModel.GEMINI] },
  { keywords: /\b(bosh\s*og'riq|bosh\s*ogriq|nevrolog|falaj|paralich|epilepsiya|stroke)\b/i, models: [AIModel.CLAUDE] },
  { keywords: /\b(rentgen|röntgen|ct|mrt|mri|tasvir|radiolog)\b/i, models: [AIModel.GPT] },
  { keywords: /\b(o'sma|saraton|onkolog|metastaz)\b/i, models: [AIModel.LLAMA] },
  { keywords: /\b(qand|gormon|qalqonsimon|tiroid|endokrin)\b/i, models: [AIModel.GROK] },
  { keywords: /\b(nafas|o'pka|bronx|pnevmoniya|astma|spo2)\b/i, models: [AIModel.PULMONOLOGIST] },
  { keywords: /\b(jigar|oshqozon|ichak|gastrit|gepatit|pankreas)\b/i, models: [AIModel.GASTRO] },
  { keywords: /\b(buyrak|siydik|nefrit|dializ)\b/i, models: [AIModel.NEPHROLOGIST] },
  { keywords: /\b(siydik\s*yo'li|urolog|prostat)\b/i, models: [AIModel.UROLOGIST] },
  { keywords: /\b(teri|dermato|qichima|ekzema)\b/i, models: [AIModel.DERMATOLOGIST] },
  { keywords: /\b(allergiya|reaksiya|qichish)\b/i, models: [AIModel.ALLERGIST] },
  { keywords: /\b(suyak|tizza|bo'yin|bel|ortoped|artroz|artrit)\b/i, models: [AIModel.ORTHOPEDIC] },
  { keywords: /\b(ko'z|ko\'z|retina|glaukoma)\b/i, models: [AIModel.OPHTHALMOLOGIST] },
  { keywords: /\b(quloq|tomoq|burun|lor|tonzillit)\b/i, models: [AIModel.OTOLARYNGOLOGIST] },
  { keywords: /\b(psix|depressiya|ruhiy|stress|anksiyete)\b/i, models: [AIModel.PSYCHIATRIST] },
  { keywords: /\b(homilador|tug'ruq|chaqaloq|obstetr)\b/i, models: [AIModel.OBGYN, AIModel.PEDIATRICIAN] },
  { keywords: /\b(dori|darmon|allergiya\s*dori|doza)\b/i, models: [AIModel.PHARMACOLOGIST] },
  { keywords: /\b(shoshilinch|jiddiy|urgent|krizis)\b/i, models: [AIModel.EMERGENCY] },
  { keywords: /\b(yuqumli|infeksiya|virus|bakteriya|COVID)\b/i, models: [AIModel.INFECTIOUS] },
  { keywords: /\b(revmatik|bo'g'im|lyupus)\b/i, models: [AIModel.RHEUMATOLOGIST] },
  { keywords: /\b(qon|anemiya|leykemiya)\b/i, models: [AIModel.HEMATOLOGIST] },
  { keywords: /\b(immun|autoimmun)\b/i, models: [AIModel.IMMUNOLOGIST] },
];

const DEFAULT_POOL: AIModel[] = [
  AIModel.INTERNAL_MEDICINE,
  AIModel.FAMILY_MEDICINE,
  AIModel.EMERGENCY,
  AIModel.GEMINI,
  AIModel.CLAUDE,
  AIModel.GPT,
];

/**
 * Shikoyat va anamnez matnidan 6–10 ta mutaxassisni tezda aniqlaydi (AI chaqiruvsiz).
 */
export function getSpecialistsFromComplaint(complaint: string): { model: AIModel; reason: string }[] {
  const text = (complaint || '').trim();
  const seen = new Set<AIModel>();
  const result: { model: AIModel; reason: string }[] = [];

  for (const { keywords, models } of KEYWORD_TO_SPECIALISTS) {
    if (result.length >= 10) break;
    if (!keywords.test(text)) continue;
    for (const model of models) {
      if (seen.has(model)) continue;
      seen.add(model);
      result.push({ model, reason: 'Shikoyat bo\'yicha tavsiya' });
    }
  }

  for (const model of DEFAULT_POOL) {
    if (result.length >= 10) break;
    if (seen.has(model)) continue;
    seen.add(model);
    result.push({ model, reason: 'Standart jamoa' });
  }

  if (result.length < 6) {
    const rest = Object.values(AIModel).filter(
      m => m !== AIModel.SYSTEM && !seen.has(m)
    ).slice(0, 6 - result.length);
    rest.forEach(model => result.push({ model, reason: 'Standart jamoa' }));
  }

  return result.slice(0, 10);
}
