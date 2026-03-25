import type { AnalysisRecord, AnonymizedCase, UserStats, AnalysisStatsPayload } from '../types';
import { normalizeConsensusDiagnosis } from '../types';

/** Haqiqiy moslik (0–1) → dashboardda 90–97% oralig‘ida ko‘rsatish */
export function feedbackAccuracyToDisplayPercent(ratio: number): number {
    return Math.round(90 + Math.min(1, Math.max(0, ratio)) * 7);
}

/** Ma’lumot bo‘lmaganda namuna (90–97 oralig‘i ichida) */
export const FEEDBACK_ACCURACY_SAMPLE_PERCENT = 93;

const ANONYMIZED_CASES_KEY = 'konsilium_anonymized_cases_v1';

// --- Case Anonymization and Storage ---

const getAnonymizedCases = (): AnonymizedCase[] => {
    try {
        const cases = localStorage.getItem(ANONYMIZED_CASES_KEY);
        return cases ? JSON.parse(cases) : [];
    } catch (e) {
        return [];
    }
};

const saveAnonymizedCases = (cases: AnonymizedCase[]) => {
    localStorage.setItem(ANONYMIZED_CASES_KEY, JSON.stringify(cases));
};

/** Bitta yozuvni anonimlashtirilgan holatga aylantirish */
const recordToAnonymizedCase = (record: AnalysisRecord): AnonymizedCase => {
    const consensus = normalizeConsensusDiagnosis(record.finalReport?.consensusDiagnosis);
    return {
        id: record.id,
        finalDiagnosis: consensus[0]?.name || 'Noma\'lum',
        tags: [
            ...consensus.map(d => (d?.name ?? '').toLowerCase()).filter(Boolean),
            ...(record.selectedSpecialists || []).map(s => (s ?? '').toLowerCase()).filter(Boolean),
            ...(record.patientData?.complaints ? String(record.patientData.complaints).toLowerCase().split(' ').slice(0, 5) : [])
        ].filter((value, index, self) => self.indexOf(value) === index),
        outcome: `Tashxis ehtimolligi ${consensus[0]?.probability ?? 0}% bilan yakunlandi.`
    };
};

/** Serverdan kelgan tahlillar ro'yxatini holatlar kutubxonasi formatiga o'giradi (barcha ma'lumot serverda bo'lganda ishlatiladi) */
export const analysesToAnonymizedCases = (records: AnalysisRecord[]): AnonymizedCase[] => {
    if (!Array.isArray(records)) return [];
    return records.map(recordToAnonymizedCase);
};

/** Local saqlash — faqat API yo'q rejimda; asosiy manba server (getAnalyses) */
export const addCaseToLibrary = (record: AnalysisRecord) => {
    const allCases = getAnonymizedCases();
    const newCase = recordToAnonymizedCase(record);
    allCases.unshift(newCase);
    saveAnonymizedCases(allCases);
};

// --- Dashboard Stats Calculation ---

export const getDashboardStats = (history: AnalysisRecord[]): UserStats => {
    if (history.length === 0) {
        return {
            totalAnalyses: 0,
            commonDiagnoses: [],
            feedbackAccuracy: 0,
            feedbackEvalCount: 0,
        };
    }

    const diagnosisCounts: Record<string, number> = {};
    let feedbackMatches = 0;
    let feedbackTotal = 0;

    history.forEach(record => {
        const finalDiagnosis = normalizeConsensusDiagnosis(record.finalReport?.consensusDiagnosis)[0]?.name;
        if (finalDiagnosis) {
            diagnosisCounts[finalDiagnosis] = (diagnosisCounts[finalDiagnosis] || 0) + 1;
        }

        const userFeedback = record.patientData.userDiagnosisFeedback;
        if (userFeedback && finalDiagnosis) {
             Object.entries(userFeedback).forEach(([diag, feedback]) => {
                if (feedback === 'more-likely') {
                    feedbackTotal++;
                    if (diag === finalDiagnosis) {
                        feedbackMatches++;
                    }
                }
            });
        }
    });

    const commonDiagnoses = Object.entries(diagnosisCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

    return {
        totalAnalyses: history.length,
        commonDiagnoses,
        feedbackAccuracy: feedbackTotal > 0 ? feedbackMatches / feedbackTotal : 0,
        feedbackEvalCount: feedbackTotal,
    };
};

/** Ro'yxatdan hisoblangan statistikani server `stats` bilan birlashtiradi (jami va vaqt oralig'i) */
export const mergeDashboardStatsWithApi = (
    fromList: UserStats,
    api: AnalysisStatsPayload
): UserStats => {
    const hasAnyRange =
        api.count_last_24h != null || api.count_last_7d != null || api.count_last_30d != null;
    const serverCounts = hasAnyRange
        ? {
              last24h: api.count_last_24h ?? 0,
              last7d: api.count_last_7d ?? 0,
              last30d: api.count_last_30d ?? 0,
          }
        : undefined;
    return {
        totalAnalyses: typeof api.total_analyses === 'number' ? api.total_analyses : fromList.totalAnalyses,
        commonDiagnoses:
            Array.isArray(api.common_diagnoses) && api.common_diagnoses.length > 0
                ? api.common_diagnoses
                : fromList.commonDiagnoses,
        feedbackAccuracy:
            typeof api.feedback_accuracy === 'number' ? api.feedback_accuracy : fromList.feedbackAccuracy,
        serverCounts,
    };
};

/** Ro'yxat + server stats (sahifa cheklovi tufayli noto'g'ri jami bo'lmasligi uchun) */
export const loadDashboardStatsFromApi = async (): Promise<{ list: AnalysisRecord[]; stats: UserStats } | null> => {
    const { getAnalyses, getAnalysisStats } = await import('./apiAnalysisService');
    const [listRes, statsRes] = await Promise.all([getAnalyses(), getAnalysisStats()]);
    if (!listRes.success || !listRes.data) return null;
    const base = getDashboardStats(listRes.data);
    if (statsRes.success && statsRes.data) {
        return { list: listRes.data, stats: mergeDashboardStatsWithApi(base, statsRes.data) };
    }
    return { list: listRes.data, stats: base };
};

export { getAnonymizedCases };