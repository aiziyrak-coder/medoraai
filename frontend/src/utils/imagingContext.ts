import type { ImagingStudyRecord, PatientData } from '../types';

/** Bir nechta saqlangan tasvir tahlillarini konsilium patient_data ga qo'shish. */
export function mergeImagingStudiesIntoPatientData(
  data: PatientData,
  studies: ImagingStudyRecord[],
): PatientData {
  if (!studies.length) return data;
  const summaries = studies
    .map((s) => (s.summary_text || '').trim())
    .filter(Boolean);
  if (!summaries.length) return data;

  const structured = studies.reduce<Record<string, Record<string, unknown>>>(
    (acc, s) => {
      const block = s.imaging_structured;
      if (!block || typeof block !== 'object') return acc;
      for (const [key, val] of Object.entries(block)) {
        if (!val || typeof val !== 'object') continue;
        const prev = acc[key];
        if (!prev) {
          acc[key] = { ...val };
          continue;
        }
        const merged = { ...prev };
        for (const field of ['summary', 'clinical_significance', 'limitations'] as const) {
          const a = String(prev[field] ?? '').trim();
          const b = String((val as Record<string, unknown>)[field] ?? '').trim();
          if (b && !a.includes(b)) {
            merged[field] = a ? `${a}\n${b}` : b;
          }
        }
        const pf = Array.isArray(prev.key_findings) ? prev.key_findings : [];
        const bf = Array.isArray((val as Record<string, unknown>).key_findings)
          ? ((val as Record<string, unknown>).key_findings as string[])
          : [];
        const seen = new Set(pf.map(String));
        merged.key_findings = [...pf, ...bf.filter((x) => !seen.has(String(x)))];
        acc[key] = merged;
      }
      return acc;
    },
    {},
  );

  return {
    ...data,
    imagingAnalysisSummary: summaries.join('\n\n---\n\n'),
    imagingStructured: Object.keys(structured).length ? structured : data.imagingStructured,
    includePriorImaging: true,
  };
}
