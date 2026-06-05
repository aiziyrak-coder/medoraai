import type { PatientData, Diagnosis, ChatMessage, AnalysisRecord } from '../types';
import { getUzbekistanContextForAI } from '../constants/uzbekistanHealthcare';
import type { Language } from '../i18n/LanguageContext';
import { formatDebateForPrompt } from './debatePrompt';

function s(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

function formatStructuredLabs(data: PatientData): string {
  const raw = data.structuredLabResults;
  if (!raw || typeof raw !== 'object') return '';
  const lines: string[] = [];
  for (const [test, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      if (!e?.value) continue;
      lines.push(`  - ${test}: ${e.value} ${e.unit || ''}${e.trend ? ` (${e.trend})` : ''}`);
    }
  }
  return lines.join('\n');
}

function formatAttachmentsMeta(data: PatientData): string {
  const atts = data.attachments;
  if (!atts?.length) return '';
  return atts
    .slice(0, 12)
    .map((att, i) => {
      const name = att.name || `fayl-${i + 1}`;
      const mime = (att.mimeType || '').toLowerCase();
      let kind = 'hujjat';
      if (/ecg|ekg/i.test(name)) kind = 'EKG/ECG';
      else if (/uzi|utt|ultra|sono/i.test(name)) kind = 'UZI/UTT';
      else if (/rentgen|xray|x-ray|rg/i.test(name)) kind = 'Rengen';
      else if (/\bct\b|kt|tomograf|computed/i.test(name)) kind = 'KT';
      else if (/\bmri\b|mrt|magnit|rezonans/i.test(name)) kind = 'MRI';
      else if (mime.startsWith('image/')) kind = 'Tibbiy rasm';
      else if (mime.includes('pdf')) kind = 'PDF';
      return `  - [${kind}] ${name} (${att.mimeType})`;
    })
    .join('\n');
}

export type ClinicalContextExtra = {
  differentialDiagnoses?: Diagnosis[];
  specialistDebateSummary?: string;
  regionalContext?: string;
};

/** To'liq klinik kontekst — shikoyat/anamnezdan tashqari barcha ma'lumotlar */
export function buildClinicalContextText(
  data: PatientData,
  language: Language,
  extra?: ClinicalContextExtra,
): string {
  const parts: string[] = [];
  const name = `${s(data.firstName)} ${s(data.lastName)}`.trim();
  const father = s(data.fatherName);
  parts.push(
    `BEMOR: ${name || "Noma'lum"}${father ? ` (${father})` : ''}, ${s(data.age) || '-'} yosh, jins: ${s(data.gender) || '-'}.`,
  );

  const fields: [keyof PatientData | string, string][] = [
    ['complaints', 'SHIKOYATLAR'],
    ['history', 'ANAMNEZ'],
    ['objectiveData', "OB'EKTIV / VITAL"],
    ['labResults', 'LABORATORIYA'],
    ['allergies', 'ALLERGIYA'],
    ['currentMedications', 'JORIY DORILAR'],
    ['familyHistory', 'OILAVIY ANAMNEZ'],
    ['additionalInfo', "QO'SHIMCHA"],
    ['pharmacogenomicsReport', 'FARMAKOGENOMIKA'],
  ];
  for (const [key, label] of fields) {
    const val = s((data as Record<string, unknown>)[key as string]);
    if (val) parts.push(`${label}: ${val}`);
  }

  const struct = formatStructuredLabs(data);
  if (struct) parts.push(`STRUKTUR LAB:\n${struct}`);

  if (data.symptomTimeline?.length) {
    const tl = data.symptomTimeline
      .slice(0, 20)
      .map((e) => `  - ${e.date}: ${e.symptom} (${e.severity}/10)${e.notes ? ` — ${e.notes}` : ''}`)
      .join('\n');
    parts.push(`SIMPTOM DINAMIKASI:\n${tl}`);
  }

  const mh = data.mentalHealthScores;
  if (mh && (mh.phq9 != null || mh.gad7 != null)) {
    parts.push(`RUHIY SKORLAR: ${mh.phq9 != null ? `PHQ-9=${mh.phq9}` : ''}${mh.gad7 != null ? ` GAD-7=${mh.gad7}` : ''}`);
  }

  const longNotes = s(data.longitudinalClinicalNotes);
  if (longNotes) parts.push(`OLDINGI TAHLILLAR:\n${longNotes.slice(0, 5000)}`);

  const attMeta = formatAttachmentsMeta(data);
  if (attMeta) {
    parts.push(
      `YUKLANGAN HUJJATLAR (EKG, UZI, rengen — TO'LIQ tahlil qiling):\n${attMeta}`,
    );
  }

  const fb = data.userDiagnosisFeedback;
  if (fb && Object.keys(fb).length) {
    parts.push(
      `SHIFOKOR FIKRI:\n${Object.entries(fb)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join('\n')}`,
    );
  }

  const ddx = extra?.differentialDiagnoses;
  if (ddx?.length) {
    parts.push(`DIFFERENSIAL TASHXISLAR: ${ddx.map((d) => d.name).filter(Boolean).join(', ')}`);
  }

  const debate = s(extra?.specialistDebateSummary);
  if (debate) parts.push(`MUTAXASSISLAR MUNOZARASI:\n${debate.slice(0, 6000)}`);

  const region = s(extra?.regionalContext);
  if (region) parts.push(`LOKAL HOLAT: ${region}`);

  parts.push(getUzbekistanContextForAI(language));
  parts.push(
    "MUHIM: Xulosa faqat shikoyat/anamnez emas — ob'ektiv, lab, tasvirlar (EKG/UZI/rengen), mutaxassis fikri va DDX ni birgalikda sintez qiling.",
  );
  return parts.join('\n\n');
}

export function buildPatientSummaryForDebate(
  patientData: PatientData,
  diagnoses: Diagnosis[],
  language: Language,
): string {
  return buildClinicalContextText(patientData, language, {
    differentialDiagnoses: diagnoses,
  });
}

export function debateHistoryToSummary(debateHistory: ChatMessage[]): string {
  return formatDebateForPrompt(debateHistory).slice(0, 6000);
}

export function extractRegionalContext(patientData: PatientData): string | undefined {
  const add = s(patientData.additionalInfo);
  if (/farg'ona|andijon|namangan|samarqand|toshkent|qashqadaryo|surxondaryo|xorazm|navoiy|jizzax|sirdaryo|buxoro/i.test(add)) {
    return add.slice(0, 500);
  }
  return undefined;
}
