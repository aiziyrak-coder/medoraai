import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { FinalReport, PatientData, ChatMessage } from '../types';
import { AI_SPECIALISTS } from '../constants';
import { logger } from '../utils/logger';

// Helper functions to create document elements
const createHeading1 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
const createHeading2 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const createKeyValue = (key: string, value: string | undefined | null) => new Paragraph({
    children: [
        new TextRun({ text: `${key}: `, bold: true }),
        new TextRun(value || "N/A"),
    ],
    spacing: { after: 100 }
});
const createListItem = (text: string) => new Paragraph({ text, bullet: { level: 0 } });

export const generateDocxReport = async (
    report: FinalReport,
    patientData: PatientData,
    debateHistory: ChatMessage[]
) => {

    const children = [
        new Paragraph({
            text: "KONSILIUM: Yakuniy Klinik Xulosa",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "\n" }),

        createHeading1("Bemor Ma'lumotlari"),
        createKeyValue("Bemor", `${patientData.firstName} ${patientData.lastName}`),
        createKeyValue("Yoshi", patientData.age),
        createKeyValue("Jinsi", patientData.gender === 'male' ? 'Erkak' : patientData.gender === 'female' ? 'Ayol' : 'Boshqa'),
        createKeyValue("Shikoyatlar va Anamnez", patientData.complaints),
        createKeyValue("Kasallik Tarixi", patientData.history),
        createKeyValue("Ob'ektiv Ko'rik", patientData.objectiveData),
        createKeyValue("Laborator Tahlillar", patientData.labResults),

        createHeading1("Konsilium Konsensusi"),
        createHeading2("Eng Ehtimolli Tashxis(lar)"),
        ...report.consensusDiagnosis.flatMap(diag => [
            createKeyValue("Tashxis", `${diag.name} (${diag.probability}%)`),
            createKeyValue("Dalillilik Darajasi", diag.evidenceLevel || "N/A"),
            createKeyValue("Asoslash", diag.justification),
            new Paragraph({ text: "" }),
        ]),

        createHeading2("Tavsiya Etilgan Davolash Rejasi"),
        ...report.treatmentPlan.map(step => createListItem(step)),
        new Paragraph({ text: "" }),

        createHeading2("Dori-Darmonlar bo'yicha Tavsiyalar"),
        ...report.medicationRecommendations.flatMap(med => [
            createKeyValue("Nomi", med.name),
            createKeyValue("Doza", med.dosage),
            createKeyValue("Izoh", med.notes),
            new Paragraph({ text: "" }),
        ]),

        createHeading2("Tavsiya Etiladigan Qo'shimcha Tekshiruvlar"),
        ...report.recommendedTests.map(test => createListItem(test)),
        new Paragraph({ text: "" }),
        
        createHeading2("Inkor Etilgan Gipotezalar"),
         ...report.rejectedHypotheses.flatMap(hyp => [
            createKeyValue("Gipoteza", hyp.name),
            createKeyValue("Rad etish sababi", hyp.reason),
            new Paragraph({ text: "" }),
        ]),

        ...(report.uzbekistanLegislativeNote ? [
            createHeading2("Qonuniy eslatma"),
            new Paragraph({ children: [new TextRun(report.uzbekistanLegislativeNote)], spacing: { after: 200 } }),
        ] : []),

        createHeading1("Konsilium Munozara Tarixi"),
        ...debateHistory.filter(msg => !msg.isSystemMessage && !msg.isUserIntervention).map(msg => new Paragraph({
            children: [
                new TextRun({ text: `${AI_SPECIALISTS[msg.author]?.name || 'Foydalanuvchi'}: `, bold: true }),
                new TextRun(msg.content)
            ],
            spacing: { after: 200 }
        })),
    ];
    
    const doc = new Document({
        sections: [{ children }],
    });

    try {
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Tibbiy_Xulosa_${patientData.lastName}_${patientData.firstName}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        // DOCX generation error
        logger.error("Could not generate DOCX file.", e);
        alert("DOCX faylini yaratishda xatolik yuz berdi.");
    }
};