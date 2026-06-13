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
import { createExportTr, formatExportDate, pdfText } from '../utils/exportI18n';

const cellPad = { top: 60, bottom: 60, left: 100, right: 100 };

function cell(children: Paragraph[], fill: string, width?: number): TableCell {
    return new TableCell({
        shading: { fill, type: ShadingType.CLEAR },
        margins: cellPad,
        verticalAlign: VerticalAlign.CENTER,
        width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
        children,
    });
}

function sectionBlock(title: string, bar: string, bg: string, lines: string[]): Table | null {
    if (!lines.length) return null;
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 2, type: WidthType.PERCENTAGE },
                        shading: { fill: bar, type: ShadingType.CLEAR },
                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                        children: [new Paragraph({ text: '' })],
                    }),
                    cell(
                        [
                            new Paragraph({
                                children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 18, color: EXPORT_THEME_HEX.text })],
                                spacing: { after: 60 },
                            }),
                            ...lines.map((line) => new Paragraph({
                                children: [
                                    new TextRun({ text: '• ', bold: true, color: bar }),
                                    new TextRun({ text: line, size: 20, color: EXPORT_THEME_HEX.text }),
                                ],
                                spacing: { after: 50 },
                            })),
                        ],
                        bg,
                        98,
                    ),
                ],
            }),
        ],
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
    const c = buildCompactExportData(report, patientData, tr);
    const dateStr = formatExportDate(language);
    const children: (Paragraph | Table)[] = [];

    // Sarlavha
    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        cell(
                            [
                                new Paragraph({
                                    children: [new TextRun({
                                        text: tr('export_patient_summary_title', 'Tibbiy xulosa'),
                                        bold: true,
                                        size: 30,
                                        color: EXPORT_THEME_HEX.white,
                                    })],
                                }),
                                new Paragraph({
                                    children: [new TextRun({ text: `${c.patientLine}  ·  ${dateStr}`, size: 18, color: 'D0E4F5' })],
                                }),
                            ],
                            EXPORT_THEME_HEX.primary,
                            100,
                        ),
                    ],
                }),
            ],
        }),
        new Paragraph({ text: '', spacing: { after: 80 } }),
    );

    if (c.urgentNote) {
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            cell(
                                [new Paragraph({
                                    children: [new TextRun({ text: c.urgentNote, bold: true, size: 20, color: EXPORT_THEME_HEX.alert })],
                                })],
                                EXPORT_THEME_HEX.alertBg,
                            ),
                        ],
                    }),
                ],
            }),
            new Paragraph({ text: '', spacing: { after: 80 } }),
        );
    }

    if (c.diagnosisName) {
        const pct = c.diagnosisPercent != null ? `${c.diagnosisPercent}%` : '';
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            cell(
                                [
                                    new Paragraph({
                                        children: [new TextRun({
                                            text: tr('export_your_diagnosis', 'Tashxis').toUpperCase(),
                                            size: 16,
                                            color: EXPORT_THEME_HEX.textMuted,
                                            bold: true,
                                        })],
                                    }),
                                    new Paragraph({
                                        children: [new TextRun({
                                            text: c.diagnosisName,
                                            bold: true,
                                            size: 28,
                                            color: EXPORT_THEME_HEX.diagnosis,
                                        })],
                                    }),
                                ],
                                EXPORT_THEME_HEX.diagnosisBg,
                                pct ? 78 : 100,
                            ),
                            ...(pct
                                ? [cell(
                                    [new Paragraph({
                                        children: [new TextRun({ text: pct, bold: true, size: 36, color: EXPORT_THEME_HEX.white })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    EXPORT_THEME_HEX.diagnosis,
                                    22,
                                )]
                                : []),
                        ],
                    }),
                ],
            }),
            new Paragraph({ text: '', spacing: { after: 80 } }),
        );
    }

    const sections = [
        sectionBlock(tr('export_what_to_do', 'Nima qilish kerak'), EXPORT_THEME_HEX.treatment, EXPORT_THEME_HEX.treatmentBg, c.treatmentLines),
        sectionBlock(tr('pdf_medications', 'Dorilar'), EXPORT_THEME_HEX.medication, EXPORT_THEME_HEX.medicationBg, c.medicationLines),
        sectionBlock(tr('export_home_care', "Uyda e'tibor berish"), EXPORT_THEME_HEX.prevention, EXPORT_THEME_HEX.preventionBg, c.preventionLines),
    ];
    sections.forEach((tbl) => {
        if (tbl) {
            children.push(tbl, new Paragraph({ text: '', spacing: { after: 60 } }));
        }
    });

    children.push(
        new Paragraph({
            children: [new TextRun({
                text: `AiDoktor · ${tr('pdf_footer_general', "Shifokor ko'rsatmasi bilan birga foydalaning.")}`,
                italics: true,
                size: 16,
                color: EXPORT_THEME_HEX.textMuted,
            })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 },
        }),
    );

    const doc = new Document({
        styles: {
            default: new DocumentDefaults({
                run: { font: 'Calibri', size: 22 },
                paragraph: { spacing: { after: 80, line: 260 } },
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
