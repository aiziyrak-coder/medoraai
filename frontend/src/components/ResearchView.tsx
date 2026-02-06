import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType, ResearchReport, ResearchProgressUpdate } from '../types';
import { runResearchCouncilDebate } from '../services/aiCouncilService';
import SpinnerIcon from './icons/SpinnerIcon';
import ChatMessage from './ChatMessage';
import ResearchReportCard from './ResearchReportCard';
import LightBulbIcon from './icons/LightBulbIcon';
import RestartIcon from './icons/RestartIcon';
import { useTranslation } from '../hooks/useTranslation';

const ResearchView: React.FC = () => {
    const { t, language } = useTranslation();
    const [diseaseName, setDiseaseName] = useState('Glioblastoma multiforme');
    const [isSearching, setIsSearching] = useState(false);
    const [debateHistory, setDebateHistory] = useState<ChatMessageType[]>([]);
    const [report, setReport] = useState<ResearchReport | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [debateHistory, statusMessage]);


    const resetState = () => {
        setIsSearching(false);
        setDebateHistory([]);
        setReport(null);
        setStatusMessage('');
        setError(null);
    };

    const handleProgress = useCallback((update: ResearchProgressUpdate) => {
        switch (update.type) {
            case 'status':
                setStatusMessage(update.message);
                break;
            case 'message':
                setDebateHistory(prev => {
                    const thinkingIndex = prev.findIndex(m => m.author === update.message.author && m.isThinking);
                    if (thinkingIndex > -1) {
                        const newHistory = [...prev];
                        newHistory[thinkingIndex] = update.message;
                        return newHistory;
                    }
                    return [...prev, update.message];
                });
                break;
            case 'report':
                setReport(update.data);
                setIsSearching(false);
                setStatusMessage('');
                break;
            case 'error':
                setError(update.message);
                setIsSearching(false);
                setStatusMessage('Tadqiqot xatolik bilan yakunlandi.');
                break;
        }
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!diseaseName.trim()) return;
        
        resetState();
        setIsSearching(true);
        await runResearchCouncilDebate(diseaseName, handleProgress, language);
    };

    if (isSearching || report) {
        return (
            <div className="glass-panel animate-fade-in-up">
                 <div className="p-6 md:p-8 flex flex-col h-[calc(100vh-10rem)]">
                    <div className="flex justify-between items-start mb-6 flex-shrink-0">
                        <div>
                            <h2 className="text-2xl font-bold text-text-primary mb-2">
                                Tadqiqot Munozarasi: "{report?.diseaseName || diseaseName}"
                            </h2>
                            <p className="text-text-secondary">Innovatsion davolash usullari bo'yicha ekspertlar muhokamasi.</p>
                        </div>
                        {report && (
                             <button onClick={resetState} className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors border border-border-color">
                                <RestartIcon className="w-5 h-5" />
                                <span>Yangi tadqiqot</span>
                            </button>
                        )}
                    </div>
                     <div ref={scrollRef} className="overflow-y-auto flex-grow pr-4 -mr-4">
                        {debateHistory.map(msg => <ChatMessage key={msg.id} message={msg} onExplainRationale={() => {}} />)}
                        
                        {statusMessage && !report && !error && (
                            <div className="text-center py-4 text-accent-color-cyan font-semibold animate-pulse">
                               {statusMessage}
                            </div>
                        )}

                        {error && (
                            <div className="p-4 my-4 text-sm text-red-300 rounded-lg bg-red-500/20 border border-red-500/30" role="alert">
                              <span className="font-bold">Xatolik!</span> {error}
                            </div>
                        )}
                         {report && <ResearchReportCard report={report} />}
                    </div>

                   
                 </div>
            </div>
        );
    }

    return (
        <div className="glass-panel animate-fade-in-up p-6 md:p-8">
            <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-accent-color-blue/20">
                    <LightBulbIcon className="h-7 w-7 text-accent-color-cyan" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-text-primary">Tadqiqot Markazi</h3>
                <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
                    Davolash usuli murakkab bo'lgan kasallik nomini kiriting. Kengashimiz ushbu kasallik uchun innovatsion va eksperimental davo choralarini muhokama qiladi.
                </p>
            </div>
            <form onSubmit={handleSearch} className="mt-8 max-w-lg mx-auto">
                <div>
                    <label htmlFor="diseaseName" className="block text-sm font-medium text-text-secondary mb-2">
                        Kasallik nomi
                    </label>
                    <input
                        type="text"
                        id="diseaseName"
                        value={diseaseName}
                        onChange={(e) => setDiseaseName(e.target.value)}
                        className="block w-full sm:text-sm common-input focus:border-accent-color-blue focus:ring focus:ring-blue-500/30 placeholder-zinc-500 transition shadow-sm px-4 py-3"
                        placeholder="Masalan: Pankreatik saraton"
                    />
                </div>
                <div className="mt-6">
                    <button
                        type="submit"
                        disabled={isSearching || !diseaseName.trim()}
                        className="w-full flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all duration-300 transform hover:scale-105"
                    >
                        {isSearching ? (
                            <>
                                <SpinnerIcon className="w-5 h-5" />
                                Izlanilmoqda...
                            </>
                        ) : (
                            "Tadqiqotni Boshlash"
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ResearchView;