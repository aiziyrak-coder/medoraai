import type { AnalysisRecord, AnonymizedCase, UserStats } from '../types';

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
    const newCase: AnonymizedCase = {
        id: record.id,
        finalDiagnosis: record.finalReport.consensusDiagnosis[0]?.name || 'Noma\'lum',
        tags: [
            ...record.finalReport.consensusDiagnosis.map(d => d.name.toLowerCase()),
            ...(record.selectedSpecialists || []).map(s => s.toLowerCase()),
            ...record.patientData.complaints.toLowerCase().split(' ').slice(0, 5) // Use first few words of complaints as tags
        ].filter((value, index, self) => self.indexOf(value) === index), // Unique tags
        outcome: `Tashxis ehtimolligi ${record.finalReport.consensusDiagnosis[0]?.probability}% bilan yakunlandi.`
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
        const finalDiagnosis = record.finalReport.consensusDiagnosis[0]?.name;
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
