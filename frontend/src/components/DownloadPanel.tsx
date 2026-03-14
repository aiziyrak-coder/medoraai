import React from 'react';
import type { AnalysisRecord, ChatMessage } from '../types';
import { generatePdfReport, generateSpecialistConclusionPdf } from '../services/pdfGenerator';
import { generateDocxReport } from '../services/docxGenerator';
import DownloadIcon from './icons/DownloadIcon';
import { AI_SPECIALISTS } from '../constants';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import { INSTITUTE_LOGO_SRC, INSTITUTE_NAME_FULL } from '../constants/brand';

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
}

const DownloadPanel: React.FC<DownloadPanelProps> = ({ record }) => {
    const { t } = useTranslation();
    if (!record.finalReport || !record.patientData) {
        return null;
    }

    const debateHistory: ChatMessage[] = Array.isArray(record.debateHistory) ? record.debateHistory : [];
    const patientName = `${record.patientData.lastName || ''}_${record.patientData.firstName || ''}`.replace(/\s+/g, '_') || 'Bemor';

    const getSpecialistName = (author: string) =>
        t(`specialist_name_${String(author).toLowerCase()}` as TranslationKey) || AI_SPECIALISTS[author]?.name || author;

    const specialistLastMsg = new Map<string, ChatMessage>();
    debateHistory
        .filter(m => !m.isSystemMessage && !m.isUserIntervention)
        .forEach(m => specialistLastMsg.set(m.author, m));

    const handlePdfDownload = async () => {
        const logoDataUrl = await getInstituteLogoDataUrl();
        generatePdfReport(record.finalReport!, record.patientData!, debateHistory, getSpecialistName, {
            instituteName: INSTITUTE_NAME_FULL,
            instituteLogoDataUrl: logoDataUrl,
        });
    };

    const handleDocxDownload = async () => {
        const logoDataUrl = await getInstituteLogoDataUrl();
        await generateDocxReport(record.finalReport!, record.patientData!, debateHistory, getSpecialistName, {
            instituteName: INSTITUTE_NAME_FULL,
            instituteLogoDataUrl: logoDataUrl,
        });
    };

    const handleSpecialistPdf = async (author: string, content: string) => {
        const specName = getSpecialistName(author);
        const fileBaseName = `${patientName}_${(AI_SPECIALISTS[author]?.name || author).replace(/\s+/g, '_')}`;
        const logoDataUrl = await getInstituteLogoDataUrl();
        generateSpecialistConclusionPdf(specName, content, {
            instituteName: INSTITUTE_NAME_FULL,
            instituteLogoDataUrl: logoDataUrl,
        }, fileBaseName);
    };

    return (
        <div className="space-y-4">
            {/* Umumiy hisobot */}
            <div className="p-4 bg-slate-100 rounded-xl border border-border-color">
                <h4 className="font-bold text-text-primary mb-3">Umumiy konsilium hisobotini yuklab olish</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={handlePdfDownload}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>PDF yuklab olish</span>
                    </button>
                    <button
                        onClick={handleDocxDownload}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>Word yuklab olish</span>
                    </button>
                </div>
            </div>

            {/* Har bir mutaxassis yakuniy xulosasi */}
            {specialistLastMsg.size > 0 && (
                <div className="p-4 bg-slate-100 rounded-xl border border-border-color">
                    <h4 className="font-bold text-text-primary mb-3">Har bir mutaxassisning yakuniy xulosasi</h4>
                    <div className="space-y-2">
                        {Array.from(specialistLastMsg.entries()).map(([author, msg]) => {
                            const specName = getSpecialistName(author);
                            const specTitle = AI_SPECIALISTS[author]?.title || '';
                            return (
                                <button
                                    key={author}
                                    onClick={() => handleSpecialistPdf(author, msg.content)}
                                    className="w-full flex items-center justify-between gap-2 py-2 px-3 text-sm bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                                >
                                    <span className="text-left">
                                        <span className="font-semibold text-text-primary">{specName}</span>
                                        {specTitle && <span className="text-xs text-slate-500 ml-1">({specTitle})</span>}
                                    </span>
                                    <span className="flex items-center gap-1 text-slate-500 shrink-0">
                                        <DownloadIcon className="w-4 h-4" />
                                        <span className="text-xs">.pdf</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DownloadPanel;
