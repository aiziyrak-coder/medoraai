import React from 'react';
import type { AnalysisRecord } from '../types';
import PrintIcon from './icons/PrintIcon';

interface EPrescriptionViewProps {
    record: AnalysisRecord;
    onBack: () => void;
}

const EPrescriptionView: React.FC<EPrescriptionViewProps> = ({ record, onBack }) => {
    const { patientData, finalReport, date } = record;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-slate-50 animate-fade-in-up">
             <div className="p-4 bg-slate-100 border-b border-border-color flex justify-between items-center print:hidden">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-accent-color-blue hover:underline">
                        &larr; Tahlilga qaytish
                    </button>
                    <h2 className="text-xl font-bold text-text-primary">Elektron Retsept</h2>
                </div>
                <button onClick={handlePrint} className="flex items-center gap-2 py-2 px-4 text-sm font-bold text-white animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-color-blue">
                    <PrintIcon className="w-5 h-5" />
                    <span>Chop etish</span>
                </button>
            </div>
            
            <div id="prescription-content" className="p-8 max-w-4xl mx-auto bg-white shadow-lg">
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b-2 border-slate-700">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">DR. KONSILIUM AI</h1>
                        <p className="text-slate-500">Klinik Qarorlarni Qo'llab-quvvatlash Tizimi</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold">Sana:</p>
                        <p>{new Date(date).toLocaleDateString('uz-UZ')}</p>
                    </div>
                </div>

                {/* Patient Info */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-6 pb-4 border-b border-slate-300">
                    <div>
                        <p className="text-sm text-slate-500">Bemor:</p>
                        <p className="font-semibold text-lg">{patientData.firstName} {patientData.lastName}</p>
                    </div>
                     <div>
                        <p className="text-sm text-slate-500">Yoshi:</p>
                        <p className="font-semibold text-lg">{patientData.age}</p>
                    </div>
                </div>
                
                {/* Prescription Body */}
                <div className="mt-8">
                     <p className="text-3xl font-light text-slate-400" style={{ fontFamily: 'cursive' }}>Rp/</p>
                     <div className="mt-4 pl-8 space-y-6">
                        {finalReport.medicationRecommendations.map((med, index) => (
                             <div key={index} className="pb-4 border-b border-dashed border-slate-300 last:border-none">
                                <p className="text-xl font-bold text-slate-800">{index + 1}. {med.name}</p>
                                <p className="text-md text-slate-600 ml-6">Dozasi: {med.dosage}</p>
                                <p className="text-md text-slate-600 ml-6">Izoh: {med.notes}</p>
                             </div>
                        ))}
                         {finalReport.medicationRecommendations.length === 0 && (
                            <p className="text-slate-500">Dori-darmonlar tavsiya etilmagan.</p>
                         )}
                     </div>
                </div>
                
                {/* Footer */}
                <div className="mt-24 pt-6 border-t border-slate-300 flex justify-between items-end">
                     <div>
                        <p className="text-sm text-slate-500">Shifokor Imzosi:</p>
                        <div className="w-48 h-12 border-b border-slate-400 mt-2"></div>
                    </div>
                    <div className="text-center">
                         <div className="w-20 h-20 border-2 border-slate-400 rounded-full mx-auto flex items-center justify-center text-slate-400 text-xs">MUHR</div>
                    </div>
                </div>
                 <p className="text-center text-xs text-slate-400 mt-8">
                    Ushbu retsept AI tizimi tomonidan shakllantirilgan va davolovchi shifokor tomonidan tasdiqlanishi shart.
                </p>
            </div>
        </div>
    );
}

export default EPrescriptionView;
