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

export const generatePdfReport = (
    report: FinalReport,
    patientData: PatientData,
    debateHistory: ChatMessage[],
    getSpecialistName?: SpecialistNameResolver
) => {
    const specialistName = (author: string): string =>
        getSpecialistName ? getSpecialistName(author) : (AI_SPECIALISTS[author]?.name || author);
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    let y = margin;

    // --- Helper Functions ---
    const addHeader = (text: string) => {
        if (y > pageHeight - 40) {
            doc.addPage();
            y = margin;
        }
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text(text, margin, y);
        y += 8;
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
    };

    const addSectionTitle = (text: string) => {
        if (y > pageHeight - 40) {
            doc.addPage();
            y = margin;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235); // blue-600
        doc.text(text, margin, y);
        y += 7;
    };

    const addText = (text: string, isListItem = false) => {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85); // slate-700
        
        const textToSplit = text || 'N/A';
        const splitText = doc.splitTextToSize(textToSplit, pageWidth - margin * 2 - (isListItem ? 5 : 0));
        
        splitText.forEach((line: string, index: number) => {
            if (y > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            let lineX = margin;
            if (isListItem) {
                lineX += 5;
                if (index === 0) {
                    doc.text('\u00B7', margin, y);
                }
            }
            doc.text(line, lineX, y);
            y += 6;
        });
        y += (isListItem ? 2 : 4);
    };
    
    const addKeyValue = (key: string, value: string | undefined | null) => {
        if (!value) return;
        
        const keyString = `${key}:`;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85); // slate-700
        const keyWidth = doc.getTextWidth(keyString) + 2;

        doc.setFont('helvetica', 'normal');
        const splitValue = doc.splitTextToSize(value, pageWidth - (margin + keyWidth) - margin);

        const requiredHeight = splitValue.length * 6;
        if (y + requiredHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }

        doc.setFont('helvetica', 'bold');
        doc.text(keyString, margin, y);

        doc.setFont('helvetica', 'normal');
        doc.text(splitValue, margin + keyWidth, y);
        y += requiredHeight + 4;
    };
    
    // --- Page 1: Title and Patient Info ---
    addHeader("KONSILIUM: Yakuniy Klinik Xulosa");

    addSectionTitle("Bemor Ma'lumotlari");
    addKeyValue("Bemor", `${patientData.firstName} ${patientData.lastName}`);
    addKeyValue("Yoshi", patientData.age);
    addKeyValue("Jinsi", patientData.gender === 'male' ? 'Erkak' : patientData.gender === 'female' ? 'Ayol' : 'Boshqa');
    y += 5;
    addKeyValue("Shikoyatlar va Anamnez", patientData.complaints);
    y += 5;
    addKeyValue("Kasallik Tarixi", patientData.history);
    y += 5;
    addKeyValue("Ob'ektiv Ko'rik", patientData.objectiveData);
    y += 5;
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
    normalizeConsensusDiagnosis(report.consensusDiagnosis).forEach(diag => {
        const pct = Number.isFinite(diag.probability) ? `${diag.probability}%` : '—';
        addKeyValue("Tashxis", `${diag.name} (${pct})`);
        addKeyValue("Dalillilik Darajasi", diag.evidenceLevel || "N/A");
        addKeyValue("Asoslash", diag.justification);
        y += 5;
    });
    
    if (report.adverseEventRisks && report.adverseEventRisks.length > 0) {
        addSectionTitle("Dori vositalarining nojo'ya ta'sir xavfi");
        report.adverseEventRisks.forEach(risk => {
            addKeyValue("Dori", risk.drug);
            addKeyValue("Xavf", `${risk.risk} (ehtimollik ~${Math.round(risk.probability * 100)}%)`);
            y += 3;
        });
        y += 5;
    }

    addSectionTitle("Tavsiya Etilgan Davolash Rejasi");
    (Array.isArray(report.treatmentPlan) ? report.treatmentPlan : []).forEach(step => {
        const s = typeof step === 'string' ? step : (typeof step === 'object' && step !== null ? Object.values(step as Record<string, unknown>).filter(Boolean).join(' - ') : String(step ?? ''));
        addText(s, true);
    });
    
    y += 5;
    addSectionTitle("Dori-Darmonlar bo'yicha Tavsiyalar");
    (Array.isArray(report.medicationRecommendations) ? report.medicationRecommendations : []).forEach(med => {
        addKeyValue("Nomi", med.name);
        addKeyValue("Doza", med.dosage);
        addKeyValue("Izoh", med.notes);
        y += 3;
    });

    if (report.unexpectedFindings) {
        y += 5;
        addSectionTitle("Kutilmagan Bog'liqliklar va Gipotezalar");
        addText(report.unexpectedFindings);
    }
    
    y += 5;
    addSectionTitle("Inkor Etilgan Gipotezalar");
    (Array.isArray(report.rejectedHypotheses) ? report.rejectedHypotheses : []).forEach(hyp => {
        addKeyValue("Gipoteza", hyp.name);
        addKeyValue("Rad etish sababi", hyp.reason);
        y += 3;
    });

    y += 5;
    addSectionTitle("Tavsiya Etiladigan Qo'shimcha Tekshiruvlar");
    (Array.isArray(report.recommendedTests) ? report.recommendedTests : []).forEach(test => addText(test, true));

    if (report.uzbekistanLegislativeNote) {
        y += 5;
        addSectionTitle("Qonuniy eslatma");
        addText(report.uzbekistanLegislativeNote);
    }

    // --- Har bir mutaxassisning yakuniy shaxsiy xulosasi (hujjat bo'limi) ---
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
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text("Konsilium ishtirokchilarining tibbiy xulosalari. Har bir mutaxassis o'z so'nggi xulosasini keltiradi.", margin, y);
        y += 8;
        const stripSalutation = (text: string) =>
            text.replace(/^\s*Hurmatli\s+Kengash\s+Raisi\s*,?\s*/i, '').trim();
        lastByAuthor.forEach((msg, author) => {
            const authorName = specialistName(author);
            if (y > pageHeight - 50) {
                doc.addPage();
                y = margin;
            }
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(authorName, margin, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            const rawContent = String(msg.content || '');
            const contentLines = doc.splitTextToSize(stripSalutation(rawContent), pageWidth - margin * 2);
            contentLines.forEach((line: string) => {
                if (y > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
                doc.text(line, margin, y);
                y += 6;
            });
            y += 6;
        });
        y += 10;
    }

    // --- Consultation History Section ---
    if (debateHistory.length > 0) {
        if (y > pageHeight - 60) {
             doc.addPage();
             y = margin;
        } else {
            y += 10;
        }
        addHeader("Konsilium Munozara Tarixi");
        
        debateHistory.forEach(item => {
            if (item.isSystemMessage || item.isUserIntervention) {
                return;
            }
            if (y > pageHeight - 40) {
                doc.addPage();
                y = margin;
            }
            const authorName = item.author ? specialistName(item.author) : 'Foydalanuvchi';
            addKeyValue(authorName, item.content);
            y += 2;
        });
    }

    // --- Footer ---
    const pageCount = (doc.internal as unknown as jsPDFInternal).pages.length;
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175); // gray-400
        const footerText = report.uzbekistanLegislativeNote
            ? `O'zbekiston Respublikasi sog'liqni saqlash qonunchiligi va SSV klinik protokollariga muvofiq. Ushbu hisobot ilg'or raqamli tizim yordamida shakllantirilgan va faqat ma'lumot uchun mo'ljallangan. U professional tibbiy maslahat o'rnini bosa olmaydi.`
            : `Ushbu hisobot ilg'or raqamli tizim yordamida shakllantirilgan va faqat ma'lumot uchun mo'ljallangan. U professional tibbiy maslahat o'rnini bosa olmaydi.`;
        const splitFooter = doc.splitTextToSize(footerText, pageWidth - margin*2);
        doc.text(splitFooter, margin, pageHeight - 10 - ((splitFooter.length -1) * 4));
        doc.text(`Sahifa ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    // --- Save the PDF ---
    doc.save(`Tibbiy_Xulosa_${patientData.lastName}_${patientData.firstName}.pdf`);
};