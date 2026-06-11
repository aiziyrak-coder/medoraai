import type { ChatMessage } from '../types';

/** Munozara o'rtasida yakuniy xulosa dublikati (KONSILIUM YOPILDI) kerak emas. */
export function isClosingDebateMessage(
  message: Pick<ChatMessage, 'id' | 'content'> & { phase?: string },
): boolean {
  const id = String(message.id ?? '');
  const phase = String(message.phase ?? '');
  const content = String(message.content ?? '');
  if (phase === 'consensus' || id.includes('chair-closing')) return true;
  return /▸\s*KONSILIUM YOPILDI/i.test(content) || /^KONSILIUM YOPILDI/i.test(content.trim());
}

export function filterDebateForDisplay(messages: ChatMessage[]): ChatMessage[] {
  return (Array.isArray(messages) ? messages : []).filter((m) => !isClosingDebateMessage(m));
}
