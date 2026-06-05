/**
 * Tahlil xato bilan tugaganda o'ng panelda ko'rsatiladi.
 */

import React from 'react';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import PillIcon from './icons/PillIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import { useTranslation } from '../hooks/useTranslation';

const Section: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200">
                {icon}
            </div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
        </div>
        <div className="p-4 space-y-4 text-sm">
            {children}
        </div>
    </div>
);

interface ErrorReportPlaceholderProps {
    message?: string;
}

const ErrorReportPlaceholder: React.FC<ErrorReportPlaceholderProps> = ({ message }) => {
    const { t } = useTranslation();

    return (
        <div className="animate-fade-in-up mt-4 space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">{t('error_report_title')}</h1>
                <p className="text-sm text-slate-500 mt-1">{t('error_report_subtitle')}</p>
            </div>

            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-amber-700 text-white">
                    <h2 className="text-lg font-bold uppercase tracking-wide">{t('error_report_main_heading')}</h2>
                    <p className="text-amber-100 text-sm mt-0.5">{t('error_report_main_sub')}</p>
                </div>
                <div className="p-6">
                    <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-amber-200">
                        <AlertTriangleIcon className="w-8 h-8 text-amber-600 flex-shrink-0" />
                        <p className="text-sm text-slate-700">{message || t('error_report_default_message')}</p>
                    </div>
                </div>
            </div>

            <Section title={t('error_report_treatment_title')} icon={<BrainCircuitIcon className="w-6 h-6" />}>
                <p className="text-slate-500 text-sm italic">{t('error_report_treatment_placeholder')}</p>
            </Section>

            <Section title={t('error_report_meds_title')} icon={<PillIcon className="w-6 h-6" />}>
                <p className="text-slate-500 text-sm italic">{t('error_report_meds_placeholder')}</p>
            </Section>

            <Section title={t('error_report_tests_title')} icon={<DocumentTextIcon className="w-6 h-6" />}>
                <p className="text-slate-500 text-sm italic">{t('error_report_tests_placeholder')}</p>
            </Section>
        </div>
    );
};

export default ErrorReportPlaceholder;
