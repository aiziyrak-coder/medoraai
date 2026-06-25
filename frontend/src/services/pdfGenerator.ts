import { jsPDF } from "jspdf";
import QRCode from 'qrcode';
import type { FinalReport, PatientData, UziUttReport } from '../types';
/** PDF footer — faqat shu faylda; brauzer keshi uchun aniq qiymatlar */
const PDF_FOOTER_SITE = 'fjsti.ziyrak.org';
const PDF_FOOTER_PUBLIC_URL = `https://${PDF_FOOTER_SITE}`;
const PDF_FOOTER_PHONE_1 = '+998 99 575 11 11';
const PDF_FOOTER_PHONE_2 = '+998907863888';
import type { Language } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translationKeys';
import { buildCompactExportData } from '../utils/compactExportSections';
import {
    createExportTr,
    exportFileSlug,
    formatExportDate,
    pdfText,
    sanitizeExportFilename,
} from '../utils/exportI18n';

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
const LINE_HEIGHT = 5;
const FOOTER_RESERVE = 10;
const MARGIN = 12;
export interface InstituteBranding {
    instituteName?: string;
    instituteLogoDataUrl?: string;
}

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

/** Kirill/O'zbek uchun DejaVu Sans — har bir uslub alohida TTF fayldan */
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

export const generatePdfReport = async (
    report: FinalReport,
    patientData: PatientData,
    _branding?: InstituteBranding,
    t?: (key: string) => string,
    language: Language = 'uz-L',
) => {
    const { renderConsiliumPdfReport } = await import('./consiliumPdfReport');
    await renderConsiliumPdfReport(report, patientData, t, language);
};

/** UTT/UZI AI xulosasi — konsilium PDF bilan bir xil pastki qism va brending */
export const generateUziUttPdf = async (
    report: UziUttReport,
    _branding?: InstituteBranding,
    t?: (key: string) => string,
    language: Language = 'uz-L',
) => {
    const tr = createExportTr(language, t as ((key: TranslationKey) => string) | undefined);
    const doc = new jsPDF();
    const fontName = await setupPdfFont(doc);
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let y = MARGIN;
    const contentBottom = () => pageHeight - FOOTER_RESERVE - 24; // footer + promo hududi uchun joy qoldiramiz

    // Generate QR code for platform
    let qrDataUrl = '';
    try {
        qrDataUrl = await QRCode.toDataURL(PDF_FOOTER_PUBLIC_URL, {
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
        doc.setFont(fontName, 'bold');
        doc.setTextColor(50, 60, 80);
        doc.text(label, MARGIN, y);
        y += LINE_HEIGHT;
        doc.setFont(fontName, 'normal');
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
        doc.setFont(fontName, 'bold');
        doc.setTextColor(50, 60, 80);
        doc.text(title, MARGIN, y);
        y += LINE_HEIGHT + 1;
        doc.setFont(fontName, 'normal');
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

    const headerTextX = MARGIN;

    doc.setFontSize(16);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(title, headerTextX, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(100, 100, 100);
    const subLines = doc.splitTextToSize(subtitle, pageWidth - MARGIN * 2 - (qrSize + 6));
    doc.text(subLines[0] || '', headerTextX, y);

    const dateStr = formatExportDate(language);
    doc.text(`${tr('pdf_date', 'Sana')}: ${dateStr}`, pageWidth - MARGIN - qrSize - 5, y, { align: 'right' });

    if (qrDataUrl) {
        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        doc.text(`${tr('pdf_scan', 'Skannerlang')} →`, qrX + qrSize / 2, qrY + qrSize + 2, { align: 'center' });
        doc.text(PDF_FOOTER_SITE, qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
    }

    y = Math.max(y + 4, qrY + qrSize + 8);
    drawLine(y, [150, 150, 150]);
    y += 6;

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    const urgLabel = tr('pdf_uzi_utt_urgency', 'Shoshilinchlik');
    doc.text(`${urgLabel}: ${pdfText(report.urgencyLevel)}`, MARGIN, y);
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
    const pageCount = doc.getNumberOfPages();
    const promoText = tr('pdf_promo_text', 'AiDoktor — AI tibbiy konsilium platformasi');
    const promoLink = PDF_FOOTER_SITE;
    const promoPhone = PDF_FOOTER_PHONE_1;
    const promoPhone2 = PDF_FOOTER_PHONE_2;

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawLine(pageHeight - FOOTER_RESERVE - 2, [200, 200, 200]);
        doc.setFontSize(7);
        doc.setFont(fontName, 'normal');
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
    doc.setFont(fontName, 'bold');
    doc.setTextColor(50, 60, 80);
    doc.text(promoText, MARGIN + 3, promoY + 2);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(30, 100, 180);
    doc.text(promoLink, MARGIN + 70, promoY + 2);
    doc.setTextColor(60, 60, 60);
    doc.text(`${tr('pdf_tel_label', 'Tel')}: ${promoPhone}  |  ${promoPhone2}`, MARGIN + 3, promoY + 6);
    doc.setFont(fontName, 'italic');
    doc.setTextColor(30, 100, 180);
    doc.text(PDF_FOOTER_SITE, MARGIN + 3, promoY + 10);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`  — ${tr('pdf_product_site_note', 'AiDoktor mahsuloti rasmiy veb-sahifasi')}`, MARGIN + 24, promoY + 10);
    doc.setFontSize(8);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(25, 55, 95);
    doc.text(tr('pdf_product_brand_footer', 'AiDoktor'), pageWidth - MARGIN - 3, promoY + 3, { align: 'right' });
    doc.setFontSize(5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text(
        tr('pdf_product_copyright_short', '© Mualliflik huquqi himoyalangan'),
        pageWidth - MARGIN - 3,
        promoY + 8,
        { align: 'right' },
    );

    const stamp = new Date().toISOString().slice(0, 19).replace('T', '_');
    doc.save(`UTT_UZI_tahlil_${stamp}.pdf`);
};
