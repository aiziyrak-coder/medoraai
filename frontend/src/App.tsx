
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { PatientData, ChatMessage, FinalReport, ProgressUpdate, User, AnalysisRecord, Diagnosis, DetectedMedication, DiagnosisFeedback, CriticalFinding, CMETopic, UserStats, AppView, PrognosisReport } from './types';
import * as aiService from './services/aiCouncilService';
import * as authService from './services/apiAuthService';
import * as caseService from './services/caseService';
import * as tvLinkService from './services/tvLinkService'; // Import TV Service
import { useTranslation } from './hooks/useTranslation';
import { useApiHealth } from './hooks/useApiHealth';
import { Language } from './i18n/LanguageContext';
import { isApiConfigured } from './config/api';

// --- Views & Components ---
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage'; // New Import
import UserGuide from './components/UserGuide'; // New Import
import SubscriptionPage from './components/SubscriptionPage';
import DoctorDashboard from './components/DoctorDashboard';
import StaffDashboard from './components/StaffDashboard';
import TvDisplay from './components/TvDisplay';
import DataInputForm from './components/DataInputForm';
import HistoryView from './components/HistoryView';
import MobileNavBar from './components/MobileNavBar';
import ResearchView from './components/ResearchView';
import ClarificationView from './components/ClarificationView';
import Dashboard from './components/Dashboard';
import LiveConsultationView from './components/LiveConsultationView';
import AnalysisView from './components/AnalysisView';
import TeamRecommendationView from './components/TeamRecommendationView';
import CaseLibraryView from './components/CaseLibraryView';
import PatientEducationPortal from './components/education/PatientEducationPortal';
import CriticalFindingAlert from './components/modals/CriticalFindingAlert';
import RationaleModal from './components/modals/RationaleModal';
import LanguageSwitcher from './components/LanguageSwitcher';

// --- Icons ---
import HomeIcon from './components/icons/HomeIcon';
import PlusCircleIcon from './components/icons/PlusCircleIcon';
import DocumentReportIcon from './components/icons/DocumentReportIcon';
import LightBulbIcon from './components/icons/LightBulbIcon';
import CopyrightIcon from './components/icons/CopyrightIcon';
import MonitorIcon from './components/icons/MonitorIcon'; 

import { AIModel } from './constants/specialists';

const ScrollWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="h-full overflow-y-auto px-4 py-6 custom-scrollbar">
        {children}
    </div>
);

// --- MOBILE BLOCKER COMPONENT ---
const MobileBlocker: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in-up">
        <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <MonitorIcon className="w-12 h-12 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Qurilma mos kelmadi</h2>
        <p className="text-slate-300 text-lg leading-relaxed max-w-md">
            Hurmatli foydalanuvchi, <strong>MEDORA AI</strong> (Klinika) tizimining to'liq funksionalidan foydalanish uchun, iltimos, 
            <span className="text-blue-400 font-bold"> Kompyuter</span> yoki <span className="text-blue-400 font-bold">Planshet</span> orqali kiring.
        </p>
        <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-white/10">
            <p className="text-sm text-slate-400">
                Telefon orqali faqat <span className="text-white font-semibold">Shifokor</span> va <span className="text-white font-semibold">Registrator</span> rejimidan foydalanish mumkin.
            </p>
        </div>
        <button 
            onClick={onLogout}
            className="mt-8 text-sm font-bold text-blue-400 hover:text-white transition-colors underline"
        >
            &larr; Login sahifasiga qaytish
        </button>
    </div>
);

const AppContent: React.FC = () => {
    // --- STATE MANAGEMENT ---
    
    // Auth & View
    // Initialize from localStorage, then try to refresh from API
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const localUser = authService.getCurrentUser();
        // Try to refresh from API if token exists
        if (localUser) {
            import('./services/apiAuthService').then(({ getProfile }) => {
                getProfile().then(apiUser => {
                    if (apiUser) {
                        setCurrentUser(apiUser);
                    }
                });
            });
        }
        return localUser;
    });
    
    // New States for Landing Page Flow
    const [showLanding, setShowLanding] = useState(!currentUser); // Show landing if not logged in
    const [showGuide, setShowGuide] = useState(false);

    const [appView, setAppView] = useState<AppView>('dashboard');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [tvModeDoctorId, setTvModeDoctorId] = useState<string | null>(null);

    // Screen Resize & URL Param Listener
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);

        // Check for TV mode URL params
        const params = new URLSearchParams(window.location.search);
        
        // New Short Code Logic: ?tv=abcdefgh
        let tvCode = params.get('tv');

        // Fallback: Check hash for blob environments or hash routers
        if (!tvCode && window.location.hash.includes('tv=')) {
            // Extract from hash, handling potential other hash parts
            // Simple extraction: assume #tv=code or #...&tv=code
            const hashParts = window.location.hash.replace(/^#/, '').split('&');
            const tvPart = hashParts.find(p => p.startsWith('tv='));
            if (tvPart) {
                tvCode = tvPart.split('=')[1];
            }
        }

        if (tvCode) {
            const doctorId = tvLinkService.getDoctorIdByCode(tvCode);
            if (doctorId) {
                setTvModeDoctorId(doctorId);
            } else {
                // Invalid TV code - silently handle, user will see normal view
                // Could log in development mode if needed
            }
        }
        
        // Legacy/Direct logic (optional fallback): ?mode=tv&doctor=...
        if (params.get('mode') === 'tv' && params.get('doctor')) {
            setTvModeDoctorId(params.get('doctor')!);
        }

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load initial data if user is already logged in on mount
    useEffect(() => {
        if (currentUser && currentUser.role === 'clinic') {
            // Try API first, fallback to local
            import('./services/apiAnalysisService').then(({ getAnalyses }) => {
                getAnalyses().then(response => {
                    if (response.success && response.data) {
                        setUserHistory(response.data);
                        setDashboardStats(caseService.getDashboardStats(response.data));
                        aiService.suggestCmeTopics(response.data, 'uz-L').then(setCmeTopics);
                    } else {
                        // Fallback to local
                        const { getAnalyses: getLocalAnalyses } = require('./services/authService');
                        const history = getLocalAnalyses(currentUser.phone);
                        setUserHistory(history);
                        setDashboardStats(caseService.getDashboardStats(history));
                        aiService.suggestCmeTopics(history, 'uz-L').then(setCmeTopics);
                    }
                }).catch(() => {
                    // Fallback to local on error
                    const { getAnalyses: getLocalAnalyses } = require('./services/authService');
                    const history = getLocalAnalyses(currentUser.phone);
                    setUserHistory(history);
                    setDashboardStats(caseService.getDashboardStats(history));
                    aiService.suggestCmeTopics(history, 'uz-L').then(setCmeTopics);
                });
            });
        }
    }, [currentUser]); // Added dependency to re-run on user change

    // i18n
    const { t, language, setLanguage } = useTranslation();

    // Core Analysis State
    const [patientData, setPatientData] = useState<PatientData | null>(null);
    const [selectedSpecialistsConfig, setSelectedSpecialistsConfig] = useState<{ role: AIModel, backEndModel: string }[]>([]);
    const [orchestratorModel, setOrchestratorModel] = useState<string>("Gemini 3.0 Pro");
    const [differentialDiagnoses, setDifferentialDiagnoses] = useState<Diagnosis[]>([]);
    const [debateHistory, setDebateHistory] = useState<ChatMessage[]>([]);
    const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
    const [diagnosisFeedback, setDiagnosisFeedback] = useState<Record<string, DiagnosisFeedback>>({});
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [criticalFinding, setCriticalFinding] = useState<CriticalFinding | null>(null);
    const [rationaleMessage, setRationaleMessage] = useState<ChatMessage | null>(null);
    const [userIntervention, setUserIntervention] = useState<string | null>(null);
    const userInterventionRef = useRef<string | null>(null);
    const [recommendedTeam, setRecommendedTeam] = useState<{ model: AIModel; reason: string }[] | null>([]);
    const [socraticQuestion, setSocraticQuestion] = useState<string | null>(null);
    const [livePrognosis, setLivePrognosis] = useState<PrognosisReport | null>(null);

    const [userHistory, setUserHistory] = useState<AnalysisRecord[]>([]);
    const [dashboardStats, setDashboardStats] = useState<UserStats | null>(null);
    const [cmeTopics, setCmeTopics] = useState<CMETopic[]>([]);
    
    const [currentAnalysisRecord, setCurrentAnalysisRecord] = useState<AnalysisRecord | null>(null);
    const [clarificationQuestions, setClarificationQuestions] = useState<string[] | null>([]);
    
    const debateScrollRef = useRef<HTMLDivElement>(null);
    const { apiHealthy, checkNow } = useApiHealth();

    useEffect(() => {
        if (debateScrollRef.current) {
            debateScrollRef.current.scrollTop = debateScrollRef.current.scrollHeight;
        }
    }, [debateHistory, statusMessage]);
    
    const handleProgress = useCallback((update: ProgressUpdate) => {
        switch (update.type) {
            case 'status': setStatusMessage(update.message); break;
            case 'message': setDebateHistory(prev => [...prev, update.message]); break;
            case 'critical_finding': setCriticalFinding(update.data); break;
            case 'user_question': setSocraticQuestion(update.question); break;
            case 'prognosis_update': setLivePrognosis(update.data); break;
            case 'report':
                setFinalReport(update.data);
                setIsProcessing(false);
                setSocraticQuestion(null);
                setStatusMessage(t('analysis_complete_status'));
                if (currentUser && patientData) {
                    const newRecord: AnalysisRecord = {
                        id: currentAnalysisRecord?.id || new Date().toISOString(),
                        patientId: currentAnalysisRecord?.patientId || `${patientData.lastName}-${patientData.firstName}-${Date.now()}`,
                        date: new Date().toISOString(),
                        patientData, debateHistory, finalReport: update.data,
                        followUpHistory: [], 
                        selectedSpecialists: selectedSpecialistsConfig.map(s => s.role),
                    };
                    
                    // Try to save to API, fallback to local
                    import('./services/apiAnalysisService').then(({ createAnalysis, updateAnalysis, getAnalyses }) => {
                        if (currentAnalysisRecord?.id && !isNaN(parseInt(currentAnalysisRecord.id))) {
                            // Update existing in API
                            updateAnalysis(parseInt(currentAnalysisRecord.id), newRecord).then(() => {
                                getAnalyses().then(response => {
                                    if (response.success && response.data) {
                                        setUserHistory(response.data);
                                        setDashboardStats(caseService.getDashboardStats(response.data));
                                        setCurrentAnalysisRecord(newRecord);
                                    }
                                }).catch(() => {
                                    // Fallback to local
                                    const { updateAnalysis: updateLocal, getAnalyses: getLocalAnalyses } = require('./services/authService');
                                    updateLocal(currentUser.phone, newRecord);
                                    const history = getLocalAnalyses(currentUser.phone);
                                    setUserHistory(history);
                                    setDashboardStats(caseService.getDashboardStats(history));
                                    setCurrentAnalysisRecord(newRecord);
                                });
                            }).catch(() => {
                                // Fallback to local
                                const { updateAnalysis: updateLocal, getAnalyses: getLocalAnalyses } = require('./services/authService');
                                updateLocal(currentUser.phone, newRecord);
                                const history = getLocalAnalyses(currentUser.phone);
                                setUserHistory(history);
                                setDashboardStats(caseService.getDashboardStats(history));
                                setCurrentAnalysisRecord(newRecord);
                            });
                        } else {
                            // Create new - try API first
                            import('./services/apiPatientService').then(({ createPatient }) => {
                                createPatient(patientData).then(patientResponse => {
                                    if (patientResponse.success && patientResponse.data) {
                                        createAnalysis(patientResponse.data.id, newRecord).then(() => {
                                            caseService.addCaseToLibrary(newRecord);
                                            getAnalyses().then(response => {
                                                if (response.success && response.data) {
                                                    setUserHistory(response.data);
                                                    setDashboardStats(caseService.getDashboardStats(response.data));
                                                    setCurrentAnalysisRecord(newRecord);
                                                }
                                            }).catch(() => {
                                                // Fallback to local
                                                const { saveAnalysis: saveLocal, getAnalyses: getLocalAnalyses } = require('./services/authService');
                                                saveLocal(currentUser.phone, newRecord);
                                                caseService.addCaseToLibrary(newRecord);
                                                const history = getLocalAnalyses(currentUser.phone);
                                                setUserHistory(history);
                                                setDashboardStats(caseService.getDashboardStats(history));
                                                setCurrentAnalysisRecord(newRecord);
                                            });
                                        }).catch(() => {
                                            // Fallback to local
                                            const { saveAnalysis: saveLocal, getAnalyses: getLocalAnalyses } = require('./services/authService');
                                            saveLocal(currentUser.phone, newRecord);
                                            caseService.addCaseToLibrary(newRecord);
                                            const history = getLocalAnalyses(currentUser.phone);
                                            setUserHistory(history);
                                            setDashboardStats(caseService.getDashboardStats(history));
                                            setCurrentAnalysisRecord(newRecord);
                                        });
                                    } else {
                                        // Patient creation failed, fallback to local
                                        const { saveAnalysis: saveLocal, getAnalyses: getLocalAnalyses } = require('./services/authService');
                                        saveLocal(currentUser.phone, newRecord);
                                        caseService.addCaseToLibrary(newRecord);
                                        const history = getLocalAnalyses(currentUser.phone);
                                        setUserHistory(history);
                                        setDashboardStats(caseService.getDashboardStats(history));
                                        setCurrentAnalysisRecord(newRecord);
                                    }
                                }).catch(() => {
                                    // Fallback to local
                                    const { saveAnalysis: saveLocal, getAnalyses: getLocalAnalyses } = require('./services/authService');
                                    saveLocal(currentUser.phone, newRecord);
                                    caseService.addCaseToLibrary(newRecord);
                                    const history = getLocalAnalyses(currentUser.phone);
                                    setUserHistory(history);
                                    setDashboardStats(caseService.getDashboardStats(history));
                                    setCurrentAnalysisRecord(newRecord);
                                });
                            });
                        }
                    }).catch(() => {
                        // API not available, use local
                        const { saveAnalysis: saveLocal, updateAnalysis: updateLocal, getAnalyses: getLocalAnalyses } = require('./services/authService');
                        if (currentAnalysisRecord?.id) {
                            updateLocal(currentUser.phone, newRecord);
                        } else {
                            saveLocal(currentUser.phone, newRecord);
                            caseService.addCaseToLibrary(newRecord);
                        }
                        const history = getLocalAnalyses(currentUser.phone);
                        setUserHistory(history);
                        setDashboardStats(caseService.getDashboardStats(history));
                        setCurrentAnalysisRecord(newRecord);
                    });
                }
                break;
            case 'error':
                setError(update.message);
                setIsProcessing(false);
                setStatusMessage(t('analysis_error_status'));
                break;
        }
    }, [currentUser, patientData, debateHistory, selectedSpecialistsConfig, t, currentAnalysisRecord]);

    const handleLoginSuccess = (user: User) => {
        setCurrentUser(user);
        setShowLanding(false); // Hide landing after successful login
        if (user.role === 'clinic') {
            // Try API first, fallback to local
            import('./services/apiAnalysisService').then(({ getAnalyses }) => {
                getAnalyses().then(response => {
                    if (response.success && response.data) {
                        setUserHistory(response.data);
                        setDashboardStats(caseService.getDashboardStats(response.data));
                        aiService.suggestCmeTopics(response.data, language).then(setCmeTopics);
                    } else {
                        // Fallback to local
                        const { getAnalyses: getLocalAnalyses } = require('./services/authService');
                        const history = getLocalAnalyses(user.phone);
                        setUserHistory(history);
                        setDashboardStats(caseService.getDashboardStats(history));
                        aiService.suggestCmeTopics(history, language).then(setCmeTopics);
                    }
                    setAppView('dashboard');
                }).catch(() => {
                    // Fallback to local on error
                    const { getAnalyses: getLocalAnalyses } = require('./services/authService');
                    const history = getLocalAnalyses(user.phone);
                    setUserHistory(history);
                    setDashboardStats(caseService.getDashboardStats(history));
                    aiService.suggestCmeTopics(history, language).then(setCmeTopics);
                    setAppView('dashboard');
                });
            });
        } else {
            setAppView('dashboard');
        }
    };

    const handleLogout = () => {
        authService.logout();
        setCurrentUser(null);
        setShowLanding(true); // Show landing on logout
        resetAnalysisState();
    };

    const handleSubscriptionPending = async () => {
        // Refresh user data from API to reflect pending status
        const { getProfile } = await import('./services/apiAuthService');
        const updatedUser = await getProfile();
        if (updatedUser) {
            setCurrentUser(updatedUser);
        }
    };

    const resetAnalysisState = () => {
        setPatientData(null);
        setSelectedSpecialistsConfig([]);
        setDifferentialDiagnoses([]);
        setDebateHistory([]);
        setFinalReport(null);
        setDiagnosisFeedback({});
        setIsProcessing(false);
        setError(null);
        setStatusMessage('');
        setCurrentAnalysisRecord(null);
        setCriticalFinding(null);
        setRationaleMessage(null);
        setUserIntervention(null);
        userInterventionRef.current = null;
        setClarificationQuestions([]);
        setRecommendedTeam([]);
        setSocraticQuestion(null);
        setLivePrognosis(null);
        setAppView('new_analysis');
    };

    const handleNavigation = (view: AppView) => {
        if (view === 'new_analysis') resetAnalysisState();
        else setAppView(view);
    };

    const handleDataSubmit = async (data: PatientData) => {
        setPatientData(data);
        setIsProcessing(true);
        setAppView('clarification');
        setStatusMessage(t('clarification_generating_questions'));
        try {
            // Use API service
            const { generateClarifyingQuestions } = await import('./services/apiAiService');
            const response = await generateClarifyingQuestions(data);
            if (response.success && response.data) {
                setClarificationQuestions(response.data);
            } else {
                // Fallback to local service
                const questions = await aiService.generateClarifyingQuestions(data, language);
                setClarificationQuestions(questions);
            }
        } catch (e) { 
             setError(t('clarification_question_error'));
             setClarificationQuestions([]);
        } 
        finally { setIsProcessing(false); }
    };
    
    const handleClarificationSubmit = async (answers: Record<string, string>) => {
        if (!patientData) return;
        let enrichedPatientData = { ...patientData };
        if (clarificationQuestions && clarificationQuestions.length > 0) {
            const qaString = clarificationQuestions
                .map((q, i) => `Q: ${q}\nA: ${answers[i] || t('clarification_not_answered')}`)
                .join('\n\n');
            enrichedPatientData.additionalInfo = `${patientData.additionalInfo || ''}\n\n--- ${t('clarification_additional_qa')} ---\n${qaString}`.trim();
        }
        setPatientData(enrichedPatientData);
        setAppView('team_recommendation');
        setIsProcessing(true);
        setStatusMessage(t('team_recommendation_creating'));
        try {
            // Try API first
            const { recommendSpecialists } = await import('./services/apiAiService');
            const response = await recommendSpecialists(enrichedPatientData);
            if (response.success && response.data) {
                setRecommendedTeam(response.data.recommendations.map(rec => ({
                    role: rec.model,
                    backEndModel: 'Gemini 3.0 Pro'
                })));
            } else {
                throw new Error('API failed');
            }
        } catch (e) {
            // Fallback to local service
            try {
                const team = await aiService.recommendSpecialists(enrichedPatientData, language);
                setRecommendedTeam(team.recommendations.map(rec => ({
                    role: rec.model,
                    backEndModel: 'Gemini 3.0 Pro'
                })));
            } catch (fallbackError) {
                setError(t('team_recommendation_auto_error'));
                const allSpecialists = Object.values(AIModel).filter(m => m !== AIModel.SYSTEM);
                const fallbackTeam = allSpecialists.map(model => ({ model, reason: t('team_recommendation_fallback_reason') }));
                setRecommendedTeam(fallbackTeam.map(rec => ({
                    role: rec.model,
                    backEndModel: 'Gemini 3.0 Pro'
                })));
            }
        } finally { setIsProcessing(false); }
    };

    const handleTeamConfirmation = async (confirmedTeam: { role: AIModel, backEndModel: string }[], orchestrator: string) => {
        if (!patientData) return;
        setSelectedSpecialistsConfig(confirmedTeam);
        setOrchestratorModel(orchestrator);
        setAppView('live_analysis');
        setIsProcessing(true);
        try {
            setStatusMessage(t('ddx_generating'));
            // Try API first
            const { generateInitialDiagnoses } = await import('./services/apiAiService');
            const response = await generateInitialDiagnoses(patientData);
            if (response.success && response.data) {
                setDifferentialDiagnoses(response.data);
            } else {
                // Fallback to local service
                const diagnoses = await aiService.generateInitialDiagnoses(patientData, language);
                setDifferentialDiagnoses(diagnoses);
            }
            setStatusMessage(t('ddx_feedback_prompt'));
        } catch (e) { 
            setError(t('ddx_generation_error'));
            setStatusMessage(t('error_try_again'));
        } 
        finally { setIsProcessing(false); }
    };

    const handleStartDebate = () => {
        if (!patientData || !differentialDiagnoses.length) return;
        let enrichedPatientData = { ...patientData, userDiagnosisFeedback: diagnosisFeedback };
        setPatientData(enrichedPatientData);
        setIsProcessing(true);
        setStatusMessage(t('debate_start_status'));
        const getUserInterventionCallback = () => {
            const intervention = userInterventionRef.current;
            userInterventionRef.current = null;
            setUserIntervention(null);
            return intervention;
        };
        aiService.runCouncilDebate(enrichedPatientData, differentialDiagnoses, selectedSpecialistsConfig, orchestratorModel, handleProgress, getUserInterventionCallback, language);
    };
    
    const handleDiagnosisFeedback = (name: string, feedback: DiagnosisFeedback) => {
        setDiagnosisFeedback(prev => {
            if (prev[name] === feedback) { const newState = { ...prev }; delete newState[name]; return newState; }
            return { ...prev, [name]: feedback };
        });
    };

    const handleUserIntervention = useCallback(async (intervention: string) => {
        if (!intervention || !intervention.trim()) return;
        
        userInterventionRef.current = intervention;
        if(socraticQuestion) { 
            setSocraticQuestion(null); 
            return; 
        } 
        
        setDebateHistory(prev => [...prev, { 
            id: `user-${Date.now()}`, 
            author: AIModel.SYSTEM, 
            content: t('user_intervention_log', { intervention }), 
            isUserIntervention: true 
        }]);
        
        if (!isProcessing && finalReport && patientData) {
             setIsProcessing(true);
             setError(null);
             try {
                 const responseMsg = await aiService.continueDebate(patientData, debateHistory, intervention, language);
                 setDebateHistory(prev => [...prev, responseMsg]);
             } catch (e) { 
                 const { getUserFriendlyError } = await import('./utils/errorHandler');
                 setError(getUserFriendlyError(e, "Javob berishda xatolik yuz berdi.")); 
             } finally { 
                 setIsProcessing(false); 
             }
        }
    }, [socraticQuestion, isProcessing, finalReport, patientData, debateHistory, language, t]);
    
    const handleRunScenario = useCallback(async (scenario: string): Promise<FinalReport | null> => {
        if (!patientData || !debateHistory.length || !scenario.trim()) return null;
        setIsProcessing(true);
        setError(null);
        try { 
            const result = await aiService.runScenarioAnalysis(patientData, debateHistory, scenario, language);
            return result;
        } catch (e) { 
            const { getUserFriendlyError } = await import('./utils/errorHandler');
            setError(getUserFriendlyError(e, t('scenario_analysis_error'))); 
            return null; 
        } finally {
            setIsProcessing(false);
        }
    }, [patientData, debateHistory, language, t]);

    const handleExplainRationale = (message: ChatMessage) => setRationaleMessage(message);
    const handleInjectHypothesis = (hypothesis: Diagnosis) => {
        setDifferentialDiagnoses(prev => [...prev, hypothesis]);
        setDiagnosisFeedback(prev => ({ ...prev, [hypothesis.name]: 'injected-hypothesis' }));
    };
    
    const handleUpdateReport = useCallback((updatedReport: Partial<FinalReport>) => {
        if (!currentAnalysisRecord || !currentUser) return;
        const newFinalReport = { ...currentAnalysisRecord.finalReport, ...updatedReport };
        setFinalReport(newFinalReport);
        const updatedRecord = { ...currentAnalysisRecord, finalReport: newFinalReport as FinalReport };
        setCurrentAnalysisRecord(updatedRecord);
        const updatedHistory = userHistory.map(r => r.id === updatedRecord.id ? updatedRecord : r);
        setUserHistory(updatedHistory);
        
        // Update in API
        import('./services/apiAnalysisService').then(({ updateAnalysis }) => {
            if (currentAnalysisRecord.id && !isNaN(parseInt(currentAnalysisRecord.id))) {
                updateAnalysis(parseInt(currentAnalysisRecord.id), updatedRecord).catch(() => {
                    // Error already handled by API service, silently fail
                });
            }
        });
    }, [currentAnalysisRecord, currentUser, userHistory]);

    const viewHistoryItem = (record: AnalysisRecord) => {
        setCurrentAnalysisRecord(record);
        setPatientData(record.patientData);
        setDebateHistory(record.debateHistory);
        setFinalReport(record.finalReport);
        const specs = record.selectedSpecialists?.map(role => ({ role, backEndModel: "Gemini 3.0 Pro" })) || [];
        setSelectedSpecialistsConfig(specs);
        setDifferentialDiagnoses(record.finalReport.consensusDiagnosis);
        setAppView('live_analysis');
        setIsProcessing(false); 
        setStatusMessage("Arxivdan yuklandi. Munozarani davom ettirishingiz mumkin.");
    };

    const NavButton: React.FC<{ view: AppView; label: string; icon: React.ReactNode }> = ({ view, label, icon }) => {
        const analysisViews: AppView[] = ['new_analysis', 'clarification', 'team_recommendation', 'live_analysis'];
        const historyViews: AppView[] = ['history', 'view_history_item', 'case_library'];
        let isActive = false;
        if (analysisViews.includes(view)) { isActive = analysisViews.includes(appView); } 
        else if (historyViews.includes(view)) { isActive = historyViews.includes(appView); } 
        else { isActive = appView === view; }
        return (
            <button onClick={() => handleNavigation(view)} className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isActive ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-white/40 hover:text-slate-700'}`}>
                {React.cloneElement(icon as React.ReactElement, { className: `w-5 h-5 transition-colors ${isActive ? 'text-blue-500' : 'text-slate-400'}` })}
                <span>{label}</span>
            </button>
        );
    };

    const renderMainContent = () => {
        switch (appView) {
            case 'dashboard': return <ScrollWrapper><Dashboard userName={currentUser!.name} onNewAnalysis={() => handleNavigation('new_analysis')} onViewHistory={() => setAppView('history')} recentAnalyses={userHistory.slice(0, 5)} onSelectAnalysis={viewHistoryItem} stats={dashboardStats} cmeTopics={cmeTopics} /></ScrollWrapper>;
            case 'new_analysis': return <div className="h-full px-4 py-4 overflow-hidden"><DataInputForm onSubmit={handleDataSubmit} isAnalyzing={isProcessing} /></div>;
            case 'clarification': return <ScrollWrapper><div className="max-w-3xl mx-auto w-full"><ClarificationView isGenerating={isProcessing} questions={clarificationQuestions} onSubmit={handleClarificationSubmit} statusMessage={statusMessage} error={error} /></div></ScrollWrapper>;
            case 'team_recommendation': return <ScrollWrapper><div className="max-w-3xl mx-auto w-full h-full flex flex-col"><TeamRecommendationView isProcessing={isProcessing} recommendations={recommendedTeam} onConfirm={handleTeamConfirmation} /></div></ScrollWrapper>
            case 'live_analysis':
            case 'view_history_item':
                const record = appView === 'live_analysis' || appView === 'view_history_item' ? { patientData, debateHistory, finalReport, selectedSpecialists: selectedSpecialistsConfig.map(s=>s.role) } : currentAnalysisRecord;
                if (!record || !record.patientData) return <div className="text-center p-8 text-slate-500">{t('error_no_data_found')}</div>;
                return <div className="h-full px-4 py-4 overflow-hidden"><AnalysisView record={record} isLive={true} statusMessage={statusMessage} isAnalyzing={isProcessing} differentialDiagnoses={differentialDiagnoses} error={error} onDiagnosisFeedback={handleDiagnosisFeedback} diagnosisFeedback={diagnosisFeedback} onStartDebate={handleStartDebate} onInjectHypothesis={handleInjectHypothesis} onUserIntervention={handleUserIntervention} userIntervention={userIntervention} onExplainRationale={handleExplainRationale} onGoToEducation={() => setAppView('patient_education')} socraticQuestion={socraticQuestion} livePrognosis={livePrognosis} onRunScenario={handleRunScenario} onUpdateReport={handleUpdateReport} /></div>;
            case 'history': return <ScrollWrapper><HistoryView analyses={userHistory} onSelectAnalysis={viewHistoryItem} onStartConsultation={() => {}} onViewCaseLibrary={() => setAppView('case_library')} /></ScrollWrapper>;
            case 'case_library': return <ScrollWrapper><CaseLibraryView onBack={() => setAppView('history')} /></ScrollWrapper>;
            case 'patient_education': return <ScrollWrapper>{currentAnalysisRecord && <PatientEducationPortal record={currentAnalysisRecord} onBack={() => setAppView('view_history_item')} />}</ScrollWrapper>;
            case 'research': return <ScrollWrapper><ResearchView /></ScrollWrapper>;
            default: return <div className="text-center p-8 text-slate-500">{t('error_page_not_found')}</div>;
        }
    };
    
    // --- TV DISPLAY MODE ---
    if (tvModeDoctorId) {
        return <TvDisplay doctorId={tvModeDoctorId} />;
    }

    // --- LANDING PAGE FLOW ---
    if (!currentUser) {
        if (showGuide) {
            return <UserGuide onBack={() => setShowGuide(false)} />;
        }
        if (showLanding) {
            return <LandingPage onLogin={() => setShowLanding(false)} onOpenGuide={() => setShowGuide(true)} />;
        }
        // If not landing, showing AuthPage
        return (
            <div className="relative">
                <button onClick={() => setShowLanding(true)} className="absolute top-4 left-4 z-50 text-white/50 hover:text-white transition-colors">
                    &larr; Bosh Sahifa
                </button>
                <AuthPage onLoginSuccess={handleLoginSuccess} />
            </div>
        );
    }

    // --- SUBSCRIPTION CHECK ---
    // Staff inherits subscription from linked doctor. Doctor/Clinic must have active subscription (trial or paid).
    if (currentUser.role !== 'staff' && !authService.hasActiveSubscription(currentUser)) {
        return <SubscriptionPage user={currentUser} onSubscriptionPending={handleSubscriptionPending} onLogout={handleLogout} />;
    }

    // --- DOCTOR MODE ---
    if (currentUser.role === 'doctor') {
        return <DoctorDashboard user={currentUser} onLogout={handleLogout} />;
    }

    // --- STAFF MODE ---
    if (currentUser.role === 'staff') {
        return <StaffDashboard user={currentUser} onLogout={handleLogout} />;
    }
    
    // --- CLINIC MODE (With Mobile Restriction) ---
    if (isMobile) {
        return <MobileBlocker onLogout={handleLogout} />;
    }

    return (
        <div className="flex flex-col h-screen w-full font-sans text-text-primary bg-transparent relative overflow-hidden">
            {criticalFinding && <CriticalFindingAlert finding={criticalFinding} onClose={() => setCriticalFinding(null)} />}
            {rationaleMessage && <RationaleModal message={rationaleMessage} patientData={patientData!} debateHistory={debateHistory} onClose={() => setRationaleMessage(null)} />}
            {isApiConfigured() && !apiHealthy && (
                <div className="flex-none flex items-center justify-center gap-3 py-2 px-4 bg-amber-500/90 text-white text-sm font-medium z-40">
                    <span>Server bilan bog'lanish yo'q. Ma'lumotlar mahalliy saqlanadi.</span>
                    <button type="button" onClick={checkNow} className="underline font-semibold hover:no-underline">Qayta tekshirish</button>
                </div>
            )}
            <header className="flex-none pt-4 px-4 pb-2 z-30">
                 <div className="glass-panel px-6 py-3 flex justify-between items-center shadow-lg shadow-blue-500/5 mx-auto max-w-[1600px]">
                        <div className="flex items-center gap-3">
                             <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <span className="text-white font-black text-lg">M</span>
                             </div>
                             <h1 className="text-xl font-bold tracking-tight text-text-primary hidden sm:block">{t('appName')}</h1>
                        </div>
                        <div className="hidden md:flex items-center gap-1 p-1 bg-white/40 rounded-full border border-white/40 backdrop-blur-md shadow-inner">
                            <NavButton view="dashboard" label={t('nav_dashboard')} icon={<HomeIcon />} />
                            <NavButton view="new_analysis" label={t('nav_new_case')} icon={<PlusCircleIcon />} />
                            <NavButton view="history" label={t('nav_archive')} icon={<DocumentReportIcon />} />
                            <NavButton view="research" label={t('nav_research')} icon={<LightBulbIcon />} />
                        </div>
                        <div className="flex items-center gap-3">
                            <LanguageSwitcher language={language} onLanguageChange={setLanguage as (lang: Language) => void} />
                            <button onClick={handleLogout} className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2 hover:bg-white/50 rounded-xl">{t('logout')}</button>
                        </div>
                </div>
            </header>

            <main className="flex-grow flex flex-col overflow-hidden w-full max-w-[1600px] mx-auto relative z-10">
               {renderMainContent()}
            </main>
            
            <footer className="flex-none w-full py-4 px-6 border-t border-white/20 bg-white/30 backdrop-blur-2xl z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-3 text-[11px] font-medium tracking-wide text-slate-500">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                            <CopyrightIcon className="w-3.5 h-3.5 opacity-70" />
                            <span>Since 2025 {t('appName')}. {t('footer_rights')}</span>
                        </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 bg-white/40 px-4 py-1.5 rounded-full border border-white/40 shadow-sm">
                        <div className="flex items-center gap-1.5 group">
                            <span className="opacity-70">{t('footer_creator')}:</span>
                            <a href="https://cdcgroup.uz" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent font-bold hover:scale-105 transition-transform duration-200 cursor-pointer">CDCGroup</a>
                        </div>
                        <span className="hidden sm:block w-px h-3 bg-slate-300"></span>
                        <div className="flex items-center gap-1.5 group">
                            <span className="opacity-70">{t('footer_support')}:</span>
                            <a href="https://cdcgroup.uz" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold hover:scale-105 transition-transform duration-200 cursor-pointer">CraDev Company</a>
                        </div>
                    </div>
                </div>
            </footer>
            
            <MobileNavBar activeView={appView} onNavigate={handleNavigation as (view: 'dashboard' | 'new_analysis' | 'history' | 'research') => void} />
        </div>
    );
};

const App: React.FC = () => (
    <AppContent />
);

export default App;
