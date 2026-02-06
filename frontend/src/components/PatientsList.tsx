
import React, { useState } from 'react';
import type { PatientQueueItem } from '../types';
import SearchIcon from './icons/SearchIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface PatientsListProps {
    queue: PatientQueueItem[];
}

const PatientsList: React.FC<PatientsListProps> = ({ queue }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPatients = queue.filter(p => 
        p.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.ticketNumber.toString().includes(searchTerm)
    ).sort((a, b) => parseInt(b.id) - parseInt(a.id)); // Newest first

    return (
        <div className="flex flex-col h-full animate-fade-in-up">
            <div className="p-5 border-b border-white/10 flex-shrink-0">
                <h2 className="text-2xl font-bold text-white mb-2">Bemorlar Ro'yxati</h2>
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Ism yoki chek raqami bo'yicha qidirish..."
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-slate-400 focus:bg-white focus:text-slate-900 transition-all outline-none"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <SearchIcon className="w-5 h-5" />
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-5 custom-scrollbar">
                <div className="space-y-3">
                    {filteredPatients.length === 0 && (
                        <p className="text-center text-slate-500 mt-10">Bemorlar topilmadi.</p>
                    )}
                    {filteredPatients.map(patient => (
                        <div key={patient.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                                    patient.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                                    patient.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-slate-500/20 text-slate-400'
                                }`}>
                                    #{patient.ticketNumber}
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-base">{patient.patientName}</h4>
                                    <p className="text-xs text-slate-400">{patient.arrivalTime} • {patient.age} yosh • {patient.address}</p>
                                </div>
                            </div>
                            <div>
                                {patient.status === 'completed' && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded">
                                        <CheckCircleIcon className="w-3 h-3" /> Yakunlangan
                                    </span>
                                )}
                                {patient.status === 'in-progress' && (
                                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded animate-pulse">
                                        Qabulda
                                    </span>
                                )}
                                {patient.status === 'waiting' && (
                                    <span className="text-xs font-bold text-slate-400 bg-white/5 px-2 py-1 rounded">
                                        Kutmoqda
                                    </span>
                                )}
                                {patient.status === 'hold' && (
                                    <span className="text-xs font-bold text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                                        Kutishda
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PatientsList;
