import React from 'react';
import type { TreatmentStrategy } from '../types';

const riskMapping = { 'Low': 15, 'Medium': 40, 'High': 65, 'Very High': 90, 'N/A': 50 };
const benefitMapping = { 'Incremental': 85, 'Significant': 50, 'Breakthrough': 15, 'N/A': 50 };

const RiskBenefitChart: React.FC<{ strategies: TreatmentStrategy[] }> = ({ strategies }) => {
    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-border-color">
            <div className="relative aspect-video w-full">
                {/* Grid Lines & Labels */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                    {[...Array(15)].map((_, i) => <div key={i} className="border-r border-slate-200"></div>)}
                    {[...Array(15)].map((_, i) => <div key={i} className="border-t border-slate-200"></div>)}
                </div>

                {/* Axis Labels */}
                <p className="absolute -left-4 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-bold text-text-secondary tracking-wider">FOYDA</p>
                <p className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold text-text-secondary tracking-wider">RISK</p>
                <p className="absolute -top-2 left-0 text-xs text-green-500">Yuqori</p>
                <p className="absolute -bottom-2 left-0 text-xs text-text-secondary">Past</p>
                <p className="absolute -bottom-2 right-0 text-xs text-red-500">Yuqori</p>
                <p className="absolute -bottom-2 left-0 text-xs text-text-secondary">Past</p>

                {/* Data Points */}
                {strategies.map((s, index) => {
                    const x = riskMapping[s.riskBenefit.risk];
                    const y = benefitMapping[s.riskBenefit.benefit];
                    const colors = {
                        'Breakthrough': 'bg-green-400 ring-green-400/50',
                        'Significant': 'bg-blue-400 ring-blue-400/50',
                        'Incremental': 'bg-yellow-400 ring-yellow-400/50',
                        'N/A': 'bg-slate-400 ring-slate-400/50',
                    }
                    
                    return (
                        <div 
                            key={index} 
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                            style={{ left: `${x}%`, top: `${y}%` }}
                            title={`${s.name} | Risk: ${s.riskBenefit.risk}, Foyda: ${s.riskBenefit.benefit}`}
                        >
                            <div className={`w-4 h-4 rounded-full ${colors[s.riskBenefit.benefit]} ring-2 cursor-pointer transition-transform group-hover:scale-125`}></div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-2 bg-panel-bg text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border-color backdrop-blur-sm">
                                {s.name}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default RiskBenefitChart;
