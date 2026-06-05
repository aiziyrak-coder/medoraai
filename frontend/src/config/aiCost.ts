/**
 * AI xarajat — default: Haiku 4.5 (eng arzon, tez, tibbiy vazifalar uchun kuchli).
 * VITE_AI_COST_MODE=scale|economy|balanced|quality
 *
 * scale/economy: BARCHA chaqiruvlar Haiku (~Sonnetdan 10–20× arzon).
 * balanced: Sonnet (sifat/yaxlitlik).
 * quality: Opus (maksimal).
 */

import { LIMITS } from '../constants/timeouts';

export type AiCostMode = 'scale' | 'economy' | 'balanced' | 'quality';

const DEEPSEEK_CHAT_DEFAULT = 'deepseek-chat';
const DEEPSEEK_REASONER_DEFAULT = 'deepseek-reasoner';

export function getAiCostMode(): AiCostMode {
  const raw = (import.meta.env.VITE_AI_COST_MODE as string | undefined)?.trim().toLowerCase();
  if (raw === 'quality' || raw === 'balanced' || raw === 'economy' || raw === 'scale') {
    return raw;
  }
  return 'balanced';
}

/** Sonnet faqat ixtiyoriy (VITE_CLAUDE_USE_SONNET_DIAGNOSIS=true). */
export function useSonnetForDiagnosis(): boolean {
  const flag = (import.meta.env.VITE_CLAUDE_USE_SONNET_DIAGNOSIS as string | undefined)?.trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

export function getClaudeModels(): {
  fast: string;
  pro: string;
  final: string;
  diagnosis: string;
} {
  const haiku =
    (import.meta.env.VITE_DEEPSEEK_MODEL_FAST as string | undefined)?.trim() ||
    (import.meta.env.VITE_CLAUDE_MODEL_HAIKU as string | undefined)?.trim() ||
    DEEPSEEK_CHAT_DEFAULT;
  const sonnet =
    (import.meta.env.VITE_DEEPSEEK_MODEL_PRO as string | undefined)?.trim() ||
    (import.meta.env.VITE_CLAUDE_MODEL_FAST as string | undefined)?.trim() ||
    DEEPSEEK_REASONER_DEFAULT;
  const opus =
    (import.meta.env.VITE_CLAUDE_MODEL_PRO as string | undefined)?.trim() ||
    DEEPSEEK_REASONER_DEFAULT;

  const mode = getAiCostMode();
  if (mode === 'quality') {
    return { fast: sonnet, pro: opus, final: opus, diagnosis: opus };
  }
  if (mode === 'balanced') {
    return { fast: sonnet, pro: sonnet, final: sonnet, diagnosis: sonnet };
  }
  if (useSonnetForDiagnosis() && mode === 'scale') {
    return { fast: haiku, pro: sonnet, final: sonnet, diagnosis: sonnet };
  }
  // scale + economy: deyarli hamma narsa Haiku
  return { fast: haiku, pro: haiku, final: haiku, diagnosis: haiku };
}

export type TokenBudget = 'tiny' | 'short' | 'medium' | 'large' | 'batch' | 'report';

const TOKEN_CAPS: Record<AiCostMode, Record<TokenBudget, number>> = {
  scale: { tiny: 384, short: 1024, medium: 2600, large: 3600, batch: 6144, report: 7168 },
  economy: { tiny: 384, short: 1280, medium: 2800, large: 3600, batch: 6144, report: 6144 },
  balanced: { tiny: 512, short: 2048, medium: 3600, large: 5120, batch: 7168, report: 8192 },
  quality: { tiny: 512, short: 2048, medium: 4096, large: 8192, batch: 8192, report: 8192 },
};

/** Professor + barcha mutaxassislar bitta Haiku chaqiruvida (~10× arzon). */
export function useBatchConsiliumDebate(): boolean {
  const flag = (import.meta.env.VITE_AI_BATCH_CONSILIUM as string | undefined)?.trim().toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  if (flag === 'true' || flag === '1') return true;
  const mode = getAiCostMode();
  return mode === 'scale' || mode === 'economy';
}

export function getMaxTokens(budget: TokenBudget): number {
  return TOKEN_CAPS[getAiCostMode()][budget];
}

export function includeAttachmentsInDebate(): boolean {
  return getAiCostMode() === 'quality';
}

export function maxAttachmentsForDiagnosis(): number {
  const mode = getAiCostMode();
  if (mode === 'quality') return 4;
  if (mode === 'balanced') return 2;
  return 1;
}

export function includeAttachmentsInAi(forDiagnosis = false): boolean {
  if (forDiagnosis) {
    return maxAttachmentsForDiagnosis() > 0;
  }
  return includeAttachmentsInDebate();
}

/** Munozara: qisqa prompt; tashxis tier alohida to'liq prompt ishlatadi. */
export function useLiteSystemPrompt(): boolean {
  return getAiCostMode() !== 'quality';
}

export function getMaxDebateSpecialists(): number {
  return LIMITS.MAX_SPECIALISTS;
}

export function getMinDebateSpecialists(): number {
  return LIMITS.MIN_SPECIALISTS;
}

export function shouldSkipPrognosisLlm(): boolean {
  return getAiCostMode() !== 'quality';
}

export function shouldSkipReportFallbackLlm(): boolean {
  return getAiCostMode() === 'scale' || getAiCostMode() === 'economy';
}

/** API fallback zanjiri — arzon rejimda Sonnet/Opus chaqirilmaydi. */
export function getCheapFallbackModels(primaryModel: string): string[] {
  const mode = getAiCostMode();
  if (mode === 'scale' || mode === 'economy') {
    return [];
  }
  if (mode === 'balanced') {
    return primaryModel.includes('chat') ? [DEEPSEEK_REASONER_DEFAULT] : [];
  }
  return [DEEPSEEK_REASONER_DEFAULT];
}

