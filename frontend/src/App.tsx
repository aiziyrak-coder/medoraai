
import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import type { PatientData, ChatMessage, FinalReport, ProgressUpdate, User, AnalysisRecord, Diagnosis, DetectedMedication, DiagnosisFeedback, CriticalFinding, UserStats, AppView, PrognosisReport } from './types';
import { normalizeConsensusDiagnosis } from './types';
import * as aiService from './services/aiCouncilService';
import * as authService from './services/apiAuthService';
import * as caseService from './services/caseService';
import * as tvLinkService from './services/tvLinkService'; // Import TV Service
import { useTranslation } from './hooks/useTranslation';
import { getSpecialistsFromComplaint } from './utils/specialistRecommendation';
import { checkPatientComplaintConsistency } from './utils/smartValidation';
import { getPriorAnalysesForPatient, buildLongitudinalClinicalNotes } from './utils/longitudinalContext';
import { useApiHealth } from './hooks/useApiHealth';
import { Language } from './i18n/LanguageContext';
import { isApiConfigured } from './config/api';
import { getAuthToken, clearTokens } from './services/api';
import { inferFallbackSpecialists } from './utils/specialistTeamFallback';

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
const HistoryView = lazy(() => import('./components/HistoryView'));
import MobileNavBar from './components/MobileNavBar';
const ResearchView = lazy(() => import('./components/ResearchView'));
import ClarificationView from './components/ClarificationView';
import Dashboard from './components/Dashboard';
import LiveConsultationView from './components/LiveConsultationView';
import AnalysisView from './components/AnalysisView';
import TeamRecommendationView from './components/TeamRecommendationView';
const CaseLibraryView = lazy(() => import('./components/CaseLibraryView'));
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
const MobileBlocker: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in-up">
            <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                <MonitorIcon className="w-12 h-12 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">{t('mobile_block_title')}</h2>
            <p className="text-slate-300 text-lg leading-relaxed max-w-md">
                {t('mobile_block_intro_prefix')}
                <strong>MEDORA AI</strong>
                {t('mobile_block_intro_suffix')}
                <span className="text-blue-400 font-bold"> {t('mobile_block_computer')}</span>
                {t('mobile_block_or')}
                <span className="text-blue-400 font-bold">{t('mobile_block_tablet')}</span>
                {t('mobile_block_intro_end')}
            </p>
            <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-white/10">
                <p className="text-sm text-slate-400">
                    {t('mobile_block_footer')}
                </p>
            </div>
            <button
                type="button"
                onClick={onLogout}
                className="mt-8 text-sm font-bold text-blue-400 hover:text-white transition-colors underline"
            >
                {t('mobile_block_back')}
            </button>
        </div>
    );
};

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

    // Sahifa yuklanganida: token bo'lsa barcha rollar uchun tahlillarni faqat API dan yuklash
    useEffect(() => {
        if (!currentUser?.phone) return;
        if (!getAuthToken()) {
            // Token bo'lmasa, serverdan yuklab bo'lmaydi; lokal saqlashdan foydalanmaymiz
            setUserHistory([]);
            setDashboardStats(null);
            return;
        }
        caseService.loadDashboardStatsFromApi().then(result => {
            if (result) {
                setUserHistory(result.list);
                setDashboardStats(result.stats);
            } else {
                setUserHistory([]);
                setDashboardStats(null);
            }
        }).catch(() => {
            setUserHistory([]);
            setDashboardStats(null);
        });
    }, [currentUser]);

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
    
    const [currentAnalysisRecord, setCurrentAnalysisRecord] = useState<AnalysisRecord | null>(null);
    const [createdPatientId, setCreatedPatientId] = useState<number | null>(null);
    /** Bazadan tanlangan bemor patient.id (string) — avvalgi tahlillar bilan bog'lash va updatePatient uchun */
    const [linkedPatientKey, setLinkedPatientKey] = useState<string | null>(null);
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
                        const list = Array.isArray(historyList) ? historyList : [];
                        setUserHistory(list);
                        const base = caseService.getDashboardStats(list);
                        import('./services/apiAnalysisService').then(({ getAnalysisStats }) => {
                            getAnalysisStats()
                                .then(sr => {
                                    if (sr.success && sr.data) {
                                        setDashboardStats(caseService.mergeDashboardStatsWithApi(base, sr.data));
                                    } else {
                                        setDashboardStats(base);
                                    }
                                })
                                .catch(() => setDashboardStats(base));
                        });
                        setCurrentAnalysisRecord(savedRecord);
                    };

                    import('./services/apiAnalysisService').then(({ createAnalysis, updateAnalysis, getAnalyses }) => {
                        const analysisIdNum = currentAnalysisRecord?.id ? parseInt(currentAnalysisRecord.id, 10) : NaN;
                        const hasValidAnalysisId = !isNaN(analysisIdNum) && analysisIdNum > 0;

                        if (hasValidAnalysisId) {
                            updateAnalysis(analysisIdNum, newRecord).then((res) => {
                                if (res.success && res.data) {
                                    const fromApi = { ...newRecord, id: String(res.data.id), patientId: res.data.patientId };
                                    return getAnalyses().then(response => {
                                        if (response.success && response.data) {
                                            const saved = response.data.find((r) => r.id === String(analysisIdNum)) || fromApi;
                                            applyHistoryAndRecord(response.data, { ...fromApi, id: String(saved?.id ?? fromApi.id ?? ''), patientId: saved?.patientId ?? fromApi.patientId ?? '' });
                                        } else {
                                            applyHistoryAndRecord([fromApi], fromApi);
                                        }
                                    });
                                } else {
                                    applyHistoryAndRecord([], newRecord);
                                }
                            }).catch(() => {
                                applyHistoryAndRecord([], newRecord);
                            });
                            return;
                        }

                        const patientIdToUse = (createdPatientId != null && createdPatientId > 0) ? createdPatientId : null;

                        const doCreateAnalysis = (patientId: number) => {
                            createAnalysis(patientId, newRecord).then((createRes) => {
                                if (createRes.success && createRes.data) {
                                    const fromApi = {
                                        ...newRecord,
                                        id: String((createRes.data as { id?: unknown }).id ?? ''),
                                        patientId: String((createRes.data as { patientId?: unknown }).patientId ?? patientId ?? ''),
                                    };
                                    setError(null);
                                    return getAnalyses().then((response) => {
                                        if (response?.success && Array.isArray(response.data)) {
                                            applyHistoryAndRecord(response.data, fromApi);
                                        } else {
                                            applyHistoryAndRecord([fromApi], fromApi);
                                        }
                                    });
                                } else {
                                    const errCode = createRes.error?.code;
                                    setError(errCode === 401 ? (t('error_save_server_login') || "Tahlilni serverga saqlash uchun tizimga kiring. Tahlil serverga saqlanmadi.") : (createRes.error?.message || "Tahlil serverga saqlanmadi."));
                                    applyHistoryAndRecord([], newRecord);
                                }
                            }).catch((err: unknown) => {
                                applyHistoryAndRecord([], newRecord);
                                const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : null;
                                setError(msg || "Serverga ulanishda xatolik. Tahlil serverga saqlanmadi.");
                            });
                        };

                        if (patientIdToUse != null) {
                            doCreateAnalysis(patientIdToUse);
                            return;
                        }

                        import('./services/apiPatientService').then(({ createPatient }) => {
                            createPatient(patientData).then(patientResponse => {
                                if (!patientResponse.success) {
                                    applyHistoryAndRecord([], newRecord);
                                    const errMsg = patientResponse.error?.message;
                                    const errCode = patientResponse.error?.code;
                                    setError(errCode === 401 ? (t('error_save_server_login') || "Tahlilni serverga saqlash uchun tizimga kiring. Tahlil serverga saqlanmadi.") : (errMsg || "Bemor serverga saqlanmadi."));
                                    return;
                                }
                                const raw = patientResponse.data as { id?: number; data?: { id?: number } } | undefined;
                                const patientId = (raw?.id != null ? raw.id : raw?.data?.id) != null
                                    ? Number(raw?.id ?? raw?.data?.id)
                                    : 0;
                                if (patientId <= 0) {
                                    applyHistoryAndRecord([], newRecord);
                                    setError("Bemor yaratildi, lekin ID olinmadi. Iltimos, qayta urinib ko'ring.");
                                    return;
                                }
                                doCreateAnalysis(patientId);
                            }).catch(() => {
                                applyHistoryAndRecord([], newRecord);
                                setError("Bemor yoki tahlil serverga saqlanmadi.");
                            });
                        });
                    }).catch((err: unknown) => {
                        applyHistoryAndRecord([], newRecord);
                        const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : null;
                        setError(msg || "Serverga saqlashda xatolik. Tahlil serverga saqlanmadi.");
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
    }, [currentUser, patientData, debateHistory, selectedSpecialistsConfig, t, currentAnalysisRecord, createdPatientId, language]);

    const handleLoginSuccess = (user: User) => {
        setCurrentUser(user);
        setShowLanding(false); // Hide landing after successful login
        // Barcha rollar uchun tahlillarni faqat bazadan (API) yuklash; lokal fallback ishlatilmaydi
        caseService.loadDashboardStatsFromApi().then(result => {
            if (result) {
                setUserHistory(result.list);
                setDashboardStats(result.stats);
            } else {
                setUserHistory([]);
                setDashboardStats(null);
            }
            setAppView('dashboard');
        }).catch(() => {
            setUserHistory([]);
            setDashboardStats(null);
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
        setCreatedPatientId(null);
        setLinkedPatientKey(null);
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

    /** Faqat shikoyatda tilga olingan mavzuga aloqador savollarni qoldiradi; mock/umumiy savollarni olib tashlaydi. */
    const filterQuestionsByComplaint = (qs: string[], complaint: string): string[] => {
        const c = (complaint || '').toLowerCase().replace(/[^\w\s'-]/g, ' ');
        const words = c.split(/\s+/).filter(w => w.length >= 3);
        if (words.length === 0) return qs;
        return qs.filter(q => {
            const ql = q.toLowerCase();
            return words.some(w => ql.includes(w));
        });
    };

    const handleGenerateClarificationQuestions = async (data: PatientData) => {
        setError(null);
        setIsProcessing(true);
        setStatusMessage(t('clarification_generating_questions'));
        const complaint = (data?.complaints ?? '').trim();

        let questions: string[] = [];
        const { getCaseBasedClarificationQuestions } = await import('./services/aiCouncilService');
        questions = getCaseBasedClarificationQuestions(data, language);
        if (questions.length >= 2) {
            setClarificationQuestions(questions);
            setIsProcessing(false);
            setAppView('clarification');
            return;
        }

        try {
            const { generateClarifyingQuestions } = await import('./services/apiAiService');
            const response = await Promise.race([
                generateClarifyingQuestions(data),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), CLARIFY_TIMEOUT_MS)),
            ]);
            if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                questions = filterQuestionsByComplaint(response.data, complaint);
            }
        } catch { /* timeout yoki xato */ }

        if (questions.length < 2) {
            try {
                const fromGemini = await aiService.generateClarifyingQuestions(data, language);
                if (fromGemini.length > 0) {
                    questions = filterQuestionsByComplaint(fromGemini, complaint);
                }
            } catch { /* ignore */ }
        }

        if (questions.length < 2) {
            questions = getCaseBasedClarificationQuestions(data, language);
        }

        setClarificationQuestions(questions);
        setIsProcessing(false);
        if (questions.length >= 2) {
            setAppView('clarification');
        } else {
            setAppView('team_recommendation');
            handleRecommendTeamFromData(data);
        }
    };

    /** Tezkor: avval bemorning barcha ma'lumotlari bo'yicha 6–10 mutaxassisni darhol ko'rsatadi, keyin fonda API natijasini yangilaydi. */
    const handleRecommendTeamFromData = (data: PatientData) => {
        const instant = getSpecialistsFromComplaint(data);
        setRecommendedTeam(instant);
        setIsProcessing(false);
        setError(null);
        (async () => {
            try {
                const { recommendSpecialists } = await import('./services/apiAiService');
                const response = await Promise.race([
                    recommendSpecialists(data),
                    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
                ]);
                if (response?.success && response.data?.recommendations?.length) {
                    setRecommendedTeam(response.data.recommendations);
                }
            } catch {
                try {
                    const team = await aiService.recommendSpecialists(data, language);
                    if (team.recommendations?.length) setRecommendedTeam(team.recommendations);
                } catch { /* keep instant list */ }
            }
        })();
    };

    const handleDataSubmit = async (data: PatientData) => {
        const consistency = checkPatientComplaintConsistency(data);
        if (!consistency.consistent) {
            setError(consistency.message ?? 'Bemor ma\'lumotlari va shikoyat matni mos kelmadi.');
            return;
        }
        setError(null);
        let merged: PatientData = { ...data };
        if (linkedPatientKey) {
            const prior = getPriorAnalysesForPatient(userHistory, linkedPatientKey);
            merged.longitudinalClinicalNotes = buildLongitudinalClinicalNotes(prior, data, language);
        } else {
            merged.longitudinalClinicalNotes = undefined;
        }
        setPatientData(merged);
        await handleGenerateClarificationQuestions(merged);
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
        if (linkedPatientKey) {
            const prior = getPriorAnalysesForPatient(userHistory, linkedPatientKey);
            enrichedPatientData.longitudinalClinicalNotes = buildLongitudinalClinicalNotes(prior, enrichedPatientData, language);
        } else {
            enrichedPatientData.longitudinalClinicalNotes = undefined;
        }
        setPatientData(enrichedPatientData);
        setAppView('team_recommendation');
        setIsProcessing(true);
        setStatusMessage(t('ddx_generating'));
        let diagnoses: Diagnosis[] = [];
        try {
            const { generateInitialDiagnoses, recommendSpecialists } = await import('./services/apiAiService');
            try {
                const ddxResp = await generateInitialDiagnoses(enrichedPatientData);
                if (ddxResp.success && ddxResp.data?.length) {
                    diagnoses = ddxResp.data;
                } else {
                    throw new Error('ddx api empty');
                }
            } catch {
                try {
                    diagnoses = await aiService.generateInitialDiagnoses(enrichedPatientData, language);
                } catch {
                    diagnoses = [];
                }
            }
            setDifferentialDiagnoses(diagnoses);

            setStatusMessage(t('team_recommendation_creating'));
            const response = await recommendSpecialists(enrichedPatientData, diagnoses.length ? diagnoses : undefined);
            if (response.success && response.data?.recommendations?.length) {
                setRecommendedTeam(response.data.recommendations);
            } else {
                throw new Error('API failed');
            }
        } catch (e) {
            try {
                const team = await aiService.recommendSpecialists(enrichedPatientData, language, diagnoses);
                setRecommendedTeam(team.recommendations);
            } catch (fallbackError) {
                setError(t('team_recommendation_auto_error'));
                setRecommendedTeam(inferFallbackSpecialists(enrichedPatientData, diagnoses));
            }
        } finally { setIsProcessing(false); }
    };

    const handleTeamConfirmation = async (confirmedTeam: { role: AIModel, backEndModel: string }[], orchestrator: string) => {
        if (!patientData) return;
        setSelectedSpecialistsConfig(confirmedTeam);
        setOrchestratorModel(orchestrator);
        setError(null);
        setDebateHistory([]);
        setFinalReport(null);
        setAppView('live_analysis');
        setIsProcessing(true);
        setStatusMessage(t('debate_start_status'));
        const enrichedPatientData = { ...patientData, userDiagnosisFeedback: diagnosisFeedback };
        setPatientData(enrichedPatientData);
        // Capture current ddx before clearing
        const currentDdx = differentialDiagnoses.slice();
        setDifferentialDiagnoses([]);

        if (currentUser) {
            try {
                const { createPatient, updatePatient } = await import('./services/apiPatientService');
                const n = linkedPatientKey && /^\d+$/.test(linkedPatientKey.trim()) ? Number(linkedPatientKey) : null;
                if (n != null && n > 0) {
                    const res = await updatePatient(n, enrichedPatientData);
                    if (res?.success !== false) setCreatedPatientId(n);
                } else {
                    const res = await createPatient(enrichedPatientData);
                    const id = res?.data && (res.data as { id?: number }).id;
                    if (id != null && Number(id) > 0) setCreatedPatientId(Number(id));
                }
            } catch {
                // Report paytida qayta urinamiz
            }
        }

        const getUserInterventionCallback = () => {
            const intervention = userInterventionRef.current;
            userInterventionRef.current = null;
            setUserIntervention(null);
            return intervention;
        };
        aiService.runCouncilDebate(enrichedPatientData, currentDdx, confirmedTeam, orchestrator, handleProgress, getUserInterventionCallback, language, userHistory);
    };

    const handleStartDebate = async () => {
        if (!patientData) return;
        const enrichedPatientData = { ...patientData, userDiagnosisFeedback: diagnosisFeedback };
        setPatientData(enrichedPatientData);
        if (currentUser) {
            try {
                const { createPatient, updatePatient } = await import('./services/apiPatientService');
                const n = linkedPatientKey && /^\d+$/.test(linkedPatientKey.trim()) ? Number(linkedPatientKey) : null;
                if (n != null && n > 0) {
                    const res = await updatePatient(n, enrichedPatientData);
                    if (res?.success !== false) setCreatedPatientId(n);
                } else {
                    const res = await createPatient(enrichedPatientData);
                    const id = res?.data && (res.data as { id?: number }).id;
                    if (id != null && Number(id) > 0) setCreatedPatientId(Number(id));
                }
            } catch {
                // Report paytida qayta urinamiz
            }
        }
        setIsProcessing(true);
        setStatusMessage(t('debate_start_status'));
        const getUserInterventionCallback = () => {
            const intervention = userInterventionRef.current;
            userInterventionRef.current = null;
            setUserIntervention(null);
            return intervention;
        };
        aiService.runCouncilDebate(enrichedPatientData, differentialDiagnoses, selectedSpecialistsConfig, orchestratorModel, handleProgress, getUserInterventionCallback, language, userHistory);
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
        const baseReport = (currentAnalysisRecord?.finalReport as FinalReport | undefined) ?? finalReport;
        if (!baseReport) return;
        const merged = { ...baseReport, ...updatedReport };
        const newFinalReport: FinalReport = {
            ...merged,
            consensusDiagnosis: normalizeConsensusDiagnosis(
                merged.consensusDiagnosis ?? baseReport.consensusDiagnosis,
            ),
        } as FinalReport;
        setFinalReport(newFinalReport);
        if (!currentAnalysisRecord || !currentUser) {
            return;
        }
        const updatedRecord = { ...currentAnalysisRecord, finalReport: newFinalReport as FinalReport };
        setCurrentAnalysisRecord(updatedRecord);
        const updatedHistory = userHistory.map(r => (r.id === updatedRecord.id ? updatedRecord : r));
        setUserHistory(updatedHistory);

        import('./services/apiAnalysisService').then(({ updateAnalysis }) => {
            const idNum = parseInt(currentAnalysisRecord.id, 10);
            if (!isNaN(idNum) && idNum > 0) {
                updateAnalysis(idNum, updatedRecord).catch(() => {
                    // Error already handled by API service, silently fail
                });
            }
        });
    }, [currentAnalysisRecord, currentUser, userHistory, finalReport]);

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
    }> = ({ title, subtitle, onBack, backLabel = t('back_to_home'), extra }) => (
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
                            allAnalyses={userHistory}
                            onSelectAnalysis={viewHistoryItem}
                            stats={dashboardStats}
                        />
                    </ScrollWrapper>
                );

            case 'new_analysis':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title={t('nav_new_case')} subtitle={t('new_case_subtitle')} onBack={() => handleNavigation('dashboard')} />
                        {error && (
                            <div className="mx-4 mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-2" role="alert">
                                <span className="font-semibold shrink-0">{t('validation_data_mismatch_title')}</span>
                                <span className="flex-1">{error}</span>
                                <button type="button" onClick={() => setError(null)} className="shrink-0 underline" aria-label={t('close')}>{t('close')}</button>
                            </div>
                        )}
                        <div className="flex-1 page-px py-4 overflow-hidden">
                            <DataInputForm
                                onSubmit={handleDataSubmit}
                                isAnalyzing={isProcessing}
                                priorAnalyses={userHistory}
                                linkedPatientKey={linkedPatientKey}
                                onLinkedPatientChange={setLinkedPatientKey}
                            />
                        </div>
                    </div>
                );

            case 'clarification':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title={t('clarification_title')} subtitle={t('clarification_subtitle')} onBack={() => handleNavigation('new_analysis')} backLabel={t('back')} />
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
                        <BackBar title={t('team_recommendation_title')} subtitle={t('team_recommendation_subtitle')} onBack={() => handleNavigation('new_analysis')} backLabel={t('back')} />
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
                            backLabel={isArchive ? t('nav_archive') : t('back_to_home')}
                        />
                        <div className="flex-1 page-px py-3 overflow-hidden">
                            <AnalysisView record={record} isLive={true} statusMessage={statusMessage} isAnalyzing={isProcessing} differentialDiagnoses={differentialDiagnoses} error={error} onDiagnosisFeedback={handleDiagnosisFeedback} diagnosisFeedback={diagnosisFeedback} onStartDebate={handleStartDebate} onInjectHypothesis={handleInjectHypothesis} onUserIntervention={handleUserIntervention} userIntervention={userIntervention} onExplainRationale={handleExplainRationale} socraticQuestion={socraticQuestion} livePrognosis={livePrognosis} onRunScenario={handleRunScenario} onUpdateReport={handleUpdateReport} onRetry={() => setError(null)} />
                        </div>
                    </div>
                );
            }

            case 'history':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title={t('history_title')} subtitle={t('history_subtitle')} onBack={() => handleNavigation('dashboard')} />
                        <ScrollWrapper>
                            <Suspense fallback={<div className="flex items-center justify-center p-8 text-text-secondary">{t('loading_text')}</div>}>
                                <HistoryView analyses={userHistory} onSelectAnalysis={viewHistoryItem} onStartConsultation={() => {}} onViewCaseLibrary={() => setAppView('case_library')} />
                            </Suspense>
                        </ScrollWrapper>
                    </div>
                );

            case 'case_library':
                return (
                    <div className="h-full flex flex-col overflow-hidden min-w-0">
                        <BackBar title={t('case_library_title')} onBack={() => setAppView('history')} backLabel={t('nav_archive')} />
                        <ScrollWrapper>
                            <Suspense fallback={<div className="flex items-center justify-center p-8 text-text-secondary">{t('loading_text')}</div>}>
                                <CaseLibraryView onBack={() => setAppView('history')} analyses={userHistory} />
                            </Suspense>
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
                        <span className="break-words">
                            Domen boshqa serverga yo&apos;naltirilgan. DNS tekshiring:{' '}
                            <code className="bg-black/20 px-1 rounded">nslookup medora.cdcgroup.uz</code>
                            {' -> '}
                            <code className="bg-black/20 px-1 rounded">167.71.53.238</code> bo&apos;lishi kerak.
                        </span>
                    ) : (
                        <span className="break-words">
                            Server bilan bog&apos;lanish yo&apos;q. Tahlilni hozircha serverga saqlab bo&apos;lmadi.
                            Iltimos, internetni tekshiring yoki birozdan so&apos;ng qayta urinib ko&apos;ring.
                        </span>
                    )}
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