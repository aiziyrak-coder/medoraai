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

const HAIKU_DEFAULT = 'claude-haiku-4-5-20251001';

export function getAiCostMode(): AiCostMode {
  const raw = (import.meta.env.VITE_AI_COST_MODE as string | undefined)?.trim().toLowerCase();
  if (raw === 'quality' || raw === 'balanced' || raw === 'economy' || raw === 'scale') {
    return raw;
  }
  return 'scale';
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
    (import.meta.env.VITE_CLAUDE_MODEL_HAIKU as string | undefined)?.trim() || HAIKU_DEFAULT;
  const sonnet =
    (import.meta.env.VITE_CLAUDE_MODEL_FAST as string | undefined)?.trim() ||
    'claude-sonnet-4-6';
  const opus =
    (import.meta.env.VITE_CLAUDE_MODEL_PRO as string | undefined)?.trim() ||
    'claude-opus-4-7';

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

export type TokenBudget = 'tiny' | 'short' | 'medium' | 'large' | 'report';

const TOKEN_CAPS: Record<AiCostMode, Record<TokenBudget, number>> = {
  scale: { tiny: 256, short: 768, medium: 2048, large: 3072, report: 6144 },
  economy: { tiny: 256, short: 1024, medium: 2048, large: 3072, report: 4096 },
  balanced: { tiny: 384, short: 1536, medium: 3072, large: 4096, report: 6144 },
  quality: { tiny: 512, short: 2048, medium: 4096, large: 8192, report: 8192 },
};

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
    return primaryModel.includes('haiku') ? ['claude-sonnet-4-6'] : [];
  }
  return ['claude-sonnet-4-6', 'claude-opus-4-7'];
}
