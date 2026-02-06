import React from 'react';
import type { FinalReport } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';

interface LiveSynthesisPanelProps {
    synthesis: Partial<FinalReport> | null;
}

const LiveSynthesisPanel: React.FC<LiveSynthesisPanelProps> = ({ synthesis }) => {
    if (!synthesis) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary">
                <SpinnerIcon className="w-8 h-8 text-accent-color-cyan" />
                <p className="mt-3 font-semibold">Tahlil natijalari kutilmoqda...</p>
            </div>
        );
    }
    
    const { consensusDiagnosis } = synthesis;

    return (
        <div className="animate-fade-in-up space-y-6 text-sm">
            {consensusDiagnosis && consensusDiagnosis.length > 0 && (
                <div>
                    <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        Ehtimolli Tashxislar
                    </h4>
                    <ul className="space-y-3">
                        {consensusDiagnosis.sort((a,b) => b.probability - a.probability).map((diag, index) => (
                            <li key={index} className="p-3 bg-slate-50 rounded-lg border border-border-color">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-text-primary">{diag.name}</span>
                                    <span className="font-bold text-green-500">{diag.probability}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                                    <div className="h-full rounded-full bg-green-500" style={{ width: `${diag.probability}%` }}></div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

             {/* Add placeholders for other sections as they get populated */}
            {!consensusDiagnosis && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary p-4">
                    <p>Konsilium muhokamasi davom etmoqda. Asosiy xulosalar shu yerda paydo bo'ladi.</p>
                </div>
            )}
        </div>
    );
};

// A simple check circle icon for the live synthesis panel
const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


export default LiveSynthesisPanel;
