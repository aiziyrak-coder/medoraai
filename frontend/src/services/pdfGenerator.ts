import { jsPDF } from "jspdf";
import QRCode from 'qrcode';
import type { FinalReport, PatientData } from '../types';
import { normalizeConsensusDiagnosis } from '../types';

interface jsPDFInternal {
    pages: unknown[];
    pageSize: {
        height: number;
        width: number;
    };
}

const PDF_FONT = 'times' as const;
const LINE_HEIGHT = 5;
const COMPACT_LINE = 3.5;
const FOOTER_RESERVE = 12;
const MARGIN = 10;
const PLATFORM_URL = 'https://medora.cdcgroup.uz';

export interface InstituteBranding {
    instituteName?: string;
    instituteLogoDataUrl?: string;
}

export const generatePdfReport = async (
    report: FinalReport,
    patientData: PatientData,
    branding?: InstituteBranding
) => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let y = MARGIN;

    // Generate QR code for platform
    let qrDataUrl = '';
    try {
        qrDataUrl = await QRCode.toDataURL(PLATFORM_URL, { 
            width: 80, 
            margin: 1,
            color: { dark: '#1e293b', light: '#ffffff' }
        });
    } catch {
        // QR generation failed, continue without it
    }

    // Draw horizontal line
    const drawLine = (yPos: number, color: [number, number, number] = [200, 200, 200]) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, yPos, pageWidth - MARGIN, yPos);
    };

    // Draw box for table cells
    const drawCell = (x: number, yPos: number, w: number, h: number, fill = false) => {
        if (fill) {
            doc.setFillColor(245, 247, 250);
            doc.rect(x, yPos, w, h, 'F');
        }
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.1);
        doc.rect(x, yPos, w, h, 'S');
    };

    // Compact header with line
    const addHeader = (text: string) => {
        if (y > pageHeight - 40) {
            doc.addPage();
            y = MARGIN;
        }
        doc.setFontSize(14);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(text, MARGIN, y);
        y += 2;
        drawLine(y, [180, 180, 180]);
        y += 4;
    };

    // Small section title
    const addSectionTitle = (text: string) => {
        if (y > pageHeight - 30) {
            doc.addPage();
            y = MARGIN;
        }
        doc.setFontSize(10);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(50, 60, 80);
        doc.text(text, MARGIN, y);
        y += 4;
    };

    // Compact key-value pair
    const addKeyValueCompact = (key: string, value: string | undefined | null, keyWidth = 40) => {
        if (!value) return;
        doc.setFontSize(9);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(key + ':', MARGIN, y);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(40, 40, 40);
        const splitValue = doc.splitTextToSize(value, pageWidth - MARGIN * 2 - keyWidth - 4);
        splitValue.forEach((line: string, i: number) => {
            doc.text(line, MARGIN + keyWidth + 2, y + i * COMPACT_LINE);
        });
        y += splitValue.length * COMPACT_LINE + 1;
    };

    // Table row helper
    const addTableRow = (cols: { label: string; value: string; width: number }[]) => {
        if (y > pageHeight - 30) {
            doc.addPage();
            y = MARGIN;
        }
        doc.setFontSize(9);
        let xPos = MARGIN;
        cols.forEach(col => {
            doc.setFont(PDF_FONT, 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text(col.label + ':', xPos, y);
            doc.setFont(PDF_FONT, 'normal');
            doc.setTextColor(40, 40, 40);
            doc.text(col.value, xPos + doc.getTextWidth(col.label + ': ') + 2, y);
            xPos += col.width;
        });
        y += COMPACT_LINE + 1;
    };

    // Bullet point item
    const addBullet = (text: string) => {
        if (y > pageHeight - 20) {
            doc.addPage();
            y = MARGIN;
        }
        doc.setFontSize(9);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(40, 40, 40);
        const indent = MARGIN + 4;
        doc.text('\u2022', MARGIN + 2, y);
        const splitText = doc.splitTextToSize(text, pageWidth - MARGIN * 2 - 8);
        splitText.forEach((line: string, i: number) => {
            doc.text(line, indent + (i > 0 ? 4 : 0), y + i * COMPACT_LINE);
        });
        y += splitText.length * COMPACT_LINE;
    };

    // === DOCUMENT HEADER ===
    // Add QR code on the right side
    const qrSize = 20;
    const qrX = pageWidth - MARGIN - qrSize;
    const qrY = y - 2; // Remember QR code start position
    if (qrDataUrl) {
        try {
            doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        } catch { /* ignore */ }
    }
    
    doc.setFontSize(16);
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text("KONSILIUM: Yakuniy Klinik Xulosa", MARGIN, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text("Rasmiy tibbiy maslahat hujjati - doktor tavsiyasi sifatida. Faqat ma'lumot uchun.", MARGIN, y);
    const reportDate = new Date();
    const dateStr = reportDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Sana: ${dateStr}`, pageWidth - MARGIN - qrSize - 5, y, { align: 'right' });
    
    // QR code label (positioned below QR code)
    if (qrDataUrl) {
        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        doc.text('Skannerlang →', qrX + qrSize/2, qrY + qrSize + 2, { align: 'center' });
        doc.text('medora.cdcgroup.uz', qrX + qrSize/2, qrY + qrSize + 5, { align: 'center' });
    }
    
    // Move past QR code area
    y = Math.max(y + 4, qrY + qrSize + 8);
    drawLine(y, [150, 150, 150]);
    y += 3;

    // === PATIENT INFO TABLE ===
    const col1Width = 60;
    const col2Width = 65;
    const col3Width = 50;
    const rowHeight = 6;
    const tableStart = y;

    // Table header
    doc.setFillColor(240, 242, 245);
    doc.rect(MARGIN, y, pageWidth - MARGIN * 2, rowHeight, 'F');
    drawLine(y);
    doc.setFontSize(9);
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(50, 60, 80);
    doc.text("BEMOR MA'LUMOTLARI", MARGIN + 2, y + 4);
    y += rowHeight;

    // Row 1: Name, Age, Gender
    doc.setDrawColor(230, 230, 230);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    const fullName = `${patientData.lastName} ${patientData.firstName}`.trim() + (patientData.fatherName ? ` ${patientData.fatherName}` : '');
    const gender = patientData.gender === 'male' ? 'Erkak' : patientData.gender === 'female' ? 'Ayol' : 'Boshqa';
    
    doc.setFontSize(9);
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text("Bemor:", MARGIN + 2, y + 4);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(fullName, MARGIN + 20, y + 4);
    
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text("Yoshi:", MARGIN + col1Width + col2Width + 2, y + 4);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(patientData.age, MARGIN + col1Width + col2Width + 18, y + 4);
    y += rowHeight;

    // Vital signs row if available
    if (patientData.objectiveData) {
        doc.line(MARGIN, y, pageWidth - MARGIN, y);
        doc.setFontSize(8);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text("Ob'ektiv:", MARGIN + 2, y + 4);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(40, 40, 40);
        const vitalText = patientData.objectiveData.substring(0, 100);
        const vitalSplit = doc.splitTextToSize(vitalText, pageWidth - MARGIN * 2 - 22);
        doc.text(vitalSplit.join(' '), MARGIN + 22, y + 4);
        y += rowHeight;
    }

    // Complaints row
    if (patientData.complaints) {
        doc.line(MARGIN, y, pageWidth - MARGIN, y);
        doc.setFontSize(8);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text("Shikoyat:", MARGIN + 2, y + 4);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(40, 40, 40);
        const compSplit = doc.splitTextToSize(patientData.complaints, pageWidth - MARGIN * 2 - 28);
        doc.text(compSplit[0] || '', MARGIN + 28, y + 4);
        y += rowHeight;
        // Continue if needed
        for (let i = 1; i < compSplit.length && i < 3; i++) {
            doc.text(compSplit[i], MARGIN + 28, y + 4);
            y += rowHeight;
        }
    }

    // Lab results row
    if (patientData.labResults) {
        doc.line(MARGIN, y, pageWidth - MARGIN, y);
        doc.setFontSize(8);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text("Lab:", MARGIN + 2, y + 4);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(40, 40, 40);
        const labSplit = doc.splitTextToSize(patientData.labResults.substring(0, 200), pageWidth - MARGIN * 2 - 18);
        doc.text(labSplit[0] || '', MARGIN + 18, y + 4);
        y += rowHeight;
    }

    // Close table
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 4;

    // === CRITICAL FINDING (compact) ===
    if (report.criticalFinding && report.criticalFinding.finding) {
        if (y > pageHeight - 40) {
            doc.addPage();
            y = MARGIN;
        }
        doc.setFillColor(255, 245, 245);
        doc.rect(MARGIN, y, pageWidth - MARGIN * 2, 12, 'F');
        doc.setDrawColor(220, 100, 100);
        doc.setLineWidth(0.5);
        doc.rect(MARGIN, y, pageWidth - MARGIN * 2, 12, 'S');
        doc.setFontSize(8);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(180, 50, 50);
        doc.text("Muhim topilma (Shoshilinch):", MARGIN + 3, y + 4);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(80, 40, 40);
        const cfText = (report.criticalFinding.finding + ' - ' + report.criticalFinding.implication).substring(0, 120);
        const cfSplit = doc.splitTextToSize(cfText, pageWidth - MARGIN * 2 - 75);
        doc.text(cfSplit[0] || '', MARGIN + 75, y + 4);
        doc.text(`Shoshilinchlik: ${report.criticalFinding.urgency}`, MARGIN + 3, y + 9);
        y += 14;
    }

    // === CONSENSUS SECTION ===
    addHeader("Konsilium Konsensusi");

    // Diagnoses in compact table format
    addSectionTitle("Tashxislar");
    const diagnoses = normalizeConsensusDiagnosis(report.consensusDiagnosis).slice(0, 4);
    diagnoses.forEach((diag, idx) => {
        const pct = Number.isFinite(diag.probability) ? `${diag.probability}%` : '-';
        doc.setFontSize(9);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(40, 80, 120);
        doc.text(`${idx + 1}. ${diag.name}`, MARGIN, y);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`(${pct}) - ${diag.evidenceLevel || 'N/A'}`, pageWidth - MARGIN - 50, y, { align: 'left' });
        y += COMPACT_LINE;
        if (diag.justification) {
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            const justSplit = doc.splitTextToSize(diag.justification, pageWidth - MARGIN * 2 - 10);
            doc.text(justSplit[0] || '', MARGIN + 6, y);
            y += COMPACT_LINE;
        }
        y += 1;
    });

    // Treatment plan
    if (report.treatmentPlan && report.treatmentPlan.length > 0) {
        y += 2;
        addSectionTitle("Davolash Rejasi");
        const treatments = (Array.isArray(report.treatmentPlan) ? report.treatmentPlan.slice(0, 6) : []);
        treatments.forEach(step => {
            const s = typeof step === 'string' ? step : 
                (typeof step === 'object' && step !== null ? Object.values(step as Record<string, unknown>).filter(Boolean).join(' - ') : String(step ?? ''));
            addBullet(s);
        });
    }

    // Medications
    if (report.medicationRecommendations && report.medicationRecommendations.length > 0) {
        y += 2;
        addSectionTitle("Dori Tavsiyalari");
        const meds = report.medicationRecommendations.slice(0, 6);
        meds.forEach(med => {
            doc.setFontSize(9);
            doc.setFont(PDF_FONT, 'bold');
            doc.setTextColor(40, 80, 40);
            doc.text('\u2022 ' + (med.name || ''), MARGIN + 2, y);
            if (med.dosage) {
                doc.setFont(PDF_FONT, 'normal');
                doc.setTextColor(80, 80, 80);
                doc.text(med.dosage, MARGIN + 80, y);
            }
            y += COMPACT_LINE;
            if (med.notes) {
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text('   ' + med.notes, MARGIN + 2, y);
                y += COMPACT_LINE;
            }
        });
    }

    // Recommended tests
    if (report.recommendedTests && report.recommendedTests.length > 0) {
        y += 2;
        addSectionTitle("Qo'shimcha Tekshiruvlar");
        const tests = report.recommendedTests.slice(0, 5);
        const testStr = (t: unknown): string => {
            if (typeof t === 'string') return t;
            if (t && typeof t === 'object') {
                const o = t as Record<string, unknown>;
                return [o.testName ?? o.name ?? o.test, o.reason].filter(Boolean).map(String).join(' - ') || '';
            }
            return '';
        };
        tests.forEach(test => {
            addBullet(testStr(test));
        });
    }

    // Adverse events (compact)
    if (report.adverseEventRisks && report.adverseEventRisks.length > 0) {
        y += 2;
        addSectionTitle("Nojo'ya Ta'sir Xavfi");
        const risks = report.adverseEventRisks.slice(0, 3);
        risks.forEach(risk => {
            doc.setFontSize(8);
            doc.setFont(PDF_FONT, 'normal');
            doc.setTextColor(40, 40, 40);
            doc.text(`\u2022 ${risk.drug}: ${risk.risk} (~${Math.round(risk.probability * 100)}%)`, MARGIN + 2, y);
            y += COMPACT_LINE;
        });
    }

    // Rejected hypotheses
    if (report.rejectedHypotheses && report.rejectedHypotheses.length > 0) {
        y += 2;
        addSectionTitle("Rad Etilgan Gipotezalar");
        const hypotheses = report.rejectedHypotheses.slice(0, 3);
        hypotheses.forEach(hyp => {
            doc.setFontSize(8);
            doc.setFont(PDF_FONT, 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`\u2022 ${hyp.name}: ${hyp.reason}`, MARGIN + 2, y);
            y += COMPACT_LINE;
        });
    }

    // Legislative note
    if (report.uzbekistanLegislativeNote) {
        y += 3;
        doc.setFillColor(250, 250, 245);
        doc.rect(MARGIN, y, pageWidth - MARGIN * 2, 8, 'F');
        doc.setFontSize(7);
        doc.setFont(PDF_FONT, 'italic');
        doc.setTextColor(100, 100, 80);
        const noteSplit = doc.splitTextToSize(report.uzbekistanLegislativeNote, pageWidth - MARGIN * 2 - 6);
        doc.text(noteSplit[0] || '', MARGIN + 3, y + 5);
        y += 10;
    }

    // === FOOTER WITH PLATFORM PROMO ===
    const footerText = report.uzbekistanLegislativeNote
        ? `O'zbekiston Respublikasi SSV protokollariga muvofiq. Faqat ma'lumot uchun.`
        : `Raqamli tizim yordamida shakllantirilgan. Faqat ma'lumot uchun.`;
    
    const pageCount = (doc.internal as unknown as jsPDFInternal).pages.length;
    
    // Platform promo text for last page
    const promoText = "AI Tibbiy Konsilium Platformasi - MedoraAI";
    const promoLink = "medora.cdcgroup.uz";
    const promoPhone = "+998 99 575 11 11";
    const promoPhone2 = "+998 90 786 38 88";
    
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Regular footer line
        drawLine(pageHeight - FOOTER_RESERVE - 2, [200, 200, 200]);
        doc.setFontSize(7);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(footerText, MARGIN, pageHeight - 5);
        doc.text(`Sahifa ${i}/${pageCount}`, pageWidth - MARGIN, pageHeight - 5, { align: 'right' });
    }
    
    // === PLATFORM PROMO SECTION (on last page) ===
    doc.setPage(pageCount);
    const promoY = pageHeight - FOOTER_RESERVE - 18;
    
    // Draw promo background box (taller to fit 3 rows)
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN, promoY - 2, pageWidth - MARGIN * 2, 16, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, promoY - 2, pageWidth - MARGIN * 2, 16, 'S');
    
    // Row 1: Platform name + link
    doc.setFontSize(7);
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(50, 60, 80);
    doc.text(promoText, MARGIN + 3, promoY + 2);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(30, 100, 180);
    doc.text(promoLink, MARGIN + 70, promoY + 2);
    
    // Row 2: Two phone numbers
    doc.setTextColor(60, 60, 60);
    doc.setFont(PDF_FONT, 'normal');
    doc.text(`Tel: ${promoPhone}  |  ${promoPhone2}`, MARGIN + 3, promoY + 6);
    
    // Row 3: Institute website
    doc.setFont(PDF_FONT, 'italic');
    doc.setTextColor(30, 100, 180);
    doc.text('www.fjsti.uz', MARGIN + 3, promoY + 10);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text("  — Farg'ona jamoat salomatligi tibbiyot instituti rasmiy sayti", MARGIN + 20, promoY + 10);
    
    // Institute logo (small)
    const logoSize = 10;
    const logoX = pageWidth - MARGIN - logoSize - 3;
    const logoY = promoY;
    if (branding?.instituteLogoDataUrl) {
        try {
            doc.addImage(branding.instituteLogoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
        } catch { /* ignore */ }
    }
    
    // Institute name small
    doc.setFontSize(5);
    doc.setTextColor(100, 100, 100);
    doc.text("Farg'ona JSTI", logoX - 25, promoY + 4);
    doc.text("(AiDoktor)", logoX - 25, promoY + 7);

    doc.save(`Konsilium_${patientData.lastName}_${patientData.firstName}.pdf`);
};
