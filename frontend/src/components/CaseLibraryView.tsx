import React, { useState, useMemo } from 'react';
import type { AnalysisRecord, AnonymizedCase } from '../types';
import * as caseService from '../services/caseService';
import SearchIcon from './icons/SearchIcon';
import { useTranslation } from '../hooks/useTranslation';

interface CaseLibraryViewProps {
    onBack: () => void;
    currentPatientComplaints?: string;
    /** Serverdan yuklangan tahlillar — berilsa holatlar shu ro'yxatdan olinadi (barcha ma'lumot serverda) */
    analyses?: AnalysisRecord[];
}

const CaseLibraryView: React.FC<CaseLibraryViewProps> = ({ onBack, currentPatientComplaints }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const cases: AnonymizedCase[] = useMemo(() => {
        if (analyses && analyses.length > 0) {
            return caseService.analysesToAnonymizedCases(analyses);
        }
        return caseService.getAnonymizedCases();
    }, [analyses]);
    
    const filteredCases = useMemo(() => {
        if (!searchTerm) return cases;
        const term = (searchTerm ?? '').toLowerCase();
        return cases.filter(c => 
            (c.tags || []).some(tag => (tag ?? '').toLowerCase().includes(term)) ||
            (c.finalDiagnosis ?? '').toLowerCase().includes(term)
        );
    }, [searchTerm, cases]);

    const findSimilar = () => {
        if (currentPatientComplaints) {
            setSearchTerm(currentPatientComplaints);
        }
    };
    
    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-accent-color-blue hover:underline mb-1">
                        &larr; {t('back')}
                    </button>
                    <h2 className="text-2xl font-bold text-text-primary">{t('case_library_title')}</h2>
                    <p className="text-text-secondary">{t('case_library_subtitle')}</p>
                </div>
            </div>
            
            <div className="sticky top-[70px] z-10 bg-bg-color/80 backdrop-blur-sm py-4">
                 <div className="relative">
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={t('case_library_placeholder')}
                        className="w-full common-input pl-10"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCases.map(c => (
                    <div key={c.id} className="glass-panel p-4">
                        <h3 className="font-bold text-text-primary">{c.finalDiagnosis}</h3>
                        <p className="text-sm text-text-secondary mt-1">{c.outcome}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {c.tags.map(tag => (
                                <span key={tag} className="text-xs bg-slate-200 text-text-secondary px-2 py-1 rounded-full">{tag}</span>
                            ))}
                        </div>
                    </div>
                ))}
                {filteredCases.length === 0 && (
                    <p className="col-span-full text-center text-text-secondary">Hech qanday holat topilmadi.</p>
                )}
            </div>
        </div>
    );
};

export default CaseLibraryView;