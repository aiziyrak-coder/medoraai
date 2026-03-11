import React from 'react';
import type { AnalysisRecord } from '../types';
import { generatePdfReport } from '../services/pdfGenerator';
import { generateDocxReport } from '../services/docxGenerator';
import DownloadIcon from './icons/DownloadIcon';

interface DownloadPanelProps {
    record: Partial<AnalysisRecord>;
}

const DownloadPanel: React.FC<DownloadPanelProps> = ({ record }) => {
    if (!record.finalReport || !record.patientData) {
        return null;
    }

    const handlePdfDownload = () => {
        generatePdfReport(record.finalReport!, record.patientData!, record.debateHistory || []);
    };
    
    const handleDocxDownload = async () => {
        await generateDocxReport(record.finalReport!, record.patientData!, record.debateHistory || []);
    };

    return (
        <div className="p-4 bg-slate-100 rounded-lg border border-border-color">
            <h4 className="font-bold text-text-primary mb-3">Hisobotni Yuklab Olish</h4>
            <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={handlePdfDownload} className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-text-primary bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors">
                    <DownloadIcon className="w-5 h-5"/>
                    <span>PDF (.pdf)</span>
                </button>
                <button onClick={handleDocxDownload} className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-text-primary bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors">
                    <DownloadIcon className="w-5 h-5"/>
                    <span>Word (.docx)</span>
                </button>
            </div>
        </div>
    );
};

export default DownloadPanel;