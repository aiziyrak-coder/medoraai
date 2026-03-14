
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AnalysisRecord, ChatMessage as ChatMessageProps, FinalReport, Diagnosis, PatientData, DetectedMedication, DiagnosisFeedback, PrognosisReport } from '../types';
import * as aiService from '../services/aiCouncilService';

// --- Components ---
import SpinnerIcon from './icons/SpinnerIcon';
import ChatMessage from './ChatMessage';
import FinalReportCard from './FinalReportCard';
import PrognosisCard from './report/PrognosisCard';
import DownloadPanel from './DownloadPanel';
import DebateStatusIndicator from './DebateStatusIndicator';
import { ObjectiveVitalsCards } from './analysis/ObjectiveVitalsCards';

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
}


const AnalysisView: React.FC<AnalysisViewProps> = (props) => {
    const { 
        record, isLive, statusMessage, isAnalyzing, differentialDiagnoses, error, 
        diagnosisFeedback, onDiagnosisFeedback, onStartDebate, onInjectHypothesis, 
        onUserIntervention, onExplainRationale, socraticQuestion,
        livePrognosis, onRunScenario, onUpdateReport
    } = props;
    
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
        return `${pd.firstName || ''} ${pd.lastName || ''}`.trim() || 'Bemor';
    }, [pd]);

    if (!pd) return <div className="text-center p-8">Ma'lumotlar topilmadi.</div>;

    return (
        <div className={`grid grid-cols-1 gap-6 h-full ${fr ? 'xl:grid-cols-12' : 'xl:grid-cols-12'}`}>
            {/* Left Panel: Patient Data */}
            <div className={`${fr ? 'xl:col-span-3' : 'xl:col-span-3'} glass-panel p-6 overflow-y-auto h-full flex flex-col`}>
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-text-primary">Bemor Ma'lumotlari</h3>
                    <div className="h-1 w-12 bg-blue-500 rounded-full mt-1"></div>
                </div>
                
                <div className="space-y-4 text-sm flex-grow">
                    <div className="p-4 bg-white/40 rounded-2xl border border-white/40 shadow-sm">
                        <p className="text-2xl font-bold text-text-primary">{patientDisplayName}</p>
                        <p className="text-text-secondary mt-1">
                            {pd.age ? `${pd.age} yosh` : 'Yosh kiritilmagan'} · {pd.gender === 'male' ? 'Erkak' : pd.gender === 'female' ? 'Ayol' : 'Kiritilmagan'}
                        </p>
                    </div>

                    <div>
                        <strong className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Shikoyatlar</strong>
                        <p className="text-text-primary bg-slate-50/50 p-3 rounded-xl border border-white/20">{pd.complaints}</p>
                    </div>
                    
                    {pd.history && (
                        <div>
                            <strong className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Anamnez</strong>
                            <p className="text-text-primary bg-slate-50/50 p-3 rounded-xl border border-white/20">{pd.history}</p>
                        </div>
                    )}
                    {pd.objectiveData && (
                        <ObjectiveVitalsCards objectiveData={pd.objectiveData} />
                    )}
                    {pd.labResults && (
                        <div>
                            <strong className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Laboratoriya</strong>
                            <p className="text-text-primary bg-slate-50/50 p-3 rounded-xl border border-white/20">{pd.labResults}</p>
                        </div>
                    )}
                    {pd.pharmacogenomicsReport && <p className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl text-purple-700 font-medium">Farmakogenomika hisoboti mavjud</p>}
                </div>
            </div>

            {/* Center Panel: Interactive Analysis */}
            <div className={`${fr ? 'xl:col-span-5' : 'xl:col-span-9'} glass-panel overflow-hidden flex flex-col h-full relative`}>
                 <div className="p-5 border-b border-white/20 flex-shrink-0 bg-white/30 backdrop-blur-md z-10">
                    <h3 className="text-lg font-bold text-text-primary">Interaktiv Tahlil</h3>
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mt-0.5">{statusMessage || "Konsilium jarayoni"}</p>
                </div>
                <div className="p-4 overflow-y-auto flex-grow flex flex-col gap-4">
                    {isAnalyzing && dh.length === 0 && !error && (
                        <div className="flex justify-center items-center flex-1 flex-col">
                            <SpinnerIcon className="w-10 h-10 text-blue-500" />
                            <p className="mt-3 text-text-secondary font-medium">Tahlil qilinmoqda...</p>
                        </div>
                    )}
                    {error && (
                        <div className="p-4 text-sm text-red-700 bg-red-50/90 rounded-2xl border border-red-200 shadow-sm" role="alert">
                            <span className="font-bold">Xatolik!</span> {error}
                        </div>
                    )}

                    {dh.length > 0 && (
                        <div ref={debateScrollRef} className="space-y-3">
                            {(Array.isArray(dh) ? dh : []).map(msg => (
                                <ChatMessage key={msg.id} message={msg} onExplainRationale={onExplainRationale} compact />
                            ))}
                        </div>
                    )}
                    {dh.length === 0 && !isAnalyzing && !error && (
                        <p className="text-text-secondary text-sm">Konsilium boshlandanda bu yerda majlis zali va bahslar ko‘rinadi.</p>
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
                                     <p className="text-xs font-bold text-yellow-700 uppercase mb-1">Konsilium Raisidan Savol:</p>
                                     <p className="text-sm italic text-text-primary">"{socraticQuestion}"</p>
                                 </div>
                                 <form onSubmit={handleInterventionSubmit} className="flex gap-2">
                                    <input type="text" id="analysis-intervention" name="intervention" value={interventionText} onChange={(e) => setInterventionText(e.target.value)} placeholder="Javobingizni kiriting..." className="flex-grow common-input" autoFocus aria-label="Javobingizni kiriting" />
                                    <button type="submit" className="p-3 rounded-xl animated-gradient-button text-white"><SendIcon className="w-5 h-5"/></button>
                                 </form>
                            </div>
                        ) : (
                             <form onSubmit={handleInterventionSubmit} className="flex gap-2">
                                <input type="text" id="analysis-intervention-alt" name="intervention-alt" value={interventionText} onChange={(e) => setInterventionText(e.target.value)} placeholder="Munozaraga aralashish..." className="flex-grow common-input" aria-label="Munozaraga aralashish" />
                                <button type="submit" className="p-3 rounded-xl animated-gradient-button text-white"><SendIcon className="w-5 h-5"/></button>
                            </form>
                        )}
                    </div>
                )}
            </div>
            
            {/* Right Panel: Final Report - faqat tahlil tugaganda ko'rinadi */}
            {fr && (
                <div className="xl:col-span-4 glass-panel overflow-hidden flex flex-col h-full">
                    <div className="p-5 border-b border-white/20 bg-white/30 backdrop-blur-md">
                        <h3 className="text-lg font-bold text-text-primary">Yakuniy Xulosa</h3>
                    </div>
                    <div className="p-5 overflow-y-auto flex-grow custom-scrollbar">
                        <div className="space-y-6">
                            <FinalReportCard report={fr} patientData={pd} onUpdateReport={onUpdateReport} debateHistory={dh} />
                            <DownloadPanel record={record} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisView;