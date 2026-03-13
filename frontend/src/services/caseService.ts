import type { AnalysisRecord, AnonymizedCase, UserStats } from '../types';
import { normalizeConsensusDiagnosis } from '../types';

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

export const addCaseToLibrary = (record: AnalysisRecord) => {
    const allCases = getAnonymizedCases();
    
    // Simple anonymization and tagging
    const consensus = normalizeConsensusDiagnosis(record.finalReport?.consensusDiagnosis);
    const newCase: AnonymizedCase = {
        id: record.id,
        finalDiagnosis: consensus[0]?.name || 'Noma\'lum',
        tags: [
            ...consensus.map(d => (d?.name ?? '').toLowerCase()).filter(Boolean),
            ...(record.selectedSpecialists || []).map(s => (s ?? '').toLowerCase()).filter(Boolean),
            ...(record.patientData?.complaints ? String(record.patientData.complaints).toLowerCase().split(' ').slice(0, 5) : [])
        ].filter((value, index, self) => self.indexOf(value) === index),
        outcome: `Tashxis ehtimolligi ${consensus[0]?.probability ?? 0}% bilan yakunlandi.`
    };

    allCases.unshift(newCase);
    saveAnonymizedCases(allCases);
};

// --- Dashboard Stats Calculation ---

export const getDashboardStats = (history: AnalysisRecord[]): UserStats => {
    if (history.length === 0) {
        return { totalAnalyses: 0, commonDiagnoses: [], feedbackAccuracy: 0 };
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
        feedbackAccuracy: feedbackTotal > 0 ? (feedbackMatches / feedbackTotal) : 0,
    };
};

export { getAnonymizedCases };