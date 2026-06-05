import React, { useState, useEffect } from 'react';
import { FinalReport, PatientEducationTopic } from '../../types';
import * as aiService from '../../services/aiCouncilService';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';
import type { Language } from '../../i18n/LanguageContext';

interface PatientEducationPortalProps {
    report: FinalReport;
    onBack: () => void;
}

type ContentLang = 'uz' | 'ru' | 'en';

const mapToContentLang = (lang: Language): ContentLang => {
    if (lang === 'ru') return 'ru';
    if (lang === 'en') return 'en';
    return 'uz';
};

const PatientEducationPortal: React.FC<PatientEducationPortalProps> = ({ report, onBack }) => {
    const { t, language } = useTranslation();
    const [contentLang, setContentLang] = useState<ContentLang>(mapToContentLang(language));
    const [content, setContent] = useState<PatientEducationTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        aiService.generatePatientEducationContent(report, contentLang)
            .then(setContent)
            .catch(() => setError(t('patient_education_load_error')))
            .finally(() => setIsLoading(false));
    }, [report, contentLang, t]);

    return (
        <div className="glass-panel p-6 md:p-8 animate-fade-in-up">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-accent-color-blue hover:underline mb-1">
                        {t('patient_education_back')}
                    </button>
                    <h2 className="text-2xl font-bold text-text-primary">{t('patient_education_title')}</h2>
                    <p className="text-text-secondary">{t('patient_education_subtitle')}</p>
                </div>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg border border-border-color">
                    {(['uz', 'ru', 'en'] as ContentLang[]).map((lang) => (
                        <button
                            key={lang}
                            type="button"
                            onClick={() => setContentLang(lang)}
                            className={`px-3 py-1 text-sm font-semibold rounded-md ${contentLang === lang ? 'bg-white shadow' : ''}`}
                        >
                            {lang.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center p-8"><SpinnerIcon className="w-10 h-10 mx-auto" /></div>
            ) : error ? (
                <p className="text-red-600 text-sm">{error}</p>
            ) : (
                <div className="space-y-4">
                    {content.map((topic, i) => (
                        <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white">
                            <h3 className="font-bold text-slate-800">{topic.title}</h3>
                            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{topic.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PatientEducationPortal;
