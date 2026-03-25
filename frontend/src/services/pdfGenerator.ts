import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { FinalReport, PatientData, ChatMessage } from '../types';
import { AI_SPECIALISTS } from "../constants";
import {
    LANDING_CONTACT_PHONE_DISPLAY,
    MEDORA_PLATFORM_URL,
    PDF_FOOTER_PROMO_LINE,
} from "../constants/platformBranding";
import { svgAssetToPngDataUrl } from "../utils/svgAssetToPngDataUrl";

export { MEDORA_PLATFORM_URL };

// Extend jsPDF internal type for pages property
interface jsPDFInternal {
    pages: unknown[];
    pageSize: {
        height: number;
        width: number;
    };
}

export const generatePdfReport = async (
    report: FinalReport,
    patientData: PatientData,
    debateHistory: ChatMessage[]
): Promise<void> => {
    let qrDataUrl: string | null = null;
    try {
        qrDataUrl = await QRCode.toDataURL(MEDORA_PLATFORM_URL, {
            width: 240,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#0f172a", light: "#ffffff" },
        });
    } catch {
        qrDataUrl = null;
    }

    const assetBase = import.meta.env.BASE_URL || "/";
    const uniLogoPng = await svgAssetToPngDataUrl(
        `${assetBase}branding/university-logo.svg`,
        220
    );

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    let y = margin;

    // --- Helper Functions ---
    const LINE_COMPACT = 4.8;
    const FONT_TABLE = 10;

    const addHeader = (text: string) => {
        if (y > pageHeight - 40) {
            doc.addPage();
            y = margin;
        }
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text(text, margin, y);
        y += 6;
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
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
        y += 5;
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
            y += 5;
        });
        y += (isListItem ? 1 : 2);
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

        const requiredHeight = splitValue.length * 5;
        if (y + requiredHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }

        doc.setFont('helvetica', 'bold');
        doc.text(keyString, margin, y);

        doc.setFont('helvetica', 'normal');
        doc.text(splitValue, margin + keyWidth, y);
        y += requiredHeight + 2;
    };

    /** Two-column bordered rows: saves vertical space vs stacked key/value blocks. */
    const addCompactTableRows = (rows: { label: string; value: string }[]) => {
        const tableW = pageWidth - margin * 2;
        const labelColW = 48;
        const pad = 2;
        const labelMaxW = labelColW - pad * 2;
        const valueMaxW = tableW - labelColW - pad * 2;

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.15);

        rows.forEach((row) => {
            doc.setFontSize(FONT_TABLE);
            const labelLines = doc.splitTextToSize(`${row.label}:`, labelMaxW);
            const valueLines = doc.splitTextToSize(row.value || '—', valueMaxW);
            const innerH = Math.max(
                labelLines.length * LINE_COMPACT,
                valueLines.length * LINE_COMPACT
            );
            const rowH = Math.max(8, innerH + pad * 2);

            if (y + rowH > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }

            const x0 = margin;
            const y0 = y;
            const firstBaseline = y0 + 6.2;

            doc.line(x0, y0, x0 + tableW, y0);
            doc.line(x0, y0 + rowH, x0 + tableW, y0 + rowH);
            doc.line(x0, y0, x0, y0 + rowH);
            doc.line(x0 + tableW, y0, x0 + tableW, y0 + rowH);
            doc.line(x0 + labelColW, y0, x0 + labelColW, y0 + rowH);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            labelLines.forEach((ln, i) => {
                doc.text(ln, x0 + pad, firstBaseline + i * LINE_COMPACT);
            });

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            valueLines.forEach((ln, i) => {
                doc.text(ln, x0 + labelColW + pad, firstBaseline + i * LINE_COMPACT);
            });

            y += rowH;
        });

        y += 2;
    };

    const urgencyUz = (u: 'High' | 'Medium'): string =>
        u === 'High' ? 'Yuqori' : "O'rta";

    const addPatientInfoTable = () => {
        const genderLabel =
            patientData.gender === 'male'
                ? 'Erkak'
                : patientData.gender === 'female'
                  ? 'Ayol'
                  : 'Boshqa';

        const rows: { label: string; value: string }[] = [
            {
                label: 'Bemor',
                value: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim() || '—',
            },
            { label: 'Yoshi', value: patientData.age ? String(patientData.age) : '—' },
            { label: 'Jinsi', value: genderLabel },
        ];

        if (patientData.complaints?.trim()) {
            rows.push({ label: "Shikoyatlar va anamnez", value: patientData.complaints });
        }
        if (patientData.history?.trim()) {
            rows.push({ label: 'Kasallik tarixi', value: patientData.history });
        }
        if (patientData.objectiveData?.trim()) {
            rows.push({ label: "Ob'ektiv ko'rik", value: patientData.objectiveData });
        }
        if (patientData.labResults?.trim()) {
            rows.push({ label: 'Laborator tahlillar', value: patientData.labResults });
        }
        if (patientData.allergies?.trim()) {
            rows.push({ label: 'Allergiyalar', value: patientData.allergies });
        }
        if (patientData.currentMedications?.trim()) {
            rows.push({ label: 'Joriy dori-darmonlar', value: patientData.currentMedications });
        }
        if (patientData.familyHistory?.trim()) {
            rows.push({ label: 'Oilaviy anamnez', value: patientData.familyHistory });
        }
        if (patientData.additionalInfo?.trim()) {
            rows.push({ label: "Qo'shimcha", value: patientData.additionalInfo });
        }

        addCompactTableRows(rows);
    };
    
    // --- Page 1: Title and Patient Info ---
    addHeader("KONSILIUM: Yakuniy Klinik Xulosa");

    addSectionTitle("Bemor Ma'lumotlari");
    addPatientInfoTable();

    if (report.criticalFinding) {
        const cf = report.criticalFinding;
        addSectionTitle("Muhim topilma (shoshilinch)");
        addCompactTableRows([
            { label: 'Topilma', value: cf.finding },
            { label: "Oqibat", value: cf.implication },
            { label: 'Shoshilinchlik', value: urgencyUz(cf.urgency) },
        ]);
    }

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
            const authorName = AI_SPECIALISTS[item.author]?.name || 'Foydalanuvchi';
            // addKeyValue bitta sahifada chizadi — uzun matn pastga qolmaydi; addText qatorlar bo‘yicha sahifalaydi
            if (y > pageHeight - 50) {
                doc.addPage();
                y = margin;
            }
            addSectionTitle(authorName);
            addText(item.content || '');
        });
    }

    // --- Footer (har sahifa): huquqiy matn + platforma bloqi + logo) ---
    const pageCount = (doc.internal as unknown as jsPDFInternal).pages.length;
    const footerText = report.uzbekistanLegislativeNote
        ? `O'zbekiston Respublikasi sog'liqni saqlash qonunchiligi va SSV klinik protokollariga muvofiq. Ushbu hisobot ilg'or raqamli tizim yordamida shakllantirilgan va faqat ma'lumot uchun mo'ljallangan. U professional tibbiy maslahat o'rnini bosa olmaydi.`
        : `Ushbu hisobot ilg'or raqamli tizim yordamida shakllantirilgan va faqat ma'lumot uchun mo'ljallangan. U professional tibbiy maslahat o'rnini bosa olmaydi.`;

    const bottomPad = 6;
    const urlDisplay = MEDORA_PLATFORM_URL.replace(/^https:\/\//, "");
    const logoWmm = 36;
    const logoHmm = uniLogoPng ? Math.min(9, (logoWmm * 56) / 200) : 0;

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");

        const splitLegal = doc.splitTextToSize(footerText, pageWidth - margin * 2);
        const splitPromo = doc.splitTextToSize(PDF_FOOTER_PROMO_LINE, pageWidth - margin * 2);

        /** Pastdan yuqoriga: sahifa raqami → logo → tel → havola → reklama → huquqiy matn */
        let y = pageHeight - bottomPad;

        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`Sahifa ${i} / ${pageCount}`, pageWidth - margin, y, { align: "right" });

        y -= 5;
        if (uniLogoPng) {
            y -= logoHmm;
            doc.addImage(
                uniLogoPng,
                "PNG",
                (pageWidth - logoWmm) / 2,
                y,
                logoWmm,
                logoHmm
            );
            y -= 2;
        }

        y -= 1;
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`Tel: ${LANDING_CONTACT_PHONE_DISPLAY}`, pageWidth / 2, y, {
            align: "center",
        });

        y -= 4.5;
        doc.setFontSize(7);
        doc.setTextColor(37, 99, 235);
        doc.text(urlDisplay, pageWidth / 2, y, { align: "center" });
        const urlTw = doc.getTextWidth(urlDisplay);
        doc.link(pageWidth / 2 - urlTw / 2, y - 3.5, urlTw, 5, {
            url: MEDORA_PLATFORM_URL,
        });

        y -= 5;
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        for (let j = splitPromo.length - 1; j >= 0; j--) {
            doc.text(splitPromo[j], margin, y);
            y -= 3.2;
        }
        y -= 1.5;

        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        for (let j = splitLegal.length - 1; j >= 0; j--) {
            doc.text(splitLegal[j], margin, y);
            y -= 4;
        }
    }

    if (qrDataUrl) {
        const qrSizeMm = 22;
        const qrX = pageWidth - margin - qrSizeMm;
        const qrY = margin;
        doc.setPage(1);
        doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSizeMm, qrSizeMm);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("medora.cdcgroup.uz", qrX + qrSizeMm / 2, qrY + qrSizeMm + 3.5, {
            align: "center",
        });
        doc.setFontSize(6.5);
        doc.text("Platformaga kirish (QR)", qrX + qrSizeMm / 2, qrY + qrSizeMm + 7.5, {
            align: "center",
        });
    }

    // --- Save the PDF ---
    doc.save(`Tibbiy_Xulosa_${patientData.lastName}_${patientData.firstName}.pdf`);
};