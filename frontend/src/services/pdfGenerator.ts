import { jsPDF } from "jspdf";
import type { FinalReport, PatientData, ChatMessage } from '../types';
import { AI_SPECIALISTS } from "../constants";

// Extend jsPDF internal type for pages property
interface jsPDFInternal {
    pages: unknown[];
    pageSize: {
        height: number;
        width: number;
    };
}

export const generatePdfReport = (
    report: FinalReport, 
    patientData: PatientData, 
    debateHistory: ChatMessage[]
) => {
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
                    doc.text('•', margin, y);
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
    
    // --- Main Report Sections ---
    addHeader("Konsilium Konsensusi");

    addSectionTitle("Eng Ehtimolli Tashxis(lar)");
    report.consensusDiagnosis.forEach(diag => {
        addKeyValue("Tashxis", `${diag.name} (${diag.probability}%)`);
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
    report.treatmentPlan.forEach(step => addText(step, true));
    
    y += 5;
    addSectionTitle("Dori-Darmonlar bo'yicha Tavsiyalar");
    report.medicationRecommendations.forEach(med => {
        addKeyValue("Nomi", med.name);
        addKeyValue("Doza", med.dosage);
        addKeyValue("Izoh", med.notes);
        y += 3;
    });

    if(report.unexpectedFindings) {
        y += 5;
        addSectionTitle("Kutilmagan Bog'liqliklar va Gipotezalar");
        addText(report.unexpectedFindings);
    }
    
    y += 5;
    addSectionTitle("Inkor Etilgan Gipotezalar");
    report.rejectedHypotheses.forEach(hyp => {
        addKeyValue("Gipoteza", hyp.name);
        addKeyValue("Rad etish sababi", hyp.reason);
        y+= 3;
    });

    y += 5;
    addSectionTitle("Tavsiya Etiladigan Qo'shimcha Tekshiruvlar");
    report.recommendedTests.forEach(test => addText(test, true));

    if (report.uzbekistanLegislativeNote) {
        y += 5;
        addSectionTitle("Qonuniy eslatma");
        addText(report.uzbekistanLegislativeNote);
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
            const authorName = AI_SPECIALISTS[item.author]?.name || 'Foydalanuvchi';
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