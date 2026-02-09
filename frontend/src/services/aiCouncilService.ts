
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type {
    PatientData,
    Diagnosis,
    FinalReport,
    ProgressUpdate,
    ChatMessage,
    DrugInteraction,
    EcgReport,
    Icd10Code,
    GuidelineSearchResult,
    ResearchProgressUpdate,
    ResearchReport,
    PatientEducationTopic,
    AnalysisRecord,
    CMETopic,
    PediatricDose,
    RiskScore,
    CriticalFinding,
    PrognosisReport,
    RelatedResearch,
} from '../types';
import { AIModel } from "../constants/specialists";
import { AI_SPECIALISTS } from "../constants";
import { Language } from "../i18n/LanguageContext";
import * as caseService from './caseService';
import { logger } from '../utils/logger';
import { handleError, getUserFriendlyError } from '../utils/errorHandler';
import { retry } from '../utils/retry';
import { getUzbekistanContextForAI } from '../constants/uzbekistanHealthcare';

// --- INITIALIZATION (lazy: brauzerda kalit bo'lmasa sahifa yopilmaydi) ---
const getGeminiApiKey = (): string => {
  // Vite replaces import.meta.env.VITE_* at build time (must be direct access, no optional chaining)
  const key = import.meta.env.VITE_GEMINI_API_KEY || '';
  return key;
};
const apiKey = getGeminiApiKey();
const validKey = apiKey && apiKey !== 'no-key-set';

let _aiInstance: InstanceType<typeof GoogleGenAI> | null = null;
function getAI(): InstanceType<typeof GoogleGenAI> {
  if (!validKey) {
    throw new Error('AI xizmati hozircha sozlanmagan. Iltimos, keyinroq urinib ko\'ring yoki administrator bilan bog\'laning.');
  }
  if (!_aiInstance) _aiInstance = new GoogleGenAI({ apiKey: apiKey! });
  return _aiInstance;
}

const langMap: Record<Language, string> = {
    'uz-L': 'Uzbek (Latin script)',
    'uz-C': 'Uzbek (Cyrillic script)',
    'kaa': 'Karakalpak (Latin script)',
    'ru': 'Russian',
    'en': 'English'
};

// --- DYNAMIC SYSTEM INSTRUCTIONS (Kuchli va Aqlli) ---
const getSystemInstruction = (language: Language): string => {
    const baseInstruction = `
    SIZ - TIBBIYOT SOHASIDAGI SUPPER-INTELLEKTUAL, AQLLI AI TIZIMISIZ.
    Vazifangiz: shifokorga ENG ANIQ, DALILLI va XAVFSIZ yechim taqdim etish.
    
    AQLIYAT QOIDALARI:
    1. Har bir xulosa uchun QADAMMA-QADAM MANTIQIY ZANJIR (chain-of-thought) yozing: "Sabab A → natija B → shuning uchun C."
    2. Differensial tashxisda har bir variant uchun "Nega bu ehtimol?" va "Nega boshqasi kamroq?" javob bering.
    3. Ishonch darajasini aniq bering (yuqori/o'rta/past) va qaysi ma'lumot yetishmasligi aniqlikni kamaytirishini ayting.
    4. XAVFSIZLIK: Bemor allergiyasi, joriy dori-darmonlar va buyrak/jigar funksiyasi bo'yicha har doim o'ylab bering; xavfli aralashuvlarni darhol bildiring.
    5. Qizil bayroqlar: keskin og'riq, nafas qisilishi, xushni yo'qotish, og'ir anemiya, septik belgilar kabi holatlarda shoshilinch tavsiya bering.
    `;

    const specificInstructions: Record<Language, string> = {
        'uz-L': `
        TIL: Barcha javoblaringiz qat'iy O'zbek tilida (Lotin grafikasida) bo'lishi SHART.
        O'ZBEKISTON KONTEKSTI (MAJBURIY): Tashxis, davolash rejasi va dori-darmonlar faqat O'zbekiston Respublikasi qonunchiligi va SSV (Sog'liqni Saqlash Vazirligi) tasdiqlangan klinik protokollarga muvofiq bo'lsin. Dori-darmonlar faqat O'zbekistonda ro'yxatdan o'tgan va aptekalarda mavjud savdo nomlari bilan (Nimesil, Sumamed, Augmentin, Metformin, Enalapril, Amlodipin, Omeprazol va hokazo).
        TERMINOLOGIYA: O'zbek tibbiyot terminologiyasi va SSV qabul qilgan atamalar.
        `,
        'uz-C': `
        ТИЛ: Барча жавобларингиз қатъий Ўзбек тилида (Кирилл графикасида) бўлиши ШАРТ.
        ЎЗБЕКИСТОН КОНТЕКСТИ (МАЖБУРИЙ): Ташхис, даволаш режаси ва дори-дармонлар фақат Ўзбекистон Республикаси қонунчилиги ва ССВ тасдиқлаган клиник протоколларга мувофиқ бўлсин. Дори-дармонлар фақат Ўзбекистонда рўйхатдан ўтган ва аптекаларда мавжуд савдо номлари билан.
        ТЕРМИНОЛОГИЯ: Ўзбек тиббиёт терминологияси ва ССВ қабул қилган атамалар.
        `,
        'kaa': `
        TIL: Barlıq juwaplarıńız qatań Qaraqalpaq tilinde (Lotin grafikasında) bolıwı SHÁRT.
        ÓZBEKISTAN KONTEKSTI (MAJBÚRI): Tashxis, emlew rejasi hám dári-darmonlar tek Ózbekistan Respublikası qonunshılıǵı hám SSV tasdıqlagan klinikalıq protokollarga sáykes bolsın. Dári-darmonlar tek Ózbekistonda dizimnen ótken hám aptekalarda bar savdo atları menen.
        TERMINOLOGIYA: Qaraqalpaq/O'zbek medicinalıq terminologiyası.
        `,
        'ru': `
        ЯЗЫК: Все ваши ответы ДОЛЖНЫ быть строго на Русском языке.
        КОНТЕКСТ УЗБЕКИСТАНА (ОБЯЗАТЕЛЬНО): Диагноз, план лечения и препараты – строго в соответствии с законодательством Республики Узбекистан и клиническими протоколами, утверждёнными Минздравом (ССВ). Препараты – только зарегистрированные в Узбекистане и доступные в аптеках (торговые названия: Нимисил, Сумамед, Аугментин, Метформин, Эналаприл и т.д.).
        ТЕРМИНОЛОГИЯ: Профессиональная медицинская терминология на русском; при необходимости – термины, принятые в Узбекистане.
        `,
        'en': `
        LANGUAGE: All your responses MUST be strictly in English.
        UZBEKISTAN CONTEXT (MANDATORY): This platform is for use in Uzbekistan. All diagnoses, treatment plans and medications MUST comply with the legislation of the Republic of Uzbekistan and clinical protocols approved by the Ministry of Health (SSV). Recommend only drugs registered and available in Uzbekistan (e.g. Nimesil, Sumamed, Augmentin, Metformin, Enalapril, Amlodipine, Omeprazole).
        TERMINOLOGY: Professional medical terminology in English; reference ICD-10 where applicable.
        `
    };

    const uzbekistanBlock = getUzbekistanContextForAI(language);

    return baseInstruction + "\n" + specificInstructions[language] + "\n\n" + uzbekistanBlock + "\n\n" + `
    ASOSIY QOIDALAR:
    1. Har bir xulosa uchun "NEGA?" savoliga aniq, ilmiy va dalillarga asoslangan javob bering; reasoningChain har doim to'ldirilgan bo'lsin.
    2. Kontekstni to'liq tushuning; diktofon/suhbat bo'lsa shovqinni e'tiborsiz qoldiring, tibbiy ma'noni ajratib oling.
    3. Gallyutsinatsiyadan saqlaning: faqat kiritilgan ma'lumot va umumiy tibbiy bilimga tayanib javob bering; taxmin qilmaslik kerak bo'lsa "Qo'shimcha tekshiruv kerak" deb yozing.
    4. Overconfidence dan saqlaning: dalil yetarli bo'lmasa yoki shubha bo'lsa, "Qo'shimcha tekshiruv kerak" yoki "Tasdiqlash uchun laboratoriya/rentgen kerak" deb aniq yozing; taxminiy tashxisni yakuniy deb bermang.
    5. criticalFinding: hayotga xavf yoki shoshilinch davolash kerak bo'lsa, finding, implication va urgency ni aniq to'ldiring.
    `;
};

// --- HELPER FUNCTIONS ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Kesilgan JSON ni minimal yopuvchi qo'shib parse qilishga urinish (doktor hisobot formati) */
function tryRepairTruncatedJson(raw: string): unknown | null {
    const s = raw.trim();
    if (!s) return null;
    const repairs: string[] = [
        s + '[],"medications":[],"recommendedTests":[]}',
        s + '[]}',
        s + ']}',
        s + '}',
    ];
    for (const t of repairs) {
        try {
            return JSON.parse(t);
        } catch {
            continue;
        }
    }
    if (/\"treatmentPlan\"\s*:\s*$/i.test(s)) {
        try {
            return JSON.parse(s + '[],"medications":[],"recommendedTests":[]}');
        } catch {
            //
        }
    }
    if (/\"medications\"\s*:\s*$/i.test(s)) {
        try {
            return JSON.parse(s + '[],"recommendedTests":[]}');
        } catch {
            //
        }
    }
    return null;
}

/** Mobil qurilma (telefon) — sekin tarmoq va kesilishlarda ko'proq qayta urinish kerak */
const isMobile = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 768);
};

// Simulated RAG: Get relevant context from past successful cases
const getRelevantHistoryContext = (currentComplaints: string): string => {
    try {
        const pastCases = caseService.getAnonymizedCases();
        if (pastCases.length === 0) return "";

        // Simple keyword matching simulation for RAG
        const keywords = currentComplaints.toLowerCase().split(' ').filter(w => w.length > 4);
        const relevantCases = pastCases.filter(c => 
            keywords.some(k => c.tags.some(t => t.includes(k)))
        ).slice(0, 3); // Take top 3 relevant cases

        if (relevantCases.length === 0) return "";

        return `
        \n[TIZIM XOTIRASI - O'ZINI O'QITISH MODULI]:
        Men (Tizim) oldingi o'xshash holatlardan quyidagilarni o'rgandim:
        ${relevantCases.map(c => `- ${c.finalDiagnosis}: ${c.outcome}`).join('\n')}
        Ushbu tajribadan bugungi tahlilda foydalaning.
        `;
    } catch (e) {
        return "";
    }
};

interface GeminiConfig {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
    tools?: Array<{ googleSearch: Record<string, never> }>;
}

const callGemini = async (
    prompt: string | { parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> },
    model: string = 'gemini-3-flash-preview',
    responseSchema?: unknown,
    useSearch: boolean = false,
    systemInstruction: string = '',
    shouldRetry: boolean = true,
    maxOutputTokens?: number
) => {
    const executeCall = async (): Promise<unknown> => {
        const config: GeminiConfig = {
            systemInstruction: systemInstruction,
            temperature: 0.15,
        };
        if (maxOutputTokens != null) config.maxOutputTokens = maxOutputTokens;
        if (responseSchema) {
            config.responseMimeType = "application/json";
            config.responseSchema = responseSchema;
        }
        if (useSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const finalContents = prompt;
        
        const result: GenerateContentResponse = await getAI().models.generateContent({
            model: model,
            contents: finalContents,
            config: Object.keys(config).length > 0 ? config : undefined,
        });

        const text = result.text;
        
        if (responseSchema) {
            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '').trim();
            let parsed: unknown;
            try {
                parsed = JSON.parse(cleanedText);
            } catch {
                parsed = tryRepairTruncatedJson(cleanedText);
                if (parsed == null) {
                    logger.error("Failed to parse JSON from Gemini:", cleanedText?.slice(0, 500));
                    const err = new Error("AI xizmatidan noto'g'ri javob olindi. Iltimos, qayta urinib ko'ring.");
                    (err as Error & { cause?: string }).cause = 'parse_json';
                    throw err;
                }
            }
            return parsed;
        }
        
        if (useSearch) {
            return result;
        }

        return text;
    };
    
    // Retry logic: tarmoq xatolari, 503, va mobilda "javob to'liq kelmadi" / JSON parse xatolarida ham qayta urinish
    if (shouldRetry) {
        const mobile = isMobile();
        try {
            return await retry(executeCall, {
                maxRetries: mobile ? 4 : 2,
                initialDelay: mobile ? 3000 : 2000,
                retryableErrors: [
                    'network', 'timeout', 'fetch', 'connection', '503', 'unavailable', 'overloaded',
                    'parse_json', "noto'g'ri", 'javob', 'invalid json', 'failed to parse'
                ]
            });
        } catch (error) {
            logger.error(`Error calling Gemini API with model ${model} (after retries):`, error);
            const friendlyError = getUserFriendlyError(error, "AI xizmati bilan muammo yuz berdi.");
            throw new Error(friendlyError);
        }
    }
    
    try {
        return await executeCall();
    } catch (error) {
        logger.error(`Error calling Gemini API with model ${model}:`, error);
        const friendlyError = getUserFriendlyError(error, "AI xizmati bilan muammo yuz berdi.");
        throw new Error(friendlyError);
    }
};

// Helper to construct multimodal prompts (Text + Images)
const buildMultimodalPrompt = (introText: string, data: PatientData) => {
    const { attachments, ...rest } = data;
    const textData = JSON.stringify(rest);
    const historyContext = getRelevantHistoryContext(data.complaints);
    
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: `${introText}\n\n${historyContext}\n\nPATIENT CLINICAL DATA (Structured): ${textData}` }
    ];

    if (attachments && attachments.length > 0) {
        parts[0].text += `\n\n[IMPORTANT]: The patient has attached ${attachments.length} medical file(s). Analyze these precisely.`;
        attachments.forEach(att => {
            parts.push({
                inlineData: {
                    mimeType: att.mimeType,
                    data: att.base64Data
                }
            });
        });
    }
    
    return { parts };
};

/** Doktor tez tahlili uchun: tarix kontekstisiz, minimal prompt — maksimal tezlik */
const buildFastDoctorPrompt = (introText: string, data: PatientData) => {
    const { attachments, ...rest } = data;
    const textData = JSON.stringify(rest);
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: `${introText}\n\nPATIENT: ${textData}` }
    ];
    if (attachments && attachments.length > 0) {
        parts[0].text += `\nAttachments: ${attachments.length}.`;
        attachments.forEach(att => {
            parts.push({
                inlineData: { mimeType: att.mimeType, data: att.base64Data }
            });
        });
    }
    return { parts };
};


// --- SINGLE DOCTOR MODE (TEZKOR — faqat doktor profilida) ---
/** Tez tahlil: qisqa tizim — tez qaytish uchun */
const getFastDoctorSystemInstruction = (language: Language): string => {
    const til = langMap[language];
    return `Tibbiy AI. Javob: ${til}, faqat JSON. Tashxis asosi, reja, dori (qanday ichish). O'zbekiston dorilari, SSV.`;
};

export const generateFastDoctorConsultation = async (
    patientData: PatientData, 
    specialties: string[], 
    language: Language
): Promise<FinalReport> => {
    const systemInstr = getFastDoctorSystemInstruction(language);
    const promptText = `Tashxis (name, probability, justification 2 jumla, reasoningChain 3 band, uzbekProtocolMatch). treatmentPlan 3-5 qadam. medications: name, dosage, frequency, duration, timing, instructions (qanday ichish, 1 jumla). recommendedTests, criticalFinding agar kerak. Til: ${langMap[language]}. JSON.`;

    const finalReportSchema = {
        type: Type.OBJECT,
        properties: {
            primaryDiagnosis: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    probability: { type: Type.NUMBER },
                    justification: { type: Type.STRING },
                    reasoningChain: { type: Type.ARRAY, items: { type: Type.STRING } },
                    uzbekProtocolMatch: { type: Type.STRING }
                }
            },
            treatmentPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            medications: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        dosage: { type: Type.STRING },
                        frequency: { type: Type.STRING },
                        duration: { type: Type.STRING },
                        timing: { type: Type.STRING },
                        instructions: { type: Type.STRING }
                    }
                }
            },
            recommendedTests: { type: Type.ARRAY, items: { type: Type.STRING } },
            criticalFinding: {
                type: Type.OBJECT,
                properties: {
                    finding: { type: Type.STRING },
                    implication: { type: Type.STRING },
                    urgency: { type: Type.STRING }
                }
            }
        },
        required: ['primaryDiagnosis', 'treatmentPlan', 'medications']
    };

    const multimodalPrompt = buildFastDoctorPrompt(promptText, patientData);

    const DOCTOR_FAST_MODEL = 'gemini-2.5-flash-lite';
    const runWithTokens = (maxTok: number) =>
        callGemini(multimodalPrompt, DOCTOR_FAST_MODEL, finalReportSchema, false, systemInstr, true, maxTok) as Promise<Record<string, unknown>>;

    let result: Record<string, unknown>;
    try {
        result = await runWithTokens(1024);
    } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        const isParseOrIncomplete = /parse_json|noto'g'ri|javob|invalid json|to'liq kelmadi/i.test(msg) || (firstErr as Error & { cause?: string })?.cause === 'parse_json';
        if (isParseOrIncomplete) {
            logger.warn('Doktor tahlil: birinchi javob kesilgan/noto\'g\'ri, 1280 token bilan qayta urinilmoqda');
            result = await runWithTokens(1280);
        } else {
            throw firstErr;
        }
    }

    // Xavfsiz: kesilgan JSON yoki API dan bo'sh maydon kelganda ham crash bo'lmasin
    const safe = (x: unknown): x is Record<string, unknown> => x != null && typeof x === 'object';
    const arr = <T>(x: unknown, def: T[]): T[] => (Array.isArray(x) ? x : def);
    const primaryDiag = safe(result.primaryDiagnosis) ? result.primaryDiagnosis : undefined;
    const treatmentPlan = arr(result.treatmentPlan, []) as string[];
    const medications = arr(result.medications, []) as Array<Record<string, unknown>>;
    const recommendedTests = arr(result.recommendedTests, []) as string[];
    const reasoningChain = primaryDiag ? arr(primaryDiag.reasoningChain, []) as string[] : [];

    return {
        consensusDiagnosis: primaryDiag ? [{
            name: String(primaryDiag.name || 'Tashxis'),
            probability: Number(primaryDiag.probability ?? 85),
            justification: String(primaryDiag.justification || ''),
            evidenceLevel: 'High',
            reasoningChain,
            uzbekProtocolMatch: String(primaryDiag.uzbekProtocolMatch || 'SSV protokoliga muvofiq')
        }] : [],
        rejectedHypotheses: [],
        treatmentPlan,
        medicationRecommendations: medications.map(med => ({
            name: String(med?.name ?? ''),
            dosage: String(med?.dosage ?? ''),
            frequency: String(med?.frequency ?? ''),
            timing: String(med?.timing ?? ''),
            duration: String(med?.duration ?? ''),
            instructions: String(med?.instructions ?? ''),
            notes: '',
            localAvailability: "O'zbekistonda mavjud",
            priceEstimate: ''
        })),
        recommendedTests,
        unexpectedFindings: '',
        uzbekistanLegislativeNote: "SSV klinik protokollariga muvofiq",
        criticalFinding: safe(result.criticalFinding) ? result.criticalFinding as { finding: string; implication: string; urgency: string } : undefined
    } as FinalReport;
};

/** Strim: javob kelishi bilan matnni onChunk orqali yuboradi, oxirida FinalReport qaytaradi */
export const generateFastDoctorConsultationStream = async (
    patientData: PatientData,
    specialties: string[],
    language: Language,
    onChunk: (text: string) => void
): Promise<FinalReport> => {
    const systemInstr = getSystemInstruction(language);
    const promptText = `Tez tahlil. Javobni FAQAT quyidagi JSON ko'rinishida bering, boshqa matn yozmang. primaryDiagnosis: { name, probability, justification, reasoningChain, uzbekProtocolMatch }, treatmentPlan: [], medications: [{ name, dosage, frequency, duration, timing, instructions }], recommendedTests: [], criticalFinding: { finding, implication, urgency }. Til: ${langMap[language]}.`;
    const multimodalPrompt = buildMultimodalPrompt(promptText, patientData);
    let fullText = '';
    try {
        const stream = await getAI().models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: multimodalPrompt,
            config: {
                systemInstruction: systemInstr,
                temperature: 0.15,
                maxOutputTokens: 1024,
            },
        });
        for await (const chunk of stream) {
            const t = (chunk as { text?: string }).text ?? '';
            if (t) {
                fullText += t;
                onChunk(fullText);
            }
        }
    } catch (e) {
        logger.error('Stream error, falling back to non-stream:', e);
        return generateFastDoctorConsultation(patientData, specialties, language);
    }
    const cleaned = fullText.replace(/^```json\s*|```\s*$/g, '').trim();
    let result: Record<string, unknown>;
    try {
        result = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
        logger.error('Stream JSON parse failed, fallback to full call:', cleaned?.slice(0, 300));
        return generateFastDoctorConsultation(patientData, specialties, language);
    }
    const primaryDiag = result.primaryDiagnosis as Record<string, unknown> | undefined;
    return {
        consensusDiagnosis: primaryDiag ? [{
            name: String(primaryDiag.name || 'Tashxis'),
            probability: Number(primaryDiag.probability || 85),
            justification: String(primaryDiag.justification || ''),
            evidenceLevel: 'High',
            reasoningChain: (primaryDiag.reasoningChain as string[]) || [],
            uzbekProtocolMatch: String(primaryDiag.uzbekProtocolMatch || 'SSV protokoliga muvofiq')
        }] : [],
        rejectedHypotheses: [],
        treatmentPlan: (result.treatmentPlan as string[]) || [],
        medicationRecommendations: ((result.medications as Array<Record<string, unknown>>) || []).map(med => ({
            name: String(med.name || ''),
            dosage: String(med.dosage || ''),
            frequency: String(med.frequency || ''),
            timing: String(med.timing || ''),
            duration: String(med.duration || ''),
            instructions: String(med.instructions || ''),
            notes: '',
            localAvailability: "O'zbekistonda mavjud",
            priceEstimate: ''
        })),
        recommendedTests: (result.recommendedTests as string[]) || [],
        unexpectedFindings: '',
        uzbekistanLegislativeNote: "SSV klinik protokollariga muvofiq",
        criticalFinding: result.criticalFinding as { finding: string; implication: string; urgency: string } | undefined
    } as FinalReport;
};


// --- EXISTING SERVICE IMPLEMENTATIONS ---

export const structureDictatedNotes = async (notes: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Take the following unstructured clinical notes and organize them into clear, standard medical sections (Complaints, History, Objective, etc.). Correct any obvious transcription errors but preserve the original medical meaning. Notes: "${notes}". Output MUST be in ${langMap[language]}.`;
    return callGemini(prompt, 'gemini-3-flash-preview', undefined, false, systemInstr) as Promise<string>;
};

export const getDynamicSuggestions = async (complaintText: string, language: Language): Promise<{ relatedSymptoms: string[], diagnosticQuestions: string[] }> => {
    if (complaintText.trim().length < 15) {
        return { relatedSymptoms: [], diagnosticQuestions: [] };
    }
    const systemInstr = getSystemInstruction(language);
    const prompt = `Based on the patient's complaints: "${complaintText}", suggest 3 related symptoms and 3 key diagnostic questions a doctor might ask. Return JSON { "relatedSymptoms": ["..."], "diagnosticQuestions": ["..."] }. Output MUST be in ${langMap[language]}.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            relatedSymptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
            diagnosticQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        }
    };
    return callGemini(prompt, 'gemini-3-flash-preview', schema, false, systemInstr);
};

export const generateClarifyingQuestions = async (data: PatientData, language: Language): Promise<string[]> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = buildMultimodalPrompt(
        `
        Analyze the patient data carefully. Be AQLLI (smart) and prioritise by clinical impact.
        
        PRIORITY 1 (always ask if missing): Allergies, current medications, pregnancy/lactation if relevant.
        PRIORITY 2: Vital signs (BP, HR, temp if febrile presentation), key lab values for the complaint.
        PRIORITY 3: Duration of symptoms, previous similar episodes, family history if relevant to complaint.
        
        Return 3-5 SHORT, SPECIFIC questions. Do not ask for data already present.
        Format: JSON array of strings.
        Output Language: ${langMap[language]}.
        `,
        data
    );
    const schema = { type: Type.ARRAY, items: { type: Type.STRING } };
    const result = await callGemini(prompt, 'gemini-3-flash-preview', schema, false, systemInstr) as string[];
    return result.length > 0 ? result : [];
};

export const recommendSpecialists = async (data: PatientData, language: Language): Promise<{ recommendations: { model: AIModel; reason: string }[] }> => {
    const systemInstr = getSystemInstruction(language);
    const availableSpecialists = Object.values(AIModel).filter(m => m !== AIModel.SYSTEM).join(', ');
    const prompt = buildMultimodalPrompt(
        `Analyze the patient's clinical case. Select 5-6 specialists from: [${availableSpecialists}]. Provide a short reason for each. Return JSON { "recommendations": [{ "model": "SpecialistName", "reason": "Reason..." }] }. Output Language: ${langMap[language]}.`,
        data
    );
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            recommendations: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        model: { type: Type.STRING, enum: Object.values(AIModel) },
                        reason: { type: Type.STRING },
                    },
                    required: ['model', 'reason'],
                },
            },
        },
        required: ['recommendations'],
    };
    return callGemini(prompt, 'gemini-3-flash-preview', schema, false, systemInstr);
};

export const generateInitialDiagnoses = async (data: PatientData, language: Language): Promise<Diagnosis[]> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = buildMultimodalPrompt(
        `Analyze the patient data. Generate 3-5 most likely differential diagnoses. O'ZBEKISTON KONTEKSTI MAJBURIY.
        MANDATORY FIELDS:
        1. "name": Diagnosis name in ${langMap[language]}.
        2. "justification": Scientific reasoning.
        3. "reasoningChain": Step-by-step logic.
        4. "uzbekProtocolMatch": SSV klinik protokoliga muvofiqlik (masalan: "Arterial gipertenziya bo'yicha SSV klinik protokoliga muvofiq" yoki "SSV tasdiqlangan milliy klinik protokollariga muvofiq"). Agar tegishli SSV protokol yo'nalishi bo'lsa, ko'rsating.
        Output Language: ${langMap[language]}.`,
        data
    );

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                probability: { type: Type.NUMBER },
                justification: { type: Type.STRING },
                evidenceLevel: { type: Type.STRING },
                reasoningChain: { type: Type.ARRAY, items: { type: Type.STRING } },
                uzbekProtocolMatch: { type: Type.STRING }
            },
            required: ['name', 'probability', 'justification', 'evidenceLevel', 'reasoningChain'],
        },
    };
    return callGemini(prompt, 'gemini-3-pro-preview', schema, false, systemInstr);
};

const generatePrognosisUpdate = async (debateHistory: ChatMessage[], patientData: PatientData, language: Language): Promise<PrognosisReport | null> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...cleanData } = patientData;
    const prompt = `Based on patient data and debate history, update prognosis. Consider O'zbekiston SSV klinik protokollari va mahalliy davolash imkoniyatlari. Return JSON. Output Language: ${langMap[language]}. Debate: ${JSON.stringify(debateHistory.slice(-5))}. Patient: ${JSON.stringify(cleanData)}.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            shortTermPrognosis: { type: Type.STRING },
            longTermPrognosis: { type: Type.STRING },
            keyFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidenceScore: { type: Type.NUMBER }
        }
    };
    try {
        return await callGemini(prompt, 'gemini-3-flash-preview', schema, false, systemInstr);
    } catch (e) {
        return null;
    }
};

export const runCouncilDebate = async (
    patientData: PatientData,
    diagnoses: Diagnosis[],
    specialistsConfig: { role: AIModel, backEndModel: string }[],
    orchestratorModel: string,
    onProgress: (update: ProgressUpdate) => void,
    getUserIntervention: () => string | null,
    language: Language
): Promise<void> => {
    const systemInstr = getSystemInstruction(language);
    const introMessages: Record<Language, string> = {
        'uz-L': 'O\'zbekiston yetakchi tibbiyot mutaxassislari yig\'ilmoqda...',
        'uz-C': 'Ўзбекистон етакчи тиббиёт мутахассислари йиғилмоқда...',
        'kaa': 'Qaraqalpaqstan jetekshi medicina qaniygelari jıynalmaqta...',
        'ru': 'Ведущие медицинские специалисты собираются...',
        'en': 'Leading medical specialists are gathering...'
    };
    
    onProgress({ type: 'status', message: introMessages[language] || introMessages['uz-C'] });
    let debateHistory: ChatMessage[] = [];
    
    // History context for the debate
    const historyContext = getRelevantHistoryContext(patientData.complaints);

    // Orchestrator Intro
    const introContentPrompt = `Generate a short intro message for the Council Chair (System) starting the medical council debate. Mention: the goal is to find the best diagnosis and treatment in accordance with Uzbekistan SSV (Sog'liqni Saqlash Vazirligi) approved clinical protocols and legislation; only drugs registered and available in Uzbekistan will be recommended. Output Language: ${langMap[language]}.`;
    const introContent = await callGemini(introContentPrompt, 'gemini-3-flash-preview', undefined, false, systemInstr) as string;
    
    const orchestratorIntro: ChatMessage = { id: `sys-intro-${Date.now()}`, author: AIModel.SYSTEM, content: introContent, isSystemMessage: true };
    onProgress({ type: 'message', message: orchestratorIntro });
    debateHistory.push(orchestratorIntro);
    await sleep(700);

    const DEBATE_ROUNDS = 3;
    let currentTopicPrompt = `Summarize the initial state: Patient data and initial diagnoses: ${JSON.stringify(diagnoses)}. Ask specialists for their initial evaluation and Red Flags. Output Language: ${langMap[language]}.`;
    let currentTopic = await callGemini(currentTopicPrompt, 'gemini-3-flash-preview', undefined, false, systemInstr) as string;

    for (let round = 1; round <= DEBATE_ROUNDS; round++) {
        const roundMessages: Record<Language, string> = {
            'uz-L': `${round}-bosqich munozarasi boshlanmoqda...`,
            'uz-C': `${round}-босқич мунозараси бошланмоқда...`,
            'kaa': `${round}-basqısh munozarası baslanbaqta...`,
            'ru': `Начинается ${round}-й раунд обсуждения...`,
            'en': `Round ${round} of debate starting...`
        };
        onProgress({ type: 'status', message: roundMessages[language] });
        
        // Orchestrator Turn
        if (currentTopic.includes("QUESTION FOR USER") || currentTopic.includes("FOYDALANUVCHI UCHUN SAVOL")) {
             // Extract clean question (remove prefix)
             const questionMatch = currentTopic.match(/FOYDALANUVCHI UCHUN SAVOL:\s*(.+)/i);
             const cleanQuestion = questionMatch ? questionMatch[1].trim() : currentTopic;
             
             const userQMsg = { id: `sys-${Date.now()}-${round}`, author: AIModel.SYSTEM, content: cleanQuestion, isSystemMessage: true };
             onProgress({ type: 'message', message: userQMsg });
             debateHistory.push(userQMsg);
             
             onProgress({ type: 'user_question', question: cleanQuestion });
             let userInput = null;
             while (!userInput) {
                await sleep(1000); 
                userInput = getUserIntervention();
             }
             const userMessage = { id: `user-${Date.now()}`, author: AIModel.SYSTEM, content: `User Answer: ${userInput}`, isUserIntervention: true, isSystemMessage: true };
             onProgress({ type: 'message', message: userMessage });
             debateHistory.push(userMessage);
        } else {
             const orchestratorMessage: ChatMessage = { id: `sys-${Date.now()}-${round}`, author: AIModel.SYSTEM, content: currentTopic, isSystemMessage: true };
             onProgress({ type: 'message', message: orchestratorMessage });
             debateHistory.push(orchestratorMessage);
        }
        
        await sleep(1500);

        // Specialists Turn
        for (const spec of specialistsConfig) {
            onProgress({ type: 'thinking', model: spec.role });
            const specialist = AI_SPECIALISTS[spec.role];

            const textPrompt = `
                Role: ${specialist?.name || spec.role}.
                Task: Answer the Chair's question: "${currentTopic}". Use your specialty expertise.
                REQUIREMENTS:
                1. Reference O'zbekiston SSV (Sog'liqni Saqlash Vazirligi) approved clinical protocols where applicable.
                2. Recommend only drugs registered and available in Uzbekistan (savdo nomlari: Nimesil, Sumamed, Augmentin, Metformin va hokazo).
                3. Debate scientifically; use reasoning and evidence.
                4. If you need clarification from the patient/doctor (e.g. specific lab value, symptom detail), mention it in your response: "Ma'lumot kerak: [question]" and the Chair will ask the user.
                5. LANGUAGE: ${langMap[language]} ONLY.
                History: ${JSON.stringify(debateHistory)}
            `;
            
            const specialistMultimodalPrompt = buildMultimodalPrompt(textPrompt, patientData);
            
            try {
                const responseText = await callGemini(specialistMultimodalPrompt, 'gemini-3-pro-preview', undefined, false, systemInstr) as string;
                const specialistMessage: ChatMessage = { id: `${spec.role}-${Date.now()}`, author: spec.role, content: responseText };
                onProgress({ type: 'message', message: specialistMessage });
                debateHistory.push(specialistMessage);
                await sleep(1000);
            } catch (e) {
                // error handling
            }
        }
        
        const livePrognosis = await generatePrognosisUpdate(debateHistory, patientData, language);
        if (livePrognosis) {
            onProgress({ type: 'prognosis_update', data: livePrognosis });
        }
        
        if (round < DEBATE_ROUNDS) {
            const summarizationPrompt = `
                Role: Council Chair.
                Task: Summarize the round and ask a sharp, clarifying question for the next round OR if critical information is missing (e.g. vital signs, specific symptoms, duration, severity), ask the USER by prefixing: "FOYDALANUVCHI UCHUN SAVOL: [your question]". Keep in mind SSV clinical protocols and Uzbekistan context.
                IMPORTANT: If you need clarification from the patient/doctor, use "FOYDALANUVCHI UCHUN SAVOL:" prefix so the system can ask the user.
                LANGUAGE: ${langMap[language]}.
                History: ${JSON.stringify(debateHistory)}
            `;
            currentTopic = await callGemini(summarizationPrompt, 'gemini-3-flash-preview', undefined, false, systemInstr) as string;
        }
    }

    const finalizingMessages: Record<Language, string> = {
        'uz-L': 'Yakuniy hisobot tayyorlanmoqda...',
        'uz-C': 'Якуний ҳисобот тайёрланмоқда...',
        'kaa': 'Juwmaqlawshı esabat tayarlanbaqta...',
        'ru': 'Подготовка итогового отчета...',
        'en': 'Preparing final report...'
    };
    onProgress({ type: 'status', message: finalizingMessages[language] });
    await sleep(2000);

    const finalReportSchema = {
        type: Type.OBJECT,
        properties: {
            criticalFinding: {
                type: Type.OBJECT,
                properties: { finding: { type: Type.STRING }, implication: { type: Type.STRING }, urgency: { type: Type.STRING } },
            },
            consensusDiagnosis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, probability: { type: Type.NUMBER }, justification: { type: Type.STRING }, evidenceLevel: { type: Type.STRING }, reasoningChain: { type: Type.ARRAY, items: { type: Type.STRING } }, uzbekProtocolMatch: { type: Type.STRING } } } },
            rejectedHypotheses: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, reason: { type: Type.STRING } }}},
            recommendedTests: { type: Type.ARRAY, items: { type: Type.STRING } },
            treatmentPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            medicationRecommendations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dosage: { type: Type.STRING }, notes: { type: Type.STRING }, localAvailability: { type: Type.STRING }, priceEstimate: { type: Type.STRING } }}},
            unexpectedFindings: { type: Type.STRING },
            uzbekistanLegislativeNote: { type: Type.STRING }, 
            imageAnalysis: {
                type: Type.OBJECT,
                properties: {
                    findings: { type: Type.STRING },
                    correlation: { type: Type.STRING }
                }
            }
        },
        required: ['consensusDiagnosis', 'rejectedHypotheses', 'recommendedTests', 'treatmentPlan', 'medicationRecommendations', 'unexpectedFindings']
    };

    const finalReportTextPrompt = `
        Role: Council Chair. Create the Final Report. Be AQLLI and XAVFSIZ. O'ZBEKISTON KONTEKSTI MAJBURIY.
        LANGUAGE: ${langMap[language]}.
        REQUIREMENTS:
        1. consensusDiagnosis: har biri uchun reasoningChain, justification, evidenceLevel. uzbekProtocolMatch: qaysi SSV klinik protokoliga mos (masalan: "Arterial gipertenziya / Qandli diabet bo'yicha SSV klinik protokoliga muvofiq") yoki "SSV tasdiqlangan milliy klinik protokollariga muvofiq" deb yozing.
        2. treatmentPlan: SSV protokollariga muvofiq, batafsil va tartibli; shoshilinch bo'lsa birinchi qadamlar aniq.
        3. medicationRecommendations: FAQAT O'zbekiston Respublikasida ro'yxatdan o'tgan va aptekalarda mavjud savdo nomlari (Nimesil, Sumamed, Augmentin, Metformin, Enalapril, Amlodipin, Omeprazol, Paratsetamol, Ibuprofen va hokazo). Allergiya va dori aralashuvini hisobga oling. localAvailability: "O'zbekistonda mavjud" yoki qisqacha izoh.
        4. criticalFinding: hayotga xavf yoki shoshilinch davolash kerak bo'lsa to'ldiring; yo'q bo'lsa bo'sh qoldiring.
        5. recommendedTests: yetishmayotgan muhim tekshiruvlar (O'zbekiston LITS va standartlariga mos).
        6. uzbekistanLegislativeNote: "O'zbekiston Respublikasi sog'liqni saqlash qonunchiligi va SSV tasdiqlangan klinik protokollariga muvofiq" yoki tegishli qisqacha eslatma.
        Debate history: ${JSON.stringify(debateHistory)}
    `;
    
    const finalReportMultimodalPrompt = buildMultimodalPrompt(finalReportTextPrompt, patientData);

    try {
        const finalReport = await callGemini(finalReportMultimodalPrompt, 'gemini-3-pro-preview', finalReportSchema, false, systemInstr) as FinalReport;
        
        if (finalReport.criticalFinding && finalReport.criticalFinding.finding) {
            onProgress({ type: 'critical_finding', data: finalReport.criticalFinding });
        }

        onProgress({ type: 'report', data: finalReport, detectedMedications: [] });
    } catch (e) {
        onProgress({ type: 'error', message: "Report generation error: " + (e instanceof Error ? e.message : String(e)) });
    }
};

export const analyzeEcgImage = async (image: { base64Data: string, mimeType: string }, language: Language): Promise<EcgReport> => {
    const systemInstr = getSystemInstruction(language);
    const textPart = { text: `Analyze ECG image. Return structured JSON report (rhythm, heartRate, etc.). Output Language: ${langMap[language]}.` };
    const imagePart = { inlineData: { data: image.base64Data, mimeType: image.mimeType } };
    const prompt = { parts: [textPart, imagePart] };

    const schema = {
        type: Type.OBJECT,
        properties: {
            rhythm: { type: Type.STRING },
            heartRate: { type: Type.STRING },
            prInterval: { type: Type.STRING },
            qrsDuration: { type: Type.STRING },
            qtInterval: { type: Type.STRING },
            axis: { type: Type.STRING },
            morphology: { type: Type.STRING },
            interpretation: { type: Type.STRING },
        },
        required: ['rhythm', 'heartRate', 'prInterval', 'qrsDuration', 'qtInterval', 'axis', 'morphology', 'interpretation']
    };
    
    return callGemini(prompt, 'gemini-3-flash-preview', schema, false, systemInstr);
};

export const getIcd10Codes = async (diagnosis: string, language: Language): Promise<Icd10Code[]> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Provide ICD-10 codes for "${diagnosis}". ICD-10 is used in Uzbekistan (O'zbekiston) for official statistics and documentation. Return JSON array [{code, description}]. Output Language: ${langMap[language]}.`;
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                code: { type: Type.STRING },
                description: { type: Type.STRING },
            },
            required: ['code', 'description'],
        }
    };
    return callGemini(prompt, 'gemini-3-flash-preview', schema, false, systemInstr);
};

export const searchClinicalGuidelines = async (query: string, language: Language): Promise<GuidelineSearchResult> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Summarize clinical guidelines for "${query}". Prefer and prioritize: (1) Uzbekistan SSV (Sog'liqni Saqlash Vazirligi) approved national clinical protocols, (2) WHO and international guidelines adopted in Uzbekistan. Output Language: ${langMap[language]}.`;
    const result = await callGemini(prompt, 'gemini-3-flash-preview', undefined, true, systemInstr) as GenerateContentResponse;
    
    const sources = result.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: { uri?: string; chunk?: { text?: string } }) => ({
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri
    })) || [];
    
    return {
        summary: result.text,
        sources: sources,
    };
};

export const interpretLabValue = async (labValue: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Interpret lab value: "${labValue}". Explain clinical significance. Use O'zbekiston LITS (Laboratoriya-indekslar va tibbiy standartlar) va SI birliklariga mos izoh bering; agar birlik ko'rsatilmasa, O'zbekistonda qo'llaniladigan odatiy birliklarni nazarda tuting. Output Language: ${langMap[language]}.`;
    return callGemini(prompt, 'gemini-3-pro-preview', undefined, false, systemInstr) as Promise<string>;
};

export const generatePatientExplanation = async (clinicalText: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Translate clinical text to simple patient language. Text: "${clinicalText}". Output Language: ${langMap[language]}.`;
    return callGemini(prompt, 'gemini-3-flash-preview', undefined, false, systemInstr) as Promise<string>;
};

export const expandAbbreviation = async (abbreviation: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Expand medical abbreviation "${abbreviation}". Output Language: ${langMap[language]}.`;
    return callGemini(prompt, 'gemini-3-flash-preview', undefined, false, systemInstr) as Promise<string>;
};

export const generateDischargeSummary = async (patientData: PatientData, finalReport: FinalReport, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...rest } = patientData;
    const prompt = `Generate Discharge Summary. Patient: ${JSON.stringify(rest)}. Report: ${JSON.stringify(finalReport)}. Output Language: ${langMap[language]}.`;
    return callGemini(prompt, 'gemini-3-pro-preview', undefined, false, systemInstr) as Promise<string>;
};

export const generateInsurancePreAuth = async (patientData: PatientData, finalReport: FinalReport, procedure: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...rest } = patientData;
    const prompt = `Write Insurance Pre-Auth letter for "${procedure}". Patient: ${JSON.stringify(rest)}. Report: ${JSON.stringify(finalReport)}. Output Language: ${langMap[language]}.`;
    return callGemini(prompt, 'gemini-3-pro-preview', undefined, false, systemInstr) as Promise<string>;
};

export const calculatePediatricDose = async (drugName: string, weightKg: number, language: Language): Promise<PediatricDose> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Calculate pediatric dose for ${drugName}, weight ${weightKg}kg. Return JSON {drugName, dose, calculation, warnings}. Output Language: ${langMap[language]}.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            drugName: { type: Type.STRING },
            dose: { type: Type.STRING },
            calculation: { type: Type.STRING },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['drugName', 'dose', 'calculation', 'warnings'],
    };
    return callGemini(prompt, 'gemini-3-pro-preview', schema, false, systemInstr);
};

export const calculateRiskScore = async (scoreType: string, patientData: PatientData, language: Language): Promise<RiskScore> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...rest } = patientData;
    const prompt = `Calculate ${scoreType} score. Patient: ${JSON.stringify(rest)}. Return JSON {name, score, interpretation}. Output Language: ${langMap[language]}.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            score: { type: Type.STRING },
            interpretation: { type: Type.STRING },
        },
        required: ['name', 'score', 'interpretation'],
    };
    return callGemini(prompt, 'gemini-3-pro-preview', schema, false, systemInstr);
};

export const generatePatientEducationContent = async (report: FinalReport, language: Language): Promise<PatientEducationTopic[]> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Create 3-4 patient education topics based on report. Return JSON array [{title, content}]. Output Language: ${langMap[language]}.`;
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                language: { type: Type.STRING },
            },
            required: ['title', 'content'],
        }
    };
    return callGemini(prompt, 'gemini-3-flash-preview', schema, false, systemInstr);
};

export const continueDebate = async (
    patientData: PatientData,
    debateHistory: ChatMessage[],
    userIntervention: string,
    language: Language
): Promise<ChatMessage> => {
    const systemInstr = getSystemInstruction(language);
    const promptText = `
        User intervention: "${userIntervention}".
        Role: Council Chair.
        Task: Respond to user and continue debate. Keep in mind SSV clinical protocols and Uzbekistan context.
        LANGUAGE: ${langMap[language]}.
        History: ${JSON.stringify(debateHistory)}
    `;
    
    const prompt = buildMultimodalPrompt(promptText, patientData);
    const response = await callGemini(prompt, 'gemini-3-flash-preview', undefined, false, systemInstr) as string;
    
    return {
        id: `sys-continue-${Date.now()}`,
        author: AIModel.SYSTEM,
        content: response,
        isSystemMessage: true
    };
};

export const runScenarioAnalysis = async (
    patientData: PatientData,
    debateHistory: ChatMessage[],
    scenario: string,
    language: Language
): Promise<FinalReport> => {
    const systemInstr = getSystemInstruction(language);
    const promptText = `
        Role: Council Chair.
        Task: Analyze "What if" scenario: "${scenario}". Follow O'zbekiston SSV klinik protokollari. Recommend only drugs registered and available in Uzbekistan (savdo nomlari: Nimesil, Sumamed, Augmentin, Metformin va hokazo).
        LANGUAGE: ${langMap[language]}.
        Original Debate: ${JSON.stringify(debateHistory)}
    `;
    
    const prompt = buildMultimodalPrompt(promptText, patientData);

    const finalReportSchema = {
        type: Type.OBJECT,
        properties: {
            consensusDiagnosis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, probability: { type: Type.NUMBER }, justification: { type: Type.STRING }, evidenceLevel: { type: Type.STRING } } } },
            treatmentPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            medicationRecommendations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dosage: { type: Type.STRING }, notes: { type: Type.STRING } } } },
            rejectedHypotheses: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, reason: { type: Type.STRING } }}},
            recommendedTests: { type: Type.ARRAY, items: { type: Type.STRING } },
            unexpectedFindings: { type: Type.STRING },
            uzbekistanLegislativeNote: { type: Type.STRING },
        },
    };

    return callGemini(prompt, 'gemini-3-pro-preview', finalReportSchema, false, systemInstr) as Promise<FinalReport>;
};

export const explainRationale = async (message: ChatMessage, patientData: PatientData, debateHistory: ChatMessage[], language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...rest } = patientData;
    const prompt = `Explain medical rationale for message: "${message.content}". Reference symptoms and protocols. LANGUAGE: ${langMap[language]}. Patient: ${JSON.stringify(rest)}.`;
    return callGemini(prompt, 'gemini-3-pro-preview', undefined, false, systemInstr) as Promise<string>;
};

export const suggestCmeTopics = async (history: AnalysisRecord[], language: Language): Promise<CMETopic[]> => {
    if (history.length === 0) return [];
    const systemInstr = getSystemInstruction(language);
    const prompt = `Suggest 2-3 CME topics based on history. Return JSON array [{topic, relevance}]. LANGUAGE: ${langMap[language]}. History: ${JSON.stringify(history.map(r => r.finalReport.consensusDiagnosis[0]?.name))}.`;
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                topic: { type: Type.STRING },
                relevance: { type: Type.STRING },
            },
            required: ['topic', 'relevance'],
        },
    };
    return callGemini(prompt, 'gemini-3-flash-preview', schema, false, systemInstr);
};

export const runResearchCouncilDebate = async (
    diseaseName: string,
    onProgress: (update: ResearchProgressUpdate) => void,
    language: Language
): Promise<void> => {
    const systemInstr = getSystemInstruction(language);
    onProgress({ type: 'status', message: `Research Topic: "${diseaseName}". Gathering data...` });
    await sleep(2000);

    const specialists = [AIModel.GPT, AIModel.LLAMA, AIModel.CLAUDE];
    for (const model of specialists) {
        const translatedIntro = await callGemini(`Translate to ${langMap[language]}: "I am ${model}, ready to analyze the latest research on ${diseaseName}."`, 'gemini-3-flash-preview', undefined, false, systemInstr);
        onProgress({ type: 'message', message: { id: `${model}-${Date.now()}`, author: model, content: translatedIntro as string, isThinking: false } });
        await sleep(500);
    }
    
    onProgress({ type: 'status', message: 'Discussing innovative strategies...' });
    await sleep(2000);
    
    const prompt = `Provide detailed research report on "${diseaseName}". Use web search. Return strictly defined JSON ResearchReport. LANGUAGE: ${langMap[language]}.`;

    const researchReportSchema = {
      type: Type.OBJECT,
      properties: {
        diseaseName: { type: Type.STRING },
        summary: { type: Type.STRING },
        epidemiology: {
          type: Type.OBJECT,
          properties: {
            prevalence: { type: Type.STRING },
            incidence: { type: Type.STRING },
            keyRiskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        pathophysiology: { type: Type.STRING },
        emergingBiomarkers: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
        },
        clinicalGuidelines: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    guidelineTitle: { type: Type.STRING },
                    source: { type: Type.STRING },
                    recommendations: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                category: { type: Type.STRING },
                                details: { type: Type.ARRAY, items: { type: Type.STRING } },
                            }
                        }
                    }
                }
            }
        },
        potentialStrategies: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              mechanism: { type: Type.STRING },
              evidence: { type: Type.STRING },
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              cons: { type: Type.ARRAY, items: { type: Type.STRING } },
              riskBenefit: {
                type: Type.OBJECT,
                properties: {
                  risk: { type: Type.STRING },
                  benefit: { type: Type.STRING },
                },
              },
              developmentRoadmap: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        stage: { type: Type.STRING },
                        duration: { type: Type.STRING },
                        cost: { type: Type.STRING },
                    }
                }
              },
              molecularTarget: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    pdbId: { type: Type.STRING }
                }
              },
              ethicalConsiderations: { type: Type.ARRAY, items: { type: Type.STRING } },
              requiredCollaborations: { type: Type.ARRAY, items: { type: Type.STRING } },
              companionDiagnosticNeeded: { type: Type.STRING },
            },
          },
        },
        pharmacogenomics: {
            type: Type.OBJECT,
            properties: {
                relevantGenes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            gene: { type: Type.STRING },
                            mutation: { type: Type.STRING },
                            impact: { type: Type.STRING },
                        }
                    }
                },
                targetSubgroup: { type: Type.STRING },
            }
        },
        patentLandscape: {
            type: Type.OBJECT,
            properties: {
                competingPatents: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            patentId: { type: Type.STRING },
                            title: { type: Type.STRING },
                            assignee: { type: Type.STRING },
                        }
                    }
                },
                whitespaceOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        },
        relatedClinicalTrials: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    trialId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    status: { type: Type.STRING },
                    url: { type: Type.STRING },
                }
            }
        },
        strategicConclusion: { type: Type.STRING },
        sources: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    uri: { type: Type.STRING },
                }
            }
        }
      },
    };

    try {
        const result = await callGemini(prompt, 'gemini-3-pro-preview', researchReportSchema, true, systemInstr) as GenerateContentResponse;
        
        const reportData: ResearchReport = JSON.parse(result.text.replace(/^```json\s*|```\s*$/g, '').trim());

        reportData.sources = result.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: { uri?: string; chunk?: { text?: string } }) => ({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri
        })).filter((v: { uri?: string }) => v.uri) || [];

        onProgress({ type: 'report', data: reportData });
    } catch (e) {
        logger.error("Research report generation failed:", e);
        const friendlyError = getUserFriendlyError(e, "Tadqiqot hisoboti yaratishda xatolik yuz berdi.");
        onProgress({ type: 'error', message: friendlyError });
    }
};

// --- DORI TOOLLAR ---

const getDrugToolSystemInstruction = (language: Language): string => {
    const til = langMap[language];
    return `Siz klinik farmakolog va dori-darmonlar bo'yicha AI assistentsiz.
Javobni faqat ${til} tilida, STRICT JSON formatida yozing. 
Faqat O'zbekistonda mavjud dori vositalari va SSV klinik protokollariga tayangan holda javob bering.
JSON tashqarisida hech qanday matn yozmang.`;
};

export const checkDrugInteractions = async (drugs: string[], language: Language): Promise<{
    severity: 'High' | 'Moderate' | 'Low' | 'None';
    description: string;
    clinicalSignificance: string;
    recommendations: string[];
}> => {
    const systemInstr = getDrugToolSystemInstruction(language);
    const prompt = `Quyidagi dorilarni birga qabul qilish xavfsizmi? Dorilar: ${drugs.join(', ')}.

JSON formatda faqat quyidagilarni qaytaring:
{
  "severity": "High | Moderate | Low | None",
  "description": "O'zaro ta'sirning qisqa tavsifi (2-3 jumla)",
  "clinicalSignificance": "Bemor uchun klinik ahamiyati (nimalarga e'tibor berish kerak)",
  "recommendations": [
    "Qaysi dori dozasini o'zgartirish yoki bekor qilish kerak",
    "Monitoring (bosim, EKG, INR va h.k.) bo'yicha tavsiyalar",
    "Qachon shoshilinch shifokorga murojaat qilish kerak"
  ]
}

Output Language: ${langMap[language]}.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            severity: { type: Type.STRING, enum: ['High', 'Moderate', 'Low', 'None'] },
            description: { type: Type.STRING },
            clinicalSignificance: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    };

    const raw = await callGemini(prompt, 'gemini-2.5-flash', schema, false, systemInstr, true, 640) as Record<string, unknown>;

    const allowedSeverity = ['High', 'Moderate', 'Low', 'None'] as const;
    const sev = typeof raw.severity === 'string' && allowedSeverity.includes(raw.severity as any)
        ? (raw.severity as (typeof allowedSeverity)[number])
        : 'None';

    const recs = Array.isArray(raw.recommendations)
        ? (raw.recommendations as unknown[]).map(r => String(r)).filter(Boolean)
        : [];

    return {
        severity: sev,
        description: String((raw as any).description || ''),
        clinicalSignificance: String((raw as any).clinicalSignificance || ''),
        recommendations: recs,
    };
};

export const identifyDrugByName = async (drugName: string, language: Language): Promise<{
    name: string;
    activeIngredient: string;
    dosage: string;
    indications: string[];
    contraindications: string[];
    sideEffects: string[];
    dosageInstructions: string;
    availabilityInUzbekistan: string;
    priceRange: string;
}> => {
    const systemInstr = getDrugToolSystemInstruction(language);
    const prompt = `Dori: \"${drugName}\".

JSON formatda faqat quyidagilarni qaytaring:
{
  "name": "Savdo nomi",
  "activeIngredient": "Faol modda",
  "dosage": "Doza (masalan, 500 mg, 1 tabletka kuniga 2 marta)",
  "indications": ["Asosiy ko'rsatmalar"],
  "contraindications": ["Asosiy qarshi ko'rsatmalar"],
  "sideEffects": ["Asosiy nojo'ya ta'sirlar"],
  "dosageInstructions": "Qanday va qanchalik tez-tez qabul qilish",
  "availabilityInUzbekistan": "Retsept bilan/retseptsiz, qaysi analoglar mavjud",
  "priceRange": "Taxminiy narx (so'm)"
}

O'ZBEKISTON KONTEKSTI: faqat mamlakatimizda mavjud dorilar ma'lumotlarini bering. Output Language: ${langMap[language]}.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            activeIngredient: { type: Type.STRING },
            dosage: { type: Type.STRING },
            indications: { type: Type.ARRAY, items: { type: Type.STRING } },
            contraindications: { type: Type.ARRAY, items: { type: Type.STRING } },
            sideEffects: { type: Type.ARRAY, items: { type: Type.STRING } },
            dosageInstructions: { type: Type.STRING },
            availabilityInUzbekistan: { type: Type.STRING },
            priceRange: { type: Type.STRING }
        }
    };

    const raw = await callGemini(prompt, 'gemini-2.5-flash', schema, false, systemInstr, true, 640) as Record<string, unknown>;
    const toArray = (v: unknown): string[] => Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : [];

    return {
        name: String((raw as any).name || ''),
        activeIngredient: String((raw as any).activeIngredient || ''),
        dosage: String((raw as any).dosage || ''),
        indications: toArray((raw as any).indications),
        contraindications: toArray((raw as any).contraindications),
        sideEffects: toArray((raw as any).sideEffects),
        dosageInstructions: String((raw as any).dosageInstructions || ''),
        availabilityInUzbekistan: String((raw as any).availabilityInUzbekistan || ''),
        priceRange: String((raw as any).priceRange || ''),
    };
};

export const identifyDrugByImage = async (base64Image: string, mimeType: string, language: Language): Promise<{
    name: string;
    activeIngredient: string;
    dosage: string;
    indications: string[];
    contraindications: string[];
    sideEffects: string[];
    dosageInstructions: string;
    availabilityInUzbekistan: string;
    priceRange: string;
}> => {
    const systemInstr = getDrugToolSystemInstruction(language);
    const prompt = {
        parts: [
            { text: `Suratdagi dori vositasini aniqlang.

JSON formatda faqat quyidagilarni qaytaring:
{
  "name": "Savdo nomi",
  "activeIngredient": "Faol modda",
  "dosage": "Doza (masalan, 500 mg, 1 tabletka kuniga 2 marta)",
  "indications": ["Asosiy ko'rsatmalar"],
  "contraindications": ["Asosiy qarshi ko'rsatmalar"],
  "sideEffects": ["Asosiy nojo'ya ta'sirlar"],
  "dosageInstructions": "Qanday qabul qilish (ovqatdan oldin/keyin, necha marta)",
  "availabilityInUzbekistan": "Qayerda va qanday shaklda mavjud",
  "priceRange": "Taxminiy narx (so'm)"
}

O'ZBEKISTON KONTEKSTI: faqat mamlakatimizda mavjud dorilar bo'yicha ma'lumot bering. Output Language: ${langMap[language]}.` },
            { inlineData: { mimeType, data: base64Image } }
        ]
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            activeIngredient: { type: Type.STRING },
            dosage: { type: Type.STRING },
            indications: { type: Type.ARRAY, items: { type: Type.STRING } },
            contraindications: { type: Type.ARRAY, items: { type: Type.STRING } },
            sideEffects: { type: Type.ARRAY, items: { type: Type.STRING } },
            dosageInstructions: { type: Type.STRING },
            availabilityInUzbekistan: { type: Type.STRING },
            priceRange: { type: Type.STRING }
        }
    };

    const raw = await callGemini(prompt, 'gemini-2.5-flash', schema, false, systemInstr, true, 640) as Record<string, unknown>;
    const toArray = (v: unknown): string[] => Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : [];

    return {
        name: String((raw as any).name || ''),
        activeIngredient: String((raw as any).activeIngredient || ''),
        dosage: String((raw as any).dosage || ''),
        indications: toArray((raw as any).indications),
        contraindications: toArray((raw as any).contraindications),
        sideEffects: toArray((raw as any).sideEffects),
        dosageInstructions: String((raw as any).dosageInstructions || ''),
        availabilityInUzbekistan: String((raw as any).availabilityInUzbekistan || ''),
        priceRange: String((raw as any).priceRange || ''),
    };
};
