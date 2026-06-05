import React, { useState } from 'react';
import type { AnalysisRecord, FinalReport } from '../types';
import { generatePdfReport } from '../services/pdfGenerator';
import { generateDocxReport } from '../services/docxGenerator';
import DownloadIcon from './icons/DownloadIcon';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import { INSTITUTE_LOGO_SRC, INSTITUTE_NAME_FULL } from '../constants/brand';
import { isApiConfigured } from '../config/api';
import { API_BASE_URL } from '../services/api';
import { getAuthToken } from '../services/api';

/** Minimal report when analysis ended with error — PDF/DOCX still export patient + debate. */
function getMinimalReportForExport(t: (key: TranslationKey) => string): FinalReport {
    return {
        consensusDiagnosis: [],
        rejectedHypotheses: [],
        recommendedTests: [],
        treatmentPlan: [],
        medicationRecommendations: [],
        unexpectedFindings: t('export_partial_fallback_message' as TranslationKey),
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
    const { t, language } = useTranslation();
    const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);

    if (!record.patientData) {
        return null;
    }

    const report: FinalReport = record.finalReport ?? getMinimalReportForExport(t);
    const branding = {
        instituteName: INSTITUTE_NAME_FULL,
        instituteLogoDataUrl: undefined as string | undefined,
    };

    const handlePdfDownload = async () => {
        setExportError(null);
        setExporting('pdf');
        try {
            branding.instituteLogoDataUrl = await getInstituteLogoDataUrl();
            await generatePdfReport(report, record.patientData!, branding, t, language);
        } catch (err) {
            console.error('PDF export failed:', err);
            setExportError(t('export_download_error' as TranslationKey));
        } finally {
            setExporting(null);
        }
    };

    const handleDocxDownload = async () => {
        setExportError(null);
        setExporting('docx');
        try {
            branding.instituteLogoDataUrl = await getInstituteLogoDataUrl();
            await generateDocxReport(report, record.patientData!, branding, t, language);
        } catch (err) {
            console.error('DOCX export failed:', err);
            setExportError(t('export_download_error' as TranslationKey));
        } finally {
            setExporting(null);
        }
    };

    const handleFhirExport = async () => {
        const analysisId = record.id ? parseInt(record.id, 10) : NaN;
        if (!isApiConfigured() || isNaN(analysisId) || analysisId <= 0) return;
        const token = getAuthToken();
        const res = await fetch(`${API_BASE_URL}/integrations/fhir/Bundle/Analysis/${analysisId}/`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const bundle = await res.json();
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fhir-analysis-${analysisId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const canFhir = isApiConfigured() && record.id && !isNaN(parseInt(record.id, 10)) && parseInt(record.id, 10) > 0;

    return (
        <div className="space-y-4">
            {hasError && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('export_partial_note' as TranslationKey)}
                </p>
            )}
            {exportError && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                    {exportError}
                </p>
            )}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                <h4 className="font-bold text-text-primary mb-3">{t('export_report_title' as TranslationKey)}</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        type="button"
                        disabled={exporting !== null}
                        onClick={() => void handlePdfDownload()}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-colors border border-slate-600"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>
                            {exporting === 'pdf'
                                ? t('export_downloading' as TranslationKey)
                                : t('export_download_pdf' as TranslationKey)}
                        </span>
                    </button>
                    <button
                        type="button"
                        disabled={exporting !== null}
                        onClick={() => void handleDocxDownload()}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-colors border border-slate-600"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>
                            {exporting === 'docx'
                                ? t('export_downloading' as TranslationKey)
                                : t('export_download_word' as TranslationKey)}
                        </span>
                    </button>
                    {canFhir && (
                        <button
                            type="button"
                            onClick={() => void handleFhirExport()}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-cyan-900 bg-cyan-100 hover:bg-cyan-200 rounded-xl transition-colors border border-cyan-300"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            <span>{t('fhir_export_btn')}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DownloadPanel;
