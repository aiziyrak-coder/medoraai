/**
 * To'liq konsilium PDF — tartibli, bemor uchun tushunarli klinik hujjat.
 * Rangli kartochkalar o'rniga aniq bo'limlar va jadvallar.
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { FinalReport, PatientData } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import type { Language } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translationKeys';
import {
    prepareExportReport,
    buildImagingExportLines,
    buildProtocolGapsLines,
    buildCareAuditLines,
    buildMedicationExportLine,
    buildIndividualDietLines,
    buildRoutingExportLines,
    buildRiskExportLines,
    buildFollowUpExportLines,
    buildReferralExportLines,
    buildPrognosisExportLines,
    buildLifestyleExportLines,
    buildPharmacologyWarningLines,
} from '../utils/exportReportSections';
import {
    createExportTr,
    exportFileSlug,
    formatExportDate,
    pdfText,
    sanitizeExportFilename,
} from '../utils/exportI18n';
import { sanitizeClinicalContent } from '../utils/sanitizeClinicalContent';

const PDF_FOOTER_SITE = 'fjsti.ziyrak.org';
const PDF_FOOTER_PUBLIC_URL = `https://${PDF_FOOTER_SITE}`;
const PDF_FOOTER_PHONE_1 = '+998 99 575 11 11';

const PDF_FONT = 'times' as const;
const PDF_UNICODE_FONT = 'DejaVuSans';
const DEJAVU_CDN = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';
const UNICODE_FONT_VARIANTS: ReadonlyArray<{
    file: string;
    style: 'normal' | 'bold' | 'italic' | 'bolditalic';
}> = [
    { file: 'DejaVuSans.ttf', style: 'normal' },
    { file: 'DejaVuSans-Bold.ttf', style: 'bold' },
    { file: 'DejaVuSans-Oblique.ttf', style: 'italic' },
    { file: 'DejaVuSans-BoldOblique.ttf', style: 'bolditalic' },
];

const COMPACT_LINE = 3.8;
const FOOTER_RESERVE = 14;
const MARGIN = 11;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function isValidTtf(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 12) return false;
    const u8 = new Uint8Array(buffer);
    const sig = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
    if (sig === 'true' || sig === 'OTTO' || sig === 'ttcf') return true;
    return u8[0] === 0x00 && u8[1] === 0x01 && u8[2] === 0x00 && u8[3] === 0x00;
}

async function fetchTtf(url: string): Promise<ArrayBuffer | null> {
    try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        return isValidTtf(buf) ? buf : null;
    } catch {
        return null;
    }
}

async function loadTtfVariant(file: string): Promise<ArrayBuffer | null> {
    const local = await fetchTtf(`/fonts/${file}`);
    if (local) return local;
    return fetchTtf(`${DEJAVU_CDN}/${file}`);
}

async function setupPdfFont(doc: jsPDF): Promise<string> {
    let registered = 0;
    for (const variant of UNICODE_FONT_VARIANTS) {
        const buf = await loadTtfVariant(variant.file);
        if (!buf) continue;
        try {
            doc.addFileToVFS(variant.file, arrayBufferToBase64(buf));
            doc.addFont(variant.file, PDF_UNICODE_FONT, variant.style);
            registered += 1;
        } catch {
            // keyingi variant
        }
    }
    if (registered > 0) {
        doc.setFont(PDF_UNICODE_FONT, 'normal');
        return PDF_UNICODE_FONT;
    }
    return PDF_FONT;
}

function treatmentStepToText(step: unknown): string {
    if (typeof step === 'string') return sanitizeClinicalContent(step);
    if (step && typeof step === 'object') {
        const o = step as Record<string, unknown>;
        return sanitizeClinicalContent(
            [o.step, o.details, o.text].filter(Boolean).map(String).join(' — ') || JSON.stringify(step),
        );
    }
    return sanitizeClinicalContent(String(step ?? ''));
}

function testToText(test: unknown): string {
    if (typeof test === 'string') return test;
    if (test && typeof test === 'object') {
        const o = test as Record<string, unknown>;
        return [o.testName ?? o.name ?? o.test, o.reason].filter(Boolean).map(String).join(' — ') || '';
    }
    return '';
}

export async function renderConsiliumPdfReport(
    report: FinalReport,
    patientData: PatientData,
    t?: (key: string) => string,
    language: Language = 'uz-L',
): Promise<void> {
    const tr = createExportTr(language, t as ((key: TranslationKey) => string) | undefined);
    report = prepareExportReport(report);

    const doc = new jsPDF();
    const fontName = await setupPdfFont(doc);
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const contentW = pageWidth - MARGIN * 2;
    let y = MARGIN;
    const contentBottom = () => pageHeight - FOOTER_RESERVE - 20;

    const ensureSpace = (needed: number) => {
        if (y + needed > contentBottom()) {
            doc.addPage();
            y = MARGIN;
        }
    };

    const drawLine = (yPos: number, color: [number, number, number] = [200, 200, 200]) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.25);
        doc.line(MARGIN, yPos, pageWidth - MARGIN, yPos);
    };

    const addHeader = (text: string) => {
        ensureSpace(16);
        doc.setFontSize(12);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(text, MARGIN, y);
        y += 3;
        drawLine(y, [160, 160, 160]);
        y += 5;
    };

    const addSectionTitle = (text: string) => {
        ensureSpace(9);
        doc.setFontSize(9.5);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(50, 60, 80);
        doc.text(text, MARGIN, y);
        y += 4.5;
    };

    const addBullet = (text: string, indent = 4) => {
        ensureSpace(7);
        doc.setFontSize(8.5);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(text || '—', contentW - indent - 4);
        lines.forEach((line: string, i: number) => {
            ensureSpace(COMPACT_LINE + 1);
            if (i === 0) doc.text('•', MARGIN + 1, y);
            doc.text(line, MARGIN + indent, y);
            y += COMPACT_LINE;
        });
        y += 1;
    };

    const addParagraph = (title: string, body: string) => {
        if (!body?.trim()) return;
        addSectionTitle(title);
        doc.setFontSize(8.5);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(body.trim(), contentW);
        lines.forEach((line: string) => {
            ensureSpace(COMPACT_LINE + 1);
            doc.text(line, MARGIN, y);
            y += COMPACT_LINE;
        });
        y += 2;
    };

    const addSectionBullets = (title: string, lines: string[]) => {
        if (!lines.length) return;
        y += 1;
        addSectionTitle(title);
        lines.forEach((line) => addBullet(line));
    };

    // === SARLAVHA ===
    let qrDataUrl = '';
    try {
        qrDataUrl = await QRCode.toDataURL(PDF_FOOTER_PUBLIC_URL, {
            width: 72,
            margin: 0,
            color: { dark: '#1e293b', light: '#ffffff' },
        });
    } catch { /* ignore */ }

    const qrSize = 18;
    const qrX = pageWidth - MARGIN - qrSize;
    const qrY = y - 1;
    if (qrDataUrl) {
        try {
            doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        } catch { /* ignore */ }
    }

    doc.setFontSize(15);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(tr('pdf_title', 'KONSILIUM: Yakuniy Klinik Xulosa'), MARGIN, y);
    y += 6;

    doc.setFontSize(7.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(90, 90, 90);
    const sub = tr('pdf_subtitle', "Rasmiy tibbiy maslahat hujjati — faqat ma'lumot uchun.");
    const subLines = doc.splitTextToSize(sub, contentW - qrSize - 6);
    doc.text(subLines[0] || '', MARGIN, y);

    const dateStr = formatExportDate(language);
    doc.text(`${tr('pdf_date', 'Sana')}: ${dateStr}`, pageWidth - MARGIN - qrSize - 4, y, { align: 'right' });
    if (qrDataUrl) {
        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        doc.text(tr('pdf_scan', 'Skanerlang'), qrX + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });
    }
    y = Math.max(y + 5, qrY + qrSize + 6);
    drawLine(y, [150, 150, 150]);
    y += 5;

    // === BEMOR ===
    addHeader(tr('pdf_patient_info', "Bemor ma'lumotlari"));
    const fullName =
        `${patientData.lastName} ${patientData.firstName}`.trim() +
        (patientData.fatherName ? ` ${patientData.fatherName}` : '');
    const gender =
        patientData.gender === 'male'
            ? tr('pdf_gender_male', 'Erkak')
            : patientData.gender === 'female'
                ? tr('pdf_gender_female', 'Ayol')
                : tr('pdf_gender_other', 'Boshqa');

    const patientRows: [string, string][] = [
        [tr('pdf_patient', 'Bemor'), pdfText(fullName)],
        [tr('pdf_age', 'Yoshi'), `${pdfText(patientData.age)} ${tr('pdf_age_unit', 'yosh')}`],
        [tr('pdf_gender', 'Jinsi'), gender],
    ];
    if (patientData.objectiveData) {
        patientRows.push([tr('pdf_objective', "Ob'ektiv ko'rik"), pdfText(patientData.objectiveData)]);
    }
    if (patientData.complaints) {
        patientRows.push([tr('pdf_complaints', 'Shikoyatlar'), pdfText(patientData.complaints)]);
    }
    if (patientData.labResults) {
        patientRows.push([tr('pdf_lab', 'Laboratoriya'), pdfText(patientData.labResults)]);
    }
    if (patientData.history) {
        patientRows.push([tr('docx_medical_history', 'Kasallik tarixi'), pdfText(patientData.history)]);
    }

    doc.setFontSize(8.5);
    patientRows.forEach(([label, value]) => {
        ensureSpace(10);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(70, 70, 70);
        doc.text(`${label}:`, MARGIN, y);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(40, 40, 40);
        const valLines = doc.splitTextToSize(value, contentW - 38);
        valLines.forEach((line: string, i: number) => {
            if (i > 0) ensureSpace(COMPACT_LINE);
            doc.text(line, MARGIN + 36, y + i * COMPACT_LINE);
        });
        y += valLines.length * COMPACT_LINE + 2;
    });
    y += 2;

    // === SHOSHILINCH ===
    if (report.criticalFinding?.finding) {
        ensureSpace(20);
        const boxY = y;
        const cfText = `${report.criticalFinding.finding}${report.criticalFinding.implication ? ` — ${report.criticalFinding.implication}` : ''}`;
        const cfLines = doc.splitTextToSize(cfText, contentW - 8).slice(0, 5);
        const boxH = 9 + cfLines.length * COMPACT_LINE;
        doc.setFillColor(255, 245, 245);
        doc.rect(MARGIN, boxY, contentW, boxH, 'F');
        doc.setDrawColor(200, 80, 80);
        doc.setLineWidth(0.4);
        doc.rect(MARGIN, boxY, contentW, boxH, 'S');
        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(180, 40, 40);
        doc.text(tr('pdf_critical_finding', 'Muhim topilma (shoshilinch)'), MARGIN + 3, boxY + 5);
        if (report.criticalFinding.urgency) {
            doc.text(
                `${tr('pdf_urgency', 'Shoshilinchlik')}: ${report.criticalFinding.urgency}`,
                pageWidth - MARGIN - 3,
                boxY + 5,
                { align: 'right' },
            );
        }
        doc.setFont(fontName, 'normal');
        doc.setTextColor(80, 40, 40);
        let cy = boxY + 10;
        cfLines.forEach((line: string) => {
            doc.text(line, MARGIN + 3, cy);
            cy += COMPACT_LINE;
        });
        y = boxY + boxH + 4;
    }

    // === KONSENSUS TASHXISLAR ===
    addHeader(tr('pdf_consensus', 'Konsilium konsensusi'));
    const diagnoses = normalizeConsensusDiagnosis(report.consensusDiagnosis).slice(0, 6);
    if (diagnoses.length === 0) {
        addBullet(tr('final_report_no_data', "Ma'lumot kiritilmagan."));
    } else {
        addSectionTitle(tr('pdf_diagnoses', 'Tashxislar'));
        diagnoses.forEach((diag, idx) => {
            ensureSpace(12);
            const pct = Number.isFinite(diag.probability) ? `${diag.probability}%` : '';
            const ev = diag.evidenceLevel || tr('pdf_evidence_na', 'Belgilanmagan');
            doc.setFontSize(9);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(30, 70, 110);
            const nameLines = doc.splitTextToSize(`${idx + 1}. ${diag.name}`, contentW - 42);
            doc.text(nameLines[0] || '', MARGIN, y);
            if (pct || ev) {
                doc.setFont(fontName, 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(100, 100, 100);
                doc.text([pct, ev].filter(Boolean).join(' · '), pageWidth - MARGIN, y, { align: 'right' });
            }
            y += COMPACT_LINE;
            nameLines.slice(1, 2).forEach((line: string) => {
                doc.setFont(fontName, 'bold');
                doc.setTextColor(30, 70, 110);
                doc.text(line, MARGIN + 4, y);
                y += COMPACT_LINE;
            });
            if (diag.icd10) {
                doc.setFontSize(7.5);
                doc.setFont(fontName, 'normal');
                doc.setTextColor(90, 90, 90);
                doc.text(`${tr('final_report_icd10', 'MKB-10')}: ${diag.icd10}`, MARGIN + 6, y);
                y += COMPACT_LINE;
            }
            if (diag.justification) {
                doc.setFontSize(8);
                doc.setTextColor(70, 70, 70);
                doc.splitTextToSize(diag.justification, contentW - 8).slice(0, 2).forEach((line: string) => {
                    doc.text(line, MARGIN + 6, y);
                    y += COMPACT_LINE;
                });
            }
            y += 1.5;
        });
    }

    if (report.simplifiedFamilyExplanation?.trim()) {
        addParagraph(tr('final_report_family_explanation', 'Bemor va oila uchun tushuntirish'), report.simplifiedFamilyExplanation);
    }

    addSectionBullets(tr('final_report_imaging_title', 'Tasvirlash tahlili'), buildImagingExportLines(report, tr));
    addSectionBullets(tr('routing_title', 'Bemor marshrutlash'), buildRoutingExportLines(report, tr));
    addSectionBullets(tr('risk_factors_title', 'Xavf omillari va og\'irlik'), buildRiskExportLines(report, tr));
    addSectionBullets(tr('final_report_protocol_gaps_title', 'Protokol kamchiliklari'), buildProtocolGapsLines(report, tr));
    addSectionBullets(tr('final_report_quality_audit_title', 'Tibbiy yordam sifati'), buildCareAuditLines(report, tr));

    // === DAVOLASH ===
    const treatments = (Array.isArray(report.treatmentPlan) ? report.treatmentPlan : [])
        .map(treatmentStepToText)
        .filter(Boolean)
        .slice(0, 8);
    addSectionBullets(tr('pdf_treatment_plan', 'Davolash rejasi'), treatments);

    // === DORILAR ===
    const medLines = (report.medicationRecommendations || [])
        .slice(0, 8)
        .map((med) => buildMedicationExportLine(med, tr));
    addSectionBullets(tr('pdf_medications', 'Dori-darmonlar'), medLines);

    const pharmWarnings = buildPharmacologyWarningLines(report);
    if (pharmWarnings.length) {
        addSectionBullets(tr('consilium_pharmacology_warnings', 'Farmakolog ogohlantirishlari'), pharmWarnings);
    }

    // === OVQATLANISH / PROFILAKTIKA ===
    const np = report.nutritionPrevention;
    if (np) {
        y += 1;
        addSectionTitle(tr('pdf_nutrition_prevention', "To'g'ri ovqatlanish va profilaktika"));
        if (np.intro?.trim()) addBullet(np.intro);
        if (np.dietaryGuidelines?.length) {
            doc.setFontSize(8);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(50, 70, 100);
            doc.text(tr('pdf_dietary_guidelines', "Ovqatlanish bo'yicha:"), MARGIN, y);
            y += COMPACT_LINE + 1;
            np.dietaryGuidelines.slice(0, 10).forEach((line) => addBullet(line));
        }
        if (np.preventionMeasures?.length) {
            doc.setFont(fontName, 'bold');
            doc.text(tr('pdf_prevention_measures', 'Profilaktika:'), MARGIN, y);
            y += COMPACT_LINE + 1;
            np.preventionMeasures.slice(0, 10).forEach((line) => addBullet(line));
        }
        addSectionBullets(tr('final_report_individual_diet_title', 'Individual parhez'), buildIndividualDietLines(report, tr));
    }

    const fm = report.folkMedicine;
    if (fm && (fm.items?.length || fm.intro?.trim())) {
        y += 1;
        addSectionTitle(tr('pdf_folk_medicine', "Xalq tabobati (qo'shimcha)"));
        doc.setFontSize(7.5);
        doc.setFont(fontName, 'italic');
        doc.setTextColor(90, 90, 90);
        doc.text(tr('pdf_folk_medicine_note', "Rasmiy dori va shifokor ko'rsatmasi o'rnini bosmaydi."), MARGIN, y);
        y += COMPACT_LINE + 2;
        if (fm.intro?.trim()) addBullet(fm.intro);
        (fm.items || []).slice(0, 6).forEach((it) => {
            const parts = [it.plantPart, it.preparationOrUsage, it.precautions].filter(Boolean).map(String);
            addBullet(`${it.plantName || ''}${parts.length ? ` — ${parts.join('; ')}` : ''}`);
        });
    }

    addSectionBullets(tr('pdf_tests', "Qo'shimcha tekshiruvlar"), (report.recommendedTests || []).map(testToText).filter(Boolean).slice(0, 6));
    addSectionBullets(tr('final_report_follow_up_title', 'Kuzatuv rejasi'), buildFollowUpExportLines(report, tr));
    addSectionBullets(tr('final_report_referrals_title', 'Mutaxassis konsultatsiyasi'), buildReferralExportLines(report, tr));
    addSectionBullets(tr('final_report_prognosis_title', 'Kasallik prognozi'), buildPrognosisExportLines(report, tr));
    addSectionBullets(tr('final_report_lifestyle_title', 'Hayot tarzi'), buildLifestyleExportLines(report, tr));

    if (report.adverseEventRisks?.length) {
        addSectionTitle(tr('pdf_risks', "Nojo'ya ta'sir xavfi"));
        report.adverseEventRisks.slice(0, 4).forEach((risk) => {
            const prob = Number.isFinite(risk.probability) ? ` (~${Math.round(risk.probability * 100)}%)` : '';
            addBullet(`${risk.drug}: ${risk.risk}${prob}${risk.management ? ` — ${risk.management}` : ''}`);
        });
    }

    if (report.rejectedHypotheses?.length) {
        addSectionTitle(tr('pdf_rejected', 'Rad etilgan gipotezalar'));
        report.rejectedHypotheses.slice(0, 4).forEach((h) => addBullet(`${h.name}: ${h.reason}`));
    }

    if (report.uzbekistanLegislativeNote?.trim()) {
        y += 2;
        ensureSpace(12);
        doc.setFillColor(250, 250, 245);
        doc.rect(MARGIN, y, contentW, 10, 'F');
        doc.setFontSize(7);
        doc.setFont(fontName, 'italic');
        doc.setTextColor(90, 90, 70);
        const noteLines = doc.splitTextToSize(report.uzbekistanLegislativeNote, contentW - 6);
        doc.text(noteLines[0] || '', MARGIN + 3, y + 6);
        y += 12;
    }

    // === FOOTER ===
    const pageCount = doc.getNumberOfPages();
    const footerText = tr('pdf_footer_general', "Raqamli tizim yordamida shakllantirilgan. Faqat ma'lumot uchun.");
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawLine(pageHeight - FOOTER_RESERVE, [200, 200, 200]);
        doc.setFontSize(7);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(50, 60, 80);
        doc.text('AiDoktor', MARGIN, pageHeight - FOOTER_RESERVE + 4);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`  |  ${PDF_FOOTER_SITE}  |  ${PDF_FOOTER_PHONE_1}`, MARGIN + 16, pageHeight - FOOTER_RESERVE + 4);
        doc.setFontSize(6.5);
        doc.text(footerText, MARGIN, pageHeight - FOOTER_RESERVE + 8);
        doc.text(`${tr('pdf_page', 'Sahifa')} ${i}/${pageCount}`, pageWidth - MARGIN, pageHeight - FOOTER_RESERVE + 6, { align: 'right' });
    }

    const fileSlug = exportFileSlug(language);
    const lastName = sanitizeExportFilename(pdfText(patientData.lastName));
    const firstName = sanitizeExportFilename(pdfText(patientData.firstName));
    doc.save(`${fileSlug}_${lastName}_${firstName}.pdf`);
}
