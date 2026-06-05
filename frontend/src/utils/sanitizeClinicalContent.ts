/**
 * Klinik matndan ichki AI/model nomlarini va texnik belgilarni olib tashlaydi.
 * Foydalanuvchi faqat professor/mutaxassis nomlarini ko'radi.
 */

const INTERNAL_AGENT_IDS =
  'deepseek|llama|mistral|gpt4o|mini|chair|reasoning|encyclopedist|standards|pharmacologist';

const REFUTATION_LINE_RE = new RegExp(
  `^\\s*[↳→•\\-]*\\s*\\[(?:STRONG|MODERATE|WEAK)\\]\\s*(?:${INTERNAL_AGENT_IDS})\\s*:\\s*`,
  'gim',
);

const BRACKET_AGENT_RE = new RegExp(
  `\\[(?:STRONG|MODERATE|WEAK)\\]\\s*(?:${INTERNAL_AGENT_IDS})\\s*:?\\s*`,
  'gi',
);

const FJSTI_DEPLOY_RE = /\bFJSTI[-_]?(?:deepseek|llama|mistral|gpt4o|mini)\b/gi;

const MODEL_TOKEN_RE =
  /\b(?:deepseek-chat|deepseek-reasoner|gpt-?4o(?:-mini)?|claude-(?:opus|sonnet|haiku))\b/gi;

/** Matn boshidagi "deepseek:" / "llama:" kabi qatorlarni tozalaydi */
const LINE_PREFIX_AGENT_RE = new RegExp(
  `^\\s*(?:${INTERNAL_AGENT_IDS})\\s*:\\s*`,
  'gim',
);

export function sanitizeClinicalContent(text: string): string {
  if (!text) return text;

  let s = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s*->\s*/g, ' — ')
    .replace(/\s*→\s*/g, ' — ')
    .replace(REFUTATION_LINE_RE, '• ')
    .replace(BRACKET_AGENT_RE, '')
    .replace(FJSTI_DEPLOY_RE, '')
    .replace(MODEL_TOKEN_RE, '')
    .replace(LINE_PREFIX_AGENT_RE, '')
    .replace(/\bProf\.\s+[\w''ʻ\-]+\s+[\w''ʻ\-]+/gi, 'Mutaxassis');

  // Qolgan yakka agent id (faqat butun so'z sifatida)
  s = s.replace(
    new RegExp(`\\b(?:${INTERNAL_AGENT_IDS})\\b(?=\\s*:)`, 'gi'),
    'mutaxassis',
  );

  return s.replace(/\n{3,}/g, '\n\n').trim();
}
