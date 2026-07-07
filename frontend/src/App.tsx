
import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import type { PatientData, ChatMessage, FinalReport, ProgressUpdate, User, AnalysisRecord, Diagnosis, DetectedMedication, DiagnosisFeedback, CriticalFinding, UserStats, AppView, PrognosisReport } from './types';
import { normalizeConsensusDiagnosis } from './types';
import * as aiService from './services/aiCouncilService';
import * as authService from './services/apiAuthService';
import * as caseService from './services/caseService';
import { useTranslation } from './hooks/useTranslation';
import { getSpecialistsFromComplaint, mergeSpecialistRecommendations } from './utils/specialistRecommendation';
import { inferFallbackSpecialists } from './utils/specialistTeamFallback';
import { checkPatientComplaintConsistency } from './utils/smartValidation';
import {
    getPriorAnalysesForPatient,
    buildLongitudinalClinicalNotes,
    buildTimelineClinicalNotes,
} from './utils/longitudinalContext';
import {
    mergeReturnVisitData,
    hasBaselineAnamnesis,
    saveActivePatientSession,
    clearActivePatientSession,
} from './utils/patientRegistry';
import { pickPatientMatchId } from './utils/patientMatch';
import { useApiHealth } from './hooks/useApiHealth';
import { Language } from './i18n/LanguageContext';
import { isApiConfigured } from './config/api';
import { getAuthToken, clearTokens } from './services/api';
import {
    generateClarifyingQuestions as apiBackendClarifyingQuestions,
    generateInitialDiagnoses as apiBackendInitialDiagnoses,
} from './services/apiAiService';
import { getAnalysis } from './services/apiAnalysisService';
import { enrichFinalReport } from './utils/reportNormalize';

// --- Views & Components ---
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import UserGuide from './components/UserGuide';
import AboutInstitutePage from './components/AboutInstitutePage';
import SubscriptionPage from './components/SubscriptionPage';
import RectorDashboard from './components/RectorDashboard';
import ClinicAdminDashboard from './components/ClinicAdminDashboard';
import RegionalStatsDashboard from './components/RegionalStatsDashboard';
import DataInputForm from './components/DataInputForm';
const HistoryView = lazy(() => import('./components/HistoryView'));
import MobileNavBar from './components/MobileNavBar';
const ToolsDashboard = lazy(() => import('./components/ToolsDashboard'));
import UziUttAnalyzer from './components/tools/UziUttAnalyzer';
import PrescriptionProtocolAudit from './components/PrescriptionProtocolAudit';
import ClarificationView from './components/ClarificationView';
import Dashboard from './components/Dashboard';
import RegistrarApp from './components/registrar/RegistrarApp';
import PrimaryCareHub from './components/primarycare/PrimaryCareHub';
const PatientDossierPage = lazy(() => import('./components/PatientDossierPage'));
import AnalysisView from './components/AnalysisView';
import TeamRecommendationView from './components/TeamRecommendationView';
const CaseLibraryView = lazy(() => import('./components/CaseLibraryView'));
import CriticalFindingAlert from './components/modals/CriticalFindingAlert';
import RationaleModal from './components/modals/RationaleModal';
import LanguageSwitcher from './components/LanguageSwitcher';
import DeviceSessionBanner from './components/DeviceSessionBanner';

// --- Icons ---
import HomeIcon from './components/icons/HomeIcon';
import PlusCircleIcon from './components/icons/PlusCircleIcon';
import DocumentReportIcon from './components/icons/DocumentReportIcon';
import LightBulbIcon from './components/icons/LightBulbIcon';
import CopyrightIcon from './components/icons/CopyrightIcon';
import { AIModel } from './constants/specialists';
import {
    INSTITUTE_NAME_FULL,
    INSTITUTE_NAME_SHORT,
    PLATFORM_NAME,
    INSTITUTE_LOGO_SRC,
    PLATFORM_WEBSITE,
} from './constants/brand';

// Scrollni bitta joy boshqaradi (main). Ichki wrapperlar overflow qilmasin — mouse wheel hamma oynada ishlasin.
const ScrollWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="w-full overflow-x-hidden page-px py-6 pb-8 min-w-0 max-md:pb-24">
        {children}
    </div>
);

const AppContent: React.FC = () => {
    // --- STATE MANAGEMENT ---
    
    // Auth & View
    // Initialize from localStorage; only refresh from API when we have a token to avoid 401s
    const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
    const rectorPathnames = ['/rektorga', '/rektor'];
    const clinicAdminPathnames = ['/klinika-admin', '/clinic-admin'];
    const pathNorm = typeof window !== 'undefined' ? (window.location.pathname.replace(/\/$/, '') || '/') : '';
    const isRectorPath = typeof window !== 'undefined' && rectorPathnames.includes(pathNorm);
    const isClinicAdminPath = typeof window !== 'undefined' && clinicAdminPathnames.includes(pathNorm);
    
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
                    setCurrentUser((prev) => {
                        if (prev && prev.phone === apiUser.phone && prev.role === apiUser.role) return prev;
                        return apiUser;
                    });
                } else {
                    clearTokens();
                    setCurrentUser(null);
                    setShowLanding(true);
                }
            });
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount to validate session

    /** Sessiya yo'q bo'lsa (chiqish yoki token eskirishi) joriy foydalanuvchiga tegishli tarixni tozalaymiz */
    useEffect(() => {
        if (!currentUser) {
            setUserHistory([]);
            setDashboardStats(null);
        }
    }, [currentUser]);

    const [appView, setAppView] = useState<AppView>(() =>
        authService.getCurrentUser()?.role === 'staff' ? 'registrar' : 'dashboard',
    );
    const [pcProfileId, setPcProfileId] = useState<number | null>(null);
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

    const dashboardLoadRef = useRef(0);

    // Sahifa yuklanganida va dashboardga qaytganda: tahlillar (takroriy so'rovlarni oldini olish)
    useEffect(() => {
        if (!currentUser?.phone) return;
        if (currentUser.role === 'staff') {
            setAppView('registrar');
            setUserHistory([]);
            setDashboardStats(null);
            return;
        }
        if (!getAuthToken()) {
            setUserHistory([]);
            setDashboardStats(null);
            return;
        }
        if (appView !== 'dashboard') return;

        const now = Date.now();
        if (now - dashboardLoadRef.current < 3000) return;
        dashboardLoadRef.current = now;

        let cancelled = false;
        caseService.loadDashboardStatsFromApi().then(result => {
            if (cancelled) return;
            if (result) {
                setUserHistory(result.list);
                setDashboardStats(result.stats);
            } else {
                setUserHistory([]);
                setDashboardStats(null);
            }
        }).catch(() => {
            if (!cancelled) {
                setUserHistory([]);
                setDashboardStats(null);
            }
        });
        return () => { cancelled = true; };
    }, [currentUser?.phone, currentUser?.role, appView]);

    // Core Analysis State
    const [patientData, setPatientData] = useState<PatientData | null>(null);
    const [selectedSpecialistsConfig, setSelectedSpecialistsConfig] = useState<{ role: AIModel, backEndModel: string }[]>([]);
    const [orchestratorModel, setOrchestratorModel] = useState<string>("Claude Opus 4.7");
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
    const [followUpHistory, setFollowUpHistory] = useState<{ question: string; answer: string }[]>([]);
    const [isFollowUpAnalyzing, setIsFollowUpAnalyzing] = useState(false);
    const [isFollowUpFinalized, setIsFollowUpFinalized] = useState(false);

    const [userHistory, setUserHistory] = useState<AnalysisRecord[]>([]);
    const [dashboardStats, setDashboardStats] = useState<UserStats | null>(null);
    
    const [currentAnalysisRecord, setCurrentAnalysisRecord] = useState<AnalysisRecord | null>(null);
    const [createdPatientId, setCreatedPatientId] = useState<number | null>(null);
    /** Bazadan tanlangan bemor patient.id (string) — avvalgi tahlillar bilan bog'lash va updatePatient uchun */
    const [linkedPatientKey, setLinkedPatientKey] = useState<string | null>(null);
    const [patientBaseline, setPatientBaseline] = useState<PatientData | null>(null);
    const [returnVisitMode, setReturnVisitMode] = useState(false);
    const [clarificationQuestions, setClarificationQuestions] = useState<string[] | null>([]);
    
    const debateScrollRef = useRef<HTMLDivElement>(null);
    const debateHistoryRef = useRef<ChatMessage[]>([]);
    const livePrognosisRef = useRef<PrognosisReport | null>(null);
    const { apiHealthy, healthStatus, checkNow } = useApiHealth();

    useEffect(() => {
        debateHistoryRef.current = debateHistory;
    }, [debateHistory]);

    useEffect(() => {
        livePrognosisRef.current = livePrognosis;
    }, [livePrognosis]);

    useEffect(() => {
        if (debateScrollRef.current) {
            debateScrollRef.current.scrollTop = debateScrollRef.current.scrollHeight;
        }
    }, [debateHistory, statusMessage]);

    const handleProgress = useCallback((update: ProgressUpdate) => {
        switch (update.type) {
            case 'status': setStatusMessage(update.message); break;
            case 'message': {
                setDebateHistory(prev => {
                    const next = [...prev, update.message];
                    debateHistoryRef.current = next;
                    return next;
                });
                break;
            }
            case 'critical_finding': setCriticalFinding(update.data); break;
            case 'user_question': setSocraticQuestion(update.question); break;
            case 'prognosis_update': {
                livePrognosisRef.current = update.data;
                setLivePrognosis(update.data);
                break;
            }
            case 'report': {
                const reportData = update.data;
                const savedDebate = update.debateHistory ?? debateHistoryRef.current;
                debateHistoryRef.current = savedDebate;
                setDebateHistory(savedDebate);
                const mergedReport: FinalReport = enrichFinalReport({
                    ...reportData,
                    prognosisReport: reportData.prognosisReport ?? livePrognosisRef.current ?? livePrognosis,
                }, { patientData: patientData ?? undefined, language });
                setFinalReport(mergedReport);
                setIsProcessing(false);
                setSocraticQuestion(null);
                setStatusMessage(t('analysis_complete_status'));
                const detectedMeds = update.type === 'report' ? (update as { detectedMedications: DetectedMedication[] }).detectedMedications : [];
                if (currentUser && patientData) {
                    const newRecord: AnalysisRecord = {
                        id: currentAnalysisRecord?.id || `local-${Date.now()}`,
                        patientId: String(
                            createdPatientId
                            ?? linkedPatientKey
                            ?? currentAnalysisRecord?.patientId
                            ?? '',
                        ) || `${patientData.lastName}-${patientData.firstName}-${Date.now()}`,
                        date: new Date().toISOString(),
                        patientData,
                        debateHistory: savedDebate,
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
                                    setError(errCode === 401 ? t('error_save_server_login') : (createRes.error?.message || t('error_save_analysis_failed')));
                                }
                            }).catch((err: unknown) => {
                                const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : null;
                                setError(msg || t('error_save_connection_failed'));
                            });
                        };

                        if (patientIdToUse != null) {
                            doCreateAnalysis(patientIdToUse);
                            return;
                        }

                        import('./services/apiPatientService').then(({ ensurePatientRecord }) => {
                            ensurePatientRecord(patientData).then(patientResponse => {
                                if (!patientResponse.success) {
                                    applyHistoryAndRecord([], newRecord);
                                    const errMsg = patientResponse.error?.message;
                                    const errCode = patientResponse.error?.code;
                                    setError(errCode === 401 ? t('error_save_server_login') : (errMsg || t('error_save_patient_failed')));
                                    return;
                                }
                                const raw = patientResponse.data as { id?: number; data?: { id?: number } } | undefined;
                                const patientId = (raw?.id != null ? raw.id : raw?.data?.id) != null
                                    ? Number(raw?.id ?? raw?.data?.id)
                                    : 0;
                                if (patientId <= 0) {
                                    applyHistoryAndRecord([], newRecord);
                                    setError(t('error_patient_id_missing'));
                                    return;
                                }
                                doCreateAnalysis(patientId);
                            }).catch(() => {
                                applyHistoryAndRecord([], newRecord);
                                setError(t('error_save_patient_or_analysis_failed'));
                            });
                        });
                    }).catch((err: unknown) => {
                        applyHistoryAndRecord([], newRecord);
                        const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : null;
                        setError(msg || t('error_save_generic_failed'));
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
        setShowLanding(false);
        if (user.role === 'staff') {
            setUserHistory([]);
            setDashboardStats(null);
            setAppView('registrar');
            return;
        }
        if (user.role === 'regional_stats') {
            setUserHistory([]);
            setDashboardStats(null);
            return;
        }
        setAppView('dashboard');
    };

    const handleLogout = () => {
        authService.logout();
        setCurrentUser(null);
        setUserHistory([]);
        setDashboardStats(null);
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
        setPatientBaseline(null);
        setReturnVisitMode(false);
        clearActivePatientSession();
        setCriticalFinding(null);
        setRationaleMessage(null);
        setUserIntervention(null);
        userInterventionRef.current = null;
        setClarificationQuestions([]);
        setRecommendedTeam([]);
        setSocraticQuestion(null);
        setLivePrognosis(null);
        setFollowUpHistory([]);
        setIsFollowUpAnalyzing(false);
        setIsFollowUpFinalized(false);
        setAppView('new_analysis');
    };

    const handleNavigation = (view: AppView) => {
        if (currentUser?.role === 'staff') {
            setAppView('registrar');
            return;
        }
        if (view === 'new_analysis') resetAnalysisState();
        else setAppView(view);
    };

    /** Savollar avval API, keyin Claude orqali; ikkalasi bo'sh bo'lsa ham fallback savollar bilan aniqlashtiruv ko'rsatiladi. */
    const CLARIFY_TIMEOUT_MS = 18000;

    /** Faqat shikoyatda tilga olingan mavzuga aloqador savollarni qoldiradi; mock/umumiy savollarni olib tashlaydi. */
    const filterQuestionsByComplaint = (qs: string[], complaint: string): string[] => {
        if (qs.length < 2) return qs;
        const c = (complaint || '').toLowerCase().replace(/[^\w\s'-]/g, ' ');
        const words = c.split(/\s+/).filter(w => w.length >= 3);
        if (words.length === 0) return qs;
        const filtered = qs.filter(q => {
            const ql = q.toLowerCase();
            return words.some(w => ql.includes(w));
        });
        return filtered.length >= 2 ? filtered : qs;
    };

    const handleLinkedPatientChange = useCallback((key: string | null) => {
        setLinkedPatientKey(key);
        if (!key) {
            setPatientBaseline(null);
            setReturnVisitMode(false);
            clearActivePatientSession();
            return;
        }
        if (currentUser) {
            saveActivePatientSession(currentUser.id, key, createdPatientId);
        }
    }, [currentUser, createdPatientId]);

    const handlePatientBaselineLoaded = useCallback((baseline: PatientData) => {
        setPatientBaseline(baseline);
        setReturnVisitMode(hasBaselineAnamnesis(baseline));
    }, []);

    const enrichPatientWithHistory = useCallback(async (data: PatientData): Promise<PatientData> => {
        const key = linkedPatientKey?.trim();
        let merged = patientBaseline ? mergeReturnVisitData(patientBaseline, data) : { ...data };
        if (!key) {
            merged.longitudinalClinicalNotes = undefined;
            return merged;
        }
        let notes = '';
        if (/^\d+$/.test(key)) {
            try {
                const { getPatientClinicalTimeline, convertPatientToPatientData } = await import('./services/apiPatientService');
                const tl = await getPatientClinicalTimeline(Number(key), 200);
                if (tl.success && tl.data) {
                    const baseline = patientBaseline ?? convertPatientToPatientData(tl.data.patient);
                    notes = buildTimelineClinicalNotes(
                        baseline,
                        tl.data.analyses,
                        merged,
                        language,
                    );
                    if (!patientBaseline) setPatientBaseline(baseline);
                    if (tl.data.analysis_count > 0 || hasBaselineAnamnesis(baseline)) {
                        setReturnVisitMode(true);
                    }
                }
            } catch {
                /* server timeline ixtiyoriy */
            }
        }
        if (!notes) {
            const prior = getPriorAnalysesForPatient(userHistory, key);
            notes = buildLongitudinalClinicalNotes(prior, merged, language);
        }
        merged.longitudinalClinicalNotes = notes || undefined;
        return merged;
    }, [linkedPatientKey, patientBaseline, userHistory, language]);

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
            const response = await Promise.race([
                apiBackendClarifyingQuestions(data),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), CLARIFY_TIMEOUT_MS)),
            ]);
            if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                questions = filterQuestionsByComplaint(response.data, complaint);
            }
        } catch { /* timeout yoki xato */ }

        if (questions.length < 2) {
            try {
                const fromClaude = await aiService.generateClarifyingQuestions(data, language);
                if (fromClaude.length > 0) {
                    questions = filterQuestionsByComplaint(fromClaude, complaint);
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

    /** Tezkor: FAFAQAT local funksiya - 0ms da darhol ko'rsatadi. Backend API kerak emas! */
    const handleRecommendTeamFromData = (data: PatientData) => {
        const instant = getSpecialistsFromComplaint(data);
        setRecommendedTeam(instant);
        setIsProcessing(false);
        setError(null);
        // ✅ Backend API chaqirilmaydi - faqat local funksiya ishlatiladi!
        // Bu qo'shimcha savollar kabi DARHOL chiqadi (0ms)
    };

    const handleDataSubmit = async (data: PatientData) => {
        const consistency = checkPatientComplaintConsistency(data);
        if (!consistency.consistent && consistency.messageKey) {
            setError(t(consistency.messageKey, consistency.messageParams));
            return;
        }
        setError(null);
        const merged = await enrichPatientWithHistory(data);
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
        const withHistory = await enrichPatientWithHistory(enrichedPatientData);
        setPatientData(withHistory);
        enrichedPatientData = withHistory;
        
        // ✅ TEZKOR: Mutaxassislarni DARHOL ko'rsatish (0ms) - Backend API emas!
        const instantTeam = getSpecialistsFromComplaint(enrichedPatientData);
        setRecommendedTeam(instantTeam);
        setAppView('team_recommendation');

        // DDx fonda — mutaxassis ro'yxatini faqat DDx bo'yicha boyitish
        void (async () => {
            let diagnoses: Diagnosis[] = [];
            try {
                try {
                    const ddxResp = await apiBackendInitialDiagnoses(enrichedPatientData);
                    if (ddxResp.success && ddxResp.data?.length) {
                        diagnoses = ddxResp.data;
                    }
                } catch {
                    try {
                        diagnoses = await aiService.generateInitialDiagnoses(enrichedPatientData, language);
                    } catch {
                        diagnoses = [];
                    }
                }
                setDifferentialDiagnoses(diagnoses);
                if (diagnoses.length > 0) {
                    const scored = getSpecialistsFromComplaint(enrichedPatientData, diagnoses);
                    const ddxBoost = inferFallbackSpecialists(enrichedPatientData, diagnoses);
                    setRecommendedTeam((prev) =>
                        mergeSpecialistRecommendations(scored, ddxBoost, 8),
                    );
                }
            } catch {
                /* ignore */
            }
        })();
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
                const { ensurePatientRecord, updatePatient } = await import('./services/apiPatientService');
                const { findPatientMatches } = await import('./services/apiPatientService');
                let n = linkedPatientKey && /^\d+$/.test(linkedPatientKey.trim()) ? Number(linkedPatientKey) : null;
                if (n == null && enrichedPatientData.firstName?.trim() && enrichedPatientData.lastName?.trim()) {
                    const matches = await findPatientMatches(
                        enrichedPatientData.firstName,
                        enrichedPatientData.lastName,
                        enrichedPatientData.phone,
                        enrichedPatientData.fatherName,
                        enrichedPatientData.age,
                    );
                    if (matches.success && matches.data?.length) {
                        const picked = pickPatientMatchId(matches.data, enrichedPatientData);
                        if (picked) {
                            n = picked;
                            handleLinkedPatientChange(String(n));
                        }
                    }
                }
                if (n != null && n > 0) {
                    const res = await updatePatient(n, enrichedPatientData);
                    if (res?.success !== false) {
                        setCreatedPatientId(n);
                        handleLinkedPatientChange(String(n));
                    } else {
                        setError(res.error?.message || t('error_patient_update_failed'));
                        setIsProcessing(false);
                        return;
                    }
                } else {
                    const res = await ensurePatientRecord(enrichedPatientData);
                    const id = res?.data && (res.data as { id?: number }).id;
                    if (res?.success && id != null && Number(id) > 0) {
                        setCreatedPatientId(Number(id));
                        handleLinkedPatientChange(String(id));
                    } else {
                        setError(res?.error?.message || t('error_patient_consilium_blocked'));
                        setIsProcessing(false);
                        return;
                    }
                }
            } catch {
                setError(t('error_patient_consilium_blocked'));
                setIsProcessing(false);
                return;
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
                const { ensurePatientRecord, updatePatient } = await import('./services/apiPatientService');
                let n = linkedPatientKey && /^\d+$/.test(linkedPatientKey.trim()) ? Number(linkedPatientKey) : null;
                if (n == null && enrichedPatientData.firstName?.trim() && enrichedPatientData.lastName?.trim()) {
                    const { findPatientMatches } = await import('./services/apiPatientService');
                    const matches = await findPatientMatches(
                        enrichedPatientData.firstName,
                        enrichedPatientData.lastName,
                        enrichedPatientData.phone,
                        enrichedPatientData.fatherName,
                        enrichedPatientData.age,
                    );
                    if (matches.success && matches.data?.length) {
                        const picked = pickPatientMatchId(matches.data, enrichedPatientData);
                        if (picked) {
                            n = picked;
                            handleLinkedPatientChange(String(n));
                        }
                    }
                }
                if (n != null && n > 0) {
                    const res = await updatePatient(n, enrichedPatientData);
                    if (res?.success !== false) {
                        setCreatedPatientId(n);
                        handleLinkedPatientChange(String(n));
                    }
                } else {
                    const res = await ensurePatientRecord(enrichedPatientData);
                    const id = res?.data && (res.data as { id?: number }).id;
                    if (id != null && Number(id) > 0) {
                        setCreatedPatientId(Number(id));
                        handleLinkedPatientChange(String(id));
                    }
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
    
    const persistFollowUpHistory = useCallback((history: { question: string; answer: string }[]) => {
        if (!currentAnalysisRecord?.id || !patientData) return;
        const analysisIdNum = parseInt(currentAnalysisRecord.id, 10);
        if (isNaN(analysisIdNum) || analysisIdNum <= 0) return;
        import('./services/apiAnalysisService').then(({ updateAnalysis }) => {
            updateAnalysis(analysisIdNum, {
                ...currentAnalysisRecord,
                patientData,
                followUpHistory: history,
                finalReport: finalReport ?? currentAnalysisRecord.finalReport,
                debateHistory,
            });
        }).catch(() => null);
    }, [currentAnalysisRecord, patientData, finalReport, debateHistory]);

    const handleFollowUpSubmit = useCallback(async (question: string) => {
        if (!patientData || !finalReport) return;
        setIsFollowUpAnalyzing(true);
        try {
            const context = [
                `Konsilium tashxislari: ${(finalReport.consensusDiagnosis || []).map(d => d.name).join(', ')}`,
                `Shifokor savoli: ${question}`,
            ].join('\n');
            let answer = '';
            const { isApiConfigured } = await import('./config/api');
            if (isApiConfigured()) {
                const { runDoctorSupport, TASK_FOLLOW_UP } = await import('./services/apiAiService');
                const resp = await runDoctorSupport(patientData, {
                    query: context,
                    taskType: TASK_FOLLOW_UP,
                    language,
                });
                if (resp.success && resp.data) {
                    const d = resp.data as Record<string, unknown>;
                    const parts: string[] = [];
                    if (typeof d.follow_up === 'string' && d.follow_up.trim()) parts.push(d.follow_up);
                    if (typeof d.return_visit === 'string' && d.return_visit.trim()) {
                        parts.push(`${t('follow_up_return_visit')}: ${d.return_visit}`);
                    }
                    for (const key of ['red_flag_symptoms', 'monitoring_at_home', 'repeat_tests', 'lifestyle_advice'] as const) {
                        const arr = d[key];
                        if (Array.isArray(arr) && arr.length) {
                            parts.push(arr.map(String).join('; '));
                        }
                    }
                    if (typeof d.emergency_contact === 'string' && d.emergency_contact.trim()) {
                        parts.push(d.emergency_contact);
                    }
                    answer = parts.filter(Boolean).join('\n\n');
                }
            }
            if (!answer) {
                answer = t('follow_up_fallback_answer');
            }
            const next = [...followUpHistory, { question, answer }];
            setFollowUpHistory(next);
            persistFollowUpHistory(next);
        } catch {
            setError(t('follow_up_error_generic'));
        } finally {
            setIsFollowUpAnalyzing(false);
        }
    }, [patientData, finalReport, language, followUpHistory, persistFollowUpHistory, t]);

    const handleFollowUpFinalize = useCallback(() => {
        setIsFollowUpFinalized(true);
        persistFollowUpHistory(followUpHistory);
    }, [followUpHistory, persistFollowUpHistory]);

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

    const viewHistoryItem = async (record: AnalysisRecord) => {
        const idNum = parseInt(record.id, 10);
        let full = record;
        if (!Number.isNaN(idNum) && idNum > 0) {
            setStatusMessage('Yuklanmoqda…');
            const res = await getAnalysis(idNum);
            if (res.success && res.data) {
                full = res.data;
            }
        }
        setCurrentAnalysisRecord(full);
        setPatientData(full.patientData);
        const pid = String(full.patientId ?? '').trim();
        if (pid && /^\d+$/.test(pid)) {
            handleLinkedPatientChange(pid);
            setCreatedPatientId(Number(pid));
            import('./services/apiPatientService').then(({ getPatient, getPatientPassport, convertPatientToPatientData }) => {
                getPatient(Number(pid)).then(async (res) => {
                    if (res.success && res.data) {
                        const baseline = convertPatientToPatientData(res.data);
                        setPatientBaseline(baseline);
                        setReturnVisitMode(hasBaselineAnamnesis(baseline));
                        return;
                    }
                    const pass = await getPatientPassport(Number(pid));
                    if (pass.success && pass.data) {
                        const baseline = convertPatientToPatientData(pass.data as import('./services/apiPatientService').Patient);
                        setPatientBaseline(baseline);
                        setReturnVisitMode(hasBaselineAnamnesis(baseline));
                    }
                }).catch(() => { /* ignore */ });
            });
        }
        setDebateHistory(full.debateHistory);
        setFinalReport(full.finalReport);
        const specs = full.selectedSpecialists?.map(role => ({ role, backEndModel: 'Claude Opus 4.7' })) || [];
        setSelectedSpecialistsConfig(specs);
        setDifferentialDiagnoses(normalizeConsensusDiagnosis(full.finalReport?.consensusDiagnosis));
        setAppView('live_analysis');
        setIsProcessing(false);
        setStatusMessage('Arxivdan yuklandi. Munozarani davom ettirishingiz mumkin.');
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
                            onOpenUziUtt={() => setAppView('uzi_utt')}
                            onOpenPrescriptionAudit={() => setAppView('prescription_audit')}
                            onOpenTools={() => setAppView('tools')}
                            onOpenPopulation={() => setAppView('primary_care')}
                            onOpenPatientDossier={() => setAppView('patient_dossier')}
                            recentAnalyses={userHistory.slice(0, 5)}
                            allAnalyses={userHistory}
                            onSelectAnalysis={viewHistoryItem}
                            stats={dashboardStats}
                        />
                    </ScrollWrapper>
                );

            case 'new_analysis':
                return (
                    <div className="min-h-0 flex flex-col flex-1 min-w-0 h-full">
                        <BackBar title={t('nav_new_case')} subtitle={t('new_case_subtitle')} onBack={() => handleNavigation('dashboard')} />
                        {error && (
                            <div className="mx-4 mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-2" role="alert">
                                <span className="font-semibold shrink-0">{t('validation_data_mismatch_title')}</span>
                                <span className="flex-1">{error}</span>
                                <button type="button" onClick={() => setError(null)} className="shrink-0 underline" aria-label={t('close')}>{t('close')}</button>
                            </div>
                        )}
                        <div className="page-px py-3 flex-1 min-h-0 flex flex-col">
                            <DataInputForm
                                onSubmit={handleDataSubmit}
                                isAnalyzing={isProcessing}
                                linkedPatientKey={linkedPatientKey}
                                onLinkedPatientChange={handleLinkedPatientChange}
                                returnVisitMode={returnVisitMode}
                                onPatientBaselineLoaded={handlePatientBaselineLoaded}
                            />
                        </div>
                    </div>
                );

            case 'clarification':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
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
                    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                        <BackBar title={t('team_recommendation_title')} subtitle={t('team_recommendation_subtitle')} onBack={() => handleNavigation('new_analysis')} backLabel={t('back')} />
                        <div className="flex-1 min-h-0 page-px py-3 overflow-hidden">
                            <TeamRecommendationView isProcessing={isProcessing} recommendations={recommendedTeam} onConfirm={handleTeamConfirmation} />
                        </div>
                    </div>
                );

            case 'live_analysis':
            case 'view_history_item': {
                const record: Partial<AnalysisRecord> = {
                    id: currentAnalysisRecord?.id,
                    patientId: currentAnalysisRecord?.patientId,
                    patientData: patientData!,
                    debateHistory,
                    finalReport: finalReport ?? undefined,
                    followUpHistory,
                    selectedSpecialists: selectedSpecialistsConfig.map(s => s.role),
                };
                if (!record || !record.patientData) return <div className="text-center p-8 text-slate-500">{t('error_no_data_found')}</div>;
                const isArchive = appView === 'view_history_item' && !isProcessing && debateHistory.length > 0;
                return (
                    // Faqat shu sahifada: flex-1 + overflow-hidden — panellar viewportni to'ldiradi va ichi scroll
                    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                        <BackBar
                            title={isArchive ? t('analysis_view_title') : t('consilium_process_title')}
                            subtitle={record.patientData ? `${record.patientData.firstName} ${record.patientData.lastName}` : ''}
                            onBack={() => isArchive ? setAppView('history') : handleNavigation('dashboard')}
                            backLabel={isArchive ? t('nav_archive') : t('back_to_home')}
                        />
                        <div className="flex-1 min-h-0 page-px py-3 overflow-hidden">
                            <AnalysisView record={record} isLive={true} statusMessage={statusMessage} isAnalyzing={isProcessing} differentialDiagnoses={differentialDiagnoses} error={error} onDiagnosisFeedback={handleDiagnosisFeedback} diagnosisFeedback={diagnosisFeedback} onStartDebate={handleStartDebate} onInjectHypothesis={handleInjectHypothesis} onUserIntervention={handleUserIntervention} userIntervention={userIntervention} onExplainRationale={handleExplainRationale} socraticQuestion={socraticQuestion} livePrognosis={livePrognosis} onRunScenario={handleRunScenario} onUpdateReport={handleUpdateReport} onRetry={() => setError(null)} followUpHistory={followUpHistory} isFollowUpAnalyzing={isFollowUpAnalyzing} isFollowUpFinalized={isFollowUpFinalized} onFollowUpSubmit={handleFollowUpSubmit} onFollowUpFinalize={handleFollowUpFinalize} />
                        </div>
                    </div>
                );
            }

            case 'history':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
                        <BackBar title={t('history_title')} subtitle={t('history_subtitle')} onBack={() => handleNavigation('dashboard')} />
                        <ScrollWrapper>
                            <Suspense fallback={<div className="flex items-center justify-center p-8 text-text-secondary">{t('loading_text')}</div>}>
                                <HistoryView analyses={userHistory} onSelectAnalysis={viewHistoryItem} onViewCaseLibrary={() => setAppView('case_library')} />
                            </Suspense>
                        </ScrollWrapper>
                    </div>
                );

            case 'case_library':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
                        <BackBar title={t('case_library_title')} onBack={() => setAppView('history')} backLabel={t('nav_archive')} />
                        <ScrollWrapper>
                            <Suspense fallback={<div className="flex items-center justify-center p-8 text-text-secondary">{t('loading_text')}</div>}>
                                <CaseLibraryView onBack={() => setAppView('history')} analyses={userHistory} />
                            </Suspense>
                        </ScrollWrapper>
                    </div>
                );

            case 'uzi_utt':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
                        <BackBar
                            title={t('uzi_utt_page_title')}
                            subtitle={t('uzi_utt_page_subtitle')}
                            onBack={() => handleNavigation('dashboard')}
                        />
                        <ScrollWrapper>
                            <UziUttAnalyzer />
                        </ScrollWrapper>
                    </div>
                );

            case 'prescription_audit':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
                        <BackBar
                            title={t('prescription_audit_page_title')}
                            subtitle={t('prescription_audit_page_subtitle')}
                            onBack={() => handleNavigation('dashboard')}
                        />
                        <ScrollWrapper>
                            <PrescriptionProtocolAudit />
                        </ScrollWrapper>
                    </div>
                );

            case 'tools':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
                        <BackBar title={t('tools_page_title')} subtitle={t('tools_page_subtitle')} onBack={() => handleNavigation('dashboard')} />
                        <ScrollWrapper>
                            <Suspense fallback={<div className="flex items-center justify-center p-8 text-text-secondary">{t('loading_text')}</div>}>
                                <ToolsDashboard />
                            </Suspense>
                        </ScrollWrapper>
                    </div>
                );

            case 'population':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
                        <BackBar title={t('population_title')} subtitle={t('population_subtitle')} onBack={() => handleNavigation('dashboard')} />
                        <ScrollWrapper>
                            <PrimaryCareHub
                                initialTab="population"
                                initialProfileId={pcProfileId}
                                onProfileConsumed={() => setPcProfileId(null)}
                            />
                        </ScrollWrapper>
                    </div>
                );

            case 'primary_care':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
                        <BackBar title={t('pc_title')} subtitle={t('pc_subtitle')} onBack={() => handleNavigation('dashboard')} />
                        <ScrollWrapper>
                            <PrimaryCareHub initialProfileId={pcProfileId} onProfileConsumed={() => setPcProfileId(null)} />
                        </ScrollWrapper>
                    </div>
                );

            case 'patient_dossier':
                return (
                    <div className="min-h-full flex flex-col min-w-0">
                        <BackBar title={t('dossier_title')} subtitle={t('dossier_subtitle')} onBack={() => handleNavigation('dashboard')} />
                        <ScrollWrapper>
                            <Suspense fallback={<div className="flex items-center justify-center p-8 text-text-secondary">{t('loading_text')}</div>}>
                                <PatientDossierPage />
                            </Suspense>
                        </ScrollWrapper>
                    </div>
                );

            default:
                return <div className="text-center p-8 text-slate-500">{t('error_page_not_found')}</div>;
        }
    };
    
    // --- DIRECTOR DASHBOARD ---
    if (isRectorPath) {
        if (!currentUser) {
            return (
                <div className="relative">
                    <button onClick={() => { window.location.href = '/'; }} className="absolute top-4 left-4 z-50 text-white/60 hover:text-white transition-colors">
                        &larr; Bosh sahifa
                    </button>
                    <AuthPage onLoginSuccess={handleLoginSuccess} />
                </div>
            );
        }
        return <RectorDashboard onBackToMain={() => { window.location.href = '/'; }} />;
    }

    // --- KLINIKA GURUHI ADMIN PANEL ---
    if (isClinicAdminPath) {
        if (!currentUser) {
            return (
                <div className="relative">
                    <button onClick={() => { window.location.href = '/'; }} className="absolute top-4 left-4 z-50 text-white/60 hover:text-white transition-colors">
                        &larr; Bosh sahifa
                    </button>
                    <AuthPage onLoginSuccess={handleLoginSuccess} />
                </div>
            );
        }
        return <ClinicAdminDashboard onBackToMain={() => { window.location.href = '/'; }} />;
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
    if (!authService.hasActiveSubscription(currentUser)) {
        return <SubscriptionPage user={currentUser} onSubscriptionPending={handleSubscriptionPending} onLogout={handleLogout} />;
    }

    // Registrator — faqat ro'yxat va chek (konsilium / dashboard yo'q)
    if (currentUser.role === 'staff') {
        return (
            <RegistrarApp
                user={currentUser}
                onLogout={handleLogout}
                language={language}
                onLanguageChange={setLanguage as (lang: Language) => void}
            />
        );
    }

    // Viloyat sog'liqni saqlash boshqarmasi — faqat statistika
    if (currentUser.role === 'regional_stats') {
        return (
            <RegionalStatsDashboard
                user={currentUser}
                onLogout={handleLogout}
            />
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full max-w-[100vw] font-sans text-text-primary app-bg relative overflow-x-hidden">
            {/* Oq/kulrang animatsion gradient (index.css .app-bg) */}
            {criticalFinding && <CriticalFindingAlert finding={criticalFinding} onClose={() => setCriticalFinding(null)} />}
            {rationaleMessage && <RationaleModal message={rationaleMessage} patientData={patientData!} debateHistory={debateHistory} onClose={() => setRationaleMessage(null)} />}
            {isApiConfigured() && !apiHealthy && !isProcessing && (
                <div className="flex-none flex items-center justify-center gap-2 sm:gap-3 py-2 page-px bg-amber-500/90 text-white text-xs sm:text-sm font-medium z-40 flex-wrap">
                    {healthStatus === 400 ? (
                        <span className="break-words">
                            Domen boshqa serverga yo&apos;naltirilgan. DNS tekshiring:{' '}
                            <code className="bg-black/20 px-1 rounded">nslookup {PLATFORM_WEBSITE}</code>
                            {' — A yozuv server IP ga ishora qilishi kerak.'}
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
                <div className="glass-panel page-px py-2.5 flex flex-wrap justify-between items-center gap-x-2 gap-y-2 shadow-lg shadow-blue-500/5 w-full min-w-0">
                    {/* Logo */}
                    <button
                        onClick={() => handleNavigation(currentUser?.role === 'staff' ? 'registrar' : 'dashboard')}
                        className="flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-80 transition-opacity"
                    >
                        <img src={INSTITUTE_LOGO_SRC} alt={INSTITUTE_NAME_SHORT} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shrink-0 bg-slate-100" />
                        <div className="min-w-0 hidden sm:block">
                            <h1 className="text-base font-black tracking-tight text-slate-800 leading-none">{t('appName')}</h1>
                            <p className="text-[9px] text-slate-400 font-medium tracking-wide leading-none mt-0.5">{PLATFORM_NAME} - AI Konsilium</p>
                        </div>
                        <h1 className="text-base font-black tracking-tight text-slate-800 sm:hidden">{t('appName')}</h1>
                    </button>

                    {/* Right: qurilma (ixcham) + til + chiqish */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
                        <DeviceSessionBanner variant="compact" />
                        <LanguageSwitcher language={language} onLanguageChange={setLanguage as (lang: Language) => void} />
                        {(currentUser?.isClinicGroupAdmin || currentUser?.isStaff || currentUser?.isSuperuser) && (
                            <a
                                href="/klinika-admin"
                                className="text-xs sm:text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors px-2 sm:px-3 py-2 hover:bg-teal-50 rounded-xl border border-transparent hover:border-teal-100 shrink-0"
                            >
                                Admin
                            </a>
                        )}
                        <button
                            onClick={handleLogout}
                            className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-red-600 transition-colors px-2 sm:px-4 py-2 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 shrink-0"
                        >
                            {t('logout')}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 flex flex-col w-full min-w-0 relative z-10 isolate overflow-x-hidden">
               {renderMainContent()}
            </main>
            
            <footer className="flex-none w-full z-20 relative max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
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

                        {/* Right - ownership */}
                        <div className="flex items-center gap-2 text-[10px] flex-wrap justify-center">
                            <span className="text-slate-400 font-medium">Mutlaq egalik:</span>
                            <span
                                className="font-black"
                                style={{
                                    background: 'linear-gradient(90deg, #0369a1, #0891b2)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                {INSTITUTE_NAME_FULL}
                            </span>
                        </div>
                    </div>
                </div>
            </footer>
            
            {currentUser?.role !== 'staff' && (
                <MobileNavBar activeView={appView} onNavigate={handleNavigation as (view: 'dashboard' | 'new_analysis' | 'history' | 'research') => void} />
            )}
        </div>
    );
};

const App: React.FC = () => (
    <AppContent />
);

export default App;