import { jsPDF } from "jspdf";
import type { FinalReport, PatientData, ChatMessage } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import { AI_SPECIALISTS } from "../constants";

// Extend jsPDF internal type for pages property
interface jsPDFInternal {
    pages: unknown[];
    pageSize: {
        height: number;
        width: number;
    };
}

/** Optional: author key -> display name (e.g. translated) for PDF */
export type SpecialistNameResolver = (author: string) => string;

const PDF_FONT = 'times' as const; // Times New Roman — haqiqiy hujjat uslubi
const LINE_HEIGHT = 7;
const FOOTER_RESERVE = 16;

/** Optional institute branding for document header */
export interface InstituteBranding {
    instituteName?: string;
    instituteLogoDataUrl?: string;
}

export const generatePdfReport = (
    report: FinalReport,
    patientData: PatientData,
    debateHistory: ChatMessage[],
    getSpecialistName?: SpecialistNameResolver,
    branding?: InstituteBranding
) => {
    const specialistName = (author: string): string =>
        getSpecialistName ? getSpecialistName(author) : (AI_SPECIALISTS[author]?.name || author);
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 18;
    let y = margin;

    const addHeader = (text: string) => {
        if (y > pageHeight - 50) {
            doc.addPage();
            y = margin;
        }
        doc.setFontSize(18);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(text, margin, y);
        y += LINE_HEIGHT + 1;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += LINE_HEIGHT + 2;
    };

    const addSectionTitle = (text: string) => {
        if (y > pageHeight - 50) {
            doc.addPage();
            y = margin;
        }
        y += 2;
        doc.setFontSize(14);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(text, margin, y);
        y += LINE_HEIGHT + 1;
    };

    const addText = (text: string, isListItem = false) => {
        doc.setFontSize(11);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(40, 40, 40);
        const textToSplit = text || 'N/A';
        const splitText = doc.splitTextToSize(textToSplit, pageWidth - margin * 2 - (isListItem ? 8 : 0));
        splitText.forEach((line: string, index: number) => {
            if (y > pageHeight - margin - FOOTER_RESERVE) {
                doc.addPage();
                y = margin;
            }
            let lineX = margin;
            if (isListItem) {
                lineX += 6;
                if (index === 0) doc.text('\u00B7', margin, y);
            }
            doc.text(line, lineX, y);
            y += LINE_HEIGHT;
        });
        y += 4;
    };

    const addKeyValue = (key: string, value: string | undefined | null) => {
        if (!value) return;
        const keyString = `${key}:`;
        doc.setFontSize(11);
        doc.setFont(PDF_FONT, 'bold');
        doc.setTextColor(40, 40, 40);
        const keyWidth = doc.getTextWidth(keyString) + 4;
        doc.setFont(PDF_FONT, 'normal');
        const splitValue = doc.splitTextToSize(value, pageWidth - margin - keyWidth - margin);
        const requiredHeight = splitValue.length * LINE_HEIGHT;
        if (y + requiredHeight > pageHeight - margin - FOOTER_RESERVE) {
            doc.addPage();
            y = margin;
        }
        doc.setFont(PDF_FONT, 'bold');
        doc.text(keyString, margin, y);
        doc.setFont(PDF_FONT, 'normal');
        splitValue.forEach((line: string, i: number) => {
            doc.text(line, margin + keyWidth, y + i * LINE_HEIGHT);
        });
        y += requiredHeight + 6;
    };

    // --- Page 1: Title and Patient Info (rasmiy hujjat uslubi) ---
    addHeader("KONSILIUM: Yakuniy Klinik Xulosa");
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Rasmiy tibbiy maslahat hujjati - doktor tavsiyasi sifatida. Faqat ma'lumot uchun.", margin, y);
    y += LINE_HEIGHT - 1;
    const reportDate = new Date();
    const dateStr = reportDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Hisobot sanasi: ${dateStr}`, margin, y);
    y += LINE_HEIGHT + 3;

    addSectionTitle("Bemor Ma'lumotlari");
    addKeyValue("Bemor", `${patientData.firstName} ${patientData.lastName}`);
    addKeyValue("Yoshi", patientData.age);
    addKeyValue("Jinsi", patientData.gender === 'male' ? 'Erkak' : patientData.gender === 'female' ? 'Ayol' : 'Boshqa');
    y += 3;
    addKeyValue("Shikoyatlar va Anamnez", patientData.complaints);
    y += 3;
    addKeyValue("Kasallik Tarixi", patientData.history);
    y += 3;
    addKeyValue("Ob'ektiv Ko'rik", patientData.objectiveData);
    y += 3;
    addKeyValue("Laborator Tahlillar", patientData.labResults);
    
    // --- Critical Finding (if any) ---
    if (report.criticalFinding && report.criticalFinding.finding) {
        addHeader("Muhim topilma (shoshilinch)");
        addKeyValue("Topilma", report.criticalFinding.finding);
        addKeyValue("Oqibat", report.criticalFinding.implication);
        addKeyValue("Shoshilinchlik", report.criticalFinding.urgency);
        y += 10;
    }

    // --- Main Report Sections ---
    addHeader("Konsilium Konsensusi");

    addSectionTitle("Eng Ehtimolli Tashxis(lar)");
    normalizeConsensusDiagnosis(report.consensusDiagnosis).slice(0, 5).forEach(diag => {
        const pct = Number.isFinite(diag.probability) ? `${diag.probability}%` : '-';
        addKeyValue("Tashxis", `${diag.name} (${pct})`);
        addKeyValue("Dalillilik Darajasi", diag.evidenceLevel || "N/A");
        addKeyValue("Asoslash", diag.justification);
        y += 3;
    });
    
    if (report.adverseEventRisks && report.adverseEventRisks.length > 0) {
        addSectionTitle("Dori vositalarining nojo'ya ta'sir xavfi");
        report.adverseEventRisks.slice(0, 6).forEach(risk => {
            addKeyValue("Dori", risk.drug);
            addKeyValue("Xavf", `${risk.risk} (ehtimollik ~${Math.round(risk.probability * 100)}%)`);
            y += 3;
        });
        y += 3;
    }

    addSectionTitle("Tavsiya Etilgan Davolash Rejasi");
    (Array.isArray(report.treatmentPlan) ? report.treatmentPlan.slice(0, 10) : []).forEach(step => {
        const s = typeof step === 'string' ? step : (typeof step === 'object' && step !== null ? Object.values(step as Record<string, unknown>).filter(Boolean).join(' - ') : String(step ?? ''));
        addText(s, true);
    });
    
    y += 3;
    addSectionTitle("Dori-Darmonlar bo'yicha Tavsiyalar");
    (Array.isArray(report.medicationRecommendations) ? report.medicationRecommendations.slice(0, 10) : []).forEach(med => {
        addKeyValue("Nomi", med.name);
        addKeyValue("Doza", med.dosage);
        addKeyValue("Izoh", med.notes);
        y += 2;
    });

    if (report.unexpectedFindings) {
        y += 3;
        addSectionTitle("Kutilmagan Bog'liqliklar va Gipotezalar");
        addText(report.unexpectedFindings);
    }
    
    y += 3;
    addSectionTitle("Inkor Etilgan Gipotezalar");
    (Array.isArray(report.rejectedHypotheses) ? report.rejectedHypotheses.slice(0, 5) : []).forEach(hyp => {
        addKeyValue("Gipoteza", hyp.name);
        addKeyValue("Rad etish sababi", hyp.reason);
        y += 2;
    });

    y += 3;
    const recommendedTestStr = (t: unknown): string => {
        if (typeof t === 'string') return t;
        if (t && typeof t === 'object') {
            const o = t as Record<string, unknown>;
            return [o.testName ?? o.name ?? o.test, o.reason, o.urgency].filter(Boolean).map(String).join(' - ') || JSON.stringify(t);
        }
        return String(t ?? '');
    };
    addSectionTitle("Tavsiya Etiladigan Qo'shimcha Tekshiruvlar");
    (Array.isArray(report.recommendedTests) ? report.recommendedTests.slice(0, 10) : []).forEach(test => addText(recommendedTestStr(test), true));

    if (report.uzbekistanLegislativeNote) {
        y += 5;
        addSectionTitle("Qonuniy eslatma");
        addText(report.uzbekistanLegislativeNote);
    }

    // --- Har bir mutaxassisning yakuniy shaxsiy xulosasi (hujjat bo'limi) ---
    // Har bir mutaxassisning faqat eng so'nggi va eng qisqa asosiy xulosasini ko'rsatamiz (PDF ni 2–3 sahifadan oshirmaslik uchun).
    const specialistMessages = debateHistory.filter((m: ChatMessage) => !m.isSystemMessage && !m.isUserIntervention);
    const lastByAuthor = new Map<string, ChatMessage>();
    specialistMessages.forEach((m: ChatMessage) => lastByAuthor.set(m.author, m));
    if (lastByAuthor.size > 0) {
        if (y > pageHeight - 60) {
            doc.addPage();
            y = margin;
        } else {
            y += 10;
        }
        addHeader("Har bir mutaxassisning yakuniy shaxsiy xulosasi");
        doc.setFontSize(10);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text("Konsilium ishtirokchilarining tibbiy xulosalari. Har bir mutaxassis o'z so'nggi xulosasini keltiradi (doktor tavsiyasi sifatida).", margin, y);
        y += LINE_HEIGHT + 4;
        const stripSalutation = (text: string) =>
            text.replace(/^\s*Hurmatli\s+Kengash\s+Raisi\s*,?\s*/i, '').trim();
        Array.from(lastByAuthor.entries()).slice(0, 6).forEach(([author, msg]) => {
            const authorName = specialistName(author);
            if (y > pageHeight - 60) {
                doc.addPage();
                y = margin;
            }
            doc.setFontSize(11);
            doc.setFont(PDF_FONT, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(authorName, margin, y);
            y += LINE_HEIGHT;
            doc.setFont(PDF_FONT, 'normal');
            doc.setTextColor(40, 40, 40);
            const rawContent = String(msg.content || '');
            // Juda uzun xulosalarni 600 belgigacha qisqartiramiz (hujjatni ixcham saqlash uchun).
            const trimmedContent = stripSalutation(rawContent).slice(0, 600);
            const contentLines = doc.splitTextToSize(trimmedContent, pageWidth - margin * 2);
            contentLines.forEach((line: string) => {
                if (y > pageHeight - margin - FOOTER_RESERVE) {
                    doc.addPage();
                    y = margin;
                }
                doc.text(line, margin, y);
                y += LINE_HEIGHT;
            });
            y += 5;
        });
        y += 8;
    }

    // Konsilium munozara tarixining to'liq matnini PDF ga kiritmaymiz, faqat yuqoridagi yakuniy xulosalar va asosiy bo'limlar qoldiriladi.

    const footerText = report.uzbekistanLegislativeNote
        ? `O'zbekiston Respublikasi sog'liqni saqlash qonunchiligi va SSV klinik protokollariga muvofiq shakllantirilgan va faqat ma'lumot uchun mo'ljallangan. U professional tibbiy maslahat o'rnini bosa olmaydi.`
        : `Ushbu hisobot ilg'or raqamli tizim yordamida shakllantirilgan, faqat ma'lumot va doktor tavsiyasi sifatida mo'ljallangan. U professional tibbiy maslahat o'rnini bosa olmaydi.`;
    const pageCount = (doc.internal as unknown as jsPDFInternal).pages.length;
    const footerLineHeight = 5;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(90, 90, 90);
        const splitFooter = doc.splitTextToSize(footerText, pageWidth - margin * 2);
        const footerY = pageHeight - 12 - (splitFooter.length * footerLineHeight);
        splitFooter.forEach((line: string, idx: number) => {
            doc.text(line, margin, footerY + idx * footerLineHeight);
        });
        doc.text(`Sahifa ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    // --- Save the PDF ---
    doc.save(`Tibbiy_Xulosa_${patientData.lastName}_${patientData.firstName}.pdf`);
};

/**
 * Generates a single specialist conclusion as a PDF (for "Har bir mutaxassisning yakuniy xulosasi").
 */
export const generateSpecialistConclusionPdf = (
    specialistDisplayName: string,
    content: string,
    branding?: InstituteBranding,
    fileName?: string
) => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 18;
    let y = margin;

    // Institute branding (logo + name)
    if (branding?.instituteName || branding?.instituteLogoDataUrl) {
        const logoSize = 16;
        if (branding.instituteLogoDataUrl) {
            try {
                const imgData = branding.instituteLogoDataUrl.includes('base64,')
                    ? branding.instituteLogoDataUrl.split(',')[1]
                    : branding.instituteLogoDataUrl;
                if (imgData) doc.addImage(imgData, 'PNG', margin, y, logoSize, logoSize);
            } catch {
                // ignore
            }
        }
        if (branding.instituteName) {
            doc.setFontSize(11);
            doc.setFont(PDF_FONT, 'bold');
            doc.setTextColor(30, 41, 59);
            const nameX = branding.instituteLogoDataUrl ? margin + logoSize + 6 : margin;
            doc.text(branding.instituteName, nameX, y + (branding.instituteLogoDataUrl ? logoSize / 2 + 3 : 4));
        }
        y += (branding.instituteLogoDataUrl ? logoSize : LINE_HEIGHT) + 6;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += LINE_HEIGHT + 6;
    }

    // Title
    doc.setFontSize(16);
    doc.setFont(PDF_FONT, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text("Mutaxassisning yakuniy xulosasi", margin, y);
    y += LINE_HEIGHT + 2;
    doc.setFontSize(12);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(specialistDisplayName, margin, y);
    y += LINE_HEIGHT + 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += LINE_HEIGHT + 6;

    // Content
    doc.setFontSize(11);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(40, 40, 40);
    const textToSplit = content || '-';
    const splitText = doc.splitTextToSize(textToSplit, pageWidth - margin * 2);
    splitText.forEach((line: string) => {
        if (y > pageHeight - margin - FOOTER_RESERVE) {
            doc.addPage();
            y = margin;
        }
        doc.text(line, margin, y);
        y += LINE_HEIGHT;
    });

    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Tibbiy maslahat hujjati - faqat ma'lumot uchun. Professional tibbiy maslahat o'rnini bosa olmaydi.", margin, pageHeight - 14);

    const name = (fileName || specialistDisplayName).replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '');
    doc.save(`${name}_xulosa.pdf`);
};