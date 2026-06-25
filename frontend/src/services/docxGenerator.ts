import {
    Document,
    DocumentDefaults,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    ShadingType,
    VerticalAlign,
} from 'docx';
import type { FinalReport, PatientData } from '../types';
import { logger } from '../utils/logger';
import type { InstituteBranding } from './pdfGenerator';
import type { Language } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translationKeys';
import { buildCompactExportData } from '../utils/compactExportSections';
import { EXPORT_THEME_HEX } from '../utils/exportDocumentTheme';
import { PDF_PRODUCT_NAME } from '../constants/brand';
import { createExportTr, formatExportDate, pdfText } from '../utils/exportI18n';
import {
    prepareExportReport,
    buildImagingExportLines,
    buildFollowUpExportLines,
    buildReferralExportLines,
    buildPrognosisExportLines,
    buildMedicationExportLine,
    buildRoutingExportLines,
    buildRiskExportLines,
} from '../utils/exportReportSections';
import { normalizeConsensusDiagnosis } from '../types';

const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: EXPORT_THEME_HEX.border },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: EXPORT_THEME_HEX.border },
    left: { style: BorderStyle.SINGLE, size: 1, color: EXPORT_THEME_HEX.border },
    right: { style: BorderStyle.SINGLE, size: 1, color: EXPORT_THEME_HEX.border },
};

function shadedCell(
    children: Paragraph[],
    fill: string,
    opts?: { columnSpan?: number; width?: number },
): TableCell {
    return new TableCell({
        shading: { fill, type: ShadingType.CLEAR, color: 'auto' },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        columnSpan: opts?.columnSpan,
        width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        borders: tableBorders,
        children,
    });
}

function labelPara(label: string, value: string, boldValue = true): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({ text: `${label}: `, bold: true, size: 18, color: EXPORT_THEME_HEX.textMuted }),
            new TextRun({ text: value, bold: boldValue, size: 20, color: EXPORT_THEME_HEX.text }),
        ],
        spacing: { after: 60 },
    });
}

function sectionHeader(title: string, barColor: string): Table {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 3, type: WidthType.PERCENTAGE },
                        shading: { fill: barColor, type: ShadingType.CLEAR },
                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                        children: [new Paragraph({ text: '' })],
                    }),
                    shadedCell(
                        [new Paragraph({
                            children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 20, color: EXPORT_THEME_HEX.text })],
                            spacing: { before: 80, after: 80 },
                        })],
                        EXPORT_THEME_HEX.cardBg,
                        { width: 97 },
                    ),
                ],
            }),
        ],
    });
}

function bulletPara(text: string, index?: number): Paragraph {
    const prefix = index != null ? `${index}. ` : '• ';
    return new Paragraph({
        children: [
            new TextRun({ text: prefix, bold: true, color: EXPORT_THEME_HEX.accent }),
            new TextRun({ text, size: 20, color: EXPORT_THEME_HEX.text }),
        ],
        spacing: { after: 80 },
        indent: { left: 200 },
    });
}

export const generateDocxReport = async (
    report: FinalReport,
    patientData: PatientData,
    _branding?: InstituteBranding,
    t?: (key: string) => string,
    language: Language = 'uz-L',
) => {
    const tr = createExportTr(language, t as ((key: TranslationKey) => string) | undefined);
    const reportNorm = prepareExportReport(report);
    const compact = buildCompactExportData(reportNorm, patientData, tr);
    const dateStr = formatExportDate(language);
    const children: (Paragraph | Table)[] = [];

    // Header banner
    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        shadedCell(
                            [
                                new Paragraph({
                                    children: [new TextRun({
                                        text: tr('pdf_title', 'KONSILIUM: Yakuniy Klinik Xulosa'),
                                        bold: true,
                                        size: 32,
                                        color: EXPORT_THEME_HEX.white,
                                    })],
                                    spacing: { after: 60 },
                                }),
                                new Paragraph({
                                    children: [new TextRun({
                                        text: tr('pdf_subtitle', "Rasmiy tibbiy maslahat hujjati — faqat ma'lumot uchun."),
                                        size: 16,
                                        color: 'C8DCF0',
                                        italics: true,
                                    })],
                                }),
                            ],
                            EXPORT_THEME_HEX.primary,
                            { width: 70 },
                        ),
                        shadedCell(
                            [
                                new Paragraph({
                                    children: [new TextRun({ text: tr('pdf_date', 'Sana'), bold: true, size: 16, color: EXPORT_THEME_HEX.white })],
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({
                                    children: [new TextRun({ text: dateStr, size: 20, color: EXPORT_THEME_HEX.white })],
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                            EXPORT_THEME_HEX.accent,
                            { width: 30 },
                        ),
                    ],
                }),
            ],
        }),
        new Paragraph({ text: '', spacing: { after: 120 } }),
    );

    // Patient table
    children.push(sectionHeader(tr('pdf_patient_info', "Bemor ma'lumotlari"), EXPORT_THEME_HEX.primary));
    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        shadedCell([labelPara(tr('pdf_patient', 'Bemor'), compact.patientName)], EXPORT_THEME_HEX.white, { width: 40 }),
                        shadedCell([labelPara(tr('pdf_age', 'Yoshi'), `${compact.age} ${tr('pdf_age_unit', 'yosh')}`)], EXPORT_THEME_HEX.white, { width: 30 }),
                        shadedCell([labelPara(tr('pdf_gender', 'Jinsi'), compact.gender)], EXPORT_THEME_HEX.white, { width: 30 }),
                    ],
                }),
                ...(compact.complaints
                    ? [new TableRow({
                        children: [
                            shadedCell(
                                [new Paragraph({
                                    children: [
                                        new TextRun({ text: `${tr('pdf_complaints', 'Shikoyat')}: `, bold: true, size: 18, color: EXPORT_THEME_HEX.textMuted }),
                                        new TextRun({ text: compact.complaints, italics: true, size: 20, color: EXPORT_THEME_HEX.text }),
                                    ],
                                })],
                                EXPORT_THEME_HEX.cardBg,
                                { columnSpan: 3 },
                            ),
                        ],
                    })]
                    : []),
            ],
        }),
        new Paragraph({ text: '', spacing: { after: 120 } }),
    );

    if (compact.criticalAlert) {
        children.push(sectionHeader(tr('pdf_critical_finding', 'Shoshilinch ogohlantirish'), EXPORT_THEME_HEX.alert));
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            shadedCell(
                                [new Paragraph({
                                    children: [new TextRun({ text: compact.criticalAlert, bold: true, size: 20, color: EXPORT_THEME_HEX.alert })],
                                })],
                                EXPORT_THEME_HEX.alertBg,
                                { columnSpan: 1 },
                            ),
                        ],
                    }),
                ],
            }),
            new Paragraph({ text: '', spacing: { after: 120 } }),
        );
    }

    if (compact.topDiagnosis) {
        const diag = compact.topDiagnosis;
        const pct = Number.isFinite(diag.probability) ? `${diag.probability}%` : '';
        children.push(sectionHeader(tr('pdf_diagnosis', 'Asosiy tashxis'), EXPORT_THEME_HEX.diagnosis));
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            shadedCell(
                                [
                                    new Paragraph({
                                        children: [new TextRun({
                                            text: diag.name,
                                            bold: true,
                                            size: 28,
                                            color: EXPORT_THEME_HEX.diagnosis,
                                        })],
                                    }),
                                    ...(diag.icd10
                                        ? [new Paragraph({
                                            children: [new TextRun({
                                                text: `${tr('final_report_icd10', 'MKB-10')}: ${diag.icd10}`,
                                                size: 18,
                                                color: EXPORT_THEME_HEX.textMuted,
                                            })],
                                        })]
                                        : []),
                                ],
                                EXPORT_THEME_HEX.diagnosisBg,
                                { width: pct ? 78 : 100 },
                            ),
                            ...(pct
                                ? [shadedCell(
                                    [new Paragraph({
                                        children: [new TextRun({ text: pct, bold: true, size: 36, color: EXPORT_THEME_HEX.white })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    EXPORT_THEME_HEX.diagnosis,
                                    { width: 22 },
                                )]
                                : []),
                        ],
                    }),
                ],
            }),
            new Paragraph({ text: '', spacing: { after: 120 } }),
        );
    }

    if (compact.treatmentLines.length > 0) {
        children.push(sectionHeader(tr('pdf_treatment_plan', 'Davolash rejasi'), EXPORT_THEME_HEX.treatment));
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: compact.treatmentLines.map((line, idx) => new TableRow({
                    children: [
                        shadedCell([bulletPara(line, idx + 1)], idx % 2 === 0 ? EXPORT_THEME_HEX.treatmentBg : EXPORT_THEME_HEX.white),
                    ],
                })),
            }),
            new Paragraph({ text: '', spacing: { after: 120 } }),
        );
    }

    if (compact.medications.length > 0) {
        children.push(sectionHeader(tr('pdf_medications', 'Dori-darmonlar'), EXPORT_THEME_HEX.medication));
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            shadedCell([new Paragraph({ children: [new TextRun({ text: tr('docx_med_name', 'Nomi'), bold: true, size: 18 })] })], EXPORT_THEME_HEX.medication, { width: 35 }),
                            shadedCell([new Paragraph({ children: [new TextRun({ text: tr('docx_dose', 'Doza'), bold: true, size: 18 })] })], EXPORT_THEME_HEX.medication, { width: 25 }),
                            shadedCell([new Paragraph({ children: [new TextRun({ text: tr('docx_note', 'Qo\'llash'), bold: true, size: 18 })] })], EXPORT_THEME_HEX.medication, { width: 40 }),
                        ],
                    }),
                    ...compact.medications.map((med, idx) => new TableRow({
                        children: [
                            shadedCell([new Paragraph({ children: [new TextRun({ text: med.name, bold: true, size: 20, color: EXPORT_THEME_HEX.medication })] })], idx % 2 === 0 ? EXPORT_THEME_HEX.medicationBg : EXPORT_THEME_HEX.white, { width: 35 }),
                            shadedCell([new Paragraph({ children: [new TextRun({ text: med.dosage, size: 20 })] })], idx % 2 === 0 ? EXPORT_THEME_HEX.medicationBg : EXPORT_THEME_HEX.white, { width: 25 }),
                            shadedCell([new Paragraph({ children: [new TextRun({ text: med.schedule, size: 18, color: EXPORT_THEME_HEX.textMuted })] })], idx % 2 === 0 ? EXPORT_THEME_HEX.medicationBg : EXPORT_THEME_HEX.white, { width: 40 }),
                        ],
                    })),
                ],
            }),
            new Paragraph({ text: '', spacing: { after: 120 } }),
        );
    }

    if (compact.preventionLines.length > 0) {
        children.push(sectionHeader(tr('pdf_prevention_measures', 'Profilaktika'), EXPORT_THEME_HEX.prevention));
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: compact.preventionLines.map((line, idx) => new TableRow({
                    children: [
                        shadedCell([bulletPara(line)], idx % 2 === 0 ? EXPORT_THEME_HEX.preventionBg : EXPORT_THEME_HEX.white),
                    ],
                })),
            }),
            new Paragraph({ text: '', spacing: { after: 120 } }),
        );
    }

    const addBulletSection = (title: string, lines: string[], bar: string, bg: string) => {
        if (!lines.length) return;
        children.push(sectionHeader(title, bar));
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: lines.map((line, idx) => new TableRow({
                    children: [shadedCell([bulletPara(line)], idx % 2 === 0 ? bg : EXPORT_THEME_HEX.white)],
                })),
            }),
            new Paragraph({ text: '', spacing: { after: 120 } }),
        );
    };

    const allDiagnoses = normalizeConsensusDiagnosis(reportNorm.consensusDiagnosis).slice(0, 6);
    if (allDiagnoses.length > 1) {
        addBulletSection(
            tr('pdf_diagnoses', 'Barcha tashxislar'),
            allDiagnoses.map((d, i) => {
                const pct = Number.isFinite(d.probability) ? ` (${d.probability}%)` : '';
                const icd = d.icd10 ? ` [${d.icd10}]` : '';
                return `${i + 1}. ${d.name}${pct}${icd}`;
            }),
            EXPORT_THEME_HEX.diagnosis,
            EXPORT_THEME_HEX.diagnosisBg,
        );
    }

    if (reportNorm.simplifiedFamilyExplanation?.trim()) {
        children.push(sectionHeader(tr('final_report_family_explanation', 'Bemor va oila uchun tushuntirish'), EXPORT_THEME_HEX.primary));
        children.push(
            new Paragraph({
                children: [new TextRun({ text: reportNorm.simplifiedFamilyExplanation, size: 20, color: EXPORT_THEME_HEX.text })],
                spacing: { after: 120 },
            }),
        );
    }

    addBulletSection(tr('final_report_imaging_title', 'Tasvirlash tahlili'), buildImagingExportLines(reportNorm, tr), EXPORT_THEME_HEX.accent, EXPORT_THEME_HEX.cardBg);
    addBulletSection(tr('pdf_tests', "Qo'shimcha tekshiruvlar"), (reportNorm.recommendedTests || []).map(String).filter(Boolean).slice(0, 8), EXPORT_THEME_HEX.treatment, EXPORT_THEME_HEX.treatmentBg);
    addBulletSection(tr('final_report_follow_up_title', 'Kuzatuv rejasi'), buildFollowUpExportLines(reportNorm, tr), EXPORT_THEME_HEX.primary, EXPORT_THEME_HEX.cardBg);
    addBulletSection(tr('final_report_referrals_title', 'Mutaxassis konsultatsiyasi'), buildReferralExportLines(reportNorm, tr), EXPORT_THEME_HEX.primary, EXPORT_THEME_HEX.cardBg);
    addBulletSection(tr('final_report_prognosis_title', 'Kasallik prognozi'), buildPrognosisExportLines(reportNorm, tr), EXPORT_THEME_HEX.diagnosis, EXPORT_THEME_HEX.diagnosisBg);
    addBulletSection(tr('routing_title', 'Bemor marshrutlash'), buildRoutingExportLines(reportNorm, tr), EXPORT_THEME_HEX.accent, EXPORT_THEME_HEX.cardBg);
    addBulletSection(tr('risk_factors_title', 'Xavf omillari'), buildRiskExportLines(reportNorm, tr), EXPORT_THEME_HEX.alert, EXPORT_THEME_HEX.alertBg);

    const extraMeds = (reportNorm.medicationRecommendations || []).slice(0, 8).map((m) => buildMedicationExportLine(m, tr));
    if (extraMeds.length > compact.medications.length) {
        addBulletSection(tr('pdf_medications', 'Dori-darmonlar (to\'liq)'), extraMeds, EXPORT_THEME_HEX.medication, EXPORT_THEME_HEX.medicationBg);
    }

    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        shadedCell(
                            [
                                new Paragraph({
                                    children: [new TextRun({ text: PDF_PRODUCT_NAME, bold: true, size: 18, color: EXPORT_THEME_HEX.primary })],
                                }),
                                new Paragraph({
                                    children: [new TextRun({
                                        text: tr('pdf_footer_general', "Raqamli tizim yordamida shakllantirilgan. Faqat ma'lumot uchun."),
                                        italics: true,
                                        size: 16,
                                        color: EXPORT_THEME_HEX.textMuted,
                                    })],
                                }),
                            ],
                            EXPORT_THEME_HEX.cardBg,
                        ),
                    ],
                }),
            ],
        }),
    );

    const doc = new Document({
        styles: {
            default: new DocumentDefaults({
                run: { font: 'Calibri', size: 22 },
                paragraph: { spacing: { after: 100, line: 276 } },
            }),
        },
        sections: [{ children }],
    });

    try {
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tr('docx_filename_prefix', 'Tibbiy_Xulosa')}_${pdfText(patientData.lastName)}_${pdfText(patientData.firstName)}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        logger.error('Could not generate DOCX file.', e);
        alert(tr('docx_generation_error', "DOCX faylini yaratishda xatolik yuz berdi."));
    }
};
