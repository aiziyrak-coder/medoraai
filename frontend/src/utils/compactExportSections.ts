import type { FinalReport, PatientData, Diagnosis } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import { prepareExportReport, type ExportTr } from './exportReportSections';
import { pdfText } from './exportI18n';

const MAX_TREATMENT = 5;
const MAX_MEDICATIONS = 6;
const MAX_PREVENTION = 6;
const MAX_LINE_CHARS = 140;
const MAX_COMPLAINTS_CHARS = 120;

function truncate(text: string, max = MAX_LINE_CHARS): string {
    const t = (text || '').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1).trim()}…`;
}

function treatmentToLine(step: unknown): string {
    if (typeof step === 'string') return truncate(step);
    if (step && typeof step === 'object') {
        const o = step as Record<string, unknown>;
        const parts = [o.step, o.details, o.text].filter(Boolean).map(String);
        return truncate(parts.join(' — ') || JSON.stringify(step));
    }
    return truncate(String(step ?? ''));
}

export interface CompactMedication {
    name: string;
    dosage: string;
    schedule: string;
    line: string;
}

function medicationToStructured(
    med: FinalReport['medicationRecommendations'][number],
): CompactMedication {
    const schedule = [med.frequency, med.duration, med.timing, med.instructions || med.notes]
        .filter(Boolean)
        .map(String)
        .join(' · ');
    const line = truncate([med.name, med.dosage, schedule].filter(Boolean).join(' — '));
    return {
        name: truncate(med.name, 60),
        dosage: truncate(med.dosage, 40),
        schedule: truncate(schedule, 80),
        line,
    };
}

export function getTopDiagnosis(diagnoses: Diagnosis[]): Diagnosis | undefined {
    const sorted = normalizeConsensusDiagnosis(diagnoses).sort(
        (a, b) =>
            (a.diagnosisRank ?? 99) - (b.diagnosisRank ?? 99) ||
            (b.probability ?? 0) - (a.probability ?? 0),
    );
    return sorted[0];
}

export interface CompactExportData {
    patientName: string;
    age: string;
    gender: string;
    complaints?: string;
    topDiagnosis?: Diagnosis;
    criticalAlert?: string;
    treatmentLines: string[];
    medications: CompactMedication[];
    medicationLines: string[];
    preventionLines: string[];
}

export function buildCompactExportData(
    report: FinalReport,
    patientData: PatientData,
    tr: ExportTr,
): CompactExportData {
    report = prepareExportReport(report);

    const fullName =
        `${patientData.lastName} ${patientData.firstName}`.trim() +
        (patientData.fatherName ? ` ${patientData.fatherName}` : '');

    const gender =
        patientData.gender === 'male'
            ? tr('pdf_gender_male', 'Erkak')
            : patientData.gender === 'female'
                ? tr('pdf_gender_female', 'Ayol')
                : tr('pdf_gender_other', 'Boshqa');

    const topDiagnosis = getTopDiagnosis(report.consensusDiagnosis);

    let criticalAlert: string | undefined;
    if (report.criticalFinding?.finding) {
        const urg = report.criticalFinding.urgency?.toLowerCase();
        if (urg === 'urgent' || urg === 'high' || urg === 'shoshilinch') {
            criticalAlert = truncate(
                `${report.criticalFinding.finding} — ${report.criticalFinding.implication || ''}`,
                180,
            );
        }
    }

    const treatmentLines = (Array.isArray(report.treatmentPlan) ? report.treatmentPlan : [])
        .map(treatmentToLine)
        .filter(Boolean)
        .slice(0, MAX_TREATMENT);

    const medications = (report.medicationRecommendations || [])
        .map(medicationToStructured)
        .filter((m) => m.name)
        .slice(0, MAX_MEDICATIONS);
    const medicationLines = medications.map((m) => m.line);

    const np = report.nutritionPrevention;
    const preventionLines = [
        ...(np?.preventionMeasures || []).map((l) => truncate(l)),
        ...(np?.dietaryGuidelines || []).map((l) => truncate(l)),
    ]
        .filter(Boolean)
        .slice(0, MAX_PREVENTION);

    return {
        patientName: pdfText(fullName),
        age: pdfText(patientData.age),
        gender,
        complaints: patientData.complaints
            ? truncate(patientData.complaints, MAX_COMPLAINTS_CHARS)
            : undefined,
        topDiagnosis,
        criticalAlert,
        treatmentLines,
        medications,
        medicationLines,
        preventionLines,
    };
}
