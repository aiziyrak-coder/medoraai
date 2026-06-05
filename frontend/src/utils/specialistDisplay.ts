import { AIModel } from '../constants/specialists';

/** Eski AI nomlari (Claude-Cardio, GPT-4o) → i18n kalit qismi */
const AUTHOR_I18N_KEY: Record<string, string> = {
  'Claude-Cardio': 'cardiologist',
  Cardiologist: 'cardiologist',
  Claude: 'neurologist',
  Neurologist: 'neurologist',
  'GPT-4o': 'radiologist',
  Radiologist: 'radiologist',
  'Llama 3': 'oncologist',
  Oncologist: 'oncologist',
  Grok: 'endocrinologist',
  Endocrinologist: 'endocrinologist',
  deepseek: 'neurologist',
  llama: 'oncologist',
  mistral: 'gastroenterologist',
  gpt4o: 'cardiologist',
  mini: 'pharmacologist',
  chair: 'cardiologist',
  reasoning: 'neurologist',
  encyclopedist: 'oncologist',
  standards: 'gastroenterologist',
  pharmacologist: 'pharmacologist',
  [AIModel.SYSTEM]: 'system',
};

/** Qavs ichidagi AI/platforma nomlarini olib tashlash */
export function stripAiParentheticals(name: string): string {
  return name
    .replace(/\s*\([^)]*(?:AI|Claude|GPT|Llama|Grok|Opus|Sonnet|Haiku|DeepSeek|Mistral|Orkestrator|Orchestrator)[^)]*\)/gi, '')
    .replace(/\s*AI\s*$/i, '')
    .trim();
}

/** Backend/API dan kelgan mutaxassis nomini AIModel ga */
export function mapApiSpecialistToAIModel(model: string): AIModel {
  const m = String(model || '').trim();
  const direct = Object.values(AIModel).find((v) => v === m);
  if (direct) return direct;
  const aliasToEnum: Record<string, AIModel> = {
    'Claude-Cardio': AIModel.GEMINI,
    Cardiologist: AIModel.GEMINI,
    Claude: AIModel.CLAUDE,
    Neurologist: AIModel.CLAUDE,
    'GPT-4o': AIModel.GPT,
    Radiologist: AIModel.GPT,
    'Llama 3': AIModel.LLAMA,
    Oncologist: AIModel.LLAMA,
    Grok: AIModel.GROK,
    Endocrinologist: AIModel.GROK,
  };
  if (aliasToEnum[m]) return aliasToEnum[m];
  const key = resolveSpecialistI18nKey(m);
  const byKey = Object.values(AIModel).find(
    (v) => resolveSpecialistI18nKey(v) === key || v.toLowerCase().replace(/[\s-]+/g, '_') === key,
  );
  return byKey ?? AIModel.INTERNAL_MEDICINE;
}

/** Backend konsilium agent id → UI avatar/mutaxassis */
export const CONSILIUM_AGENT_TO_MODEL: Record<string, AIModel> = {
  deepseek: AIModel.CLAUDE,
  reasoning: AIModel.CLAUDE,
  llama: AIModel.LLAMA,
  encyclopedist: AIModel.LLAMA,
  mistral: AIModel.GASTRO,
  standards: AIModel.GASTRO,
  mini: AIModel.PHARMACOLOGIST,
  pharmacologist: AIModel.PHARMACOLOGIST,
  gpt4o: AIModel.SYSTEM,
  chair: AIModel.SYSTEM,
};

export function mapConsiliumAgentIdToAIModel(agentId: string): AIModel {
  const id = String(agentId || '').split('-')[0].toLowerCase();
  return CONSILIUM_AGENT_TO_MODEL[id] ?? AIModel.INTERNAL_MEDICINE;
}

export function resolveSpecialistI18nKey(author: string | AIModel): string {
  const raw = String(author).trim();
  if (AUTHOR_I18N_KEY[raw]) return AUTHOR_I18N_KEY[raw];
  const lower = raw.toLowerCase();
  for (const [alias, key] of Object.entries(AUTHOR_I18N_KEY)) {
    if (alias.toLowerCase() === lower) return key;
  }
  return lower.replace(/[\s-]+/g, '_');
}
