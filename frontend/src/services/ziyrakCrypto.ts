/**
 * FJSTI Ziyrak — brauzer ↔ server payload shifrlash (AES-256-GCM).
 */
const KEY_ENV = (import.meta.env.VITE_FJSTI_ZIYRAK_PAYLOAD_KEY as string | undefined)?.trim() || '';

let cachedKey: CryptoKey | null | undefined;

async function deriveKey(): Promise<CryptoKey | null> {
  if (cachedKey !== undefined) return cachedKey;
  if (!KEY_ENV) {
    cachedKey = null;
    return null;
  }
  let raw: Uint8Array;
  if (/^[0-9a-fA-F]{64}$/.test(KEY_ENV)) {
    raw = hexToBytes(KEY_ENV);
  } else {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(KEY_ENV));
    raw = new Uint8Array(digest);
  }
  cachedKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return cachedKey;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function isZiyrakPayloadEncryptionEnabled(): boolean {
  return !!KEY_ENV;
}

export async function encryptZiyrakPayload(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = await deriveKey();
  if (!key) return data;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const merged = new Uint8Array(iv.length + ciphertext.byteLength);
  merged.set(iv, 0);
  merged.set(new Uint8Array(ciphertext), iv.length);
  return { v: 1, enc: true, data: bytesToBase64(merged) };
}
