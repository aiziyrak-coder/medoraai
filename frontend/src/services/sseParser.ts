/**
 * SSE (Server-Sent Events) oqimini xavfsiz o'qish.
 *
 * Nega alohida modul: tarmoqdan kelgan bo'lak (`reader.read()`) SSE hodisa
 * chegarasiga mos tushmaydi — bitta `data: {...}` qatori ikki o'qish orasida
 * bo'linib ketishi mumkin. Buferlanmasa bo'lingan hodisa butunlay yo'qoladi.
 *
 * SSE formati: hodisalar bo'sh qator bilan ajratiladi, hodisa ichidagi
 * `data:` qatorlari `\n` bilan birlashtiriladi.
 */

export interface SseEvent {
  /** Matn bo'lagi (`{"chunk": "..."}`) */
  chunk?: string;
  /** Server yuborgan xato (`{"error": "..."}`) */
  error?: string;
  /** `data: [DONE]` — oqim tugadi */
  done?: boolean;
}

/** Bitta hodisa blokidan `data:` qatorlarini yig'ib, payload qaytaradi. */
function payloadOf(block: string): string | null {
  const parts: string[] = [];
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':')) continue; // bo'sh yoki izoh
    if (!trimmed.startsWith('data:')) continue;        // event:/id:/retry: — bizga kerak emas
    parts.push(trimmed.slice(5).trim());
  }
  return parts.length ? parts.join('\n') : null;
}

function toEvent(payload: string): SseEvent | null {
  if (payload === '[DONE]') return { done: true };
  try {
    const obj = JSON.parse(payload) as { chunk?: string; error?: string };
    if (obj.error) return { error: obj.error };
    if (typeof obj.chunk === 'string' && obj.chunk) return { chunk: obj.chunk };
    return null;
  } catch {
    // To'liq hodisa bo'lib ham JSON buzuq bo'lsa — bu haqiqiy xato, jim yutmaymiz.
    return { error: 'SSE payload JSON emas' };
  }
}

/**
 * Oqim buferi: har `push()` da to'liq yig'ilgan hodisalarni qaytaradi,
 * chala qolgan qismni keyingi bo'lakka saqlab turadi.
 */
export class SseBuffer {
  private buf = '';

  push(text: string): SseEvent[] {
    this.buf += text;
    const events: SseEvent[] = [];

    // Hodisa chegarasi: \n\n yoki \r\n\r\n
    for (;;) {
      const m = /\r?\n\r?\n/.exec(this.buf);
      if (!m) break;
      const block = this.buf.slice(0, m.index);
      this.buf = this.buf.slice(m.index + m[0].length);
      const payload = payloadOf(block);
      if (payload === null) continue;
      const ev = toEvent(payload);
      if (ev) events.push(ev);
    }
    return events;
  }

  /** Oqim yopilgach, oxirgi chegarasiz qolgan blokni tekshiradi. */
  flush(): SseEvent[] {
    const rest = this.buf;
    this.buf = '';
    const payload = payloadOf(rest);
    if (payload === null) return [];
    const ev = toEvent(payload);
    return ev ? [ev] : [];
  }
}
