
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { PatientData, ChatMessage, FinalReport, ProgressUpdate, User, AnalysisRecord, Diagnosis, DetectedMedication, DiagnosisFeedback, CriticalFinding, CMETopic, UserStats, AppView, PrognosisReport } from './types';
import { normalizeConsensusDiagnosis } from './types';
import * as aiService from './services/aiCouncilService';
import * as authService from './services/apiAuthService';
import * as authServiceLocal from './services/authService';
import * as caseService from './services/caseService';
import * as tvLinkService from './services/tvLinkService'; // Import TV Service
import { useTranslation } from './hooks/useTranslation';
import { useApiHealth } from './hooks/useApiHealth';
import { Language } from './i18n/LanguageContext';
import { isApiConfigured } from './config/api';
import { getAuthToken, clearTokens } from './services/api';

// --- Views & Components ---
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import UserGuide from './components/UserGuide';
import AboutInstitutePage from './components/AboutInstitutePage';
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
import { INSTITUTE_NAME_FULL, INSTITUTE_NAME_SHORT, PLATFORM_NAME, INSTITUTE_LOGO_SRC } from './constants/brand';

const ScrollWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="h-full overflow-y-auto overflow-x-hidden page-px py-6 custom-scrollbar min-w-0">
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
            Hurmatli foydalanuvchi, <strong>{INSTITUTE_NAME_SHORT}</strong> ({INSTITUTE_NAME_FULL}) tizimining to'liq funksionalidan foydalanish uchun, iltimos, 
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
    // Initialize from localStorage; only refresh from API when we have a token to avoid 401s
    const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
    
    // New States for Landing Page Flow
    const [showLanding, setShowLanding] = useState(!currentUser); // Show landing if not logged in
    const [showGuide, setShowGuide] = useState(false);
    const [showAbout, setShowAbout] = useState(false);

    // Sync with API when token exists; clear stale session when no token (avoids 401 on profile/analyses)
    useEffect(() => {
        if (!currentUser) return;
        if (!getAuthToken()) {
            clearTokens();
            setCurrentUser(null);
            setShowLanding(true);
            return;
        }
        import('./services/apiAuthService').then(({ getProfile }) => {
            getProfile().then(apiUser => {
                if (apiUser) {
                    setCurrentUser(apiUser);
                } else {
                    clearTokens();
                    setCurrentUser(null);
                    setShowLanding(true);
                }
            });
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount to validate session

    const [appView, setAppView] = useState<AppView>('dashboard');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [tvModeDoctorId, setTvModeDoctorId] = useState<string | null>(null);
    const historyFromPopstateRef = useRef(false);

    // i18n — must be before any effect that uses language/t
    const { t, language, setLanguage } = useTranslation();

    // Brauzer orqaga: SPA ichida qolish, platformadan chiqib ketmaslik
    useEffect(() => {
        if (historyFromPopstateRef.current) {
            historyFromPopstateRef.current = false;
            return;
        }
        const state = { appView };
        if (!window.history.state || (window.history.state as { appView?: AppView }).appView !== appView) {
            window.history.pushState(state, '', window.location.href);
        }
    }, [appView]);

    useEffect(() => {
        const onPopstate = (e: PopStateEvent) => {
            const state = e.state as { appView?: AppView } | null;
            historyFromPopstateRef.current = true;
            setAppView(state?.appView ?? 'dashboard');
        };
        window.addEventListener('popstate', onPopstate);
        return () => window.removeEventListener('popstate', onPopstate);
    }, []);

    // Telefon: input/textarea fokusida klaviatura orqasida qolmasin (faqat mobil qurilmalarda)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const ua = navigator.userAgent || '';
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua);
        if (!isMobileUA) {
            // Faqat haqiqiy telefon/planshetlarda yoqamiz; desktopda ishlamasin
            return;
        }
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onFocusIn = (e: FocusEvent) => {
            const el = e.target as HTMLElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                    timer = null;
                }, 380);
            }
        };
        document.addEventListener('focusin', onFocusIn);
        return () => {
            document.removeEventListener('focusin', onFocusIn);
            if (timer) clearTimeout(timer);
        };
    }, []);

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

    // Sahifa yuklanganida: token bo'lsa barcha rollar uchun tahlillarni bazadan (API) yuklash
    useEffect(() => {
        if (!currentUser?.phone) return;
        if (!getAuthToken()) {
            const history = authServiceLocal.getAnalyses(currentUser.phone);
            setUserHistory(history);
            setDashboardStats(caseService.getDashboardStats(history));
            return;
        }
        import('./services/apiAnalysisService').then(({ getAnalyses }) => {
            getAnalyses().then(response => {
                if (response.success && response.data) {
                    setUserHistory(response.data);
                    setDashboardStats(caseService.getDashboardStats(response.data));
                    aiService.suggestCmeTopics(response.data, language).then(setCmeTopics);
                } else {
                    const history = authServiceLocal.getAnalyses(currentUser.phone);
                    setUserHistory(history);
                    setDashboardStats(caseService.getDashboardStats(history));
                    aiService.suggestCmeTopics(history, language).then(setCmeTopics);
                }
            }).catch(() => {
                const history = authServiceLocal.getAnalyses(currentUser.phone);
                setUserHistory(history);
                setDashboardStats(caseService.getDashboardStats(history));
                aiService.suggestCmeTopics(history, language).then(setCmeTopics);
            });
        }).catch(() => {
            const history = authServiceLocal.getAnalyses(currentUser.phone);
            setUserHistory(history);
            setDashboardStats(caseService.getDashboardStats(history));
        });
    }, [currentUser, language]);

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
    const { apiHealthy, healthStatus, checkNow } = useApiHealth();

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
            case 'report': {
                const reportData = update.data;
                const mergedReport: FinalReport = {
                    ...reportData,
                    prognosisReport: livePrognosis ?? reportData.prognosisReport,
                    rejectedHypotheses: Array.isArray(reportData.rejectedHypotheses) && reportData.rejectedHypotheses.length > 0
                        ? reportData.rejectedHypotheses.map((h: { name?: string; reason?: string }) => ({ name: String(h?.name ?? ''), reason: String(h?.reason ?? '') }))
                        : (reportData.rejectedHypotheses ?? []),
                };
                setFinalReport(mergedReport);
                setIsProcessing(false);
                setSocraticQuestion(null);
                setStatusMessage(t('analysis_complete_status'));
                const detectedMeds = update.type === 'report' ? (update as { detectedMedications: DetectedMedication[] }).detectedMedications : [];
                if (currentUser && patientData) {
                    const newRecord: AnalysisRecord = {
                        id: currentAnalysisRecord?.id || new Date().toISOString(),
                        patientId: currentAnalysisRecord?.patientId || `${patientData.lastName}-${patientData.firstName}-${Date.now()}`,
                        date: new Date().toISOString(),
                        patientData,
                        debateHistory,
                        finalReport: mergedReport,
                        followUpHistory: [],
                        selectedSpecialists: selectedSpecialistsConfig.map(s => s.role),
                        detectedMedications: Array.isArray(detectedMeds) ? detectedMeds : [],
                    };

                    const applyHistoryAndRecord = (historyList: AnalysisRecord[], savedRecord: AnalysisRecord) => {
                        setUserHistory(historyList);
                        setDashboardStats(caseService.getDashboardStats(historyList));
                        setCurrentAnalysisRecord(savedRecord);
                        aiService.suggestCmeTopics(historyList, language).then(setCmeTopics);
                    };

                    import('./services/apiAnalysisService').then(({ createAnalysis, updateAnalysis, getAnalyses }) => {
                        const analysisIdNum = currentAnalysisRecord?.id ? parseInt(currentAnalysisRecord.id, 10) : NaN;
                        const hasValidAnalysisId = !isNaN(analysisIdNum) && analysisIdNum > 0;

                        if (hasValidAnalysisId) {
                            updateAnalysis(analysisIdNum, newRecord).then((res) => {
                                if (res.success && res.data) {
                                    const fromApi = { ...newRecord, id: String(res.data.id), patientId: res.data.patientId };
                                    authServiceLocal.updateAnalysis(currentUser.phone, fromApi);
                                }
                                return getAnalyses();
                            }).then((response) => {
                                if (response.success && response.data) {
                                    const saved = response.data.find((r) => r.id === String(analysisIdNum)) || newRecord;
                                    applyHistoryAndRecord(response.data, { ...newRecord, id: String(saved.id), patientId: saved.patientId });
                                } else {
                                    const history = authServiceLocal.getAnalyses(currentUser.phone);
                                    applyHistoryAndRecord(history, newRecord);
                                }
                            }).catch(() => {
                                authServiceLocal.updateAnalysis(currentUser.phone, newRecord);
                                applyHistoryAndRecord(authServiceLocal.getAnalyses(currentUser.phone), newRecord);
                            });
                            return;
                        }

                        import('./services/apiPatientService').then(({ createPatient }) => {
                            createPatient(patientData).then(patientResponse => {
                                if (!patientResponse.success || !patientResponse.data) {
                                    authServiceLocal.saveAnalysis(currentUser.phone, newRecord);
                                    caseService.addCaseToLibrary(newRecord);
                                    applyHistoryAndRecord(authServiceLocal.getAnalyses(currentUser.phone), newRecord);
                                    setError(patientResponse.error?.message || "Bemor serverga saqlanmadi. Tahlil faqat ushbu qurilmada saqlandi.");
                                    return;
                                }
                                const patientId = patientResponse.data.id;
                                createAnalysis(patientId, newRecord).then((createRes) => {
                                    if (createRes.success && createRes.data) {
                                        const fromApi = {
                                            ...newRecord,
                                            id: String(createRes.data.id),
                                            patientId: String(createRes.data.patientId ?? patientId),
                                        };
                                        authServiceLocal.saveAnalysis(currentUser.phone, fromApi);
                                        caseService.addCaseToLibrary(fromApi);
                                        setError(null);
                                    } else {
                                        authServiceLocal.saveAnalysis(currentUser.phone, newRecord);
                                        caseService.addCaseToLibrary(newRecord);
                                        setError(createRes.error?.message || "Tahlil serverga saqlanmadi. Faqat ushbu qurilmada saqlandi.");
                                    }
                                    return getAnalyses();
                                }).then((response) => {
                                    if (response.success && Array.isArray(response.data)) {
                                        const list = response.data;
                                        const savedRecord = createRes?.success && createRes?.data
                                            ? { ...newRecord, id: String(createRes.data.id), patientId: String(createRes.data.patientId ?? patientId) }
                                            : newRecord;
                                        applyHistoryAndRecord(list, list[0] ?? savedRecord);
                                    } else {
                                        applyHistoryAndRecord(authServiceLocal.getAnalyses(currentUser.phone), newRecord);
                                    }
                                }).catch(() => {
                                    authServiceLocal.saveAnalysis(currentUser.phone, newRecord);
                                    caseService.addCaseToLibrary(newRecord);
                                    applyHistoryAndRecord(authServiceLocal.getAnalyses(currentUser.phone), newRecord);
                                    setError("Serverga ulanishda xatolik. Tahlil faqat ushbu qurilmada saqlandi.");
                                });
                            }).catch(() => {
                                authServiceLocal.saveAnalysis(currentUser.phone, newRecord);
                                caseService.addCaseToLibrary(newRecord);
                                applyHistoryAndRecord(authServiceLocal.getAnalyses(currentUser.phone), newRecord);
                                setError("Bemor yoki tahlil serverga saqlanmadi. Faqat ushbu qurilmada saqlandi.");
                            });
                        });
                    }).catch((err) => {
                        if (currentAnalysisRecord?.id) {
                            authServiceLocal.updateAnalysis(currentUser.phone, newRecord);
                        } else {
                            authServiceLocal.saveAnalysis(currentUser.phone, newRecord);
                            caseService.addCaseToLibrary(newRecord);
                        }
                        applyHistoryAndRecord(authServiceLocal.getAnalyses(currentUser.phone), newRecord);
                        setError(err?.message || "Serverga saqlashda xatolik. Tahlil ushbu qurilmada saqlandi.");
                    });
                }
                break;
            }
            case 'error':
                setError(update.message);
                setIsProcessing(false);
                setStatusMessage(t('analysis_error_status'));
                break;
        }
    }, [currentUser, patientData, debateHistory, selectedSpecialistsConfig, t, currentAnalysisRecord, language]);

    const handleLoginSuccess = (user: User) => {
        setCurrentUser(user);
        setShowLanding(false); // Hide landing after successful login
        // Barcha rollar uchun tahlillarni bazadan (API) yuklash; token bo'lsa API, aks holda localStorage
        import('./services/apiAnalysisService').then(({ getAnalyses }) => {
            getAnalyses().then(response => {
                if (response.success && response.data) {
                    setUserHistory(response.data);
                    setDashboardStats(caseService.getDashboardStats(response.data));
                    aiService.suggestCmeTopics(response.data, language).then(setCmeTopics);
                } else {
                    const history = authServiceLocal.getAnalyses(user.phone);
                    setUserHistory(history);
                    setDashboardStats(caseService.getDashboardStats(history));
                    aiService.suggestCmeTopics(history, language).then(setCmeTopics);
                }
                setAppView('dashboard');
            }).catch(() => {
                const history = authServiceLocal.getAnalyses(user.phone);
                setUserHistory(history);
                setDashboardStats(caseService.getDashboardStats(history));
                aiService.suggestCmeTopics(history, language).then(setCmeTopics);
                setAppView('dashboard');
            });
        }).catch(() => {
            const history = authServiceLocal.getAnalyses(user.phone);
            setUserHistory(history);
            setDashboardStats(caseService.getDashboardStats(history));
            setAppView('dashboard');
        });
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

    /** Savollar avval API, keyin Gemini orqali; ikkalasi bo'sh bo'lsa ham fallback savollar bilan aniqlashtiruv ko'rsatiladi. */
    const CLARIFY_TIMEOUT_MS = 18000;
    const handleGenerateClarificationQuestions = async (data: PatientData) => {
        setError(null);
        setIsProcessing(true);
        setStatusMessage(t('clarification_generating_questions'));
        let questions: string[] = [];
        try {
            const { generateClarifyingQuestions } = await import('./services/apiAiService');
            const response = await Promise.race([
                generateClarifyingQuestions(data),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), CLARIFY_TIMEOUT_MS)),
            ]);
            if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                questions = response.data;
            }
        } catch { /* timeout yoki xato → Gemini fallback */ }

        if (questions.length === 0) {
            try {
                questions = await aiService.generateClarifyingQuestions(data, language);
            } catch { /* ignore */ }
        }

        if (questions.length === 0) {
            const { getCaseBasedClarificationQuestions, CLARIFY_FALLBACK } = await import('./services/aiCouncilService');
            const caseBased = getCaseBasedClarificationQuestions(data, language);
            questions = caseBased.length >= 2 ? caseBased : CLARIFY_FALLBACK[language];
        }

        setClarificationQuestions(questions);
        setIsProcessing(false);
        setAppView('clarification');
    };

    const handleRecommendTeamFromData = async (data: PatientData) => {
        setIsProcessing(true);
        setStatusMessage(t('team_recommendation_creating'));
        try {
            const { recommendSpecialists } = await import('./services/apiAiService');
            const response = await recommendSpecialists(data);
            if (response.success && response.data?.recommendations?.length) {
                setRecommendedTeam(response.data.recommendations);
                setError(null);
            } else {
                throw new Error('API failed');
            }
        } catch {
            try {
                const team = await aiService.recommendSpecialists(data, language);
                setRecommendedTeam(team.recommendations);
                setError(null);
            } catch {
                const defaultSpecialists = [AIModel.INTERNAL_MEDICINE, AIModel.FAMILY_MEDICINE, AIModel.EMERGENCY, AIModel.GEMINI, AIModel.CLAUDE, AIModel.GPT];
                setRecommendedTeam(defaultSpecialists.map(model => ({ model, reason: 'Standart jamoa' })));
            }
        } finally { setIsProcessing(false); }
    };

    const handleDataSubmit = async (data: PatientData) => {
        setPatientData(data);
        await handleGenerateClarificationQuestions(data);
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
        await handleRecommendTeamFromData(enrichedPatientData);
    };

    const handleTeamConfirmation = (confirmedTeam: { role: AIModel, backEndModel: string }[], orchestrator: string) => {
        if (!patientData) return;
        setSelectedSpecialistsConfig(confirmedTeam);
        setOrchestratorModel(orchestrator);
        setDifferentialDiagnoses([]);
        setError(null);
        setDebateHistory([]);
        setFinalReport(null);
        setAppView('live_analysis');
        setIsProcessing(true);
        setStatusMessage(t('debate_start_status'));
        const enrichedPatientData = { ...patientData, userDiagnosisFeedback: diagnosisFeedback };
        setPatientData(enrichedPatientData);
        const getUserInterventionCallback = () => {
            const intervention = userInterventionRef.current;
            userInterventionRef.current = null;
            setUserIntervention(null);
            return intervention;
        };
        aiService.runCouncilDebate(enrichedPatientData, [], confirmedTeam, orchestrator, handleProgress, getUserInterventionCallback, language);
    };

    const handleStartDebate = () => {
        if (!patientData) return;
        const enrichedPatientData = { ...patientData, userDiagnosisFeedback: diagnosisFeedback };
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
        const merged = { ...currentAnalysisRecord.finalReport, ...updatedReport };
        const newFinalReport: FinalReport = {
            ...merged,
            consensusDiagnosis: normalizeConsensusDiagnosis(merged.consensusDiagnosis ?? (currentAnalysisRecord.finalReport as FinalReport)?.consensusDiagnosis),
        } as FinalReport;
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
        setDifferentialDiagnoses(normalizeConsensusDiagnosis(record.finalReport?.consensusDiagnosis));
        setAppView('live_analysis');
        setIsProcessing(false); 
        setStatusMessage("Arxivdan yuklandi. Munozarani davom ettirishingiz mumkin.");
    };

    /** Sahifa ichidagi qaytish paneli - faqat dashboard da ko'rinmaydi */
    const BackBar: React.FC<{
        title: string;
        subtitle?: string;
        onBack: () => void;
        backLabel?: string;
        extra?: React.ReactNode;
    }> = ({ title, subtitle, onBack, backLabel = 'Asosiy sahifa', extra }) => (
        <div
            className="flex items-center gap-3 px-4 py-2.5 mb-0 flex-shrink-0"
            style={{
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.6)',
            }}
        >
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-all border border-slate-200/60"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {backLabel}
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-800 leading-none truncate">{title}</h2>
                {subtitle && <p className="text-[10px] text-slate-400 mt-0.5 leading-none truncate">{subtitle}</p>}
            </div>
            {extra && <div className="flex-shrink-0">{extra}</div>}
        </div>
    );

    const renderMainContent = () => {
        switch (appView) {
            case 'dashboard':
                return (
                    <ScrollWrapper>
                        <Dashboard
                            userName={currentUser!.name}
                            onNewAnalysis={() => handleNavigation('new_analysis')}
                            onViewHistory={() => setAppView('history')}
                            recentAnalyses={userHistory.slice(0, 5)}
                            onSelectAnalysis={viewHistoryItem}
                            stats={dashboardStats}
                            cmeTopics={cmeTopics}
                        />
                    </ScrollWrapper>
                );

            case 'new_analysis':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title={t('nav_new_case')} subtitle="Bemor ma'lumotlarini kiriting" onBack={() => handleNavigation('dashboard')} />
                        <div className="flex-1 page-px py-4 overflow-hidden">
                            <DataInputForm onSubmit={handleDataSubmit} isAnalyzing={isProcessing} />
                        </div>
                    </div>
                );

            case 'clarification':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title="Aniqlashtiruvchi Savollar" subtitle="Konsilium tahlilini boyitish uchun" onBack={() => handleNavigation('new_analysis')} backLabel="Orqaga" />
                        <ScrollWrapper>
                            <div className="max-w-3xl mx-auto w-full min-w-0">
                                <ClarificationView isGenerating={isProcessing} questions={clarificationQuestions} onSubmit={handleClarificationSubmit} statusMessage={statusMessage} error={error} />
                            </div>
                        </ScrollWrapper>
                    </div>
                );

            case 'team_recommendation':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title="Mutaxassislar Jamoasi" subtitle="AI konsilium uchun jamoa tanlang" onBack={() => handleNavigation('new_analysis')} backLabel="Orqaga" />
                        <ScrollWrapper>
                            <div className="max-w-3xl mx-auto w-full h-full flex flex-col min-w-0">
                                <TeamRecommendationView isProcessing={isProcessing} recommendations={recommendedTeam} onConfirm={handleTeamConfirmation} />
                            </div>
                        </ScrollWrapper>
                    </div>
                );

            case 'live_analysis':
            case 'view_history_item': {
                const record = { patientData, debateHistory, finalReport, selectedSpecialists: selectedSpecialistsConfig.map(s => s.role) };
                if (!record || !record.patientData) return <div className="text-center p-8 text-slate-500">{t('error_no_data_found')}</div>;
                const isArchive = appView === 'view_history_item' && !isProcessing && debateHistory.length > 0;
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar
                            title={isArchive ? "Tahlil Ko'rinishi" : "Konsilium Jarayoni"}
                            subtitle={record.patientData ? `${record.patientData.firstName} ${record.patientData.lastName}` : ''}
                            onBack={() => isArchive ? setAppView('history') : handleNavigation('dashboard')}
                            backLabel={isArchive ? 'Arxiv' : 'Asosiy sahifa'}
                        />
                        <div className="flex-1 page-px py-3 overflow-hidden">
                            <AnalysisView record={record} isLive={true} statusMessage={statusMessage} isAnalyzing={isProcessing} differentialDiagnoses={differentialDiagnoses} error={error} onDiagnosisFeedback={handleDiagnosisFeedback} diagnosisFeedback={diagnosisFeedback} onStartDebate={handleStartDebate} onInjectHypothesis={handleInjectHypothesis} onUserIntervention={handleUserIntervention} userIntervention={userIntervention} onExplainRationale={handleExplainRationale} socraticQuestion={socraticQuestion} livePrognosis={livePrognosis} onRunScenario={handleRunScenario} onUpdateReport={handleUpdateReport} />
                        </div>
                    </div>
                );
            }

            case 'history':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title="Tahlillar Arxivi" subtitle="O'tkazilgan barcha tahlillar" onBack={() => handleNavigation('dashboard')} />
                        <ScrollWrapper>
                            <HistoryView analyses={userHistory} onSelectAnalysis={viewHistoryItem} onStartConsultation={() => {}} onViewCaseLibrary={() => setAppView('case_library')} />
                        </ScrollWrapper>
                    </div>
                );

            case 'case_library':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title="Holatlar Kutubxonasi" onBack={() => setAppView('history')} backLabel="Arxiv" />
                        <ScrollWrapper>
                            <CaseLibraryView onBack={() => setAppView('history')} />
                        </ScrollWrapper>
                    </div>
                );

            default:
                return <div className="text-center p-8 text-slate-500">{t('error_page_not_found')}</div>;
        }
    };
    
    // --- TV DISPLAY MODE ---
    if (tvModeDoctorId) {
        return <TvDisplay doctorId={tvModeDoctorId} />;
    }

    // --- LANDING PAGE FLOW ---
    if (!currentUser) {
        if (showAbout) {
            return <AboutInstitutePage onBack={() => setShowAbout(false)} />;
        }
        if (showGuide) {
            return <UserGuide onBack={() => setShowGuide(false)} />;
        }
        if (showLanding) {
            return <LandingPage onLogin={() => setShowLanding(false)} onOpenGuide={() => setShowGuide(true)} onOpenAbout={() => setShowAbout(true)} />;
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
        <div className="flex flex-col h-screen w-full max-w-[100vw] font-sans text-text-primary app-bg relative overflow-hidden">
            {/* Oq/kulrang animatsion gradient (index.css .app-bg) */}
            {criticalFinding && <CriticalFindingAlert finding={criticalFinding} onClose={() => setCriticalFinding(null)} />}
            {rationaleMessage && <RationaleModal message={rationaleMessage} patientData={patientData!} debateHistory={debateHistory} onClose={() => setRationaleMessage(null)} />}
            {isApiConfigured() && !apiHealthy && !isProcessing && (
                <div className="flex-none flex items-center justify-center gap-2 sm:gap-3 py-2 page-px bg-amber-500/90 text-white text-xs sm:text-sm font-medium z-40 flex-wrap">
                    {healthStatus === 400 ? (
                        <span className="break-words">Domen boshqa serverga yo&apos;naltirilgan. DNS tekshiring: <code className="bg-black/20 px-1 rounded">nslookup medora.cdcgroup.uz</code>{' -> '}<code className="bg-black/20 px-1 rounded">167.71.53.238</code> bo&apos;lishi kerak.</span>
                    ) : (
                        <span>Server bilan bog&apos;lanish yo&apos;q. Ma&apos;lumotlar mahalliy saqlanadi.</span>
                    )}
                    <button type="button" onClick={checkNow} className="underline font-semibold hover:no-underline shrink-0">Qayta tekshirish</button>
                </div>
            )}
            <header className="flex-none pt-3 sm:pt-4 pb-2 z-30 w-full relative">
                <div className="glass-panel page-px py-2.5 flex justify-between items-center shadow-lg shadow-blue-500/5 w-full min-w-0">
                    {/* Logo */}
                    <button
                        onClick={() => handleNavigation('dashboard')}
                        className="flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-80 transition-opacity"
                    >
                        <img src={INSTITUTE_LOGO_SRC} alt={INSTITUTE_NAME_SHORT} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shrink-0 bg-slate-100" />
                        <div className="min-w-0 hidden sm:block">
                            <h1 className="text-base font-black tracking-tight text-slate-800 leading-none">{t('appName')}</h1>
                            <p className="text-[9px] text-slate-400 font-medium tracking-wide leading-none mt-0.5">{PLATFORM_NAME} - AI Konsilium</p>
                        </div>
                        <h1 className="text-base font-black tracking-tight text-slate-800 sm:hidden">{t('appName')}</h1>
                    </button>

                    {/* Right: lang + logout */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <LanguageSwitcher language={language} onLanguageChange={setLanguage as (lang: Language) => void} />
                        <button
                            onClick={handleLogout}
                            className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-red-600 transition-colors px-3 sm:px-4 py-2 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100"
                        >
                            {t('logout')}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-grow flex flex-col overflow-hidden w-full min-w-0 relative z-10 isolate">
               {renderMainContent()}
            </main>
            
            <footer className="flex-none w-full z-20 relative">
                {/* Top accent line */}
                <div className="w-full h-px" style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.4) 30%, rgba(34,197,94,0.4) 60%, transparent 100%)',
                }} />

                <div
                    className="w-full"
                    style={{
                        background: 'linear-gradient(135deg, rgba(248,252,255,0.92) 0%, rgba(236,248,250,0.92) 50%, rgba(240,253,244,0.92) 100%)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                    }}
                >
                    {/* Main footer content */}
                    <div className="container-full py-3 sm:py-4 flex flex-col lg:flex-row justify-between items-center gap-3">

                        {/* Institute branding */}
                        <div className="flex items-center gap-3 min-w-0">
                            <img src={INSTITUTE_LOGO_SRC} alt={INSTITUTE_NAME_SHORT} className="w-8 h-8 rounded-xl object-contain flex-shrink-0 shadow-md" />
                            <div className="min-w-0">
                                <p
                                    className="font-black text-sm tracking-tight"
                                    style={{
                                        background: 'linear-gradient(90deg, #0369a1 0%, #0891b2 50%, #059669 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    {INSTITUTE_NAME_SHORT}
                                </p>
                                <p className="text-[9px] text-slate-400 font-medium tracking-wide hidden sm:block truncate">
                                    {INSTITUTE_NAME_FULL}
                                </p>
                            </div>
                        </div>

                        {/* Center - copyright */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                            <CopyrightIcon className="w-3 h-3 opacity-60 flex-shrink-0" />
                            <span>2026 · {t('footer_rights')}</span>
                            <span className="hidden sm:inline text-slate-300 mx-1">|</span>
                            <span
                                className="hidden sm:inline font-bold"
                                style={{
                                    background: 'linear-gradient(90deg, #0ea5e9, #10b981)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                {PLATFORM_NAME}
                            </span>
                        </div>

                        {/* Right - partners */}
                        <div className="flex items-center gap-4 sm:gap-5 text-[10px] flex-wrap justify-center">
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-medium">{t('footer_creator')}:</span>
                                <a
                                    href="https://fargana.uz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-black hover:scale-105 transition-transform"
                                    style={{
                                        background: 'linear-gradient(90deg, #0369a1, #0891b2)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    CDCGroup
                                </a>
                            </div>
                            <div className="w-px h-3 bg-slate-200 hidden sm:block" />
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-medium">{t('footer_support')}:</span>
                                <a
                                    href="https://fargana.uz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-black hover:scale-105 transition-transform"
                                    style={{
                                        background: 'linear-gradient(90deg, #7c3aed, #6366f1)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    CraDev Company
                                </a>
                            </div>
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