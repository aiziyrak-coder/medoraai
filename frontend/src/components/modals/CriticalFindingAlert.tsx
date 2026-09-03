import React from 'react';
import { CriticalFinding } from '../../types';
import AlertTriangleIcon from '../icons/AlertTriangleIcon';
import { useTranslation } from '../../hooks/useTranslation';

interface CriticalFindingAlertProps {
    finding: CriticalFinding;
    onClose: () => void;
}

const CriticalFindingAlert: React.FC<CriticalFindingAlertProps> = ({ finding, onClose }) => {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
            <div className="max-w-lg w-full bg-slate-800 rounded-2xl shadow-2xl border-2 border-red-500/50">
                <div className="p-6 text-center">
                    <AlertTriangleIcon className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
                    <h2 className="mt-4 text-2xl font-extrabold text-white">{t('critical_finding_title')}</h2>
                    <p className="mt-2 text-lg font-semibold text-red-400">{finding.finding}</p>
                    <p className="mt-4 text-slate-300">{finding.implication}</p>
                </div>
                <div className="p-4 bg-black/20">
                     <button
                        onClick={onClose}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors"
                    >
                        {t('critical_finding_ack')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CriticalFindingAlert;