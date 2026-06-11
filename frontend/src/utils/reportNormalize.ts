import type {
  FinalReport,
  Diagnosis,
  PatientData,
  PrognosisReport,
  ProtocolComplianceGap,
  CareQualityAudit,
  ImagingInterpretation,
  AdverseEventRisk,
  NutritionPreventionSection,
  IndividualDietPlan,
  PatientRouting,
  RiskFactor,
  SeverityAssessment,
} from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import type { Language } from '../i18n/LanguageContext';
import { sanitizeClinicalContent } from './sanitizeClinicalContent';

const BAD_TREATMENT_RE = /shifokor tasdiqlashi|konsensus davolash rejasi|kiritilmagan|ma'lumot yo'q/i;

function planItemToString(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    return [o.step, o.details, o.urgency, o.action, o.description, o.text]
      .filter((v) => v != null && String(v).trim())
      .map(String)
      .join(' - ')
      .trim();
  }
  return String(item ?? '').trim();
}

function isUsableTreatmentStep(step: string): boolean {
  const s = step.trim();
  return s.length >= 10 && !BAD_TREATMENT_RE.test(s);
}

/** Davolash rejasini normalizatsiya; placeholder bo'lsa dorilar va tekshiruvlardan to'ldiradi */
export function normalizeTreatmentPlan(
  raw: Record<string, unknown>,
  report: FinalReport,
): string[] {
  const src = raw.treatmentPlan ?? raw.treatment_plan;
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (step: string) => {
    const s = step.trim();
    if (!isUsableTreatmentStep(s)) return;
    const key = s.toLowerCase().slice(0, 100);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  if (Array.isArray(src)) {
    for (const item of src) {
      const text = planItemToString(item);
      for (const part of text.split(/\n|;/).map((x) => x.trim()).filter(Boolean)) {
        push(part.replace(/^\d+[\).\-\s]+/, '').trim());
      }
    }
  }

  if (out.length >= 2) return out.slice(0, 8);

  const dx = normalizeConsensusDiagnosis(report.consensusDiagnosis)[0]?.name?.trim();
  const tests = (report.recommendedTests || []).map(String).filter((t) => t.trim()).slice(0, 4);
  const meds = report.medicationRecommendations || [];

  if (dx) {
    push(
      tests.length
        ? `1-qadam: ${dx} bo'yicha tashxisni tasdiqlash — ${tests.join(', ')}.`
        : `1-qadam: ${dx} bo'yicha klinik holatni baholash va zarur tekshiruvlarni belgilash.`,
    );
  }

  if (meds.length) {
    meds.slice(0, 3).forEach((m, i) => {
      const line = [m.name, m.dosage, m.notes].filter((x) => String(x ?? '').trim()).join(' — ');
      if (line) push(`${i + 2}-qadam: Farmakoterapiya — ${line}.`);
    });
  } else if (dx) {
    push(`2-qadam: ${dx} uchun SSV protokoliga muvofiq davolashni boshlash.`);
  }

  push(`${out.length + 1}-qadam: Davolash samaradorligi va xavfsizlik bo'yicha rejalashtirilgan kuzatuv.`);

  return out.slice(0, 8);
}

const BAD_MED_NAMES = new Set(['', 'dori', 'doza', 'tabletka', 'tavsiya', 'dori-darmon', 'farmakoterapiya']);

function isUsableMedName(name: string): boolean {
  const n = name.trim();
  return n.length >= 2 && !BAD_MED_NAMES.has(n.toLowerCase());
}

function medFromRecord(m: Record<string, unknown>): FinalReport['medicationRecommendations'][number] | null {
  const name = String(m.name ?? m.generic ?? '').trim();
  if (!isUsableMedName(name)) return null;
  const notes = String(m.notes ?? m.instructions ?? '').trim();
  return {
    name,
    dosage: String(m.dosage ?? '').trim(),
    frequency: String(m.frequency ?? '').trim() || undefined,
    duration: String(m.duration ?? '').trim() || undefined,
    timing: String(m.timing ?? '').trim() || undefined,
    instructions: String(m.instructions ?? m.notes ?? '').trim() || undefined,
    notes: notes || String(m.instructions ?? '').trim(),
    localAvailability: String(m.localAvailability ?? m.local_availability ?? "O'zbekistonda mavjud").trim() || undefined,
    priceEstimate: String(m.priceEstimate ?? m.price_estimate ?? '').trim() || undefined,
    adverseEffects: Array.isArray(m.adverseEffects)
      ? m.adverseEffects.map(String).filter(Boolean)
      : Array.isArray(m.adverse_effects)
        ? m.adverse_effects.map(String).filter(Boolean)
        : undefined,
    contraindications: String(m.contraindications ?? '').trim() || undefined,
    monitoring: String(m.monitoring ?? '').trim() || undefined,
  };
}

function parseMedFromTreatmentLine(text: string): FinalReport['medicationRecommendations'][number] | null {
  const raw = text.trim();
  if (!raw) return null;
  const low = raw.toLowerCase();
  if (!/(farmakoterapiya|dori|mg|mcg|iu|tablet|kapsul|ml)/i.test(low)) return null;

  let t = raw.replace(/^\d+-qadam:\s*/i, '').trim();
  t = t.replace(/^(?:farmakoterapiya|dori[- ]?darmon)\s*[—\-:]\s*/i, '').trim();

  let name = '';
  let dosage = '';
  const dash = t.match(/^(.+?)\s*[—\-]\s*(.+)$/);
  if (dash) {
    name = dash[1].trim();
    dosage = dash[2].trim();
  } else {
    const dose = t.match(/^([A-Za-zА-Яа-яЁёO'ʻG'g'\-\s]{2,40}?)\s+(\d[\d\s./\-–]*(mg|mcg|g|ml|IU|ME|tab).*)$/i);
    if (dose) {
      name = dose[1].trim().replace(/,$/, '');
      dosage = dose[2].trim();
    } else {
      const parts = t.split(/[.;]/, 2);
      name = parts[0]?.trim() ?? '';
      dosage = parts[1]?.trim() ?? '';
    }
  }
  if (!isUsableMedName(name) || (!dosage && name.length > 60)) return null;
  return {
    name,
    dosage,
    notes: dosage || '',
    localAvailability: "O'zbekistonda mavjud",
  };
}

/** Dori tavsiyalarini normalizatsiya; bo'sh bo'lsa rejadan va snake_case maydonlardan to'ldiradi */
export function normalizeMedicationRecommendations(
  raw: Record<string, unknown>,
  report: FinalReport,
): FinalReport['medicationRecommendations'] {
  const src =
    raw.medicationRecommendations
    ?? raw.medication_recommendations
    ?? raw.medications;
  const out: FinalReport['medicationRecommendations'] = [];
  const seen = new Set<string>();

  const push = (med: FinalReport['medicationRecommendations'][number] | null) => {
    if (!med || !isUsableMedName(med.name)) return;
    const key = med.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(med);
  };

  if (Array.isArray(src)) {
    for (const item of src) {
      if (item && typeof item === 'object') {
        push(medFromRecord(item as Record<string, unknown>));
      }
    }
  }

  if (out.length >= 1) return out.slice(0, 8);

  const planSrc = raw.treatmentPlan ?? raw.treatment_plan;
  const planSteps = Array.isArray(planSrc)
    ? planSrc.map((item) => planItemToString(item)).filter(Boolean)
    : (report.treatmentPlan || []);
  for (const step of planSteps) {
    push(parseMedFromTreatmentLine(step));
  }

  const dx = normalizeConsensusDiagnosis(report.consensusDiagnosis)[0]?.name?.trim();
  if (!out.length && dx) {
    push({
      name: dx,
      dosage: 'SSV protokoliga muvofiq individual',
      notes: `${dx} uchun O'zbekiston SSV klinik protokoliga muvofiq farmakoterapiya belgilanadi.`,
      localAvailability: "O'zbekistonda mavjud",
    });
  }

  return out.slice(0, 8);
}

const BAD_REJECTED_NAMES = new Set([
  '',
  'aniqlanmadi',
  'tashxis aniqlanmadi',
  'noma\'lum',
  'nomalum',
  'unknown',
  'ma\'lumot kiritilmagan',
]);

function isUsableRejectedName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n.length >= 3 && !BAD_REJECTED_NAMES.has(n);
}

/** Rad etilgan gipotezalarni normalizatsiya; bo'sh bo'lsa konsensus differensiallaridan to'ldiradi */
export function normalizeRejectedHypotheses(
  raw: Record<string, unknown>,
  consensusDiagnosis?: Diagnosis[],
): FinalReport['rejectedHypotheses'] {
  const src = raw.rejectedHypotheses ?? raw.rejected_hypotheses;
  const out: FinalReport['rejectedHypotheses'] = [];
  const seen = new Set<string>();

  const push = (name: string, reason: string) => {
    const nm = name.trim();
    if (!isUsableRejectedName(nm)) return;
    const key = nm.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const rs = reason.trim();
    out.push({
      name: nm,
      reason: rs || 'Konsilium munozarasi natijasida rad etilgan differensial gipoteza.',
    });
  };

  if (Array.isArray(src)) {
    for (const item of src) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      push(String(o.name ?? ''), String(o.reason ?? ''));
    }
  }

  const primary = consensusDiagnosis?.[0]?.name?.trim().toLowerCase() ?? '';
  if (out.length < 2 && consensusDiagnosis && consensusDiagnosis.length > 1) {
    for (const d of consensusDiagnosis.slice(1)) {
      const name = String(d.name ?? '').trim();
      if (!name || name.toLowerCase() === primary) continue;
      push(
        name,
        String(d.justification ?? '').trim()
          || 'Asosiy konsensus tashxisi ustun — differensial variant rad etildi.',
      );
      if (out.length >= 4) break;
    }
  }

  return out.slice(0, 6);
}

export function normalizePrognosisReport(raw: unknown): PrognosisReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = (raw as { prognosis?: unknown }).prognosis
    ? (raw as { prognosis: Record<string, unknown> }).prognosis
    : (raw as Record<string, unknown>);
  if (!obj || typeof obj !== 'object') return null;
  const shortTerm = typeof obj.shortTermPrognosis === 'string'
    ? obj.shortTermPrognosis
    : (typeof (obj as { short_term_prognosis?: string }).short_term_prognosis === 'string'
      ? (obj as { short_term_prognosis: string }).short_term_prognosis
      : (typeof (obj as { summary?: string }).summary === 'string' ? (obj as { summary: string }).summary : ''));
  const longTerm = typeof obj.longTermPrognosis === 'string'
    ? obj.longTermPrognosis
    : (typeof (obj as { long_term_prognosis?: string }).long_term_prognosis === 'string'
      ? (obj as { long_term_prognosis: string }).long_term_prognosis
      : '');
  const kfRaw = obj.keyFactors ?? (obj as { key_factors?: unknown }).key_factors;
  const keyFactors = Array.isArray(kfRaw)
    ? kfRaw.filter((f: unknown) => typeof f === 'string') as string[]
    : [];
  const cs = obj.confidenceScore ?? (obj as { confidence_score?: unknown }).confidence_score;
  const confidenceScore = typeof cs === 'number' && cs >= 0 && cs <= 1 ? cs : 0.5;
  if (!shortTerm.trim() && !longTerm.trim() && keyFactors.length === 0) return null;
  return {
    shortTermPrognosis: shortTerm || '-',
    longTermPrognosis: longTerm || '-',
    keyFactors,
    confidenceScore,
  };
}

/** AI yoki tarmoq xatosi bo'lsa ham konsensus va bemor ma'lumotlaridan to'liq prognoz blokini beradi */
export function ensurePrognosisReport(
  pr: PrognosisReport | null | undefined,
  fr: FinalReport,
  patientData: PatientData = {} as PatientData,
  language: Language = 'uz-L',
): PrognosisReport {
  const dx = normalizeConsensusDiagnosis(fr.consensusDiagnosis);
  const dxNames = dx.map((d) => d.name).filter(Boolean).join('; ') || 'klinik holat';
  const shortRaw = (pr?.shortTermPrognosis || '').trim();
  const longRaw = (pr?.longTermPrognosis || '').trim();
  const shortOk = shortRaw.length > 2 && shortRaw !== '-';
  const longOk = longRaw.length > 2 && longRaw !== '-';
  const factorsOk = Array.isArray(pr?.keyFactors) && pr!.keyFactors!.some((f) => String(f).trim().length > 3);

  if (shortOk && longOk && factorsOk && pr) {
    return {
      ...pr,
      confidenceScore: typeof pr.confidenceScore === 'number' ? pr.confidenceScore : 0.65,
    };
  }

  const isRu = language === 'ru';
  const isEn = language === 'en';
  const medHints = (fr.medicationRecommendations || [])
    .map((m) => String(m.name ?? '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  const shortTerm = shortOk && pr
    ? pr.shortTermPrognosis
    : isEn
      ? `Short term (1–3 months): based on the consensus (${dxNames}), expected course depends on adherence to the proposed plan and follow-up. Symptoms may improve as treatment takes effect; monitor for warning signs and repeat tests as advised.${medHints ? ` Key medications: ${medHints}.` : ''}`
      : isRu
        ? `Краткосрочно (1–3 мес.): по консенсусу (${dxNames}) ожидается ответ на терапию при соблюдении плана; контроль симптомов и анализов по назначению.${medHints ? ` Препараты: ${medHints}.` : ''}`
        : `Qisqa muddat (1–3 oy): konsensus bo'yicha asosiy yo'nalish — ${dxNames}. Taklif qilingan davolash va kuzatuvga rioya qilinsa, simptomlar vaqt o'tishi bilan yaxshilanishi yoki barqarorlashishi mumkin; ogohlantiruvchi belgilar va qayta tekshiruvlar bo'yicha shifokor ko'rsatmalariga amal qiling.${medHints ? ` Asosiy dorilar: ${medHints}.` : ''}`;

  const longTerm = longOk && pr
    ? pr.longTermPrognosis
    : isEn
      ? `Long term (1–5 years): prognosis depends on chronicity, comorbidities, lifestyle, and adherence. Regular follow-up and prevention reduce recurrence and complications.`
      : isRu
        ? `Долгосрочно (1–5 лет): прогноз зависит от хроничности, сопутствующих заболеваний и соблюдения терапии; профилактика и диспансеризация снижают риск обострений.`
        : `Uzoq muddat (1–5 yil): surunkali kasalliklar uchun prognoz yosh, qo'shimcha kasalliklar, hayot tarzi va davolashga rioya qilish bilan bog'liq. Muntazam kuzatuv va profilaktika qayta yuzaga kelish va asoratlarni kamaytiradi.`;

  const complaintsSnippet = (patientData.complaints || '').trim();
  const keyFactors: string[] = factorsOk && pr && pr.keyFactors
    ? pr.keyFactors.filter((f) => String(f).trim().length > 0)
    : [
        `${isEn ? 'Consensus diagnosis' : isRu ? 'Консенсус-диагноз' : 'Konsensus tashxis'}: ${dxNames}`,
        patientData.age
          ? (isEn ? `Age: ${patientData.age}` : isRu ? `Возраст: ${patientData.age}` : `Yosh: ${patientData.age}`)
          : (isEn ? 'Clinical context' : isRu ? 'Клинический контекст' : 'Klinik kontekst'),
        complaintsSnippet
          ? (isEn
            ? `Chief complaints: ${complaintsSnippet.slice(0, 200)}${complaintsSnippet.length > 200 ? '…' : ''}`
            : isRu
              ? `Жалобы: ${complaintsSnippet.slice(0, 200)}${complaintsSnippet.length > 200 ? '…' : ''}`
              : `Shikoyatlar: ${complaintsSnippet.slice(0, 200)}${complaintsSnippet.length > 200 ? '…' : ''}`)
          : (isEn ? 'Treatment adherence and follow-up visits' : isRu ? 'Соблюдение терапии и визиты' : 'Davolashga rioya qilish va qayta ko‘rish'),
        isEn ? 'Comorbidities and risk factors from the record' : isRu ? 'Сопутствующие заболевания и факторы риска' : 'Qo‘shimcha kasalliklar va xavf omillari (ma\'lumotlar bo\'yicha)',
      ];

  return {
    shortTermPrognosis: shortTerm,
    longTermPrognosis: longTerm,
    keyFactors,
    confidenceScore: typeof pr?.confidenceScore === 'number' ? pr.confidenceScore : 0.55,
  };
}

export type EnrichFinalReportOptions = {
  patientData?: PatientData;
  language?: Language;
};

function strList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

export function normalizeProtocolComplianceGaps(raw: unknown): ProtocolComplianceGap[] {
  if (!Array.isArray(raw)) return [];
  const out: ProtocolComplianceGap[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const gap = String(o.gap ?? o.deficiency ?? '').trim();
    if (!gap) continue;
    out.push({
      gap,
      protocolReference: String(o.protocolReference ?? o.protocol_reference ?? '').trim(),
      severity: (String(o.severity ?? 'medium').toLowerCase() as ProtocolComplianceGap['severity']) || 'medium',
      consequences: String(o.consequences ?? o.impact ?? '').trim(),
      recommendedCorrection: String(o.recommendedCorrection ?? o.recommended_correction ?? '').trim(),
    });
  }
  return out;
}

const GENERIC_QUALITY_STRENGTHS = new Set([
  'shikoyatlar aniq hujjatlashtirilgan',
  'anamnez mavjud',
  "ob'ektiv ko'rik/vital ko'rsatkichlar kiritilgan",
]);

const GENERIC_UNEXPECTED_MARKERS = [
  'dalillar phase 1',
  "refutation og'irligi asosida birlashtirildi",
  'konsilium munozarasi yakunida asosiy tashxis:',
];

function isGenericUnexpectedFindings(text: string): boolean {
  const low = text.trim().toLowerCase();
  if (!low) return true;
  const generic = GENERIC_UNEXPECTED_MARKERS.some((m) => low.includes(m));
  if (!generic) return false;
  return !low.includes('▸') && !low.includes('•') && !low.includes('rad etilgan');
}

/** Kutilmagan topilmalar — umumiy xulosa bo'lsa hisobot maydonlaridan boyitadi */
export function normalizeUnexpectedFindings(
  raw: Record<string, unknown>,
  report: FinalReport,
): string {
  const u = raw.unexpectedFindings ?? raw.unexpected_findings ?? raw.agreement_summary ?? raw.agreementSummary;
  let text = typeof u === 'string' ? sanitizeClinicalContent(u.trim()) : '';
  if (text && !isGenericUnexpectedFindings(text)) return text;

  const parts: string[] = [];
  const dx = normalizeConsensusDiagnosis(report.consensusDiagnosis);
  const primary = dx[0]?.name?.trim();
  if (primary) {
    parts.push(`▸ YAKUNIY XULOSA\nAsosiy tashxis: ${primary}.`);
    const just = dx[0]?.justification?.trim();
    if (just && just.length > 20) {
      parts.push(`▸ ASOSIY KONSENSUS DALILLARI\n${just}`);
    }
  }

  const rejected = report.rejectedHypotheses || [];
  if (rejected.length) {
    parts.push(
      `▸ RAD ETILGAN GIPOTEZALAR\n${rejected
        .map((h) => `• ${h.name}${h.reason ? ` — ${h.reason}` : ''}`)
        .join('\n')}`,
    );
  }

  const alts = dx.slice(1).filter((d) => d.name?.trim());
  if (alts.length) {
    parts.push(
      `▸ KO'RIB CHIQILGAN MUQOBIL TASHXISLAR\n${alts
        .map((d) => `• ${d.name}${d.probability ? ` (${d.probability}%)` : ''}${d.justification ? ` — ${d.justification}` : ''}`)
        .join('\n')}`,
    );
  }

  const tests = (report.recommendedTests || []).filter((t) => String(t).trim()).slice(0, 4);
  if (tests.length) {
    parts.push(`▸ QO'SHIMCHA TEKSHIRUV TAVSIYALARI\n${tests.map((t) => `• ${t}`).join('\n')}`);
  }

  if (report.unexpectedFindings && !isGenericUnexpectedFindings(String(report.unexpectedFindings))) {
    return String(report.unexpectedFindings);
  }

  return parts.join('\n\n').slice(0, 4500) || text;
}

const GENERIC_QUALITY_SUMMARIES = new Set([
  "ma'lumotlar yuqori darajada to'liq",
  "ma'lumotlar o'rtacha — qo'shimcha klinik ma'lumot tavsiya etiladi",
  'ma\'lumotlar cheklangan — konsilium natijasini ehtiyotkor baholang',
]);

export function normalizeCareQualityAudit(raw: unknown): CareQualityAudit | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const errorsRaw = o.errors;
  const errors: CareQualityAudit['errors'] = [];
  if (Array.isArray(errorsRaw)) {
    for (const e of errorsRaw) {
      if (!e || typeof e !== 'object') continue;
      const r = e as Record<string, unknown>;
      const desc = String(r.description ?? r.error ?? '').trim();
      if (!desc) continue;
      errors.push({
        category: String(r.category ?? 'general').trim(),
        description: desc,
        protocolReference: String(r.protocolReference ?? r.protocol_reference ?? '').trim(),
        impact: String(r.impact ?? '').trim(),
      });
    }
  }
  let overallScore: number | undefined;
  const sc = o.overallScore ?? o.overall_score;
  if (sc != null && !Number.isNaN(Number(sc))) overallScore = Math.max(0, Math.min(100, Number(sc)));
  let summary = String(o.summary ?? '').trim();
  if (summary && GENERIC_QUALITY_SUMMARIES.has(summary.toLowerCase())) {
    summary = '';
  }
  const strengths = strList(o.strengths).filter(
    (s) => !GENERIC_QUALITY_STRENGTHS.has(s.toLowerCase()),
  );
  if (overallScore == null && !summary && errors.length === 0 && strengths.length === 0) return undefined;
  return { overallScore, summary, errors, strengths };
}

function normModality(block: unknown): ImagingInterpretation['ecg'] {
  if (!block || typeof block !== 'object') return undefined;
  const o = block as Record<string, unknown>;
  const summary = String(o.summary ?? '').trim();
  const keyFindings = strList(o.keyFindings ?? o.key_findings ?? o.findings);
  const clinicalSignificance = String(o.clinicalSignificance ?? o.clinical_significance ?? '').trim();
  const limitations = String(o.limitations ?? '').trim();
  if (!summary && keyFindings.length === 0 && !clinicalSignificance) return undefined;
  return { summary, keyFindings, clinicalSignificance, limitations: limitations || undefined };
}

export function normalizeImagingInterpretation(raw: unknown): ImagingInterpretation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const ecg = normModality(o.ecg);
  const ultrasound = normModality(o.ultrasound ?? o.uzi);
  const xray = normModality(o.xray ?? o.x_ray);
  const ct = normModality(o.ct);
  const mri = normModality(o.mri);
  const generalCorrelation = String(o.generalCorrelation ?? o.general_correlation ?? '').trim();
  if (!ecg && !ultrasound && !xray && !ct && !mri && !generalCorrelation) return undefined;
  return { ecg, ultrasound, xray, ct, mri, generalCorrelation: generalCorrelation || undefined };
}

export function normalizePatientRouting(raw: unknown): PatientRouting | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const specialistsRaw = o.recommendedSpecialists ?? o.recommended_specialists ?? o.referrals;
  const recommendedSpecialists: PatientRouting['recommendedSpecialists'] = [];
  if (Array.isArray(specialistsRaw)) {
    for (const s of specialistsRaw) {
      if (!s || typeof s !== 'object') continue;
      const r = s as Record<string, unknown>;
      const specialty = String(r.specialty ?? '').trim();
      if (!specialty) continue;
      const urgency = String(r.urgency ?? '').toLowerCase();
      recommendedSpecialists.push({
        specialty,
        reason: String(r.reason ?? '').trim(),
        urgency: urgency === 'urgent' ? 'urgent' : 'routine',
      });
    }
  }
  const examPlan = strList(o.examPlan ?? o.exam_plan);
  const disposition = String(o.disposition ?? '').toLowerCase() as PatientRouting['disposition'];
  const validDisposition = ['outpatient', 'observation', 'inpatient', 'emergency'].includes(disposition || '')
    ? disposition
    : undefined;
  const routing: PatientRouting = {
    recommendedSpecialists: recommendedSpecialists.length ? recommendedSpecialists : undefined,
    examPlan: examPlan.length ? examPlan : undefined,
    disposition: validDisposition,
    dispositionReason: String(o.dispositionReason ?? o.disposition_reason ?? '').trim() || undefined,
    followUpTimeline: String(o.followUpTimeline ?? o.follow_up_timeline ?? '').trim() || undefined,
    hospitalizationIndicated: o.hospitalizationIndicated === true || o.hospitalization_indicated === true,
    hospitalizationReason: String(o.hospitalizationReason ?? o.hospitalization_reason ?? '').trim() || undefined,
  };
  const hasContent =
    (routing.recommendedSpecialists?.length ?? 0) > 0 ||
    (routing.examPlan?.length ?? 0) > 0 ||
    !!routing.disposition ||
    routing.hospitalizationIndicated ||
    !!routing.followUpTimeline;
  return hasContent ? routing : undefined;
}

export function normalizeRiskFactors(raw: unknown): RiskFactor[] {
  if (!Array.isArray(raw)) return [];
  const out: RiskFactor[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const factor = String(o.factor ?? '').trim();
    if (!factor) continue;
    const sev = String(o.severity ?? '').toLowerCase();
    out.push({
      factor,
      severity: (['high', 'medium', 'low'].includes(sev) ? sev : undefined) as RiskFactor['severity'],
      mitigation: String(o.mitigation ?? '').trim() || undefined,
    });
  }
  return out;
}

export function normalizeSeverityAssessment(raw: unknown): SeverityAssessment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const levelRaw = String(o.level ?? '').toLowerCase();
  const level = (['critical', 'urgent', 'moderate', 'low'].includes(levelRaw)
    ? levelRaw
    : undefined) as SeverityAssessment['level'];
  let score: number | undefined;
  if (o.score != null && !Number.isNaN(Number(o.score))) score = Math.max(1, Math.min(10, Number(o.score)));
  const rationale = String(o.rationale ?? '').trim();
  const redFlags = strList(o.redFlags ?? o.red_flags);
  if (!level && score == null && !rationale && redFlags.length === 0) return undefined;
  return { level: level || 'moderate', score, rationale: rationale || undefined, redFlags: redFlags.length ? redFlags : undefined };
}

export function normalizeAdverseEventRisks(raw: unknown): AdverseEventRisk[] {
  if (!Array.isArray(raw)) return [];
  const out: AdverseEventRisk[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const drug = String(o.drug ?? o.name ?? '').trim();
    const risk = String(o.risk ?? '').trim();
    if (!drug || !risk) continue;
    let probability = Number(o.probability ?? 0.3);
    if (Number.isNaN(probability)) probability = 0.3;
    probability = Math.max(0, Math.min(1, probability));
    out.push({
      drug,
      risk,
      probability,
      management: String(o.management ?? '').trim(),
    });
  }
  return out;
}

export function normalizeNutritionExtended(raw: unknown): NutritionPreventionSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const dietaryGuidelines = strList(o.dietaryGuidelines ?? o.dietary_guidelines);
  const preventionMeasures = strList(o.preventionMeasures ?? o.prevention_measures);
  const intro = String(o.intro ?? '').trim() || undefined;
  const disclaimer = String(o.disclaimer ?? '').trim() || undefined;
  const rowsRaw = o.individualDietByDiagnosis ?? o.individual_diet_by_diagnosis;
  const individualDietByDiagnosis: IndividualDietPlan[] = [];
  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const diagnosis = String(r.diagnosis ?? '').trim();
      if (!diagnosis) continue;
      individualDietByDiagnosis.push({
        diagnosis,
        allowedFoods: strList(r.allowedFoods ?? r.allowed_foods),
        restrictedFoods: strList(r.restrictedFoods ?? r.restricted_foods),
        mealPlanNotes: String(r.mealPlanNotes ?? r.meal_plan_notes ?? '').trim(),
      });
    }
  }
  if (
    dietaryGuidelines.length === 0 &&
    preventionMeasures.length === 0 &&
    !intro &&
    individualDietByDiagnosis.length === 0
  ) {
    return undefined;
  }
  return {
    intro,
    disclaimer,
    dietaryGuidelines,
    preventionMeasures,
    individualDietByDiagnosis: individualDietByDiagnosis.length ? individualDietByDiagnosis : undefined,
  };
}

/** Yakuniy hisobotni boyitilgan maydonlar bilan birlashtiradi */
export function enrichFinalReport(raw: FinalReport, opts?: EnrichFinalReportOptions): FinalReport {
  const r = raw as FinalReport & Record<string, unknown>;
  const out: FinalReport = { ...raw };

  const cdNorm = normalizeConsensusDiagnosis(
    r.consensusDiagnosis ?? r.consensus_diagnosis,
  );
  if (cdNorm.length) {
    out.consensusDiagnosis = cdNorm;
  }

  const unexpected = normalizeUnexpectedFindings(r, out);
  if (unexpected) out.unexpectedFindings = unexpected;
  if (!out.recommendedTests?.length) {
    const rt = r.recommendedTests ?? r.recommended_tests;
    if (Array.isArray(rt) && rt.length) out.recommendedTests = rt.map(String);
  }
  const sfe = r.simplifiedFamilyExplanation ?? r.simplified_family_explanation;
  if (typeof sfe === 'string' && sfe.trim()) {
    out.simplifiedFamilyExplanation = sanitizeClinicalContent(sfe.trim());
  }
  const rr = r.relatedResearch ?? r.related_research;
  if (Array.isArray(rr) && rr.length) out.relatedResearch = rr as FinalReport['relatedResearch'];

  const gaps = normalizeProtocolComplianceGaps(r.protocolComplianceGaps ?? r.protocol_compliance_gaps);
  if (gaps.length) out.protocolComplianceGaps = gaps;

  const audit = normalizeCareQualityAudit(r.careQualityAudit ?? r.care_quality_audit);
  if (audit) out.careQualityAudit = audit;

  const imaging = normalizeImagingInterpretation(r.imagingInterpretation ?? r.imaging_interpretation);
  if (imaging) {
    out.imagingInterpretation = imaging;
    const parts: string[] = [];
    if (imaging.ecg?.summary) parts.push(`ECG: ${imaging.ecg.summary}`);
    if (imaging.ultrasound?.summary) parts.push(`US: ${imaging.ultrasound.summary}`);
    if (imaging.xray?.summary) parts.push(`XR: ${imaging.xray.summary}`);
    if (imaging.ct?.summary) parts.push(`CT: ${imaging.ct.summary}`);
    if (imaging.mri?.summary) parts.push(`MRI: ${imaging.mri.summary}`);
    if (parts.length) {
      out.imageAnalysis = {
        findings: parts.join(' | '),
        correlation: imaging.generalCorrelation || out.imageAnalysis?.correlation || '',
      };
    }
  }

  const aer = normalizeAdverseEventRisks(r.adverseEventRisks ?? r.adverse_event_risks);
  if (aer.length) out.adverseEventRisks = aer;

  const np = normalizeNutritionExtended(r.nutritionPrevention ?? r.nutrition_prevention);
  if (np) out.nutritionPrevention = np;

  const routing = normalizePatientRouting(r.patientRouting ?? r.patient_routing);
  if (routing) out.patientRouting = routing;

  const risks = normalizeRiskFactors(r.riskFactors ?? r.risk_factors);
  if (risks.length) out.riskFactors = risks;

  const severity = normalizeSeverityAssessment(r.severityAssessment ?? r.severity_assessment);
  if (severity) out.severityAssessment = severity;

  const rejected = normalizeRejectedHypotheses(r, out.consensusDiagnosis);
  if (rejected.length) out.rejectedHypotheses = rejected;

  const treatmentPlan = normalizeTreatmentPlan(r, out);
  if (treatmentPlan.length) out.treatmentPlan = treatmentPlan;

  const meds = normalizeMedicationRecommendations(r, out);
  if (meds.length) out.medicationRecommendations = meds;

  const existingPrognosis = normalizePrognosisReport(
    out.prognosisReport ?? r.prognosis_report,
  );
  out.prognosisReport = ensurePrognosisReport(
    existingPrognosis,
    out,
    opts?.patientData,
    opts?.language ?? 'uz-L',
  );

  const lang = opts?.language ?? 'uz-L';
  if (!out.nutritionPrevention) {
    const diag = out.consensusDiagnosis?.[0]?.name?.trim() || '';
    const fallback = buildNutritionPreventionFallback(diag, lang);
    if (fallback) out.nutritionPrevention = fallback;
  }
  if (!out.relatedResearch?.length) {
    const diag = out.consensusDiagnosis?.[0]?.name?.trim() || 'clinical diagnosis';
    out.relatedResearch = buildFastResearchSources(diag, lang);
  }

  return out;
}

function buildFastResearchSources(diagnosis: string, language: string): FinalReport['relatedResearch'] {
  const term = diagnosis || 'clinical diagnosis';
  const enc = encodeURIComponent;
  return [
    { title: 'PubMed — tizimli sharhlar', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${enc(`${term} systematic review`)}`, summary: `«${term}» bo'yicha xalqaro maqolalar` },
    { title: 'Cochrane Library', url: `https://www.cochranelibrary.com/search?q=${enc(`${term} Cochrane`)}`, summary: 'Meta-tahlil va RCT dalillari' },
    { title: 'The Lancet', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${enc(`${term} Lancet`)}`, summary: 'Yuqori impakt faktorli tadqiqotlar' },
    { title: 'NEJM / JAMA', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${enc(`${term} NEJM JAMA`)}`, summary: 'Dalillarga asoslangan terapiya' },
    { title: 'ESC / WHO / NICE guideline', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${enc(`${term} ESC WHO NICE guideline`)}`, summary: 'Xalqaro klinik qo\'llanmalar' },
    { title: 'O\'zbekiston SSV protokollari', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${enc(`${term} Uzbekistan clinical protocol`)}`, summary: 'Milliy protokol mosligi' },
  ];
}

function buildNutritionPreventionFallback(
  diagnosis: string,
  language: string,
): NutritionPreventionSection | undefined {
  const diag = diagnosis.trim() || 'asosiy tashxis';
  const isRu = language.startsWith('ru');
  const isEn = language.startsWith('en');
  const isKaa = language === 'kaa';
  const intro = isRu
    ? `Рекомендации по питанию и профилактике для «${diag}».`
    : isEn
      ? `Diet and prevention guidance for «${diag}».`
      : isKaa
        ? `«${diag}» ushın durıs awqatlanıw hám profilaktika usınısları.`
        : `«${diag}» uchun to'g'ri ovqatlanish va profilaktika tavsiyalari (WHO va xalqaro qo'llanmalar asosida).`;
  const disclaimer = isRu
    ? 'Индивидуальная диета — после консультации врача.'
    : isEn
      ? 'Individual diet requires physician consultation.'
      : isKaa
        ? 'Jeke parhez ushın shifokor maslahati shárt.'
        : 'Individual parhez uchun shifokor/dietolog maslahati shart.';
  const dietaryGuidelines = isRu
    ? ['Сбалансированное питание', 'Ограничение соли и сахара', 'Достаточная вода', 'Регулярный режим питания']
    : isEn
      ? ['Balanced nutrition', 'Limit salt and sugar', 'Adequate hydration', 'Regular meal timing']
      : ['Muvozanatli ovqatlanish', 'Tuz va shakarni cheklash', 'Yetarli suv', 'Muntazam ovqatlanish vaqti'];
  const preventionMeasures = isRu
    ? ['Физическая активность 150 мин/нед', 'Контроль веса и АД', 'Скрининги', 'Отказ от курения']
    : isEn
      ? ['150 min/week activity', 'Weight and BP control', 'Scheduled screenings', 'No smoking']
      : ['Haftasiga 150 daqiqa faollik', 'Vazn va qon bosimi nazorati', 'Skrininglar', 'Chekishni tashlash'];
  return {
    intro,
    disclaimer,
    dietaryGuidelines,
    preventionMeasures,
    individualDietByDiagnosis: [{
      diagnosis: diag,
      allowedFoods: dietaryGuidelines.slice(0, 2),
      restrictedFoods: isRu ? ['Избыток соли', 'Жареное'] : isEn ? ['Excess salt', 'Fried foods'] : ['Ortiqcha tuz', 'Qovurilgan taomlar'],
    }],
  };
}
