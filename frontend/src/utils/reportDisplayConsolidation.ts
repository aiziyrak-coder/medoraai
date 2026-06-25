import type { Diagnosis, FinalReport, FollowUpTask, Referral } from '../types';
import { normalizeConsensusDiagnosis } from '../types';

const PLACEHOLDER_ICD10 = new Set([
  'X00', 'X00.0', 'X00.00', 'Z00', 'Z00.0', 'Z00.00',
  'A00', 'A00.0', 'E00', 'E00.0', 'I00', 'I00.0', 'J00', 'J00.0',
  'R00', 'R00.0', 'S00', 'S00.0', 'T00', 'T00.0',
]);

const ICD10_RE = /^[A-TV-Z][0-9][0-9AB](\.[0-9A-Z]{1,4})?$/i;

export function isValidIcd10Code(code: string | undefined | null): boolean {
  const c = String(code || '').trim().toUpperCase();
  if (!c || PLACEHOLDER_ICD10.has(c)) return false;
  return ICD10_RE.test(c);
}

/** Noto'g'ri yoki placeholder MKB-10 kodlarini tozalaydi */
export function sanitizeDiagnosisIcd10(diagnoses: Diagnosis[]): Diagnosis[] {
  return diagnoses.map((d) => {
    if (!d.icd10 || !isValidIcd10Code(d.icd10)) {
      const { icd10: _a, icd10Description: _b, ...rest } = d;
      return rest;
    }
    return d;
  });
}

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function namesSimilar(a: string, b: string): boolean {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const xWords = new Set(x.split(/[\s,;/-]+/).filter((w) => w.length > 3));
  const yWords = new Set(y.split(/[\s,;/-]+/).filter((w) => w.length > 3));
  let overlap = 0;
  xWords.forEach((w) => { if (yWords.has(w)) overlap += 1; });
  return overlap >= 2;
}

/** Konsensus differensiallaridan takrorlangan rad etilgan gipotezalarni olib tashlaydi */
export function uniqueRejectedHypotheses(
  report: FinalReport,
  consensusDiagnoses: Diagnosis[],
): FinalReport['rejectedHypotheses'] {
  const diffNames = consensusDiagnoses.slice(1).map((d) => d.name).filter(Boolean);
  const primary = consensusDiagnoses[0]?.name || '';
  const seen = new Set<string>();
  const out: FinalReport['rejectedHypotheses'] = [];

  for (const h of report.rejectedHypotheses || []) {
    const name = String(h.name || '').trim();
    if (!name) continue;
    const key = normName(name);
    if (seen.has(key)) continue;
    if (primary && namesSimilar(name, primary)) continue;
    if (diffNames.some((dn) => namesSimilar(name, dn))) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

const GENERIC_UNEXPECTED_MARKERS = [
  'dalillar phase 1',
  "refutation og'irligi asosida birlashtirildi",
  'konsilium munozarasi yakunida asosiy tashxis:',
  '▸ yakuniy xulosa',
  '▸ rad etilgan gipotezalar',
  "▸ ko'rib chiqilgan muqobil",
  "▸ qo'shimcha tekshiruv",
];

function isGenericUnexpected(text: string): boolean {
  const low = text.trim().toLowerCase();
  if (!low) return true;
  return GENERIC_UNEXPECTED_MARKERS.some((m) => low.includes(m));
}

/** unexpectedFindings boshqa bo'limlarda allaqachon bo'lsa — alohida ko'rsatilmaydi */
export function condensedUnexpectedFindings(
  report: FinalReport,
  consensusDiagnoses: Diagnosis[],
): string | null {
  const raw = String(report.unexpectedFindings || '').trim();
  if (!raw || isGenericUnexpected(raw)) return null;

  const primary = consensusDiagnoses[0];
  const just = primary?.justification?.trim() || '';
  if (just && raw.includes(just.slice(0, Math.min(80, just.length)))) return null;

  const rejectedNames = (report.rejectedHypotheses || []).map((h) => h.name).filter(Boolean);
  const dupRejected = rejectedNames.filter((n) => raw.toLowerCase().includes(n.toLowerCase()));
  if (dupRejected.length >= 2 && dupRejected.length === rejectedNames.length) return null;

  const diffBlock = consensusDiagnoses.slice(1).every(
    (d) => !d.name?.trim() || raw.toLowerCase().includes(d.name.toLowerCase().slice(0, 20)),
  );
  if (consensusDiagnoses.length > 2 && diffBlock) return null;

  return raw;
}

export interface MergedFollowUpBlock {
  tests: string[];
  tasks: FollowUpTask[];
  routingTimeline?: string;
  examPlan: string[];
}

/** Tekshiruvlar, kuzatuv va marshrut — takrorlarsiz */
export function mergeFollowUpAndTests(report: FinalReport): MergedFollowUpBlock {
  const seen = new Set<string>();
  const tests: string[] = [];
  const pushTest = (t: string) => {
    const s = t.trim();
    if (!s) return;
    const key = s.toLowerCase().slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    tests.push(s);
  };

  (report.recommendedTests || []).forEach((t) => pushTest(String(t)));
  (report.patientRouting?.examPlan || []).forEach(pushTest);

  const tasks = report.followUpPlan || [];
  const routingTimeline = report.patientRouting?.followUpTimeline?.trim() || undefined;
  const examPlan = (report.patientRouting?.examPlan || []).filter(Boolean);

  return { tests, tasks, routingTimeline, examPlan };
}

/** Referrallar marshrut mutaxassislari bilan dublikat bo'lsa filtrlash */
export function uniqueReferrals(report: FinalReport): Referral[] {
  const routingSpecs = (report.patientRouting?.recommendedSpecialists || []).map((s) => s.specialty);
  return (report.referrals || []).filter((ref) => {
    return !routingSpecs.some((sp) => namesSimilar(sp, ref.specialty));
  });
}

export function shouldShowLifestyleSeparate(report: FinalReport): boolean {
  const lp = report.lifestylePlan;
  if (!lp) return false;
  const hasLifestyle = (lp.diet?.length ?? 0) > 0 || (lp.exercise?.length ?? 0) > 0;
  if (!hasLifestyle) return false;
  const np = report.nutritionPrevention;
  if (!np?.dietaryGuidelines?.length) return true;
  const dietJoined = np.dietaryGuidelines.join(' ').toLowerCase();
  const lifestyleJoined = [...(lp.diet || []), ...(lp.exercise || [])].join(' ').toLowerCase();
  if (lifestyleJoined.length < 20) return false;
  return !dietJoined.includes(lifestyleJoined.slice(0, 40));
}

export function prepareDisplayReport(report: FinalReport): FinalReport {
  let consensusDiagnosis = sanitizeDiagnosisIcd10(
    normalizeConsensusDiagnosis(report.consensusDiagnosis),
  );
  const seenDx = new Set<string>();
  consensusDiagnosis = consensusDiagnosis.filter((d) => {
    const key = normName(d.name || '');
    if (!key || seenDx.has(key)) return false;
    seenDx.add(key);
    return true;
  });
  const rejectedHypotheses = uniqueRejectedHypotheses(report, consensusDiagnosis);
  const unexpected = condensedUnexpectedFindings(
    { ...report, consensusDiagnosis, rejectedHypotheses },
    consensusDiagnosis,
  );
  const referrals = uniqueReferrals(report);

  return {
    ...report,
    consensusDiagnosis,
    rejectedHypotheses,
    unexpectedFindings: unexpected || '',
    referrals: referrals.length ? referrals : undefined,
  };
}
