/**
 * FJSTI Ziyrak AI — yagona inference kanali (brauzer → FJSTI server).
 * Tashqi AI provayderlarga to'g'ridan-to'g'ri ulanish yo'q.
 */
import { API_CONFIG } from '../config/api';
import { apiPost } from './api';
import { encryptZiyrakPayload } from './ziyrakCrypto';

export type ZiyrakMessage = { role: string; content: string };

export async function ziyrakInference(params: {
  model: string;
  messages: ZiyrakMessage[];
  max_tokens: number;
  temperature?: number;
  want_json?: boolean;
}): Promise<{ content: Array<{ type: string; text?: string }> }> {
  const body = {
    model: params.model,
    messages: params.messages,
    max_tokens: params.max_tokens,
    temperature: params.temperature ?? 0.1,
    want_json: !!params.want_json,
  };
  const payload = await encryptZiyrakPayload(body);
  const res = await apiPost<{ content: Array<{ type: string; text?: string }> }>(
    '/ziyrak/inference/',
    payload,
    API_CONFIG.AI_TIMEOUT_MS,
  );
  if (!res.success || !res.data) {
    throw new Error(res.error?.message || 'FJSTI Ziyrak AI javob bermadi');
  }
  return res.data;
}
