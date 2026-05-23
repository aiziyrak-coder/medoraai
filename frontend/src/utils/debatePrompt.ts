import type { ChatMessage } from '../types';
import { AIModel } from '../constants/specialists';

/** Munozarani JSON.stringify o'rniga qisqa matn — input tokenlarni 70–90% kamaytiradi. */
export function formatDebateForPrompt(
  debateHistory: ChatMessage[],
  maxMessages = 12,
  maxCharsPerMessage = 450,
): string {
  return debateHistory
    .slice(-maxMessages)
    .map((m) => {
      const who = m.author === AIModel.SYSTEM ? 'Professor' : String(m.author);
      const text = (m.content || '').trim().slice(0, maxCharsPerMessage);
      return `[${who}]: ${text}`;
    })
    .join('\n');
}
