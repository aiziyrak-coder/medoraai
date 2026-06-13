import type { FinalReport, PatientData, Diagnosis } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import { prepareExportReport, type ExportTr } from './exportReportSections';
import { pdfText } from './exportI18n';

/** Bemor uchun qisqa xulosa — faqat foydali, tushunarli ma'lumotlar */
const MAX_TREATMENT = 3;
const MAX_MEDICATIONS = 4;
const MAX_PREVENTION = 4;
const MAX_LINE_CHARS = 72;
const MAX_ALERT_CHARS = 90;

function truncate(text: string, max = MAX_LINE_CHARS): string {
    const t = (text || '').trim().replace(/\s+/g, ' ');
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1).trim()}…`;
}

function treatmentToLine(step: unknown): string {
    if (typeof step === 'string') return truncate(step);
    if (step && typeof step === 'object') {
        const o = step as Record<string, unknown>;
        const main = String(o.step || o.text || o.details || '').trim();
        return truncate(main || Object.values(o).filter(Boolean).map(String).join(' '));
    }
    return truncate(String(step ?? ''));
}

export interface CompactMedication {
    line: string;
}

function medicationToLine(
    med: FinalReport['medicationRecommendations'][number],
): string {
    const how = [med.frequency, med.timing].filter(Boolean).map(String).join(', ');
    const parts = [med.name, med.dosage, how].filter(Boolean);
    return truncate(parts.join(' — '));
}

export function getTopDiagnosis(diagnoses: Diagnosis[]): Diagnosis | undefined {
    const sorted = normalizeConsensusDiagnosis(diagnoses).sort(
        (a, b) =>
            (a.diagnosisRank ?? 99) - (b.diagnosisRank ?? 99) ||
            (b.probability ?? 0) - (a.probability ?? 0),
    );
    return sorted[0];
}

/** Bemorga beriladigan qisqa xulosa */
export interface CompactExportData {
    patientLine: string;
    diagnosisName?: string;
    diagnosisPercent?: number;
    urgentNote?: string;
    treatmentLines: string[];
    medicationLines: string[];
    preventionLines: string[];
}

export function buildCompactExportData(
    report: FinalReport,
    patientData: PatientData,
    tr: ExportTr,
): CompactExportData {
    report = prepareExportReport(report);

    const shortName = `${patientData.lastName} ${patientData.firstName}`.trim();
    const patientLine = truncate(
        `${pdfText(shortName)}, ${pdfText(patientData.age)} ${tr('pdf_age', 'yosh')}`,
        55,
    );

    const top = getTopDiagnosis(report.consensusDiagnosis);

    let urgentNote: string | undefined;
    if (report.criticalFinding?.finding) {
        const urg = report.criticalFinding.urgency?.toLowerCase() ?? '';
        if (urg === 'urgent' || urg === 'high' || urg === 'shoshilinch') {
            urgentNote = truncate(report.criticalFinding.finding, MAX_ALERT_CHARS);
        }
    }

    const treatmentLines = (Array.isArray(report.treatmentPlan) ? report.treatmentPlan : [])
        .map(treatmentToLine)
        .filter(Boolean)
        .slice(0, MAX_TREATMENT);

    const medicationLines = (report.medicationRecommendations || [])
        .map(medicationToLine)
        .filter(Boolean)
        .slice(0, MAX_MEDICATIONS);

    const preventionLines = (report.nutritionPrevention?.preventionMeasures || [])
        .map((l) => truncate(l))
        .filter(Boolean)
        .slice(0, MAX_PREVENTION);

    return {
        patientLine,
        diagnosisName: top?.name ? truncate(top.name, 80) : undefined,
        diagnosisPercent: top && Number.isFinite(top.probability) ? top.probability : undefined,
        urgentNote,
        treatmentLines,
        medicationLines,
        preventionLines,
    };
}
