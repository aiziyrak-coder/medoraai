import type { AnalysisRecord, PatientData } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import type { Language } from '../i18n/LanguageContext';

const MAX_PRIOR = 80;
const MAX_FIELD_LEN = 900;

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
    /** Shu bemorga tegishli tahlillar (eng yangisi birinchi) */
    records: AnalysisRecord[];
}

/** Bemorni guruhlash kaliti: avval patientId, bo'lmasa FIO */
export function patientGroupKey(record: AnalysisRecord): string {
    const id = String(record.patientId ?? '').trim();
    if (id) return `id:${id}`;
    const pd = record.patientData;
    const name = `${pd.lastName || ''}|${pd.firstName || ''}|${pd.fatherName || ''}`.trim().toLowerCase();
    if (name && name !== '||') return `name:${name}`;
    return `analysis:${record.id}`;
}

/** Mahalliy tarixdan bemorlar guruhi — patientId yoki FIO bo'yicha bitta qator */
export function groupRecentPatientsFromHistory(records: AnalysisRecord[]): RecentPatientGroup[] {
    const map = new Map<string, AnalysisRecord[]>();
    for (const r of records) {
        const key = patientGroupKey(r);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
    }
    const out: RecentPatientGroup[] = [];
    for (const [key, list] of map) {
        const sorted = [...list].sort((a, b) => recordTime(b) - recordTime(a));
        const last = sorted[0];
        out.push({
            patientKey: key,
            label: `${last.patientData.lastName || ''} ${last.patientData.firstName || ''}`.trim()
                || `${last.patientData.firstName || ''} ${last.patientData.lastName || ''}`.trim()
                || key,
            lastDate: last.date,
            count: sorted.length,
            records: sorted,
        });
    }
    return out
        .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
        .slice(0, 24);
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
        'kaa': 'Bul nawqas ushın platformada aldınǵı analizler bar. Tómende qısqa tariyx hám házirgi qabılmen salıstırıw.',
    };

    const lines: string[] = [intro[lang] || intro['uz-L'], ''];

    slice.forEach((rec, idx) => {
        const dx = normalizeConsensusDiagnosis(rec.finalReport?.consensusDiagnosis);
        const names = dx.map(d => d.name).filter(Boolean).join('; ') || '—';
        const dateStr = new Date(rec.date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'uz-UZ');
        const meds = rec.finalReport?.medicationRecommendations?.slice(0, 6).map(m => m.name).filter(Boolean).join(', ');
        const priorComplaint = truncate(rec.patientData?.complaints || '', 320);
        const treatment = (rec.finalReport?.treatmentPlan || []).slice(0, 4).map(String).filter(Boolean).join('; ');
        lines.push(`[${idx + 1}] ${dateStr} — konsensus: ${truncate(names, 400)}`);
        if (priorComplaint) lines.push(`    Shikoyat (o'sha qabul): ${priorComplaint}`);
        if (meds) lines.push(`    Dorilar: ${truncate(meds, 280)}`);
        if (treatment) lines.push(`    Davolash: ${truncate(treatment, 320)}`);
        const tests = (rec.finalReport?.recommendedTests || []).slice(0, 4).join(', ');
        if (tests) lines.push(`    Tekshiruvlar: ${truncate(tests, 200)}`);
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

    return lines.join('\n').slice(0, 14000);
}

export interface TimelineAnalysis {
    id: number;
    date: string;
    complaints?: string;
    consensus_diagnoses?: string[];
    treatment_plan?: string[];
    recommended_tests?: string[];
    follow_up?: string;
}

/** Serverdan kelgan klinik vaqt chizig'i + bazadagi anamnez — konsilium uchun to'liq kontekst. */
export function buildTimelineClinicalNotes(
    baseline: PatientData | null,
    timeline: TimelineAnalysis[],
    current: PatientData,
    lang: Language,
): string {
    const lines: string[] = [];
    const hdr: Record<Language, string> = {
        'uz-L': 'BEMOR KLINIK TARIXI (bazada saqlangan — qayta so\'ramang, tahlilda INOBATGA OLING):',
        'uz-C': 'БЕМОР КЛИНИК ТАРИХИ (базада сақланган):',
        'ru': 'КЛИНИЧЕСКАЯ ИСТОРИЯ ПАЦИЕНТА (в базе — учитывать при анализе):',
        'en': 'PATIENT CLINICAL HISTORY (on record — use in analysis):',
        'kaa': 'NAWQAS KLINIKALIQ TARIYX (bazada saqlanǵan):',
    };
    lines.push(hdr[lang] || hdr['uz-L'], '');

    if (baseline) {
        if (baseline.history?.trim()) lines.push(`Anamnez: ${truncate(baseline.history, MAX_FIELD_LEN)}`);
        if (baseline.allergies?.trim()) lines.push(`Allergiya: ${truncate(baseline.allergies, 240)}`);
        if (baseline.familyHistory?.trim()) lines.push(`Oilaviy anamnez: ${truncate(baseline.familyHistory, 400)}`);
        if (baseline.currentMedications?.trim()) lines.push(`Doimiy dorilar: ${truncate(baseline.currentMedications, 400)}`);
        if (baseline.labResults?.trim()) lines.push(`Oxirgi lab (bazada): ${truncate(baseline.labResults, 400)}`);
        lines.push('');
    }

    timeline.slice(0, MAX_PRIOR).forEach((item, idx) => {
        const dateStr = item.date
            ? new Date(item.date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'uz-UZ')
            : '—';
        const dx = (item.consensus_diagnoses || []).join('; ') || '—';
        const phys = (item as { physician?: string }).physician;
        const header = phys ? `[Tahlil ${idx + 1}] ${dateStr} (${phys}) — ${dx}` : `[Tahlil ${idx + 1}] ${dateStr} — ${dx}`;
        lines.push(header);
        if (item.complaints) lines.push(`  Shikoyat: ${truncate(item.complaints, 300)}`);
        const just = (item as { justification?: string }).justification;
        if (just) lines.push(`  Xulosa: ${truncate(just, 400)}`);
        if (item.treatment_plan?.length) lines.push(`  Davolash: ${truncate(item.treatment_plan.join('; '), 350)}`);
        const meds = (item as { medications?: string[] }).medications;
        if (meds?.length) lines.push(`  Dorilar: ${truncate(meds.join(', '), 250)}`);
        if (item.recommended_tests?.length) lines.push(`  Tekshiruv: ${truncate(item.recommended_tests.join(', '), 250)}`);
        if (item.follow_up) lines.push(`  Kuzatuv: ${truncate(item.follow_up, 200)}`);
    });

    lines.push('');
    lines.push('--- BUGUNGI QABUL ---');
    lines.push(`Shikoyat: ${truncate(current.complaints || '', MAX_FIELD_LEN)}`);
    lines.push(`Ob\'ektiv/lab (bugun): ${truncate((current.objectiveData || '') + (current.labResults || ''), 500)}`);

    return lines.join('\n').slice(0, 28000);
}
