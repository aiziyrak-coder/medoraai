import React from 'react';
import type { AnalysisRecord, FinalReport } from '../types';
import { generatePdfReport } from '../services/pdfGenerator';
import { generateDocxReport } from '../services/docxGenerator';
import DownloadIcon from './icons/DownloadIcon';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import { INSTITUTE_LOGO_SRC, INSTITUTE_NAME_FULL } from '../constants/brand';

/** Minimal report when analysis ended with error — PDF/DOCX still export patient + debate. */
function getMinimalReportForExport(): FinalReport {
    return {
        consensusDiagnosis: [],
        rejectedHypotheses: [],
        recommendedTests: [],
        treatmentPlan: [],
        medicationRecommendations: [],
        unexpectedFindings: "Tahlil xato bilan tugadi. Quyida faqat bemor ma'lumotlari va konsilium munozarasi keltirilgan.",
    };
}

/** Fetch institute logo as data URL for use in PDF/DOCX */
async function getInstituteLogoDataUrl(): Promise<string | undefined> {
    try {
        const res = await fetch(INSTITUTE_LOGO_SRC);
        if (!res.ok) return undefined;
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    } catch {
        return undefined;
    }
}

interface DownloadPanelProps {
    record: Partial<AnalysisRecord>;
    /** True when analysis ended with error — still allow export of patient + debate. */
    hasError?: boolean;
}

const DownloadPanel: React.FC<DownloadPanelProps> = ({ record, hasError }) => {
    const { t } = useTranslation();
    if (!record.patientData) {
        return null;
    }

    const report: FinalReport = record.finalReport ?? getMinimalReportForExport();

    const handlePdfDownload = async () => {
        const logoDataUrl = await getInstituteLogoDataUrl();
        await generatePdfReport(report, record.patientData!, {
            instituteName: INSTITUTE_NAME_FULL,
            instituteLogoDataUrl: logoDataUrl,
        }, t);
    };

    const handleDocxDownload = async () => {
        const logoDataUrl = await getInstituteLogoDataUrl();
        await generateDocxReport(report, record.patientData!, {
            instituteName: INSTITUTE_NAME_FULL,
            instituteLogoDataUrl: logoDataUrl,
        });
    };

    return (
        <div className="space-y-4">
            {hasError && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('export_partial_note' as TranslationKey)}
                </p>
            )}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                <h4 className="font-bold text-text-primary mb-3">{t('export_report_title' as TranslationKey)}</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={handlePdfDownload}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded-xl transition-colors border border-slate-600"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>{t('export_download_pdf' as TranslationKey)}</span>
                    </button>
                    <button
                        onClick={handleDocxDownload}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded-xl transition-colors border border-slate-600"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>{t('export_download_word' as TranslationKey)}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DownloadPanel;
