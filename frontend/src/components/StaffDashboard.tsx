
import React, { useState, useEffect } from 'react';
import type { User, PatientQueueItem } from '../types';
import * as queueService from '../services/queueService';
import * as tvLinkService from '../services/tvLinkService';
import XIcon from './icons/XIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import PrintIcon from './icons/PrintIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import TrashIcon from './icons/TrashIcon';
import MonitorIcon from './icons/MonitorIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import PauseIcon from './icons/PauseIcon';
import PlayIcon from './icons/PlayIcon';
import ViewListIcon from './icons/ViewListIcon'; // Make sure this icon exists or use generic
import PatientsList from './PatientsList';
import QRCode from 'qrcode'; // Import QR library
import { useTranslation } from '../hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';
import { logger } from '../utils/logger';

interface StaffDashboardProps {
    user: User;
    onLogout: () => void;
}

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <div className={`ios-glass-card ${className}`}>
        {children}
    </div>
);

const StaffDashboard: React.FC<StaffDashboardProps> = ({ user, onLogout }) => {
    const { t, language, setLanguage } = useTranslation();
    const doctorId = user.linkedDoctorId || '';
    const [view, setView] = useState<'queue' | 'list'>('queue');
    const [queue, setQueue] = useState<PatientQueueItem[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Detailed patient state
    const [newPatient, setNewPatient] = useState({ 
        firstName: '', 
        lastName: '', 
        age: '', 
        address: '' 
    });

    useEffect(() => {
        if (!doctorId) return;
        
        const loadQueue = () => {
            setQueue(queueService.getQueue(doctorId));
        };
        loadQueue();

        const unsubscribe = queueService.subscribeToQueueUpdates(doctorId, (updatedQueue) => {
            setQueue(updatedQueue);
        });

        return () => unsubscribe();
    }, [doctorId]);

    const handleAddPatient = () => {
        if (!newPatient.firstName.trim() || !newPatient.lastName.trim() || !newPatient.age.trim()) {
            alert(t('required_field'));
            return;
        }
        
        const item = queueService.addToQueue(doctorId, {
            firstName: newPatient.firstName,
            lastName: newPatient.lastName,
            age: newPatient.age,
            address: newPatient.address,
            arrivalTime: new Date().toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'}),
            complaints: ''
        });

        setNewPatient({ firstName: '', lastName: '', age: '', address: '' });
        setShowAddModal(false);
        
        // Always attempt to print/show ticket
        handlePrintTicket(item);
    };

    const handlePrintTicket = async (item: PatientQueueItem) => {
        const tvCode = tvLinkService.getOrGenerateTvCode(doctorId);
        const tvUrl = tvLinkService.getTvUrl(tvCode);
        
        try {
            // Generate QR Code Data URL locally
            const qrDataUrl = await QRCode.toDataURL(tvUrl, { width: 200, margin: 1 });

            const printWindow = window.open('', '', 'width=350,height=550');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Courier New', monospace; text-align: center; padding: 10px; margin: 0; }
                            .ticket { border: 2px dashed #000; padding: 15px; border-radius: 10px; display: inline-block; width: 100%; box-sizing: border-box; }
                            h1 { font-size: 32px; margin: 5px 0; }
                            h2 { font-size: 18px; margin: 5px 0; font-weight: bold; }
                            p { font-size: 12px; margin: 2px 0; }
                            .qr-box { margin: 15px 0; display: flex; justify-content: center; }
                            .info { font-size: 10px; font-style: italic; margin-top: 10px; }
                            img { width: 120px; height: 120px; }
                        </style>
                    </head>
                    <body>
                        <div class="ticket">
                            <h2>MEDORA AI</h2>
                            <p>Klinik Navbat Cheki</p>
                            <br/>
                            <h1>#${item.ticketNumber}</h1>
                            <p style="font-size: 14px; font-weight: bold;">${item.lastName} ${item.firstName}</p>
                            <p>Yosh: ${item.age}</p>
                            <p>Vaqt: ${item.arrivalTime}</p>
                            <br/>
                            <div class="qr-box">
                                <img src="${qrDataUrl}" alt="QR Code" />
                            </div>
                            <p>Navbatni kuzatish uchun skanerlang</p>
                            <p class="info">Iltimos, navbatingiz kelishini kuting.</p>
                            <p class="info">Agar o'tkazib yuborsangiz, registratorga murojaat qiling.</p>
                        </div>
                    </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
                
                // Allow image to render before print
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500); 
            }
        } catch (e) {
            // QR generation error
            logger.error("QR Generation Error", e);
            alert("QR Kod generatsiya qilishda xatolik.");
        }
    };

    const handleRemove = (id: string) => {
        if(confirm(t('delete') + "?")) {
            queueService.removeFromQueue(doctorId, id);
        }
    };

    const handleStatusChange = (id: string, newStatus: PatientQueueItem['status']) => {
        queueService.updatePatientStatus(doctorId, id, newStatus);
    };

    const openTvDisplay = () => {
        const code = tvLinkService.getOrGenerateTvCode(doctorId);
        const url = tvLinkService.getTvUrl(code);
        window.open(url, '_blank');
    };

    // Derived lists
    const waitingList = queue.filter(p => p.status === 'waiting' || p.status === 'in-progress');
    const holdList = queue.filter(p => p.status === 'hold');
    const completedList = queue.filter(p => p.status === 'completed');

    return (
        <div className="h-screen w-full medical-mesh-bg text-white flex flex-col font-sans overflow-hidden relative">
            
            {/* --- ADD PATIENT MODAL --- */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up overflow-y-auto">
                    <GlassCard className="w-full max-w-md p-6 bg-slate-900/95 border-white/20 my-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="text-xl font-bold">{t('staff_add_patient')}</h3>
                            <button onClick={() => setShowAddModal(false)}><XIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">{t('data_input_patient_name')}</label>
                                    <input 
                                        value={newPatient.firstName}
                                        onChange={e => setNewPatient({...newPatient, firstName: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                        placeholder="Ali"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">{t('data_input_patient_lastname')}</label>
                                    <input 
                                        value={newPatient.lastName}
                                        onChange={e => setNewPatient({...newPatient, lastName: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                        placeholder="Valiyev"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertTriangleIcon className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                                    <div>
                                        <label className="text-xs font-bold text-yellow-500 uppercase">{t('data_input_age')}</label>
                                        <input 
                                            type="number"
                                            value={newPatient.age}
                                            onChange={e => setNewPatient({...newPatient, age: e.target.value})}
                                            className="w-full common-input bg-white/10 border-yellow-500/50 text-white focus:bg-white focus:text-slate-900 font-bold text-lg mt-1"
                                            placeholder="Masalan: 25"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Manzil</label>
                                <input 
                                    value={newPatient.address}
                                    onChange={e => setNewPatient({...newPatient, address: e.target.value})}
                                    className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                    placeholder="..."
                                />
                            </div>

                            <button 
                                onClick={handleAddPatient}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg mt-2 active:scale-95 transition-transform"
                            >
                                {t('staff_print_ticket')}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Header */}
            <div className="p-5 flex justify-between items-center safe-top bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                        {user.name.charAt(0)}
                    </div>
                    <div>
                        <h1 className="font-bold text-sm">{t('staff_title')}</h1>
                        <p className="text-xs text-slate-400">{t('staff_queue_mgmt')}</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
                    <button 
                        onClick={openTvDisplay}
                        className="p-2 bg-white/10 rounded-full text-slate-300 hover:bg-white/20 hover:text-white"
                        title="TV Ekranni ochish"
                    >
                        <MonitorIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onLogout} className="p-2 bg-white/10 rounded-full text-slate-300 hover:bg-red-500/20 hover:text-red-400">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* View Switcher */}
            <div className="px-5 py-2 flex gap-2">
                <button 
                    onClick={() => setView('queue')}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${view === 'queue' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                >
                    <CheckCircleIcon className="w-5 h-5" />
                    {t('doc_tab_queue')}
                </button>
                <button 
                    onClick={() => setView('list')}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                >
                    <ViewListIcon className="w-5 h-5" />
                    {t('doc_tab_patients')}
                </button>
            </div>

            {/* Main Content Area */}
            {view === 'queue' ? (
                <>
                    {/* Add Action */}
                    <div className="px-5 py-2">
                        <button 
                            onClick={() => setShowAddModal(true)}
                            className="w-full bg-white/10 hover:bg-white/20 border-2 border-dashed border-white/20 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-blue-300 transition-colors"
                        >
                            <PlusCircleIcon className="w-6 h-6" />
                            {t('staff_add_patient')}
                        </button>
                    </div>

                    {/* Lists Container */}
                    <div className="flex-grow overflow-y-auto px-5 pb-10 space-y-6 custom-scrollbar mt-2">
                        
                        {/* 1. CURRENT QUEUE */}
                        <div>
                            <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                {t('doc_tab_queue')}
                            </h3>
                            <div className="space-y-3">
                                {waitingList.length === 0 && <p className="text-center text-white/30 text-sm py-4 bg-white/5 rounded-xl">{t('doc_queue_empty')}</p>}
                                {waitingList.map(item => (
                                    <GlassCard key={item.id} className="p-4 flex items-center justify-between group border-l-4 border-l-blue-500">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-xl font-black text-white border border-white/10">
                                                {item.ticketNumber}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white">{item.lastName} {item.firstName}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-slate-300 bg-white/10 px-1.5 py-0.5 rounded">{item.age} yosh</span>
                                                    {item.status === 'in-progress' ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">
                                                            {t('staff_in_progress')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold bg-blue-500/20 text-blue-400">
                                                            {t('staff_waiting')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.status !== 'in-progress' && (
                                                <button onClick={() => handleStatusChange(item.id, 'hold')} className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400 hover:bg-yellow-500/20" title="Kutishga olish">
                                                    <PauseIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                            <button onClick={() => handlePrintTicket(item)} className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
                                                <PrintIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleRemove(item.id)} className="p-2 bg-red-500/10 rounded-lg text-red-400 hover:bg-red-500/20">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        </div>

                        {/* 2. ON HOLD (KUTISHDA) */}
                        {holdList.length > 0 && (
                            <div className="animate-fade-in-up">
                                <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <PauseIcon className="w-4 h-4" />
                                    {t('staff_hold')}
                                </h3>
                                <div className="space-y-3">
                                    {holdList.map(item => (
                                        <GlassCard key={item.id} className="p-4 flex items-center justify-between group border-l-4 border-l-yellow-500 bg-yellow-500/5">
                                            <div className="flex items-center gap-4 opacity-80">
                                                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-xl font-black text-yellow-200 border border-yellow-500/20">
                                                    {item.ticketNumber}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-yellow-100">{item.lastName} {item.firstName}</h4>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                        {t('staff_hold')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleStatusChange(item.id, 'waiting')} 
                                                    className="px-3 py-2 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-lg shadow-green-500/20 transition-all"
                                                >
                                                    <PlayIcon className="w-4 h-4" /> Faollashtirish
                                                </button>
                                                <button onClick={() => handleRemove(item.id)} className="p-2 bg-red-500/10 rounded-lg text-red-400 hover:bg-red-500/20">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </GlassCard>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. COMPLETED */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 mt-4">{t('staff_completed')}</h3>
                            <div className="space-y-2">
                                {completedList.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 opacity-50 hover:opacity-80 transition-opacity">
                                        <span className="font-bold text-slate-400">#{item.ticketNumber} {item.lastName} {item.firstName}</span>
                                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </>
            ) : (
                <PatientsList queue={queue} />
            )}
        </div>
    );
};

export default StaffDashboard;
