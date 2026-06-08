import type { PatientData } from '../types';
import type { Patient } from '../services/apiPatientService';

export function normalizePatientPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-().]/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('998')) return `+${cleaned}`;
  if (/^\d{9}$/.test(cleaned)) return `+998${cleaned}`;
  if (/^\d+$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
}

/** Mavjud bemorlar ro'yxatidan eng mos ID ni tanlash (telefon ustuvor). */
export function pickPatientMatchId(
  matches: Patient[],
  data: Pick<PatientData, 'firstName' | 'lastName' | 'fatherName' | 'age' | 'phone'>,
): number | null {
  if (!matches.length) return null;

  const phoneKey = normalizePatientPhone(data.phone);
  if (phoneKey) {
    const byPhone = matches.filter((p) => normalizePatientPhone(p.phone) === phoneKey);
    if (byPhone.length >= 1) {
      return byPhone[0].id;
    }
  }

  if (matches.length === 1) {
    return matches[0].id;
  }

  const fn = (data.firstName || '').trim().toLowerCase();
  const ln = (data.lastName || '').trim().toLowerCase();
  const father = (data.fatherName || '').trim().toLowerCase();
  const age = (data.age || '').trim();
  if (fn && ln && father && age) {
    const exact = matches.filter(
      (p) =>
        (p.first_name || '').trim().toLowerCase() === fn
        && (p.last_name || '').trim().toLowerCase() === ln
        && (p.father_name || '').trim().toLowerCase() === father
        && String(p.age || '').trim() === age,
    );
    if (exact.length === 1) {
      return exact[0].id;
    }
  }

  return null;
}
