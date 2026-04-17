import { jsPDF } from "jspdf";
import QRCode from 'qrcode';
import type { FinalReport, PatientData, UziUttReport } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import { PLATFORM_PUBLIC_URL, PLATFORM_WEBSITE } from '../constants/brand';

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
export interface InstituteBranding {
    instituteName?: string;
    instituteLogoDataUrl?: string;
}

export const generatePdfReport = async (
    report: FinalReport,
    patientData: PatientData,
    branding?: InstituteBranding,
    t?: (key: string) => string
) => {
    // Translation helper - returns key if translation not found
    const tr = (key: string, fallback: string): string => {
        if (t) {
            const translated = t(key);
            // If translation equals key (not found), use fallback
            return translated === key ? fallback : translated;
        }
        return fallback;
    };
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let y = MARGIN;

    // Generate QR code for platform
    let qrDataUrl = '';
    try {
        qrDataUrl = await QRCode.toDataURL(PLATFORM_PUBLIC_URL, { 
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
    doc.text(tr('pdf_title', "KONSILIUM: Yakuniy Klinik Xulosa"), MARGIN, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(tr('pdf_subtitle', "Rasmiy tibbiy maslahat hujjati - doktor tavsiyasi sifatida. Faqat ma'lumot uchun."), MARGIN, y);
    const reportDate = new Date();
    const dateStr = reportDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Sana: ${dateStr}`, pageWidth - MARGIN - qrSize - 5, y, { align: 'right' });
    
    // QR code label (positioned below QR code)
    if (qrDataUrl) {
        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        doc.text('Skannerlang →', qrX + qrSize/2, qrY + qrSize + 2, { align: 'center' });
        doc.text(PLATFORM_WEBSITE, qrX + qrSize/2, qrY + qrSize + 5, { align: 'center' });
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
    doc.text(tr('pdf_patient_info', "BEMOR MA'LUMOTLARI"), MARGIN + 2, y + 4);
    y += rowHeight;

    // Row 1: Name, Age, Gender
    doc.setDrawColor(230, 230, 230);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    const fullName = `${patientData.lastName} ${patientData.firstName}`.trim() + (patientData.fatherName ? ` ${patientData.fatherName}` : '');
    const gender = patientData.gender === 'male' ? 'Erkak' : patientData.gender === 'female' ? 'Ayol' : 'Boshqa';
    
    doc.setFontSize(9);
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(tr('pdf_patient', "Bemor:") + ' ', MARGIN + 2, y + 4);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(fullName, MARGIN + 20, y + 4);
    
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(tr('pdf_age', "Yoshi:") + ' ', MARGIN + col1Width + col2Width + 2, y + 4);
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
        doc.text(tr('pdf_objective', "Ob'ektiv:") + ' ', MARGIN + 2, y + 4);
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
        doc.text(tr('pdf_complaints', "Shikoyat:") + ' ', MARGIN + 2, y + 4);
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
        doc.text(tr('pdf_lab', "Lab:") + ' ', MARGIN + 2, y + 4);
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
        if (y > pageHeight - 50) {
            doc.addPage();
            y = MARGIN;
        }
        // Increase box height to fit two lines
        doc.setFillColor(255, 245, 245);
        doc.rect(MARGIN, y, pageWidth - MARGIN * 2, 16, 'F');
        doc.setDrawColor(220, 100, 100);
        doc.setLineWidth(0.5);
        doc.rect(MARGIN, y, pageWidth - MARGIN * 2, 16, 'S');
        doc.setFontSize(8);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(180, 50, 50);
        doc.text(tr('pdf_critical_finding', "Muhim topilma (Shoshilinch):"), MARGIN + 3, y + 4);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(80, 40, 40);
        const cfText = (report.criticalFinding.finding + ' - ' + report.criticalFinding.implication).substring(0, 120);
        const cfSplit = doc.splitTextToSize(cfText, pageWidth - MARGIN * 2 - 6);
        doc.text(cfSplit[0] || '', MARGIN + 3, y + 9);
        if (cfSplit[1]) {
            doc.text(cfSplit[1], MARGIN + 3, y + 13);
        }
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(180, 50, 50);
        doc.text(`${tr('pdf_urgency', 'Shoshilinchlik')}: ${report.criticalFinding.urgency}`, pageWidth - MARGIN - 3, y + 13, { align: 'right' });
        y += 20;
    }

    // === CONSENSUS SECTION ===
    addHeader(tr('pdf_consensus', "Konsilium Konsensusi"));

    // Diagnoses in compact table format
    addSectionTitle(tr('pdf_diagnoses', "Tashxislar"));
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
        addSectionTitle(tr('pdf_treatment_plan', "Davolash Rejasi"));
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
        addSectionTitle(tr('pdf_medications', "Dori Tavsiyalari"));
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

    // Folk medicine (adjunct, traditional herbs)
    const fm = report.folkMedicine;
    if (fm && (fm.items?.length || fm.intro?.trim() || fm.disclaimer?.trim())) {
        y += 2;
        addSectionTitle(tr('pdf_folk_medicine', "Xalq tabobati (qo'shimcha)"));
        doc.setFontSize(8);
        doc.setFont(PDF_FONT, 'italic');
        doc.setTextColor(100, 120, 100);
        const warn = tr('pdf_folk_medicine_note', "Rasmiy dori va shifokor ko'rsatmasi o'rnini bosmaydi.");
        doc.text(warn, MARGIN, y);
        y += COMPACT_LINE + 1;
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(40, 40, 40);
        if (fm.intro?.trim()) {
            const introLines = doc.splitTextToSize(fm.intro, pageWidth - MARGIN * 2);
            introLines.forEach((line: string) => {
                doc.text(line, MARGIN, y);
                y += COMPACT_LINE;
            });
            y += 1;
        }
        if (fm.disclaimer?.trim()) {
            doc.setFontSize(7);
            doc.setTextColor(90, 90, 90);
            const dLines = doc.splitTextToSize(fm.disclaimer, pageWidth - MARGIN * 2);
            dLines.forEach((line: string) => {
                doc.text(line, MARGIN, y);
                y += COMPACT_LINE;
            });
            y += 1;
            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
        }
        (fm.items || []).slice(0, 8).forEach(it => {
            doc.setFontSize(9);
            doc.setFont(PDF_FONT, 'bold');
            doc.setTextColor(30, 90, 50);
            doc.text('\u2022 ' + (it.plantName || ''), MARGIN + 2, y);
            y += COMPACT_LINE;
            doc.setFont(PDF_FONT, 'normal');
            doc.setTextColor(60, 60, 60);
            const parts = [it.plantPart, it.preparationOrUsage, it.traditionalContext, it.precautions]
                .filter(Boolean)
                .map(String);
            if (parts.length) {
                const block = doc.splitTextToSize(parts.join(' — '), pageWidth - MARGIN * 2 - 4);
                block.forEach((line: string) => {
                    doc.text(line, MARGIN + 6, y);
                    y += COMPACT_LINE;
                });
            }
        });
    }

    // Nutrition & prevention
    const np = report.nutritionPrevention;
    if (
        np &&
        ((np.dietaryGuidelines?.length ?? 0) > 0 ||
            (np.preventionMeasures?.length ?? 0) > 0 ||
            np.intro?.trim() ||
            np.disclaimer?.trim())
    ) {
        y += 2;
        addSectionTitle(
            tr('pdf_nutrition_prevention', "To'g'ri ovqatlanish va kasalliklarni oldini olish (profilaktika)"),
        );
        doc.setFontSize(8);
        doc.setFont(PDF_FONT, 'italic');
        doc.setTextColor(80, 100, 130);
        doc.text(tr('pdf_nutrition_note', "Umumiy tavsiya; individual parhez uchun mutaxassis bilan maslahat."), MARGIN, y);
        y += COMPACT_LINE + 1;
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(40, 40, 40);
        if (np.intro?.trim()) {
            const introLines = doc.splitTextToSize(np.intro, pageWidth - MARGIN * 2);
            introLines.forEach((line: string) => {
                doc.text(line, MARGIN, y);
                y += COMPACT_LINE;
            });
            y += 1;
        }
        if ((np.dietaryGuidelines?.length ?? 0) > 0) {
            doc.setFontSize(9);
            doc.setFont(PDF_FONT, 'bold');
            doc.setTextColor(30, 80, 120);
            doc.text(tr('pdf_dietary_guidelines', "To'g'ri ovqatlanish bo'yicha:"), MARGIN, y);
            y += COMPACT_LINE;
            doc.setFont(PDF_FONT, 'normal');
            doc.setTextColor(50, 50, 50);
            np.dietaryGuidelines.slice(0, 12).forEach((line) => {
                addBullet(line);
            });
        }
        if ((np.preventionMeasures?.length ?? 0) > 0) {
            y += 1;
            doc.setFontSize(9);
            doc.setFont(PDF_FONT, 'bold');
            doc.setTextColor(30, 80, 120);
            doc.text(tr('pdf_prevention_measures', 'Profilaktika va oldini olish:'), MARGIN, y);
            y += COMPACT_LINE;
            doc.setFont(PDF_FONT, 'normal');
            doc.setTextColor(50, 50, 50);
            np.preventionMeasures.slice(0, 12).forEach((line) => {
                addBullet(line);
            });
        }
        if (np.disclaimer?.trim()) {
            y += 1;
            doc.setFontSize(7);
            doc.setTextColor(90, 90, 90);
            const dLines = doc.splitTextToSize(np.disclaimer, pageWidth - MARGIN * 2);
            dLines.forEach((line: string) => {
                doc.text(line, MARGIN, y);
                y += COMPACT_LINE;
            });
            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
        }
    }

    // Recommended tests
    if (report.recommendedTests && report.recommendedTests.length > 0) {
        y += 2;
        addSectionTitle(tr('pdf_tests', "Qo'shimcha Tekshiruvlar"));
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
        addSectionTitle(tr('pdf_risks', "Nojo'ya Ta'sir Xavfi"));
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
        addSectionTitle(tr('pdf_rejected', "Rad Etilgan Gipotezalar"));
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
        ? tr('pdf_footer_legislative', "O'zbekiston Respublikasi SSV protokollariga muvofiq. Faqat ma'lumot uchun.")
        : tr('pdf_footer_general', "Raqamli tizim yordamida shakllantirilgan. Faqat ma'lumot uchun.");
    
    const pageCount = (doc.internal as unknown as jsPDFInternal).pages.length;
    
    // Platform promo text for last page
    const promoText = tr('pdf_promo_text', "AI Tibbiy Konsilium Platformasi - MedoraAI");
    const promoLink = PLATFORM_WEBSITE;
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
        doc.text(`${tr('pdf_page', 'Sahifa')} ${i}/${pageCount}`, pageWidth - MARGIN, pageHeight - 5, { align: 'right' });
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
    doc.text(`  — ${tr('pdf_institute_website', "Farg'ona jamoat salomatligi tibbiyot instituti rasmiy sayti")}`, MARGIN + 20, promoY + 10);
    
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
    doc.text(tr('pdf_institute_name', "Farg'ona JSTI"), logoX - 25, promoY + 4);
    doc.text(tr('pdf_platform_name', "(AiDoktor)"), logoX - 25, promoY + 7);

    doc.save(`Konsilium_${patientData.lastName}_${patientData.firstName}.pdf`);
};

/** UTT/UZI AI xulosasi — konsilium PDF bilan bir xil pastki qism va brending */
export const generateUziUttPdf = async (
    report: UziUttReport,
    branding?: InstituteBranding,
    t?: (key: string) => string,
) => {
    const tr = (key: string, fallback: string): string => {
        if (t) {
            const translated = t(key);
            return translated === key ? fallback : translated;
        }
        return fallback;
    };
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let y = MARGIN;
    const contentBottom = () => pageHeight - FOOTER_RESERVE - 24; // footer + promo hududi uchun joy qoldiramiz

    // Generate QR code for platform
    let qrDataUrl = '';
    try {
        qrDataUrl = await QRCode.toDataURL(PLATFORM_PUBLIC_URL, {
            width: 80,
            margin: 1,
            color: { dark: '#1e293b', light: '#ffffff' },
        });
    } catch {
        // ignore
    }

    const drawLine = (yPos: number, color: [number, number, number] = [200, 200, 200]) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, yPos, pageWidth - MARGIN, yPos);
    };

    const ensureSpace = (needed: number) => {
        if (y + needed > contentBottom()) {
            doc.addPage();
            y = MARGIN;
        }
    };

    const addParagraph = (label: string, body: string, fontSize = 9) => {
        ensureSpace(28);
        doc.setFontSize(10);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(50, 60, 80);
        doc.text(label, MARGIN, y);
        y += LINE_HEIGHT;
        doc.setFont(PDF_FONT, 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(body || '—', pageWidth - MARGIN * 2);
        for (const line of lines) {
            ensureSpace(LINE_HEIGHT + 2);
            doc.text(line, MARGIN, y);
            y += LINE_HEIGHT;
        }
        y += 3;
    };

    const addBulletList = (title: string, items: string[], limit = 10) => {
        ensureSpace(16);
        doc.setFontSize(10);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(50, 60, 80);
        doc.text(title, MARGIN, y);
        y += LINE_HEIGHT + 1;
        doc.setFont(PDF_FONT, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        const list = (items.length ? items : ['—']).slice(0, Math.max(1, limit));
        for (const item of list) {
            const wrapped = doc.splitTextToSize(`• ${item}`, pageWidth - MARGIN * 2 - 4);
            for (const line of wrapped) {
                ensureSpace(LINE_HEIGHT);
                doc.text(line, MARGIN + 2, y);
                y += LINE_HEIGHT - 0.5;
            }
        }
        y += 3;
    };

    const title = tr('pdf_uzi_utt_title', 'UZI / UTT: Tahlil va xulosa');
    const subtitle = tr('pdf_uzi_utt_subtitle', "Rasmiy tibbiy maslahat hujjati - faqat ma'lumot uchun. Doktor xulosasining o'rnini bosmaydi.");

    // === DOCUMENT HEADER (consilium-style) ===
    const qrSize = 20;
    const qrX = pageWidth - MARGIN - qrSize;
    const qrY = y - 2;
    if (qrDataUrl) {
        try {
            doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        } catch {
            /* ignore */
        }
    }

    // Optional institute logo on the left
    const headerLogoSize = 10;
    const headerLogoX = MARGIN;
    const headerLogoY = y - 1;
    const headerTextX = branding?.instituteLogoDataUrl ? MARGIN + headerLogoSize + 3 : MARGIN;
    if (branding?.instituteLogoDataUrl) {
        try {
            doc.addImage(branding.instituteLogoDataUrl, 'PNG', headerLogoX, headerLogoY, headerLogoSize, headerLogoSize);
        } catch {
            /* ignore */
        }
    }

    doc.setFontSize(16);
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(title, headerTextX, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(100, 100, 100);
    const subLines = doc.splitTextToSize(subtitle, pageWidth - MARGIN * 2 - (branding?.instituteLogoDataUrl ? headerLogoSize + 3 : 0) - (qrSize + 6));
    doc.text(subLines[0] || '', headerTextX, y);

    const reportDate = new Date();
    const dateStr = reportDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Sana: ${dateStr}`, pageWidth - MARGIN - qrSize - 5, y, { align: 'right' });

    if (qrDataUrl) {
        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        doc.text('Skannerlang →', qrX + qrSize / 2, qrY + qrSize + 2, { align: 'center' });
        doc.text(PLATFORM_WEBSITE, qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
    }

    y = Math.max(y + 4, qrY + qrSize + 8);
    drawLine(y, [150, 150, 150]);
    y += 6;

    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    const urgLabel = tr('pdf_uzi_utt_urgency', 'Shoshilinchlik');
    doc.text(`${urgLabel}: ${report.urgencyLevel}`, MARGIN, y);
    y += 6;

    addParagraph(tr('pdf_uzi_utt_study_type', 'Tekshiruv turi'), report.studyType);
    addParagraph(tr('pdf_uzi_utt_region', 'Organ / soha'), report.regionOrOrgan);
    if (report.techniqueNotes) {
        addParagraph(tr('pdf_uzi_utt_technique', 'Texnika / izoh'), report.techniqueNotes);
    }
    addBulletList(tr('pdf_uzi_utt_findings', 'Asosiy topilmalar'), report.keyFindings, 10);
    if (report.measurements) {
        addParagraph(tr('pdf_uzi_utt_measurements', "O'lchamlar"), report.measurements);
    }
    addParagraph(tr('pdf_uzi_utt_impression', 'Impression'), report.impression);
    addParagraph(tr('pdf_uzi_utt_conclusion', 'Klinik xulosa'), report.clinicalConclusion);
    addBulletList(tr('pdf_uzi_utt_recommendations', 'Tavsiyalar'), report.recommendations, 8);
    if (report.differentialDiagnosis) {
        addParagraph(tr('pdf_uzi_utt_ddx', 'Farqlovchi tashxislar'), report.differentialDiagnosis);
    }
    if (report.limitations) {
        addParagraph(tr('pdf_uzi_utt_limitations', 'Cheklovlar'), report.limitations);
    }

    // Agar kontent promo hududiga juda yaqinlashsa, promo uchun alohida sahifa ochamiz
    if (y > contentBottom() - 6) {
        doc.addPage();
        y = MARGIN;
    }

    const footerText = tr('pdf_footer_general', "Raqamli tizim yordamida shakllantirilgan. Faqat ma'lumot uchun.");
    const pageCount = (doc.internal as unknown as jsPDFInternal).pages.length;
    const promoText = tr('pdf_promo_text', "AI Tibbiy Konsilium Platformasi - MedoraAI");
    const promoLink = PLATFORM_WEBSITE;
    const promoPhone = "+998 99 575 11 11";
    const promoPhone2 = "+998 90 786 38 88";

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawLine(pageHeight - FOOTER_RESERVE - 2, [200, 200, 200]);
        doc.setFontSize(7);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(footerText, MARGIN, pageHeight - 5);
        doc.text(`${tr('pdf_page', 'Sahifa')} ${i}/${pageCount}`, pageWidth - MARGIN, pageHeight - 5, { align: 'right' });
    }

    doc.setPage(pageCount);
    const promoY = pageHeight - FOOTER_RESERVE - 18;
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN, promoY - 2, pageWidth - MARGIN * 2, 16, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, promoY - 2, pageWidth - MARGIN * 2, 16, 'S');
    doc.setFontSize(7);
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(50, 60, 80);
    doc.text(promoText, MARGIN + 3, promoY + 2);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(30, 100, 180);
    doc.text(promoLink, MARGIN + 70, promoY + 2);
    doc.setTextColor(60, 60, 60);
    doc.text(`Tel: ${promoPhone}  |  ${promoPhone2}`, MARGIN + 3, promoY + 6);
    doc.setFont(PDF_FONT, 'italic');
    doc.setTextColor(30, 100, 180);
    doc.text('www.fjsti.uz', MARGIN + 3, promoY + 10);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`  — ${tr('pdf_institute_website', "Farg'ona jamoat salomatligi tibbiyot instituti rasmiy sayti")}`, MARGIN + 20, promoY + 10);
    const logoSize = 10;
    const logoX = pageWidth - MARGIN - logoSize - 3;
    const logoY = promoY;
    if (branding?.instituteLogoDataUrl) {
        try {
            doc.addImage(branding.instituteLogoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
        } catch { /* ignore */ }
    }
    doc.setFontSize(5);
    doc.setTextColor(100, 100, 100);
    doc.text(tr('pdf_institute_name', "Farg'ona JSTI"), logoX - 25, logoY + 4);
    doc.text(tr('pdf_platform_name', "(AiDoktor)"), logoX - 25, logoY + 7);

    const stamp = new Date().toISOString().slice(0, 19).replace('T', '_');
    doc.save(`UTT_UZI_tahlil_${stamp}.pdf`);
};
