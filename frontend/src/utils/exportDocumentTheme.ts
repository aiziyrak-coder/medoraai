/** Konsilium PDF/DOCX eksporti uchun umumiy ranglar va yordamchilar */

export const EXPORT_THEME = {
    primary: [30, 58, 95] as [number, number, number],
    primaryDark: [20, 42, 72] as [number, number, number],
    accent: [14, 116, 144] as [number, number, number],
    accentLight: [224, 242, 254] as [number, number, number],
    diagnosis: [3, 105, 161] as [number, number, number],
    diagnosisBg: [239, 246, 255] as [number, number, number],
    treatment: [79, 70, 229] as [number, number, number],
    treatmentBg: [245, 243, 255] as [number, number, number],
    medication: [13, 148, 136] as [number, number, number],
    medicationBg: [240, 253, 250] as [number, number, number],
    prevention: [5, 150, 105] as [number, number, number],
    preventionBg: [236, 253, 245] as [number, number, number],
    alert: [220, 38, 38] as [number, number, number],
    alertBg: [254, 242, 242] as [number, number, number],
    text: [30, 41, 59] as [number, number, number],
    textMuted: [100, 116, 139] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    cardBg: [248, 250, 252] as [number, number, number],
} as const;

export const EXPORT_THEME_HEX = {
    primary: '1E3A5F',
    accent: '0E7490',
    diagnosis: '0369A1',
    diagnosisBg: 'EFF6FF',
    treatment: '4F46E5',
    treatmentBg: 'F5F3FF',
    medication: '0D9488',
    medicationBg: 'F0FDFA',
    prevention: '059669',
    preventionBg: 'ECFDF5',
    alert: 'DC2626',
    alertBg: 'FEF2F2',
    text: '1E293B',
    textMuted: '64748B',
    border: 'E2E8F0',
    cardBg: 'F8FAFC',
    white: 'FFFFFF',
} as const;

export type ExportSectionKind = 'patient' | 'diagnosis' | 'treatment' | 'medication' | 'prevention' | 'alert';

export const SECTION_HEX: Record<ExportSectionKind, { bar: string; bg: string }> = {
    patient: { bar: EXPORT_THEME_HEX.primary, bg: EXPORT_THEME_HEX.cardBg },
    diagnosis: { bar: EXPORT_THEME_HEX.diagnosis, bg: EXPORT_THEME_HEX.diagnosisBg },
    treatment: { bar: EXPORT_THEME_HEX.treatment, bg: EXPORT_THEME_HEX.treatmentBg },
    medication: { bar: EXPORT_THEME_HEX.medication, bg: EXPORT_THEME_HEX.medicationBg },
    prevention: { bar: EXPORT_THEME_HEX.prevention, bg: EXPORT_THEME_HEX.preventionBg },
    alert: { bar: EXPORT_THEME_HEX.alert, bg: EXPORT_THEME_HEX.alertBg },
};
