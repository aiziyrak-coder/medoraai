
import React from 'react';
import type { AnalysisRecord, UserStats, CMETopic } from '../types';
import PlusCircleIcon from './icons/PlusCircleIcon';
import DocumentReportIcon from './icons/DocumentReportIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import UserStatsComponent from './dashboard/UserStats';
import CmeSuggestions from './dashboard/CmeSuggestions';
import { useTranslation } from '../hooks/useTranslation';

interface DashboardProps {
    userName: string;
    onNewAnalysis: () => void;
    onViewHistory: () => void;
    recentAnalyses: AnalysisRecord[];
    onSelectAnalysis: (record: AnalysisRecord) => void;
    stats: UserStats | null;
    cmeTopics: CMETopic[];
}

const Dashboard: React.FC<DashboardProps> = ({ userName, onNewAnalysis, onViewHistory, recentAnalyses, onSelectAnalysis, stats, cmeTopics }) => {
    const { t } = useTranslation();
    const currentDate = new Date().toLocaleDateString('uz-UZ', { weekday: 'long', month: 'long', day: 'numeric' });
    
    return (
        <div className="animate-fade-in-up space-y-8 w-full">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 px-2">
                <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">{currentDate}</p>
                    <h1 className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight">
                        {t('dashboard_greeting', { name: userName.split(' ')[0] })}
                    </h1>
                </div>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
                
                {/* Hero Card - Spans 8 cols on Large */}
                <div 
                    onClick={onNewAnalysis}
                    className="col-span-1 md:col-span-2 lg:col-span-8 relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#007AFF] via-[#3A82F7] to-[#5856D6] text-white shadow-[0_20px_50px_-12px_rgba(58,130,247,0.5)] cursor-pointer group transition-all duration-500 hover:scale-[1.01] hover:shadow-[0_25px_60px_-12px_rgba(58,130,247,0.6)] min-h-[280px] flex flex-col justify-center"
                >
                    {/* Abstract Liquid Shapes Background */}
                    <div className="absolute top-[-50%] right-[-10%] w-[600px] h-[600px] bg-white opacity-10 rounded-full blur-[80px] group-hover:translate-y-4 transition-transform duration-[2s]"></div>
                    <div className="absolute bottom-[-30%] left-[-10%] w-[400px] h-[400px] bg-[#5AC8FA] opacity-20 rounded-full blur-[60px] group-hover:-translate-y-2 transition-transform duration-[2s]"></div>
                    
                    <div className="relative p-10 flex flex-col md:flex-row items-center justify-between gap-8 h-full">
                        <div className="flex-1 space-y-6 z-10 text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-semibold text-white tracking-wide shadow-sm">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#34C759] shadow-[0_0_10px_rgba(52,199,89,0.8)] animate-pulse"></span>
                                AI Konsilium 2.0 Tizimi
                            </div>
                            <div>
                                <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-2">
                                    {t('dashboard_new_analysis_title')}
                                </h2>
                                <p className="text-blue-50/90 text-lg font-medium leading-relaxed max-w-lg">
                                    {t('dashboard_new_analysis_desc')}
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 bg-white text-[#007AFF] px-6 py-3 rounded-2xl font-bold text-lg shadow-lg group-hover:shadow-xl transition-all group-hover:px-8">
                                Boshlash <ChevronRightIcon className="w-5 h-5"/>
                            </div>
                        </div>
                        
                        <div className="flex-shrink-0 relative">
                            <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full scale-110"></div>
                            <div className="bg-white/10 p-8 rounded-[2.5rem] backdrop-blur-md border border-white/30 shadow-inner group-hover:bg-white/20 transition-all duration-300 group-hover:rotate-6 group-hover:scale-105">
                                <PlusCircleIcon className="w-20 h-20 text-white drop-shadow-lg" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Card - Spans 4 cols */}
                <div className="col-span-1 md:col-span-1 lg:col-span-4 h-full min-h-[280px]">
                    {stats ? <UserStatsComponent stats={stats} /> : (
                        <div className="glass-panel p-8 h-full flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                            <p className="text-text-secondary font-medium">{t('dashboard_stats_loading')}</p>
                        </div>
                    )}
                </div>

                {/* Recent History - Spans 8 cols */}
                <div className="col-span-1 md:col-span-2 lg:col-span-8">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                            <div className="p-2 bg-blue-100/50 rounded-xl">
                                <DocumentReportIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            {t('dashboard_recent_analyses_title')}
                        </h2>
                        <button onClick={onViewHistory} className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors bg-white/60 hover:bg-white px-4 py-2 rounded-full shadow-sm">
                            {t('view')} {t('nav_archive')} &rarr;
                        </button>
                    </div>
                    
                    <div className="glass-panel p-3">
                        {recentAnalyses.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {recentAnalyses.map(record => (
                                    <button 
                                        key={record.id} 
                                        onClick={() => onSelectAnalysis(record)}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/60 transition-all duration-300 text-left group border border-transparent hover:border-blue-100 hover:shadow-lg"
                                    >
                                        <div className="flex items-center gap-5 min-w-0">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 font-bold text-xl flex-shrink-0 border border-blue-100 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                                {record.patientData.firstName[0]}{record.patientData.lastName[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-text-primary truncate text-lg group-hover:text-blue-600 transition-colors">
                                                    {record.patientData.firstName} {record.patientData.lastName}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 uppercase tracking-wide border border-slate-200">
                                                        {new Date(record.date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className="text-sm text-text-secondary truncate font-medium flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                        {record.finalReport.consensusDiagnosis[0]?.name || t('unknown_diagnosis')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0 pr-2">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-300 shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                                                <ChevronRightIcon className="w-6 h-6"/>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-16">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-100">
                                    <DocumentReportIcon className="w-10 h-10 text-slate-300" />
                                </div>
                                <p className="text-text-secondary font-medium text-lg">{t('dashboard_no_recent_analyses')}</p>
                                <button onClick={onNewAnalysis} className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-6 py-3 rounded-xl transition-colors">
                                    {t('dashboard_new_analysis_title')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* CME / Education - Spans 4 cols */}
                <div className="col-span-1 md:col-span-2 lg:col-span-4 h-full">
                     <div className="flex items-center gap-2 mb-4 px-2">
                        <h2 className="text-xl font-bold text-text-primary">{t('dashboard_cme_title')}</h2>
                    </div>
                    {cmeTopics ? <CmeSuggestions topics={cmeTopics} /> : (
                        <div className="glass-panel p-8 text-center text-text-secondary h-full flex items-center justify-center">
                            {t('dashboard_cme_loading')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
