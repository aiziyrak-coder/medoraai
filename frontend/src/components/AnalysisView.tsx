
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AnalysisRecord, ChatMessage as ChatMessageProps, FinalReport, Diagnosis, PatientData, DetectedMedication, DiagnosisFeedback, PrognosisReport } from '../types';
import * as aiService from '../services/aiCouncilService';

// --- Components ---
import SpinnerIcon from './icons/SpinnerIcon';
import ChatMessage from './ChatMessage';
import FinalReportCard from './FinalReportCard';
import PrognosisCard from './report/PrognosisCard';
import DownloadPanel from './DownloadPanel';
import ErrorReportPlaceholder from './ErrorReportPlaceholder';
import DebateStatusIndicator from './DebateStatusIndicator';
import { ObjectiveVitalsCards } from './analysis/ObjectiveVitalsCards';
import ErrorWithRetry from './ErrorWithRetry';
import UsefulnessFeedbackCard from './UsefulnessFeedbackCard';
import { useTranslation } from '../hooks/useTranslation';

// --- Icons ---
import SendIcon from './icons/SendIcon';
import LightBulbIcon from './icons/LightBulbIcon';


interface AnalysisViewProps {
    record: Partial<AnalysisRecord>;
    isLive: boolean;
    statusMessage: string;
    isAnalyzing: boolean;
    differentialDiagnoses: Diagnosis[];
    error: string | null;
    diagnosisFeedback: Record<string, DiagnosisFeedback>;
    userIntervention: string | null;
    socraticQuestion: string | null;
    livePrognosis: PrognosisReport | null;
    onDiagnosisFeedback: (name: string, feedback: DiagnosisFeedback) => void;
    onStartDebate: () => void;
    onInjectHypothesis: (hypothesis: Diagnosis) => void;
    onUserIntervention: (intervention: string) => void;
    onExplainRationale: (message: ChatMessageProps) => void;
    onRunScenario: (scenario: string) => Promise<FinalReport | null>;
    onUpdateReport: (updatedReport: Partial<FinalReport>) => void;
    onRetry?: () => void;
}


const AnalysisView: React.FC<AnalysisViewProps> = (props) => {
    const { 
        record, isLive, statusMessage, isAnalyzing, differentialDiagnoses, error, 
        diagnosisFeedback, onDiagnosisFeedback, onStartDebate, onInjectHypothesis, 
        onUserIntervention, onExplainRationale, socraticQuestion,
        livePrognosis, onRunScenario, onUpdateReport, onRetry
    } = props;
    const { t } = useTranslation();
    
    const debateScrollRef = useRef<HTMLDivElement>(null);
    const [interventionText, setInterventionText] = useState('');
    const [scenarioText, setScenarioText] = useState('');
    const [isScenarioRunning, setIsScenarioRunning] = useState(false);
    const [scenarioResult, setScenarioResult] = useState<FinalReport | null>(null);

    useEffect(() => {
        if (debateScrollRef.current) {
            debateScrollRef.current.scrollTop = debateScrollRef.current.scrollHeight;
        }
    }, [record?.debateHistory, statusMessage, socraticQuestion]);

    const { patientData: pd, debateHistory: dh = [], finalReport: fr = null } = record ?? {};
    const hasDebate = (dh?.length ?? 0) > 0;
    const showRightPanel = !!pd && (!!fr || !!error || isAnalyzing || hasDebate);

    const handleInterventionSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!interventionText.trim() || (!isAnalyzing && !socraticQuestion)) return;
        onUserIntervention(interventionText);
        setInterventionText('');
    }, [interventionText, isAnalyzing, socraticQuestion, onUserIntervention]);
    
    const handleRunScenario = useCallback(async () => {
        if (!scenarioText.trim()) return;
        setIsScenarioRunning(true);
        setScenarioResult(null);
        try {
            const result = await onRunScenario(scenarioText);
            setScenarioResult(result);
        } catch (error) {
            // Error is handled by parent component
        } finally {
            setIsScenarioRunning(false);
        }
    }, [scenarioText, onRunScenario]);
    
    const patientDisplayName = useMemo(() => {
        if (!pd) return '';
        return `${pd.firstName || ''} ${pd.lastName || ''}`.trim() || t('analysis_patient_fallback');
    }, [pd]);

    if (!pd) return <div className="text-center p-8">{t('error_no_data_found')}</div>;

    /** Show downloads only after council has ended and final critical info is ready (final report or error state). */
    const showDownloadSection = (!!fr || !!error) && !isAnalyzing;

    return (
        <div className="grid grid-cols-1 gap-4 xl:gap-6 xl:grid-cols-12 h-full">
            {/* Left Panel: Patient Data — ultra compact (≈3x) */}
            <div className="xl:col-span-2 glass-panel p-2 flex flex-col h-full overflow-y-auto touch-scroll-y">
                <div className="mb-2">
                    <h3 className="text-[11px] font-semibold text-text-primary">{t('analysis_patient_data_title')}</h3>
                    <div className="h-0.5 w-8 bg-blue-500 rounded-full mt-0.5"></div>
                </div>
                
                <div className="space-y-2 text-[11px] flex-grow">
                    <div className="p-2.5 bg-white/40 rounded-lg border border-white/40 shadow-sm">
                        <p className="text-base font-semibold text-text-primary leading-tight">{patientDisplayName}</p>
                        <p className="text-[10px] text-text-secondary mt-0.5">
                            {pd.age ? `${pd.age} ${t('analysis_age_suffix')}` : t('analysis_age_missing')} · {pd.gender === 'male' ? t('data_input_gender_male') : pd.gender === 'female' ? t('data_input_gender_female') : t('analysis_not_provided')}
                        </p>
                    </div>

                    <div>
                        <strong className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">{t('analysis_complaints_title')}</strong>
                        <p className="text-[10px] text-text-primary bg-slate-50/50 p-1.5 rounded-md border border-white/20 leading-tight">{pd.complaints}</p>
                    </div>
                    
                    {pd.history && (
                        <div>
                            <strong className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">{t('data_input_history_label')}</strong>
                            <p className="text-[10px] text-text-primary bg-slate-50/50 p-1.5 rounded-md border border-white/20 leading-tight">{pd.history}</p>
                        </div>
                    )}
                    {pd.objectiveData && (
                        <ObjectiveVitalsCards objectiveData={pd.objectiveData} />
                    )}
                    {pd.labResults && (
                        <div>
                            <strong className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">{t('analysis_labs_title')}</strong>
                            <p className="text-[10px] text-text-primary bg-slate-50/50 p-1.5 rounded-md border border-white/20 leading-tight">{pd.labResults}</p>
                        </div>
                    )}
                    {pd.pharmacogenomicsReport && <p className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl text-purple-700 font-medium">{t('analysis_pharmacogenomics_present')}</p>}
                </div>
            </div>

            {/* Center Panel: Interactive Analysis */}
            <div className={`${showRightPanel ? 'xl:col-span-6' : 'xl:col-span-10'} glass-panel flex flex-col h-full min-h-0 relative`}>
                 <div className="p-5 border-b border-white/20 flex-shrink-0 bg-white/30 backdrop-blur-md z-10">
                    <h3 className="text-lg font-bold text-text-primary">{t('analysis_interactive_title')}</h3>
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mt-0.5">{statusMessage || t('analysis_process_subtitle')}</p>
                </div>
                <div ref={debateScrollRef} className="p-4 flex-1 min-h-0 overflow-y-auto touch-scroll-y flex flex-col gap-4">
                    {isAnalyzing && dh.length === 0 && !error && (
                        <div className="flex justify-center items-center flex-1 flex-col">
                            <SpinnerIcon className="w-10 h-10 text-blue-500" />
                            <p className="mt-3 text-text-secondary font-medium">{t('analysis_scenario_analyzing')}</p>
                        </div>
                    )}
                    {error && (
                        <div className="p-4 text-sm text-red-700 bg-red-50/90 rounded-2xl border border-red-200 shadow-sm" role="alert">
                            <span className="font-bold">{t('error_title')}</span> {error}
                        </div>
                    )}

                    {dh.length > 0 && (
                        <div className="space-y-3">
                            {(Array.isArray(dh) ? dh : []).map(msg => (
                                <ChatMessage key={msg.id} message={msg} onExplainRationale={onExplainRationale} compact />
                            ))}
                        </div>
                    )}
                    {dh.length === 0 && !isAnalyzing && !error && (
                        <p className="text-text-secondary text-sm">{t('analysis_debate_placeholder')}</p>
                    )}
                    {isLive && isAnalyzing && dh.length > 0 && !socraticQuestion && (
                        <DebateStatusIndicator message={statusMessage} />
                    )}
                </div>
                {isLive && (isAnalyzing || socraticQuestion) && (
                    <div className="p-4 border-t border-white/20 bg-white/40 backdrop-blur-md">
                        {socraticQuestion ? (
                            <div className="animate-fade-in-up">
                                 <div className="p-3 bg-yellow-50/90 border border-yellow-200 rounded-xl mb-3 shadow-sm">
                                     <p className="text-xs font-bold text-yellow-700 uppercase mb-1">{t('analysis_socratic_question_title')}</p>
                                     <p className="text-sm italic text-text-primary">"{socraticQuestion}"</p>
                                 </div>
                                 <form onSubmit={handleInterventionSubmit} className="flex gap-2">
                                    <input type="text" id="analysis-intervention" name="intervention" value={interventionText} onChange={(e) => setInterventionText(e.target.value)} placeholder={t('analysis_socratic_answer_placeholder')} className="flex-grow common-input" autoFocus aria-label={t('analysis_socratic_answer_placeholder')} />
                                    <button type="submit" className="p-3 rounded-xl animated-gradient-button text-white"><SendIcon className="w-5 h-5"/></button>
                                 </form>
                            </div>
                        ) : (
                             <form onSubmit={handleInterventionSubmit} className="flex gap-2">
                                <input type="text" id="analysis-intervention-alt" name="intervention-alt" value={interventionText} onChange={(e) => setInterventionText(e.target.value)} placeholder={t('analysis_user_intervention_placeholder')} className="flex-grow common-input" aria-label={t('analysis_user_intervention_placeholder')} />
                                <button type="submit" className="p-3 rounded-xl animated-gradient-button text-white"><SendIcon className="w-5 h-5"/></button>
                            </form>
                        )}
                    </div>
                )}
            </div>
            
            {/* Right Panel: Yakuniy xulosa — munozara paytida ham ochiq; jarayon, raund xulosalari, keyin to'liq hisobot */}
            {showRightPanel && (
                <div className="xl:col-span-4 glass-panel flex flex-col h-full min-h-0">
                    <div className="p-5 border-b border-white/20 flex-shrink-0 bg-white/30 backdrop-blur-md">
                        <h3 className="text-lg font-bold text-text-primary">{t('final_report_title')}</h3>
                        {isAnalyzing && !fr && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t('analysis_results_in_progress')}</p>
                        )}
                        {!fr && error && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('analysis_results_error_note')}</p>
                        )}
                    </div>
                    <div className="p-5 flex-1 min-h-0 overflow-y-auto touch-scroll-y">
                        <div className="space-y-6">
                            {fr && <FinalReportCard report={fr} patientData={pd} onUpdateReport={onUpdateReport} />}
                            {!fr && error && <ErrorReportPlaceholder message={error} />}
                            {!fr && !error && (isAnalyzing || hasDebate) && (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                        <h4 className="text-sm font-bold text-text-primary mb-2">{t('analysis_process_box_title')}</h4>
                                        <p className="text-sm font-semibold text-text-primary">{statusMessage || t('analysis_process_subtitle')}</p>
                                    </div>
                                    {hasDebate && (
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                            <h4 className="text-sm font-bold text-text-primary mb-2">{t('analysis_preliminary_conclusions_title')}</h4>
                                            <p className="text-sm font-semibold text-text-primary">
                                                {t('analysis_preliminary_conclusions_desc')}
                                            </p>
                                        </div>
                                    )}
                                    {(isAnalyzing || livePrognosis) && (
                                        <PrognosisCard
                                            prognosis={livePrognosis}
                                            isLoading={isAnalyzing && !livePrognosis}
                                        />
                                    )}
                                    <p className="text-sm font-semibold text-text-primary italic">{t('analysis_final_report_after_finish')}</p>
                                </div>
                            )}
                            {record?.id && !isNaN(parseInt(record.id, 10)) && fr && (
                                <UsefulnessFeedbackCard analysisId={parseInt(record.id, 10)} />
                            )}
                            {showDownloadSection && (
                                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-600">
                                    <DownloadPanel record={record} hasError={!fr && !!error} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisView;