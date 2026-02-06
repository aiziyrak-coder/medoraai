import React, { useState, useEffect } from 'react';
import { FinalReport, PatientEducationTopic } from '../../types';
import * as aiService from '../../services/aiCouncilService';
import SpinnerIcon from '../icons/SpinnerIcon';

interface PatientEducationPortalProps {
    report: FinalReport;
    onBack: () => void;
}

type Language = 'uz' | 'ru' | 'en';

const PatientEducationPortal: React.FC<PatientEducationPortalProps> = ({ report, onBack }) => {
    const [language, setLanguage] = useState<Language>('uz');
    const [content, setContent] = useState<PatientEducationTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        aiService.generatePatientEducationContent(report, language)
            .then(setContent)
            .catch(() => setError("Ma'lumotlarni yuklashda xatolik yuz berdi."))
            .finally(() => setIsLoading(false));
    }, [report, language]);

    return (
        <div className="glass-panel p-6 md:p-8 animate-fade-in-up">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-accent-color-blue hover:underline mb-1">
                        &larr; Tahlilga qaytish
                    </button>
                    <h2 className="text-2xl font-bold text-text-primary">Bemor uchun Ma'lumot Portali</h2>
                    <p className="text-text-secondary">Tashxis va davolash rejasi haqida sodda tilda ma'lumot.</p>
                </div>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg border border-border-color">
                    {(['uz', 'ru', 'en'] as Language[]).map(lang => (
                        <button key={lang} onClick={() => setLanguage(lang)} className={`px-3 py-1 text-sm font-semibold rounded-md ${language === lang ? 'bg-white shadow' : ''}`}>
                            {lang.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center p-8"><SpinnerIcon className="w-10 h-10 mx-auto" /></div>
            ) : error ? (
                <div className="text-center p-8 text-red-500">{error}</div>
            ) : (
                <div className="space-y-6">
                    {content.map((topic, index) => (
                        <div key={index} className="p-4 bg-slate-50 rounded-lg border border-border-color">
                            <h3 className="text-xl font-bold text-text-primary">{topic.title}</h3>
                            <div className="mt-2 prose prose-sm max-w-none whitespace-pre-wrap">{topic.content}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PatientEducationPortal;
