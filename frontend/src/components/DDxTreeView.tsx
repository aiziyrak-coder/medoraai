import React from 'react';
import type { Diagnosis } from '../types';

interface DDxTreeViewProps {
    diagnoses: Diagnosis[];
    onStartDebate: () => void;
    isDebateStarted: boolean;
}

const DDxTreeView: React.FC<DDxTreeViewProps> = ({ diagnoses, onStartDebate, isDebateStarted }) => {
    // This is a simplified tree view for demonstration.
    // A real implementation would use a proper tree-layout algorithm.
    const primary = diagnoses[0];
    const secondaries = diagnoses.slice(1);

    return (
        <div className="mb-6 animate-fade-in-up">
             <h4 className="font-bold text-sm text-text-primary mb-3">Differensial Tashxislar (Daraxt Ko'rinishi)</h4>
             <div className="flex flex-col items-center">
                {/* Primary Diagnosis */}
                {primary && (
                    <div className="p-3 bg-blue-100 border-2 border-blue-300 rounded-lg text-center shadow-lg z-10">
                        <p className="font-bold text-blue-800">{primary.name}</p>
                        <p className="text-sm font-extrabold text-blue-600">{primary.probability}%</p>
                    </div>
                )}

                {/* Connecting Lines */}
                {secondaries.length > 0 && (
                     <div className="w-px h-8 bg-slate-300"></div>
                )}
               
                {/* Secondary Diagnoses */}
                <div className="flex justify-center gap-4">
                     {secondaries.map((diag, index) => (
                        <div key={index} className="flex flex-col items-center">
                            <div className="w-px h-8 bg-slate-300"></div>
                             <div className="p-2 bg-slate-100 border border-slate-300 rounded-lg text-center">
                                <p className="font-semibold text-text-primary text-sm">{diag.name}</p>
                                <p className="text-xs font-bold text-text-secondary">{diag.probability}%</p>
                            </div>
                        </div>
                     ))}
                </div>
             </div>
             {!isDebateStarted && (
                <div className="mt-4">
                    <button onClick={onStartDebate} className="w-full animated-gradient-button text-white font-semibold py-2 rounded-lg">
                        Munozarani Boshlash
                    </button>
                </div>
            )}
             <hr className="my-6 border-border-color" />
        </div>
    );
}

export default DDxTreeView;
