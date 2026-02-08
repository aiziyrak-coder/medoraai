
import React, { useState, useRef, useEffect } from 'react';
import type { User, PatientData, FinalReport, PatientQueueItem, AnalysisRecord, UserStats } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import * as aiService from '../services/aiCouncilService';
import * as authService from '../services/apiAuthService';
import * as localAuthService from '../services/authService';
import * as queueService from '../services/queueService';
import * as settingsService from '../services/settingsService'; 
import * as tvLinkService from '../services/tvLinkService'; 
import * as caseService from '../services/caseService';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { logger } from '../utils/logger';
import { LIMITS } from '../constants/timeouts'; 

// Icons
import PlusCircleIcon from './icons/PlusCircleIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import CameraIcon from './icons/CameraIcon';
import PhotoIcon from './icons/PhotoIcon';
import XIcon from './icons/XIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import HomeIcon from './icons/HomeIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import AudioVisualizer from './AudioVisualizer';
import ClipboardListIcon from './icons/ClipboardListIcon';
import PillIcon from './icons/PillIcon';
import HeartRateIcon from './icons/HeartRateIcon'; 
import OxygenIcon from './icons/OxygenIcon'; 
import StethoscopeIcon from './icons/StethoscopeIcon';
import UploadCloudIcon from './icons/UploadCloudIcon';
import UsersIcon from './icons/UsersIcon';
import MonitorIcon from './icons/MonitorIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import PencilIcon from './icons/PencilIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import PlayIcon from './icons/PlayIcon';
import ViewListIcon from './icons/ViewListIcon';
import DocumentReportIcon from './icons/DocumentReportIcon';
import PatientsList from './PatientsList';
import LanguageSwitcher from './LanguageSwitcher';
import { Language } from '../i18n/LanguageContext';
import DrugInteractionChecker from './tools/DrugInteractionChecker';
import DrugIdentifier from './tools/DrugIdentifier';

interface DoctorDashboardProps {
    user: User;
    onLogout: () => void;
}

// Extend Queue Item locally if needed
interface DoctorPatient extends PatientQueueItem {}

interface Attachment {
    file: File;
    preview: string;
    type: 'image' | 'doc';
}

// --- HELPER COMPONENTS ---

const GlassCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
    <div onClick={onClick} className={`ios-glass-card ${className} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform duration-300' : ''}`}>
        {children}
    </div>
);

const VitalInputCompact: React.FC<{ 
    label: string; 
    value: string; 
    onChange: (val: string) => void;
    unit: string;
    icon: React.ReactNode;
    color: string;
    onFocus?: () => void;
}> = ({ label, value, onChange, unit, icon, color, onFocus }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const handleFocus = () => {
        onFocus?.();
    };
    return (
    <div 
        onClick={() => inputRef.current?.focus()}
        className="flex flex-col bg-slate-800/60 border-2 border-slate-700 rounded-xl p-2.5 relative overflow-hidden group focus-within:border-blue-500 focus-within:bg-slate-800 transition-all cursor-text select-text"
    >
        <div className={`absolute top-1 right-1 text-${color}-400 opacity-40 pointer-events-none`}>
            {icon}
        </div>
        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider mb-1 pointer-events-none">{label}</span>
        <div className="flex items-baseline gap-1 z-10 min-h-[28px]">
            <input 
                ref={inputRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(e.target.value)}
                onFocus={handleFocus}
                placeholder="-"
                aria-label={label}
                className="w-full bg-transparent text-xl font-black text-white outline-none placeholder-slate-600 min-w-0 min-h-[1.5rem] py-0.5"
            />
            <span className="text-[10px] text-slate-400 font-bold shrink-0 pointer-events-none">{unit}</span>
        </div>
    </div>
    );
};

// --- TAB COMPONENTS ---

const DiagnosisTab: React.FC<{ report: FinalReport }> = ({ report }) => {
    const primaryDiag = report.consensusDiagnosis[0];
    return (
    <div className="space-y-4 animate-fade-in-up">
        {report.criticalFinding && (
            <GlassCard className="p-5 border-l-4 border-red-500 bg-red-500/10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                    <h4 className="text-red-400 font-bold text-xs uppercase tracking-widest">Kritik Signal</h4>
                </div>
                <p className="text-white font-bold text-xl leading-tight text-glow">{report.criticalFinding.finding}</p>
                <p className="text-red-200/80 text-sm mt-2 font-medium">{report.criticalFinding.implication}</p>
            </GlassCard>
        )}
        
        {primaryDiag && (
            <GlassCard className="p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-2xl text-white">{primaryDiag.name}</h3>
                        <div className="flex flex-col items-end">
                            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">{primaryDiag.probability}%</span>
                        </div>
                    </div>
                    
                    {primaryDiag.reasoningChain && primaryDiag.reasoningChain.length > 0 && (
                        <div className="mt-4 pl-4 border-l-2 border-white/10 space-y-3">
                            {primaryDiag.reasoningChain.map((step, idx) => (
                                <p key={idx} className="text-sm text-slate-300 leading-relaxed font-light">
                                    {step}
                                </p>
                            ))}
                        </div>
                    )}

                    {primaryDiag.uzbekProtocolMatch && (
                        <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <CheckCircleIcon className="w-3 h-3" />
                            {primaryDiag.uzbekProtocolMatch}
                        </div>
                    )}
                </div>
            </GlassCard>
        )}
    </div>
    );
};

const PlanTab: React.FC<{ report: FinalReport }> = ({ report }) => (
    <div className="space-y-4 animate-fade-in-up">
        <GlassCard className="p-6">
            <h4 className="font-bold text-white/90 text-lg mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-indigo-500/30">1</div>
                Davolash Taktikasi
            </h4>
            <div className="space-y-5 relative pl-4">
                <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-white/10 rounded-full"></div>
                {report.treatmentPlan.map((step, i) => (
                    <div key={i} className="flex gap-5 relative z-10 group">
                        <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-indigo-500 flex items-center justify-center text-[10px] font-bold text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)] shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                            {i + 1}
                        </div>
                        <p className="text-sm text-slate-200 font-medium leading-relaxed">{step}</p>
                    </div>
                ))}
            </div>
        </GlassCard>

        <GlassCard className="p-6">
            <h4 className="font-bold text-white/90 text-lg mb-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-pink-500/30">2</div>
                Qo'shimcha Tekshiruvlar
            </h4>
            <ul className="space-y-3">
                {report.recommendedTests.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_5px_#f472b6]"></div>
                        <span className="text-sm text-slate-200 font-medium">{t}</span>
                    </li>
                ))}
            </ul>
        </GlassCard>
    </div>
);

const PrescriptionTab: React.FC<{ report: FinalReport }> = ({ report }) => (
    <div className="space-y-4 animate-fade-in-up">
        {report.medicationRecommendations.length === 0 && (
            <p className="text-center text-slate-400 py-8">Dori tavsiya qilinmagan.</p>
        )}
        {report.medicationRecommendations.map((med, i) => (
            <GlassCard key={i} className="p-5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                        <h4 className="font-black text-lg text-white tracking-tight">{med.name}</h4>
                        <span className="text-[9px] font-black uppercase text-emerald-300 bg-emerald-900/40 px-2 py-1 rounded-md border border-emerald-500/30">
                            O'zbekiston
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {med.dosage && (
                            <div className="bg-blue-900/20 p-2 rounded border border-blue-500/20">
                                <p className="text-[10px] text-blue-300 mb-0.5">💊 Dozasi</p>
                                <p className="text-sm font-bold text-white">{med.dosage}</p>
                            </div>
                        )}
                        {med.frequency && (
                            <div className="bg-purple-900/20 p-2 rounded border border-purple-500/20">
                                <p className="text-[10px] text-purple-300 mb-0.5">🔁 Chastota</p>
                                <p className="text-sm font-bold text-white">{med.frequency}</p>
                            </div>
                        )}
                        {med.timing && (
                            <div className="bg-amber-900/20 p-2 rounded border border-amber-500/20">
                                <p className="text-[10px] text-amber-300 mb-0.5">⏰ Vaqt</p>
                                <p className="text-sm font-bold text-white">{med.timing}</p>
                            </div>
                        )}
                        {med.duration && (
                            <div className="bg-green-900/20 p-2 rounded border border-green-500/20">
                                <p className="text-[10px] text-green-300 mb-0.5">📅 Davomiyligi</p>
                                <p className="text-sm font-bold text-white">{med.duration}</p>
                            </div>
                        )}
                    </div>
                    
                    {med.instructions && (
                        <p className="text-xs text-slate-300 bg-black/30 p-3 rounded-lg border border-white/5">
                            📋 <span className="font-semibold">Yo'riqnoma:</span> {med.instructions}
                        </p>
                    )}
                </div>
            </GlassCard>
        ))}
        
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 backdrop-blur-md">
            <span className="text-xl">⚠️</span>
            <p className="text-xs text-amber-200 leading-relaxed font-medium">
                <span className="font-bold text-amber-100">Diqqat:</span> Ushbu elektron retsept tavsiyaviy xarakterga ega. 
                {report.uzbekistanLegislativeNote && ` ${report.uzbekistanLegislativeNote}`}
            </p>
        </div>
    </div>
);

// --- NEW SUB-VIEWS FOR DOCK ---

const DocumentsView: React.FC<{ user: User }> = ({ user }) => {
    const [docs, setDocs] = useState<AnalysisRecord[]>([]);
    const { t } = useTranslation();

    useEffect(() => {
        // Load analyses - try API first, fallback to local
        const loadAnalyses = async () => {
            try {
                const { getAnalyses } = await import('../services/apiAnalysisService');
                const response = await getAnalyses();
                if (response.success && response.data) {
                    setDocs(response.data);
                    return;
                }
            } catch {
                // Fallback to local
            }
            // Fallback to local storage
            const { getAnalyses: getLocalAnalyses } = await import('../services/authService');
            const history = getLocalAnalyses(user.phone);
            setDocs(history);
        };
        loadAnalyses();
    }, [user.phone]);

    return (
        <div className="flex flex-col h-full animate-fade-in-up p-5 pb-32">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                {t('doc_docs_title')}
            </h2>
            <p className="text-slate-400 mb-6">{t('doc_docs_desc')}</p>
            
            <div className="space-y-4">
                {docs.length === 0 && <p className="text-center text-slate-500 py-10">Hujjatlar mavjud emas.</p>}
                {docs.map(doc => (
                    <GlassCard key={doc.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                <DocumentReportIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white">{doc.patientData.firstName} {doc.patientData.lastName}</h4>
                                <p className="text-xs text-slate-400">{new Date(doc.date).toLocaleDateString()}</p>
                                <span className="text-[10px] text-blue-300 uppercase font-bold">Tibbiy Xulosa</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="px-4 py-2 bg-blue-600 rounded-lg text-xs font-bold text-white">PDF</button>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    )
}

const ProfileView: React.FC<{ user: User, onLogout: () => void }> = ({ user, onLogout }) => {
    const { t, language, setLanguage } = useTranslation();
    const [stats, setStats] = useState<UserStats | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Load analyses - try API first, fallback to local
            try {
                const { getAnalyses } = await import('../services/apiAnalysisService');
                const response = await getAnalyses();
                if (cancelled) return;
                if (response.success && response.data) {
                    setStats(caseService.getDashboardStats(response.data));
                    return;
                }
            } catch {
                // Fallback to local
            }
            if (cancelled) return;
            // Fallback to local storage
            const { getAnalyses: getLocalAnalyses } = await import('../services/authService');
            const history = getLocalAnalyses(user.phone);
            setStats(caseService.getDashboardStats(history));
        })();
        return () => { cancelled = true; };
    }, [user.phone]);

    return (
        <div className="flex flex-col h-full animate-fade-in-up p-5 pb-32 overflow-y-auto">
            <h2 className="text-3xl font-black text-white mb-8">{t('doc_profile_title')}</h2>
            
            {/* User Info Card */}
            <GlassCard className="p-6 flex items-center gap-6 mb-6 bg-gradient-to-r from-blue-900/40 to-slate-900/40">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                    {user.name.charAt(0)}
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-white">{user.name}</h3>
                    <p className="text-blue-300 font-medium">{user.specialties?.join(', ')}</p>
                    <p className="text-xs text-slate-400 mt-1">{user.phone}</p>
                </div>
            </GlassCard>

            {/* Obuna */}
            {(user.subscriptionPlan || user.subscriptionExpiry || user.trialEndsAt) && (
                <GlassCard className="p-4 mb-6 bg-white/5 border border-white/10">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">Obuna</h4>
                    {user.subscriptionPlan && (
                        <p className="text-white font-medium">{user.subscriptionPlan.name}</p>
                    )}
                    {user.trialEndsAt && new Date(user.trialEndsAt) > new Date() && (
                        <p className="text-green-400 text-sm mt-1">
                            Trial: {Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} kun qoldi
                        </p>
                    )}
                    {user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date() && !user.trialEndsAt && (
                        <p className="text-slate-300 text-sm mt-1">
                            Tugash: {new Date(user.subscriptionExpiry).toLocaleDateString('uz-UZ')}
                        </p>
                    )}
                </GlassCard>
            )}

            {/* Language Settings */}
            <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 ml-1">{t('doc_settings_language')}</h4>
                <div className="bg-white/5 rounded-2xl p-2 border border-white/10">
                    <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <GlassCard className="p-4 text-center">
                        <p className="text-3xl font-black text-white">{stats.totalAnalyses}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">{t('doc_stat_patients')}</p>
                    </GlassCard>
                    <GlassCard className="p-4 text-center">
                        <p className="text-3xl font-black text-green-400">4.9</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">{t('doc_stat_rating')}</p>
                    </GlassCard>
                </div>
            )}

            <button onClick={onLogout} className="w-full py-4 rounded-xl bg-red-500/10 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/20 transition-colors">
                {t('logout')}
            </button>
        </div>
    )
}

// --- MAIN DOCTOR DASHBOARD ---

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ user, onLogout }) => {
    const { t, language, setLanguage } = useTranslation();
    
    // State
    const [view, setView] = useState<'queue' | 'consultation' | 'assistant' | 'patients_list' | 'documents' | 'profile' | 'drug_tools'>('queue');
    const [mode, setMode] = useState<'input' | 'processing' | 'result'>('input');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Immediate Admission (Walk-in) State
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [walkInPatient, setWalkInPatient] = useState({ firstName: '', lastName: '', age: '', address: '' });

    // Edit Patient State
    const [showEditPatientModal, setShowEditPatientModal] = useState(false);
    const [editingPatient, setEditingPatient] = useState<DoctorPatient | null>(null);

    // Assistant Mgmt State
    const [assistantData, setAssistantData] = useState({ name: '', phone: '', password: '' });
    const [assistantMsg, setAssistantMsg] = useState('');

    // TV Settings State
    const [tvSettings, setTvSettings] = useState<settingsService.TvSettings>({ isUnlocked: false, videoUrl: '', scrollingText: '' });
    const [unlockCodeInput, setUnlockCodeInput] = useState('');
    const [tvMsg, setTvMsg] = useState('');

    // Data
    const [queue, setQueue] = useState<DoctorPatient[]>([]);
    const [currentPatient, setCurrentPatient] = useState<DoctorPatient | null>(null);
    const [complaints, setComplaints] = useState('');
    
    // Vitals
    const [vitals, setVitals] = useState({
        bpSys: '', bpDia: '', heartRate: '', temp: '', spO2: '', respiration: ''
    });

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [report, setReport] = useState<FinalReport | null>(null);

    // Tools
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { isListening, transcript, startListening, stopListening } = useSpeechToText();

    // Init Queue & Settings
    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            const data = await queueService.loadQueueFromServer(user.phone);
            if (!cancelled) setQueue(data as DoctorPatient[]);
        };
        init();
        const unsubscribeQueue = queueService.subscribeToQueueUpdates(user.phone, (updatedQueue) => {
            if (!cancelled) setQueue(updatedQueue as DoctorPatient[]);
        });

        // Assistant
        const existingAssistant = localAuthService.getAssistant(user.phone);
        if (existingAssistant) {
            setAssistantData({ name: existingAssistant.name, phone: existingAssistant.phone, password: '' });
        }

        // TV Settings
        setTvSettings(settingsService.getTvSettings(user.phone));

        return () => {
            cancelled = true;
            unsubscribeQueue();
        };
    }, [user.phone]);

    useEffect(() => {
        if (transcript && isListening) {
            setComplaints(prev => {
                if (prev.endsWith(transcript)) return prev;
                return prev + (prev ? ' ' : '') + transcript;
            });
        }
    }, [transcript, isListening]);

    // Handlers
    const handleStartPatient = (patient: DoctorPatient) => {
        setCurrentPatient(patient);
        setComplaints(patient.complaints || '');
        setAttachments([]);
        setVitals({ bpSys: '', bpDia: '', heartRate: '', temp: '', spO2: '', respiration: '' });
        setReport(null);
        setMode('input');
        setView('consultation');
        queueService.updatePatientStatus(user.phone, patient.id, 'in-progress').then(() => {
            setQueue(queueService.getQueue(user.phone) as DoctorPatient[]);
        }).catch(() => {});
    };

    // New "Navbatsiz Qabul" (Immediate Admission) Logic
    const handleImmediateAdmit = async () => {
        if (!walkInPatient.firstName || !walkInPatient.lastName || !walkInPatient.age) {
            alert(t('alert_required_name_age'));
            return;
        }
        try {
            const newPatient = await queueService.addToQueue(user.phone, {
                firstName: walkInPatient.firstName,
                lastName: walkInPatient.lastName,
                age: walkInPatient.age,
                address: walkInPatient.address,
                arrivalTime: new Date().toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'}),
                complaints: 'Navbatsiz qabul'
            });
            if (currentPatient) {
                await queueService.updatePatientStatus(user.phone, currentPatient.id, 'hold');
            }
            await queueService.updatePatientStatus(user.phone, newPatient.id, 'in-progress');
            setQueue(queueService.getQueue(user.phone) as DoctorPatient[]);
            const patientWithId = { ...newPatient, id: newPatient.id, status: 'in-progress' } as DoctorPatient;
            setCurrentPatient(patientWithId);
            setComplaints('');
            setAttachments([]);
            setVitals({ bpSys: '', bpDia: '', heartRate: '', temp: '', spO2: '', respiration: '' });
            setReport(null);
            setMode('input');
            setView('consultation');
            setWalkInPatient({ firstName: '', lastName: '', age: '', address: '' });
            setShowWalkInModal(false);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Navbatga qo\'shish amalga oshmadi.');
        }
    };

    const handleEditPatientOpen = () => {
        if (currentPatient) {
            setEditingPatient({ ...currentPatient });
            setShowEditPatientModal(true);
        }
    };

    const handleEditPatientSave = async () => {
        if (editingPatient && currentPatient) {
            try {
                await queueService.updatePatientDetails(user.phone, currentPatient.id, {
                    firstName: editingPatient.firstName,
                    lastName: editingPatient.lastName,
                    age: editingPatient.age,
                    address: editingPatient.address
                });
                setQueue(queueService.getQueue(user.phone) as DoctorPatient[]);
                setCurrentPatient(editingPatient);
                setShowEditPatientModal(false);
            } catch {
                // ignore
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setAttachments(prev => [...prev, {
                        file,
                        preview: file.type.startsWith('image/') ? ev.target?.result as string : '',
                        type: file.type.startsWith('image/') ? 'image' : 'doc'
                    }]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const handleVitalChange = (key: keyof typeof vitals, value: string) => {
        // Bo'sh, yoki raqam (minus, kasr qo'llab-quvvatlanadi)
        if (value !== '' && !/^-?\d*\.?\d*$/.test(value)) return;
        setVitals(prev => ({ ...prev, [key]: value }));
    };

    const handleAnalyze = async () => {
        if ((!complaints.trim() && attachments.length === 0) || !currentPatient) {
            alert(t('alert_complaints_required'));
            return;
        }
        if (mode === 'processing') return;
        setMode('result');
        setIsAnalyzing(true);
        setReport(null);
        try {
            const formattedAttachments = await Promise.all(attachments.map(async (att) => {
                // Fixed: Remove casting causing issues. att.file is already defined as File in the interface.
                const file = att.file;
                const isSupported = (file.type && file.type.startsWith('image/')) || file.type === 'application/pdf';
                return {
                    name: file.name,
                    base64Data: isSupported 
                        ? (await blobToBase64(file)).split(',')[1] 
                        : '', 
                    mimeType: file.type
                };
            }));

            const supportedAttachments = formattedAttachments.filter(a => a.base64Data);

            const objectiveData = `
                Vital Ko'rsatkichlar:
                Qon Bosimi: ${vitals.bpSys || '-'}/${vitals.bpDia || '-'} mm.Hg
                Puls: ${vitals.heartRate || '-'} bpm
                Harorat: ${vitals.temp || '-'} °C
                Saturatsiya: ${vitals.spO2 || '-'} %
                Nafas Soni: ${vitals.respiration || '-'} /min
                
                Yashash Manzili: ${currentPatient.address || 'Kiritilmagan'}
            `;

            const patientData: PatientData = {
                firstName: currentPatient.firstName,
                lastName: currentPatient.lastName,
                age: currentPatient.age,
                gender: '', 
                complaints: complaints,
                objectiveData: objectiveData,
                attachments: supportedAttachments
            };

            const result = await aiService.generateFastDoctorConsultation(patientData, user.specialties || [], language);
            setReport(result);
            setIsAnalyzing(false);
        } catch (e) {
            setIsAnalyzing(false);
            const { getUserFriendlyError } = await import('../utils/errorHandler');
            const errorMessage = getUserFriendlyError(e, "Tahlilda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
            const retry = confirm(`${errorMessage}\n\n${t('confirm_retry_analysis')}`);
            if (retry) {
                handleAnalyze();
            } else {
                setMode('input');
            }
        }
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleFinish = async () => {
        if (!confirm(t('confirm_finish_consultation'))) return;
        if (currentPatient) {
            await queueService.updatePatientStatus(user.phone, currentPatient.id, 'completed').catch(() => {});
            setQueue(queueService.getQueue(user.phone) as DoctorPatient[]);
        }
        setCurrentPatient(null);
        setComplaints('');
        setVitals({ bpSys: '', bpDia: '', heartRate: '', temp: '', spO2: '', respiration: '' });
        setAttachments([]);
        setReport(null);
        setView('queue');
        setMode('input');
    };

    const handleSaveAssistant = async () => {
        if (!assistantData.name || !assistantData.phone) {
            setAssistantMsg("Ism va telefon raqam majburiy.");
            return;
        }
        if (!assistantData.password || assistantData.password.length < 8) {
            setAssistantMsg("Parol kamida 8 ta belgidan iborat bo'lishi kerak.");
            return;
        }
        try {
            setAssistantMsg("Yuklanmoqda...");
            const { register } = await import('../services/apiAuthService');
            const { getProfile } = await import('../services/apiAuthService');
            const doctorProfile = await getProfile();
            if (!doctorProfile || !doctorProfile.phone) {
                setAssistantMsg("Shifokor profili topilmadi. Qayta kiring.");
                return;
            }
            // Backend ID kutadi, lekin bizda phone bor - backenddan ID olish kerak
            // Hozircha phone yuboramiz, backend serializer'da phone'ni ID ga o'giradi
            const result = await register({
                phone: assistantData.phone,
                name: assistantData.name,
                password: assistantData.password,
                password_confirm: assistantData.password,
                role: 'staff',
                linked_doctor: String(user.phone), // Backend buni ID sifatida qabul qiladi
            });
            if (result.success) {
                setAssistantMsg("Yordamchi muvaffaqiyatli qo'shildi! U o'z telefoni va paroli bilan kirishi mumkin.");
                setAssistantData({ name: '', phone: '', password: '' });
            } else {
                const errorMsg = typeof result.message === 'string' 
                    ? result.message 
                    : JSON.stringify(result.message || result);
                setAssistantMsg(`Xatolik: ${errorMsg}`);
                logger.error("Assistant register error:", result);
            }
        } catch (error) {
            setAssistantMsg(`Xatolik: ${error instanceof Error ? error.message : String(error)}`);
            logger.error("Assistant register exception:", error);
        }
    };

    const handleDeleteAssistant = async () => {
        // Yordamchini o'chirish backend orqali - hozircha ishlatilmaydi
        setAssistantMsg("O'chirish funksiyasi hozircha ishlamaydi.");
        setAssistantData({ name: '', phone: '', password: '' });
        setAssistantMsg("Yordamchi o'chirildi.");
    };

    // TV Settings Handlers
    const handleUnlockTv = () => {
        const correctCode = settingsService.generateUnlockCode(user.phone);
        if (unlockCodeInput === correctCode) {
            const newSettings = { ...tvSettings, isUnlocked: true };
            setTvSettings(newSettings);
            settingsService.saveTvSettings(user.phone, newSettings);
            setTvMsg("Reklama bloki ochildi!");
        } else {
            setTvMsg("Noto'g'ri kod. Admin bilan bog'laning.");
        }
    };

    const handleSaveTvSettings = () => {
        settingsService.saveTvSettings(user.phone, tvSettings);
        setTvMsg("Sozlamalar saqlandi.");
    };

    const openTvDisplay = () => {
        const code = tvLinkService.getOrGenerateTvCode(user.phone);
        const url = tvLinkService.getTvUrl(code);
        window.open(url, '_blank');
    };

    return (
        <div className="h-screen w-full medical-mesh-bg text-white flex flex-col font-sans overflow-hidden">
            
            {/* --- IMMEDIATE ADMISSION (NAVBATSIZ) MODAL --- */}
            {showWalkInModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
                    <GlassCard className="w-full max-w-md p-6 border-white/20 bg-slate-900/80">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <PlayIcon className="w-5 h-5 text-green-400"/> Navbatsiz Qabul
                            </h3>
                            <button onClick={() => setShowWalkInModal(false)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-200">
                                Ushbu bemor navbat kutmasdan, to'g'ridan-to'g'ri qabulga kiritiladi.
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Ism</label>
                                    <input 
                                        value={walkInPatient.firstName}
                                        onChange={e => setWalkInPatient({...walkInPatient, firstName: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white placeholder-slate-500 focus:bg-white focus:text-slate-900"
                                        placeholder="Ism"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Familiya</label>
                                    <input 
                                        value={walkInPatient.lastName}
                                        onChange={e => setWalkInPatient({...walkInPatient, lastName: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white placeholder-slate-500 focus:bg-white focus:text-slate-900"
                                        placeholder="Familiya"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Yosh</label>
                                <input 
                                    type="number"
                                    value={walkInPatient.age}
                                    onChange={e => setWalkInPatient({...walkInPatient, age: e.target.value})}
                                    className="w-full common-input bg-white/10 border-white/10 text-white placeholder-slate-500 focus:bg-white focus:text-slate-900 font-bold"
                                    placeholder="Masalan: 35"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Manzil</label>
                                <input 
                                    value={walkInPatient.address}
                                    onChange={e => setWalkInPatient({...walkInPatient, address: e.target.value})}
                                    className="w-full common-input bg-white/10 border-white/10 text-white placeholder-slate-500 focus:bg-white focus:text-slate-900"
                                    placeholder="Manzil (ixtiyoriy)"
                                />
                            </div>
                            <button 
                                onClick={handleImmediateAdmit}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg mt-4 active:scale-95 transition-all"
                            >
                                Qabulni Boshlash
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* --- EDIT PATIENT MODAL --- */}
            {showEditPatientModal && editingPatient && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up overflow-y-auto">
                    <GlassCard className="w-full max-w-md p-6 border-white/20 bg-slate-900/95 my-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <PencilIcon className="w-5 h-5"/> Bemor Ma'lumotlarini Tahrirlash
                            </h3>
                            <button onClick={() => setShowEditPatientModal(false)} className="text-slate-400 hover:text-white">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-200">
                                Iltimos, tashxis qo'yishdan oldin bemorning yoshi va ma'lumotlari to'g'riligini tasdiqlang.
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Ism</label>
                                    <input 
                                        value={editingPatient.firstName}
                                        onChange={e => setEditingPatient({...editingPatient, firstName: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Familiya</label>
                                    <input 
                                        value={editingPatient.lastName}
                                        onChange={e => setEditingPatient({...editingPatient, lastName: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Yosh (Bemor Yoshi)</label>
                                <input 
                                    type="number"
                                    value={editingPatient.age}
                                    onChange={e => setEditingPatient({...editingPatient, age: e.target.value})}
                                    className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900 font-bold text-lg"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Manzil</label>
                                <input 
                                    value={editingPatient.address}
                                    onChange={e => setEditingPatient({...editingPatient, address: e.target.value})}
                                    className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                    />
                            </div>

                            <button 
                                onClick={handleEditPatientSave}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg mt-4 active:scale-95 transition-all"
                            >
                                Saqlash va Davom Etish
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* --- ASSISTANT & TV MANAGEMENT VIEW --- */}
            {view === 'assistant' && (
                <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in-up overflow-y-auto">
                    <GlassCard className="w-full max-w-lg p-8 border-white/20 bg-slate-900/95 my-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                <UsersIcon className="w-6 h-6 text-blue-400"/> Sozlamalar
                            </h3>
                            <button onClick={() => setView('queue')} className="text-slate-400 hover:text-white">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        {/* Section 1: Assistant */}
                        <div className="mb-8">
                            <h4 className="text-lg font-bold text-blue-200 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Yordamchi (Registrator)
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">F.I.SH</label>
                                    <input 
                                        value={assistantData.name}
                                        onChange={e => setAssistantData({...assistantData, name: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                        placeholder="Yordamchi ismi"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Telefon (Login)</label>
                                    <input 
                                        value={assistantData.phone}
                                        onChange={e => setAssistantData({...assistantData, phone: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                        placeholder="+998..."
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Parol</label>
                                    <input 
                                        type="text"
                                        value={assistantData.password}
                                        onChange={e => setAssistantData({...assistantData, password: e.target.value})}
                                        className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                        placeholder="Yangi parol (kamida 8 ta belgi)"
                                    />
                                </div>
                                
                                {assistantMsg && <p className="text-sm text-green-400 bg-green-900/20 p-2 rounded">{assistantMsg}</p>}

                                <div className="flex gap-3 pt-2">
                                    <button 
                                        onClick={handleSaveAssistant}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all"
                                    >
                                        Saqlash
                                    </button>
                                    <button 
                                        onClick={handleDeleteAssistant}
                                        className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 font-bold py-3 rounded-xl border border-red-500/30 active:scale-95 transition-all"
                                    >
                                        O'chirish
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: TV Settings */}
                        <div className="pt-6 border-t border-white/10">
                            <h4 className="text-lg font-bold text-purple-200 mb-4 flex items-center gap-2">
                                <MonitorIcon className="w-5 h-5"/> TV Ekran Sozlamalari
                            </h4>
                            
                            <div className="space-y-4">
                                {!tvSettings.isUnlocked ? (
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="flex items-start gap-3 mb-3">
                                            <ShieldCheckIcon className="w-6 h-6 text-yellow-500" />
                                            <div>
                                                <p className="text-sm text-white font-bold">Reklama bloki faol</p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Standart reklama (Admin tomonidan) ko'rsatilmoqda. O'zgartirish uchun maxsus kodni kiriting.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                value={unlockCodeInput}
                                                onChange={e => setUnlockCodeInput(e.target.value)}
                                                className="flex-grow common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                                placeholder="Maxsus kod (masalan: ADMIN-...)"
                                            />
                                            <button 
                                                onClick={handleUnlockTv}
                                                className="px-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl text-sm"
                                            >
                                                Ochish
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-2 italic">Sizning kodingiz: {settingsService.generateUnlockCode(user.phone)} (Demo uchun)</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                                        <p className="text-sm text-green-400 font-bold mb-3 flex items-center gap-2">
                                            <CheckCircleIcon className="w-4 h-4"/> Reklama bloki ochilgan
                                        </p>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Video URL (Vergullab bir nechta kiritish mumkin)</label>
                                                <input 
                                                    value={tvSettings.videoUrl}
                                                    onChange={e => setTvSettings({...tvSettings, videoUrl: e.target.value})}
                                                    className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                                    placeholder="https://video1.mp4, https://video2.mp4"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1">Ko'p videolar uchun vergul (,) bilan ajrating.</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Yuguruvchi satr matni</label>
                                                <input 
                                                    value={tvSettings.scrollingText}
                                                    onChange={e => setTvSettings({...tvSettings, scrollingText: e.target.value})}
                                                    className="w-full common-input bg-white/10 border-white/10 text-white focus:bg-white focus:text-slate-900"
                                                    placeholder="Yangiliklar..."
                                                />
                                            </div>
                                            <button 
                                                onClick={handleSaveTvSettings}
                                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl shadow-lg mt-2"
                                            >
                                                Sozlamalarni Saqlash
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {tvMsg && <p className="text-sm text-yellow-400 text-center">{tvMsg}</p>}

                                <button 
                                    onClick={openTvDisplay}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/20 transition-colors mt-4"
                                >
                                    <MonitorIcon className="w-5 h-5"/>
                                    TV Ekranni Ko'rish (Demo)
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Top Bar (Fixed Header) — mobil: ixcham, ustma-ust kelmasin */}
            <div className="flex-none px-3 py-2 sm:px-5 sm:py-4 z-50 safe-top">
                <GlassCard className="flex justify-between items-center gap-2 p-2 sm:p-3 rounded-2xl sm:rounded-full bg-white/5 border-white/10 shadow-lg backdrop-blur-md">
                    <div className="flex items-center gap-2 sm:gap-4 pl-1 sm:pl-2 flex-1 min-w-0 overflow-hidden">
                        {view !== 'consultation' ? (
                            <>
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-[0_0_15px_rgba(79,70,229,0.5)] flex-shrink-0">
                                    {user.name.charAt(0)}
                                </div>
                                <div className="min-w-0 overflow-hidden">
                                    <h1 className="font-bold text-white text-xs sm:text-sm leading-tight tracking-wide truncate">{user.name}</h1>
                                    <p className="text-[9px] sm:text-[10px] text-blue-300 font-semibold uppercase tracking-wider truncate">{user.specialties?.[0]}</p>
                                </div>
                            </>
                        ) : (
                            currentPatient && (
                                <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 animate-fade-in-up bg-black/20 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border border-white/10">
                                    <div className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                                    <span className="font-bold text-white text-sm sm:text-base truncate min-w-0">{currentPatient.lastName} {currentPatient.firstName}</span>
                                    <span className="text-[10px] sm:text-xs text-blue-200 font-mono flex-shrink-0">{currentPatient.age}y</span>
                                    <span className="text-[10px] sm:text-xs text-slate-400 flex-shrink-0 hidden sm:inline">{currentPatient.arrivalTime}</span>
                                    <button 
                                        type="button"
                                        onClick={handleEditPatientOpen}
                                        className="p-1 sm:p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-blue-300 flex-shrink-0 ml-auto"
                                        aria-label="Tahrirlash"
                                    >
                                        <PencilIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {(view !== 'consultation') && (
                            <button 
                                type="button"
                                onClick={() => setView('assistant')}
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-blue-300 transition-colors"
                                title="Jamoa va Sozlamalar"
                                aria-label="Jamoa"
                            >
                                <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        )}
                        {view === 'consultation' ? (
                            <button 
                                type="button"
                                onClick={() => setView('queue')} 
                                className="h-8 sm:h-10 px-3 sm:px-5 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm transition-colors shadow-lg whitespace-nowrap"
                            >
                                &larr; Navbat
                            </button>
                        ) : (
                            <button 
                                type="button"
                                onClick={onLogout} 
                                className="h-8 sm:h-10 px-3 sm:px-4 rounded-full bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 flex items-center justify-center font-bold text-[10px] sm:text-xs transition-colors border border-white/5 whitespace-nowrap"
                            >
                                {t('logout')}
                            </button>
                        )}
                    </div>
                </GlassCard>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex flex-col overflow-hidden relative z-10">
                
                {/* VIEW: QUEUE */}
                {view === 'queue' && (
                    <div className="flex-grow overflow-y-auto p-3 sm:p-5 pb-32 custom-scrollbar">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-8">
                            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">{t('doc_tab_queue')}</h2>
                            <button 
                                type="button"
                                onClick={() => setShowWalkInModal(true)}
                                className="h-10 sm:h-12 px-4 sm:px-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center text-white font-bold gap-1.5 sm:gap-2 active:scale-95 transition-transform border border-green-400/50 text-xs sm:text-sm"
                            >
                                <PlayIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span>Navbatsiz Qabul</span>
                            </button>
                        </div>

                        <div className="space-y-3 sm:space-y-4">
                            {queue.filter(p => p.status !== 'completed').length === 0 && (
                                <p className="text-center text-slate-500 mt-6 sm:mt-10 text-sm">{t('doc_queue_empty')}</p>
                            )}
                            {queue.map(patient => (
                                <GlassCard 
                                    key={patient.id}
                                    onClick={() => patient.status !== 'completed' && handleStartPatient(patient)}
                                    className={`p-3 sm:p-5 relative overflow-hidden group border-white/5 ${
                                        patient.status === 'completed' ? 'opacity-50' : 'hover:bg-white/10 cursor-pointer'
                                    }`}
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-transparent opacity-50" />
                                    <div className="flex justify-between items-center gap-3 relative z-10 min-w-0">
                                        <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
                                            <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-xl font-bold backdrop-blur-md shadow-inner flex-shrink-0 ${
                                                patient.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                patient.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 
                                                'bg-white/5 text-slate-400 border border-white/10'
                                            }`}>
                                                {patient.ticketNumber}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-bold text-white text-sm sm:text-lg tracking-wide truncate">{patient.lastName} {patient.firstName}</h3>
                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                        patient.status === 'waiting' ? 'bg-yellow-400 animate-pulse' :
                                                        patient.status === 'in-progress' ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'
                                                    }`} />
                                                    <p className="text-[10px] sm:text-xs text-slate-300 font-medium uppercase tracking-wider">
                                                        {patient.age} yosh{typeof patient.arrivalTime === 'string' ? ` · ${patient.arrivalTime}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {patient.status !== 'completed' && (
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 flex-shrink-0">
                                                <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </div>
                                        )}
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    </div>
                )}

                {/* VIEW: PATIENTS LIST */}
                {view === 'patients_list' && (
                    <div className="flex-grow overflow-hidden">
                        <div className="p-3 sm:p-5 pb-0">
                            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{t('doc_patients_title')}</h2>
                        </div>
                        <PatientsList queue={queue} />
                    </div>
                )}

                {/* VIEW: DOCUMENTS */}
                {view === 'documents' && <DocumentsView user={user} />}

                {/* VIEW: PROFILE */}
                {view === 'profile' && <ProfileView user={user} onLogout={onLogout} />}

                {/* VIEW: DRUG TOOLS */}
                {view === 'drug_tools' && (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <div className="max-w-7xl mx-auto p-4 pb-24">
                            <h2 className="text-2xl font-bold text-white mb-6 px-2">🧪 Dori Vositalari</h2>
                            <div className="space-y-6">
                                <DrugInteractionChecker />
                                <DrugIdentifier />
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW: CONSULTATION (FULLSCREEN LOGIC) */}
                {view === 'consultation' && currentPatient && (
                    <div className="flex flex-col h-full relative overflow-hidden">
                        
                        {/* Floating Listening Indicator (Optional, can be subtle) */}
                        {isListening && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                                <div className="bg-red-500/80 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md">
                                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Eshitmoqda...</span>
                                </div>
                            </div>
                        )}

                        {/* INPUT MODE — mobil: scroll qilish mumkin, klaviatura orqasida qolmasin */}
                        {mode === 'input' && (
                            <div className="flex-grow flex flex-col min-h-0 p-4 flex flex-col h-full">
                                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar consultation-scroll mobile-keyboard-pad pb-safe">
                                    {/* Top: Vitals (HUD) */}
                                    <div className="flex-none mb-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            <VitalInputCompact label="SYS" unit="mm" value={vitals.bpSys} onChange={val => handleVitalChange('bpSys', val)} icon={<span className="text-[10px] font-black">BP</span>} color="red" />
                                            <VitalInputCompact label="DIA" unit="mm" value={vitals.bpDia} onChange={val => handleVitalChange('bpDia', val)} icon={<span className="text-[10px] font-black">BP</span>} color="red" />
                                            <VitalInputCompact label="Puls" unit="bpm" value={vitals.heartRate} onChange={val => handleVitalChange('heartRate', val)} icon={<HeartRateIcon className="w-3 h-3"/>} color="pink" />
                                            <VitalInputCompact label="t°" unit="°C" value={vitals.temp} onChange={val => handleVitalChange('temp', val)} icon={<span className="text-xs">🌡</span>} color="orange" />
                                            <VitalInputCompact label="SpO2" unit="%" value={vitals.spO2} onChange={val => handleVitalChange('spO2', val)} icon={<OxygenIcon className="w-3 h-3"/>} color="cyan" />
                                            <VitalInputCompact label="Nafas" unit="/min" value={vitals.respiration} onChange={val => handleVitalChange('respiration', val)} icon={<span className="text-xs">🫁</span>} color="blue" />
                                        </div>
                                    </div>

                                    {/* Middle: Shikoyatlar (mobil uchun min-height — klaviatura uchun joy) */}
                                    <div className="flex-none min-h-[220px] mb-3">
                                        <GlassCard className="flex flex-col min-h-[200px] bg-white/5 border border-white/10 overflow-hidden relative">
                                            {isListening && (
                                                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/60 to-transparent z-20 flex flex-col items-center justify-center pointer-events-none">
                                                    <AudioVisualizer isListening={isListening} />
                                                </div>
                                            )}
                                            <textarea
                                                value={complaints}
                                                onChange={(e) => setComplaints(e.target.value)}
                                                placeholder="Shikoyatlar, anamnez va ob'ektiv ko'rik ma'lumotlarini bu yerga yozing..."
                                                className="min-h-[180px] w-full bg-transparent text-white text-base leading-relaxed placeholder-white/20 p-4 outline-none resize-none custom-scrollbar"
                                            />
                                        
                                        {/* Attachment List Area (Inside Input) */}
                                        <div className="flex-none p-2 border-t border-white/5 bg-black/20 overflow-x-auto whitespace-nowrap custom-scrollbar flex items-center gap-2 min-h-[60px]">
                                            {attachments.length === 0 && (
                                                <div className="text-xs text-white/30 italic px-2 flex items-center gap-2">
                                                    <UploadCloudIcon className="w-4 h-4"/> Analizlar yuklanmagan (PDF, JPG, DOC)
                                                </div>
                                            )}
                                            {attachments.map((att, i) => (
                                                <div key={i} className="relative inline-block w-12 h-12 rounded-lg overflow-hidden border border-white/10 group flex-shrink-0 bg-white/5">
                                                    {att.type === 'image' ? (
                                                        <img src={att.preview} className="w-full h-full object-cover opacity-80" alt="attachment" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-white/50">
                                                            <DocumentTextIcon className="w-5 h-5" />
                                                            <span className="text-[8px] truncate w-full text-center px-1">{att.file.name.split('.').pop()}</span>
                                                        </div>
                                                    )}
                                                    <button 
                                                        onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <XIcon className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Input Toolbar */}
                                        <div className="flex-none p-3 border-t border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                                            <div className="flex gap-3">
                                                <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} />
                                                <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                                                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple onChange={handleFileSelect} />
                                                
                                                <button type="button" onClick={() => cameraInputRef.current?.click()} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" title="Kamera" aria-label="Kamera">
                                                    <CameraIcon className="w-5 h-5 text-blue-300" />
                                                </button>
                                                <button type="button" onClick={() => galleryInputRef.current?.click()} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" title="Galereya" aria-label="Galereya">
                                                    <PhotoIcon className="w-5 h-5 text-emerald-300" />
                                                </button>
                                                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" title="Hujjat Yuklash" aria-label="Hujjat yuklash">
                                                    <UploadCloudIcon className="w-5 h-5 text-purple-300" />
                                                </button>
                                                
                                                <div className="h-9 w-[1px] bg-white/10 mx-1"></div>
                                                <span className="text-[9px] leading-tight text-white/40 flex items-center font-bold max-w-[60px]">
                                                    ANALIZ<br/>YUKLASH
                                                </span>
                                            </div>

                                            <button 
                                                type="button"
                                                onClick={isListening ? stopListening : startListening}
                                                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                                                    isListening 
                                                    ? 'bg-red-500 animate-pulse shadow-red-500/50' 
                                                    : 'bg-white/10 hover:bg-white/20 border border-white/10'
                                                }`}
                                                aria-label={isListening ? 'Ovozni to\'xtatish' : 'Ovoz yozish'}
                                            >
                                                <MicrophoneIcon className="w-6 h-6 text-white" />
                                            </button>
                                        </div>
                                    </GlassCard>
                                </div>
                                </div>

                                {/* Tugma doim pastda (klaviatura ochiq bo'lsa ham ko'rinadi) */}
                                <div className="flex-none mt-3 pt-2 pb-safe">
                                    <button 
                                        onClick={handleAnalyze}
                                        disabled={!complaints && attachments.length === 0}
                                        className="w-full bg-white text-slate-900 font-black py-4 rounded-[20px] shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none hover:bg-blue-50"
                                    >
                                        <div className="p-1 bg-black rounded-full text-white">
                                            <CheckCircleIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-base tracking-wide font-bold">TAHLILNI BOSHLASH</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* RESULT VIEW: darhol natija sahifasi, loading — ingichka qator */}
                        {mode === 'result' && (
                            <div className="flex-grow flex flex-col overflow-hidden bg-black/20 backdrop-blur-xl h-full">
                                {/* Ingichka loading — "Ma'lumotlar qayta ishlanmoqda" o'rniga */}
                                {isAnalyzing && (
                                    <div className="flex-none flex items-center gap-3 px-4 py-2 bg-blue-500/20 border-b border-blue-500/30">
                                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm font-bold text-blue-200">Tahlil qilinmoqda...</span>
                                    </div>
                                )}

                                {/* Bitta sahifa — 3 bo'lim (Tashxis, Reja, Retsept) */}
                                <div className="flex-grow overflow-y-auto p-5 custom-scrollbar">
                                    {!report && isAnalyzing && (
                                        <>
                                            <div className="space-y-4 pb-8">
                                                <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
                                                <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
                                            </div>
                                            <div className="h-28 bg-white/5 rounded-2xl animate-pulse mb-6" />
                                            <div className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                                        </>
                                    )}
                                    {report && (
                                        <div className="space-y-8 pb-24">
                                            <section className="animate-fade-in-up">
                                                <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <CheckCircleIcon className="w-4 h-4 text-emerald-400" /> 1. Tashxis
                                                </h3>
                                                <DiagnosisTab report={report} />
                                            </section>
                                            <section className="animate-fade-in-up">
                                                <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <ClipboardListIcon className="w-4 h-4 text-indigo-400" /> 2. Davolash rejasi
                                                </h3>
                                                <PlanTab report={report} />
                                            </section>
                                            <section className="animate-fade-in-up">
                                                <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <PillIcon className="w-4 h-4 text-emerald-400" /> 3. Dori-darmonlar
                                                </h3>
                                                <PrescriptionTab report={report} />
                                            </section>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-none p-5 bg-gradient-to-t from-black via-black/80 to-transparent z-30">
                                    <button 
                                        onClick={handleFinish}
                                        disabled={isAnalyzing}
                                        className="w-full bg-white text-black font-black py-5 rounded-[24px] shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        QABULNI YAKUNLASH
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Dock — mobil: ixcham, barcha tugmalar sig'sin */}
            {(view !== 'consultation') && (
                <div className="absolute bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-5 z-50">
                    <GlassCard className="flex justify-between sm:justify-around items-center py-2 px-1 sm:py-3 sm:px-2 rounded-2xl sm:rounded-[32px] bg-white/10 border-white/10 backdrop-blur-2xl shadow-2xl">
                        <button type="button" onClick={() => setView('queue')} className={`flex flex-col items-center justify-center p-1 sm:p-2 transition-colors min-w-0 flex-1 ${view === 'queue' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                            <HomeIcon className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 ${view === 'queue' ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`} />
                            <span className="text-[8px] sm:text-[9px] font-bold mt-0.5 sm:mt-1 tracking-wider sm:tracking-widest truncate w-full text-center text-glow">{t('doc_tab_queue')}</span>
                        </button>
                        <button type="button" onClick={() => setView('patients_list')} className={`flex flex-col items-center justify-center p-1 sm:p-2 transition-colors min-w-0 flex-1 ${view === 'patients_list' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                            <ViewListIcon className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 ${view === 'patients_list' ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`} />
                            <span className="text-[8px] sm:text-[9px] font-bold mt-0.5 sm:mt-1 tracking-wider truncate w-full text-center">{t('doc_tab_patients')}</span>
                        </button>
                        <button type="button" onClick={() => setView('documents')} className={`flex flex-col items-center justify-center p-1 sm:p-2 transition-colors min-w-0 flex-1 ${view === 'documents' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                            <DocumentTextIcon className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 ${view === 'documents' ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`} />
                            <span className="text-[8px] sm:text-[9px] font-bold mt-0.5 sm:mt-1 tracking-wider truncate w-full text-center">{t('doc_tab_docs')}</span>
                        </button>
                        <button type="button" onClick={() => setView('drug_tools')} className={`flex flex-col items-center justify-center p-1 sm:p-2 transition-colors min-w-0 flex-1 ${view === 'drug_tools' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                            <PillIcon className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 ${view === 'drug_tools' ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`} />
                            <span className="text-[8px] sm:text-[9px] font-bold mt-0.5 sm:mt-1 tracking-wider truncate w-full text-center">Dorilar</span>
                        </button>
                        <button type="button" onClick={() => setView('profile')} className={`flex flex-col items-center justify-center p-1 sm:p-2 transition-colors min-w-0 flex-1 ${view === 'profile' ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                            <UserCircleIcon className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 ${view === 'profile' ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`} />
                            <span className="text-[8px] sm:text-[9px] font-bold mt-0.5 sm:mt-1 tracking-wider truncate w-full text-center">{t('doc_tab_profile')}</span>
                        </button>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default DoctorDashboard;
