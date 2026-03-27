import type { AnalysisRecord, PatientData } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import type { Language } from '../i18n/LanguageContext';

const MAX_PRIOR = 5;
const MAX_FIELD_LEN = 420;

function truncate(s: string, max: number): string {
    const t = (s || '').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

function recordTime(r: AnalysisRecord): number {
    const t = new Date(r.date).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/** Server/frontend tahlillardan shu bemor uchun (patient_id matni) mos keluvchilarni sanasi bo'yicha tartiblaydi */
export function getPriorAnalysesForPatient(all: AnalysisRecord[], patientKey: string): AnalysisRecord[] {
    const idStr = patientKey.trim();
    if (!idStr) return [];
    const list = all.filter(r => String(r.patientId ?? '').trim() === idStr);
    return list.sort((a, b) => recordTime(b) - recordTime(a));
}

export interface RecentPatientGroup {
    patientKey: string;
    label: string;
    lastDate: string;
    count: number;
}

/** Mahalliy tarixdan bemorlar guruhi — patientId raqam bo'lsa ajratiladi */
export function groupRecentPatientsFromHistory(records: AnalysisRecord[]): RecentPatientGroup[] {
    const map = new Map<string, AnalysisRecord[]>();
    for (const r of records) {
        const raw = String(r.patientId ?? '').trim();
        if (!raw) continue;
        if (!map.has(raw)) map.set(raw, []);
        map.get(raw)!.push(r);
    }
    const out: RecentPatientGroup[] = [];
    for (const [key, list] of map) {
        const sorted = [...list].sort((a, b) => recordTime(b) - recordTime(a));
        const last = sorted[0];
        out.push({
            patientKey: key,
            label: `${last.patientData.firstName || ''} ${last.patientData.lastName || ''}`.trim() || key,
            lastDate: last.date,
            count: sorted.length,
        });
    }
    return out
        .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
        .slice(0, 12);
}

function trendHint(oldText: string, newText: string, lang: Language): string {
    const o = (oldText || '').trim();
    const n = (newText || '').trim();
    if (!o && n) return lang === 'ru' ? 'yangi maʼlumot qo‘shildi' : lang === 'en' ? 'new data added' : "yangi ma'lumot qo'shildi";
    if (o && !n) return lang === 'ru' ? 'matn olib tashlangan' : lang === 'en' ? 'text cleared' : 'matn olib tashlangan';
    if (o === n) return lang === 'ru' ? 'o‘zgarishsiz' : lang === 'en' ? 'unchanged' : "o'zgarishsiz";
    const ol = o.length;
    const nl = n.length;
    if (nl > ol * 1.35) return lang === 'ru' ? 'matn sezilarli kengaygan (batafsilroq)' : lang === 'en' ? 'notably more detail' : 'matn kengaygan (batafsilroq)';
    if (nl < ol * 0.65) return lang === 'ru' ? 'matn qisqargan' : lang === 'en' ? 'text shortened' : 'matn qisqargan';
    return lang === 'ru' ? 'matn yangilangan' : lang === 'en' ? 'updated' : 'yangilangan';
}

/**
 * Oldingi tahlillar va joriy formani solishtirib, konsilium uchun qisqa matn.
 */
export function buildLongitudinalClinicalNotes(
    priorSortedNewestFirst: AnalysisRecord[],
    current: PatientData,
    lang: Language
): string {
    const slice = priorSortedNewestFirst.slice(0, MAX_PRIOR);
    if (slice.length === 0) return '';

    const intro: Record<Language, string> = {
        'uz-L': 'Bu bemor uchun platformada oldin tahlillar mavjud. Quyida qisqa tarix va hozirgi qabul bilan solishtirish. Dinamikani (yaxshilanish / og\'irlashish / noaniqlik) klinik jihatdan baholang.',
        'uz-C': 'Бу бемор учун платформада аввал таҳлиллар мавжуд. Қисқа тарих ва ҳозирги қабулни солиштиринг.',
        'ru': 'По этому пациенту уже есть анализы в системе. Ниже краткая история и сравнение с текущим приёмом. Оцените динамику клинически.',
        'en': 'This patient has prior analyses in the system. Below is a brief history and comparison with the current visit. Assess clinical trajectory.',
    };

    const lines: string[] = [intro[lang] || intro['uz-L'], ''];

    slice.forEach((rec, idx) => {
        const dx = normalizeConsensusDiagnosis(rec.finalReport?.consensusDiagnosis);
        const names = dx.map(d => d.name).filter(Boolean).join('; ') || '—';
        const dateStr = new Date(rec.date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'uz-UZ');
        const meds = rec.finalReport?.medicationRecommendations?.slice(0, 4).map(m => m.name).filter(Boolean).join(', ');
        lines.push(`[${idx + 1}] ${dateStr} — konsensus: ${truncate(names, 280)}`);
        if (meds) lines.push(`    Tavsiya etilgan dorilar (qisqa): ${truncate(meds, 200)}`);
    });

    const latest = slice[0];
    const pd = latest.patientData;
    lines.push('');
    lines.push('--- Hozirgi qabul vs oxirgi saqlangan tahlil (matn solishtirish) ---');
    lines.push(`Shikoyat: ${trendHint(pd.complaints || '', current.complaints || '', lang)} | oldin: ${truncate(pd.complaints || '', MAX_FIELD_LEN)}`);
    lines.push(`Hozir: ${truncate(current.complaints || '', MAX_FIELD_LEN)}`);
    lines.push(`Anamnez: ${trendHint(pd.history || '', current.history || '', lang)} | oldin: ${truncate(pd.history || '', 220)}`);
    lines.push(`Hozir: ${truncate(current.history || '', 220)}`);
    lines.push(`Ob'ektiv/lab (oxirgi tahlil): ${truncate((pd.objectiveData || '') + (pd.labResults || ''), 300)}`);
    lines.push(`Ob'ektiv/lab (hozir): ${truncate((current.objectiveData || '') + (current.labResults || ''), 300)}`);

    return lines.join('\n').slice(0, 8000);
}
