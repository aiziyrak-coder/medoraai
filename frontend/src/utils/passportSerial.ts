/** Pasport seriya raqami — bemorning doimiy ID raqami (masalan AB1234567). */
const PASSPORT_SERIAL_RE = /^[A-Z]{2}\d{7}$/;
const LEGACY_NUMERIC_RE = /^\d{8}$/;

export function normalizePassportSerial(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidPassportSerial(value: string | null | undefined): boolean {
  const n = normalizePassportSerial(value);
  return PASSPORT_SERIAL_RE.test(n) || LEGACY_NUMERIC_RE.test(n);
}

export function formatPassportSerialInput(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letters = raw.replace(/[^A-Z]/g, '').slice(0, 2);
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 7);
  return letters + digits;
}
