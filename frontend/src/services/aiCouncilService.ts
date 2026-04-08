import { GoogleGenAI } from '@google/genai';
import type {
    PatientData,
    Diagnosis,
    FinalReport,
    ProgressUpdate,
    ChatMessage,
    DrugInteraction,
    EcgReport,
    UziUttReport,
    UziUttUrgency,
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
import { normalizeConsensusDiagnosis, normalizeFolkMedicine, normalizeNutritionPrevention } from '../types';
import { AIModel } from "../constants/specialists";
import { AI_SPECIALISTS } from "../constants";
import { Language } from "../i18n/LanguageContext";
import * as caseService from './caseService';
import { logger } from '../utils/logger';
import { handleError, getUserFriendlyError } from '../utils/errorHandler';
import { retry } from '../utils/retry';
import { getUzbekistanContextForAI } from '../constants/uzbekistanHealthcare';

// --- GEMINI AI (single provider) ---
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const validKey = !!(GEMINI_API_KEY && GEMINI_API_KEY !== 'your-gemini-api-key-here');

let _geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!validKey) {
    throw new Error('Gemini AI xizmati sozlanmagan. Iltimos, VITE_GEMINI_API_KEY ni .env faylga kiriting.');
  }
  if (!_geminiClient) {
    _geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return _geminiClient;
}

/*
 * Asosiy: 2.5 flash (barqaror/tez). 3-preview ba'zan 503 — zaxira zanjirida keyinroq.
 * Override: VITE_GEMINI_MODEL_FAST / VITE_GEMINI_MODEL_PRO
 */
const MODEL_FAST =
    (import.meta.env.VITE_GEMINI_MODEL_FAST as string | undefined)?.trim() || 'gemini-2.5-flash';
const MODEL_PRO =
    (import.meta.env.VITE_GEMINI_MODEL_PRO as string | undefined)?.trim() || 'gemini-2.5-pro';
/** Aliases used across council/debate */
const DEPLOY_FAST = MODEL_FAST;
const DEPLOY_PRO = MODEL_PRO;

/** Zaxira: 3-preview, keyin 2.0, keyin Pro variantlari */
const GEMINI_FALLBACK_AFTER_PRO: readonly string[] = [
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3-pro-preview',
    'gemini-2.5-pro',
];
const GEMINI_FALLBACK_AFTER_FLASH: readonly string[] = [
    'gemini-3-flash-preview',
    'gemini-2.0-flash',
    'gemini-3-pro-preview',
    'gemini-2.5-pro',
];

/** Map model label to Gemini model name */
function mapModel(modelLabel: string): string {
  const m = (modelLabel || '').toLowerCase();
  if (m.includes('flash') || m.includes('mini')) return MODEL_FAST;
  return MODEL_PRO;
}

const langMap: Record<Language, string> = {
    'uz-L': 'Uzbek (Latin script)',
    'uz-C': 'Uzbek (Cyrillic script)',
    'ru': 'Russian',
    'en': 'English'
};

/**
 * Bemor shikoyatlaridan kasallikka xos 3 ta aniqlashtiruvchi savol hosil qiladi.
 * AI ishlamaganda ham shablon emas, balki shu holatga bog'liq savollar chiqadi.
 */
export function getCaseBasedClarificationQuestions(data: PatientData, language: Language): string[] {
    const complaints = (data?.complaints ?? '').trim();
    if (!complaints || complaints.length < 3) return [];

    const parts = complaints
        .split(/[.,;]|\s+va\s+|\s+ham\s+/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 2 && s.length < 80);
    const symptoms = [...new Set(parts)].slice(0, 3);
    if (symptoms.length === 0) return [];

    const templates: Record<Language, (s: string) => string> = {
        'uz-L': (s) => [
            `${s} qachondan boshlanib, qanday kechmoqda?`,
            `${s} uchun qanday davolash yoki tekshiruv qilingan?`,
            `${s} bilan birga boshqa shikoyatlar ham bormi?`,
        ],
        'uz-C': (s) => [
            `${s} қачондан бошланиб, қандай кечмоқда?`,
            `${s} учун қандай даволаш ёки текширув қилинган?`,
            `${s} билан бирга бошқа шикоятлар ҳам борми?`,
        ],
        'ru': (s) => [
            `Когда началось «${s}» и как протекает?`,
            `Какое лечение или обследование проводилось по поводу «${s}»?`,
            `Есть ли другие жалобы вместе с «${s}»?`,
        ],
        'en': (s) => [
            `When did "${s}" start and how does it progress?`,
            `What treatment or tests were done for "${s}"?`,
            `Any other symptoms along with "${s}"?`,
        ],
    };
    const t = templates[language];
    const out: string[] = [];
    if (symptoms.length === 1) {
        out.push(t(symptoms[0])[0], t(symptoms[0])[1], t(symptoms[0])[2]);
    } else if (symptoms.length === 2) {
        out.push(t(symptoms[0])[0], t(symptoms[1])[1], t(symptoms[0])[2]);
    } else {
        out.push(t(symptoms[0])[0], t(symptoms[1])[1], t(symptoms[2])[2]);
    }
    return out.filter(Boolean).slice(0, 3);
}

// --- DYNAMIC SYSTEM INSTRUCTIONS (Kuchli va Aqlli) ---
const getSystemInstruction = (language: Language): string => {
    const baseInstruction = `
    SIZ - TIBBIYOT SOHASIDAGI SUPPER-INTELLEKTUAL, AQLLI AI TIZIMISIZ.
    Vazifangiz: shifokorga ENG ANIQ, DALILLI va XAVFSIZ yechim taqdim etish.
    
    AQLIYAT QOIDALARI:
    1. Har bir xulosa uchun QADAMMA-QADAM MANTIQIY ZANJIR (chain-of-thought) yozing: "Sabab A  ->  natija B  ->  shuning uchun C."
    2. Differensial tashxisda har bir variant uchun "Nega bu ehtimol?" va "Nega boshqasi kamroq?" javob bering.
    3. Ishonch darajasini aniq bering (yuqori/o'rta/past) va qaysi ma'lumot yetishmasligi aniqlikni kamaytirishini ayting.
    4. XAVFSIZLIK: Bemor allergiyasi, joriy dori-darmonlar va buyrak/jigar funksiyasi bo'yicha har doim o'ylab bering; xavfli aralashuvlarni darhol bildiring.
    5. Qizil bayroqlar: keskin og'riq, nafas qisilishi, xushni yo'qotish, og'ir anemiya, septik belgilar kabi holatlarda shoshilinch tavsiya bering.
    6. ANATOMIK MANTIQ: Aniq anatomik jihatdan imkonsiz iboralarni (masalan, "tovonimdagi yurak", "oyog'im ichidagi jigar", bosh suyagida oshqozon va hokazo) so'zma-so'z qabul qilmang. Bunday hollarda:
       - ularni AQLGA TO'G'RI KELMAYDIGAN yoki ehtimol noto'g'ri yozilgan deb baholang;
       - bunday joylashuvga asoslangan tashxis/davolash bermang;
       - bemor/shifokorga muloyimlik bilan bu anatomik jihatdan mumkin emasligini tushuntiring va kerak bo'lsa to'g'ri joylashuvni aniqlashtirish uchun savol bering.
    7. FIZIOLOGIYA VA FIZIONOMIYA: Har bir holatda bemorning YOSHI, JINSI, VAZNI, VITAL KO'RSATKICHLARI (BP, yurak urishi, harorat, SpO2, nafas soni) va umumiy ko'rinishi (kaxeksiya, semizlik, shish, sianoz, rangparlik, dismorfik belgilar) NI INOBATGA OLING.
       - OB'EKTIV KO'RIK (VITAL): Qon bosimi, puls, harorat, SpO2, nafas soni shifokor tomonidan bemor ma'lumotlariga KIRITILGAN. Konsilium/munozarada shifokordan bu ma'lumotlarni HECH QACHON so'ramang — ular allaqachon berilgan, faqat xulosangizda hisobga oling.
       - LABORATORIYA VA DIAGNOSTIKA HUJJATLARI: Agar bemor laboratoriya natijalari, rentgen/MRT/CT skaner yoki boshqa tibbiy hujjatlar yuklagan bo'lsa — ularni TO'LIQ TAHLIL QILING, xulosangizda ishlating va shifokordan bu ma'lumotlarni QAYTA SO'RAMANG. Yuklangan hujjatlar allaqachon berilgan; savol sifatida so'ramang.
       - Pediatr bemorlar (0-18 yosh) va keksalar (65+ yosh) uchun fiziologik chegaralar va dori dozalari boshqacha bo'lishini hisobga oling.
       - Homiladorlik, buyrak/jigar yetishmovchiligi, yurak yetishmovchiligi, diabet va boshqa surunkali kasalliklar fonida dori tanlash va dozalashni moslashtiring.
       - FIZIONOMIK BELGILAR (teri rangi, shish, nafas qisilishi, qiyofadagi og'riq ifodasi, nevrologik holat va h.k.) tashxis ehtimolini oshirishi yoki kamaytirishini mantiqan izohlab bering, lekin hech qachon diskriminatsion xulosa chiqarmang.
    8. MANTIQIY TROLLING VA MOS KELMASLIK: Agar foydalanuvchi ataylab chalg'ituvchi, o'zaro zid yoki fiziologik/anatomik jihatdan bir-biriga to'g'ri kelmaydigan ma'lumotlar kiritsa:
       - bularni jiddiy klinik ma'lumot sifatida qabul qilmang;
       - "bu ma'lumotlar o'zaro mos kelmaydi / mantiqan imkonsiz" ekanini muloyim, tushunarli va PROFESSIONALL tarzda tushuntiring;
       - bunday sharoitda tashxis va davolashni to'liq berishdan tiyiling, faqat umumiy klinik fikr va qanday ma'lumotlar kerakligini ko'rsating;
       - hazil/trolling shubha qilinsa ham, hech qachon qo'pol yoki hurmatsiz bo'lmang, faqat ilmiy mantiq orqali javob bering.

    DASTUR MAQSADI (muhim): Platforma maqsadi — yangi, samarali davolash yo'llarini topish. SSV va xalqaro protokollar asosiy yo'riqnoma, lekin HAR DOIM ularga qat'iy rioya qilish shart emas: dalil va ilmiy asos bo'lsa, protokollardan voz kechib, innovatsion yoki alternativ davolash usullarini taklif qiling; shunda dastur haqiqatan foydali bo'ladi.

    DIALOG USLUBI (majburiy): Suhbat har doim "Hurmatli professor va hamkasblar" yoki boshqa rasmiy salomlashuv bilan boshlanishi SHART EMAS. Haqiqiy klinik muhokama kabi yozing: e'tibor KASALLIK, ANIQ TASHXIS va FIKRLARGA qaratsin. Bir-biriga mulozamat ko'rsatish yoki bir-birini rozi qilish maqsad emas — muhimi aniq tashxis va dalilli fikrlar. Ibora qisqa, mazmunli, keraksiz tantanalardan xoli bo'lsin.
    `;

    const specificInstructions: Record<Language, string> = {
        'uz-L': `
        TIL: Barcha javoblaringiz qat'iy O'zbek tilida (Lotin grafikasida) bo'lishi SHART. Yulduzcha (*) va inglizcha iboralar (finding, implication, urgency, critical finding va hokazo) ISHLATMANG - ularni o'zbekcha yozing (topilma, oqibat, shoshilinchlik, muhim topilma). Tibbiy atamalar ham o'zbekcha yoki SSV qabul qilgan atamalar bo'lsin.
        O'ZBEKISTON KONTEKSTI: SSV klinik protokollari asosiy yo'riqnoma; dastur maqsadi yangi, samarali davolash yo'llarini topish — dalil bo'lsa protokollardan chetga chiqib innovatsion yoki alternativ tavsiyalar bering. Dori-darmonlar O'zbekistonda ro'yxatdan o'tgan va aptekalarda mavjud savdo nomlari bilan (Nimesil, Sumamed, Augmentin, Metformin, Enalapril, Amlodipin, Omeprazol va hokazo); yangi yoki off-label taklif qilsangiz, sababini ko'rsating.
        TERMINOLOGIYA: O'zbek tibbiyot terminologiyasi va SSV qabul qilgan atamalar.
        `,
        'uz-C': `TIL: Barcha javoblaringiz qat'iy O'zbek tilida (Kirill yozuvida) bo'lishi SHART.
        O'ZBEKISTON KONTEKSTI: SSV protokollari asosiy yo'riqnoma; dastur maqsadi yangi davolash yo'llarini topish — dalil bo'lsa protokollardan voz kechib samarali takliflar bering. Dori-darmonlar O'zbekistonda mavjud savdo nomlari bilan (Nimesil, Sumamed, Augmentin va hokazo).
        TERMINOLOGIYA: O'zbek tibbiyot terminologiyasi va SSV qabul qilgan atamalar.`,
        'ru': `YAZYK: Vse vashi otvety DOLZHNY byt strogo na russkom yazyke.
        KONTEKST UZBEKISTANA: Klinicheskie protokoly SSV — osnovnoye rukovodstvo; tsel platformy — nayti novye effektivnyye metody lecheniya. Pri nalichii dokazatelstv dopuskayetsya otkloneniye ot protokolov i innovatsionnyye/alternativnyye rekomendatsii. Preparaty — zaregistrirovannyye v Uzbekistane (Nimesil, Sumamed, Augmentin, Metformin, Enalapril i t.d.).
        TERMINOLOGIYA: Professionalnaya meditsinskaya terminologiya na russkom; pri neobhodimosti - terminy, prinyatye v Uzbekistane.
        `,
        'en': `
        LANGUAGE: All your responses MUST be strictly in English.
        UZBEKISTAN CONTEXT: SSV clinical protocols are the baseline; the platform's goal is to find new, effective treatment approaches. When evidence supports it, you may deviate from protocols and suggest innovative or alternative options. Recommend drugs registered and available in Uzbekistan (e.g. Nimesil, Sumamed, Augmentin, Metformin, Enalapril, Amlodipine, Omeprazole); if suggesting off-protocol or off-label, state the rationale.
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
    AMALIY YORDAM (majburiy): Javoblaringiz shifokor darhol qo'llashi mumkin bo'lsin. Dori nomi + aniq doza + kuniga necha marta + davomiyligi; davolash rejasi 1-qadam, 2-qadam tarzida; SSV protokolga havola yoki agar taklif protokoldan farq qilsa — protokoldan voz kechish sababini (dalil asosida) ko'rsating; "darhol qilish kerak" va "keyinroq/kuzatuv" ni ajrating. Umumiy so'zlar o'rniga konkret, amaliy tavsiyalar bering.
    ANIQLIK (majburiy): (1) Faqat kiritilgan ma'lumot va klinik dalillarga asoslangan xulosa chiqaring; ma'lumot yetishmasa "Tasdiqlash uchun ... tekshiruv kerak" deb aniq yozing. (2) Har bir tashxis uchun probability (0-100) ni faqat dalil kuchiga mos RAQAM sifatida bering — KUCHLI dalil=90-97%, o'rtacha=85-89%, zaif=70-84%, shubhali=<70%. Taxminiy yoki "chiroyli" shablonlar (masalan doim 60/25/20, 50/50, 75/25) ISHLATMANG. Bir nechta differensial tashxis bo'lsa, ular bir-birini istisno qiluvchi bo'lishi uchun probability lar yig'indisi 100% ga yaqin bo'lishi kerak. (3) reasoningChain va justification da "nima uchun shunday" savoliga aniq javob bo'lsin; umumiy iboralardan saqlaning. (4) SSV protokol havolasi yoki protokoldan chetga chiqish sababi (dalil bilan). (5) Taxminiy tashxisni yakuniy deb yozmang; differensial tashxisda eng ehtimolini birinchi qo'ying va dalil asosini ko'rsating.
    `;
};

// --- HELPER FUNCTIONS ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function tryRepairTruncatedJson(raw: string): unknown | null {
    let s = raw.trim();
    if (!s) return null;

    // 0) Oxiridagi "axlat" satrlarni olib tashlash (masalan, faqat "2" yoki notog'ri bo'laklar)
    const lines = s.split('\n');
    while (lines.length > 0) {
        const last = lines[lines.length - 1].trim();
        if (last && !last.includes(':') && !last.includes('}') && !last.includes(']')) {
            lines.pop();
            continue;
        }
        break;
    }
    s = lines.join('\n').trim();
    if (!s) return null;

    const fixBrackets = (text: string): string => {
        let fixed = text;
        const openCurly = (fixed.match(/{/g) || []).length;
        const closeCurly = (fixed.match(/}/g) || []).length;
        for (let i = 0; i < openCurly - closeCurly; i++) fixed += '}';
        const openSquare = (fixed.match(/\[/g) || []).length;
        const closeSquare = (fixed.match(/]/g) || []).length;
        for (let i = 0; i < openSquare - closeSquare; i++) fixed += ']';
        return fixed;
    };

    /** Close brackets in reverse order of opening (so { "a": [ { → " } ] }) */
    const closeBracketsInOrder = (text: string): string => {
        const stack: string[] = [];
        let inStr = false;
        let escaped = false;
        for (let i = 0; i < text.length; i++) {
            if (escaped) { escaped = false; continue; }
            if (text[i] === '\\' && inStr) { escaped = true; continue; }
            if (text[i] === '"') { inStr = !inStr; continue; }
            if (!inStr) {
                if (text[i] === '{') stack.push('}');
                else if (text[i] === '[') stack.push(']');
                else if (text[i] === '}' || text[i] === ']') stack.pop();
            }
        }
        return text + stack.join('');
    };

    // 0.5) Kesilgan string ichida: oxirida ochiq qator (justification, reason, va h.k.)
    if (s.startsWith('[') || s.startsWith('{')) {
        const trimmed = s.replace(/,\s*$/, '');
        const inString = (str: string): boolean => {
            let inStr = false;
            let escaped = false;
            for (let i = 0; i < str.length; i++) {
                if (escaped) { escaped = false; continue; }
                if (str[i] === '\\') { escaped = true; continue; }
                if ((str[i] === '"') && !escaped) inStr = !inStr;
            }
            return inStr;
        };
        if (/[\w\u0400-\u04FF\u0000-\u007F]\s*$/.test(trimmed) && inString(trimmed)) {
            const withQuote = trimmed + '"';
            try {
                return JSON.parse(closeBracketsInOrder(withQuote));
            } catch {
                try {
                    return JSON.parse(fixBrackets(withQuote));
                } catch {
                    //
                }
            }
        }
    }

    // 0.6) Object root: oxirida ochiq string (masalan reasoningChain ichida kesilgan)
    if (s.startsWith('{')) {
        const inString = (str: string): boolean => {
            let inStr = false, escaped = false;
            for (let i = 0; i < str.length; i++) {
                if (escaped) { escaped = false; continue; }
                if (str[i] === '\\' && inStr) { escaped = true; continue; }
                if (str[i] === '"') inStr = !inStr;
            }
            return inStr;
        };
        const trimmed = s.replace(/,\s*$/, '').trim();
        if (trimmed.length > 10 && inString(trimmed) && !/[\"\]\}]\s*$/.test(trimmed)) {
            const withQuote = trimmed + '"';
            try {
                return JSON.parse(closeBracketsInOrder(withQuote));
            } catch {
                try {
                    return JSON.parse(fixBrackets(withQuote));
                } catch {
                    //
                }
            }
        }
    }

    // 1) Umumiy tuzatish: oxiridagi vergulni olib tashlash va figurali/qavslarni yopish
    if (s.startsWith('{') || s.startsWith('[')) {
        s = s.replace(/,\s*$/, '');
        const genericFixed = fixBrackets(s);
        try {
            return JSON.parse(genericFixed);
        } catch {
            //
        }
    }

    // 2) Kesilgan massiv: oxirida ochiq qator (differensial tashxis ro'yxati)
    if (s.startsWith('[')) {
        const closeRepairs = [
            (s.trimEnd().replace(/,\s*$/, '') || s) + ']',
            s + '"]}]',
            s + '"]',
            s + ']',
        ];
        for (const t of closeRepairs) {
            try {
                return JSON.parse(t);
            } catch {
                continue;
            }
        }
        const endsWithWord = /[\w\u0400-\u04FF]\s*$/.test(s);
        if (endsWithWord) {
            const inStr = (str: string): boolean => {
                let inS = false, esc = false;
                for (let i = 0; i < str.length; i++) {
                    if (esc) { esc = false; continue; }
                    if (str[i] === '\\') { esc = true; continue; }
                    if (str[i] === '"') inS = !inS;
                }
                return inS;
            };
            if (inStr(s)) {
                try {
                    return JSON.parse(closeBracketsInOrder(s + '"'));
                } catch {
                    //
                }
            }
        }
        try {
            return JSON.parse(fixBrackets(endsWithWord ? s + '"' : s));
        } catch {
            //
        }
    }

    // 3) Doktor hisobotiga xos patchlar (treatmentPlan/medications kesilganda)
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

/** Mobil qurilma (telefon) - sekin tarmoq va kesilishlarda ko'proq qayta urinish kerak */
const isMobile = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 768);
};

// Simulated RAG: Get relevant context from past cases (serverdan yuborilgan yoki local)
const getRelevantHistoryContext = (currentComplaints: string, pastCasesIn?: import('../types').AnonymizedCase[]): string => {
    try {
        const pastCases = pastCasesIn && pastCasesIn.length > 0 ? pastCasesIn : caseService.getAnonymizedCases();
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

/**
 * Core Gemini API call. Supports text & multimodal (images via base64 inlineData).
 */
const callGemini = async (
    prompt: string | { parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> },
    model: string = MODEL_PRO,
    responseSchema?: unknown,
    _useSearch: boolean = false,
    systemInstruction: string = '',
    shouldRetry: boolean = true,
    maxOutputTokens?: number
): Promise<unknown> => {
    const geminiModel = mapModel(model);
    const wantJson = !!responseSchema;
    const sys = systemInstruction || "Siz professional tibbiy AI yordamchisiz. O'zbekiston kontekstida javob bering; protokollar asos, yangi samarali davolash yo'llarini topish maqsadida dalil bo'lsa protokollardan voz kechish mumkin.";

    const buildContents = (): string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> => {
        if (typeof prompt === 'string') {
            const userText = wantJson ? `${prompt}\n\nMuhim: Javobni FAQAT toza JSON formatida qaytaring.` : prompt;
            return `${sys}\n\n${userText}`;
        }
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
            { text: sys + '\n\n' + (wantJson ? 'Muhim: Javobni FAQAT toza JSON formatida qaytaring.\n\n' : '') },
        ];
        for (const part of prompt.parts) {
            if ('text' in part) parts.push({ text: part.text });
            else if ('inlineData' in part) parts.push({ inlineData: part.inlineData });
        }
        return parts;
    };

    const modelsToTry: string[] = [];
    const pushModel = (id: string) => {
        if (id && !modelsToTry.includes(id)) modelsToTry.push(id);
    };
    pushModel(geminiModel);
    const extras = geminiModel === MODEL_PRO || geminiModel === DEPLOY_PRO
        ? GEMINI_FALLBACK_AFTER_PRO
        : GEMINI_FALLBACK_AFTER_FLASH;
    for (const id of extras) pushModel(id);

    const executeCall = async (modelId?: string): Promise<unknown> => {
        const useModel = modelId ?? geminiModel;
        const contents = buildContents();
        const ai = getGemini();
        const isPro = (geminiModel === MODEL_PRO || geminiModel === DEPLOY_PRO);
    const config: { temperature?: number; maxOutputTokens?: number; responseMimeType?: string } = {
            temperature: 0.1,
            maxOutputTokens: maxOutputTokens ?? (isPro ? 8192 : 4096),
        };
        if (wantJson) config.responseMimeType = 'application/json';

        const response = await ai.models.generateContent({
            model: useModel,
            contents: typeof contents === 'string' ? contents : [{ role: 'user', parts: contents }],
            config,
        });
        const text = (response.text ?? '').trim();

        if (wantJson && text) {
            let cleaned = text;
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```\s*$/, '').trim();
            }
            const jsonStart = Math.min(...['{', '['].map(ch => cleaned.indexOf(ch)).filter(i => i >= 0), Infinity);
            const candidate = jsonStart !== Infinity ? cleaned.slice(jsonStart) : cleaned;
            try {
                return JSON.parse(candidate);
            } catch {
                const repaired = tryRepairTruncatedJson(candidate);
                if (repaired == null) {
                    logger.error('Failed to parse JSON from Gemini:', candidate?.slice(0, 500));
                    const err = new Error("AI_JSON_PARSE_ERROR");
                    (err as Error & { cause?: string }).cause = 'parse_json';
                    throw err;
                }
                return repaired;
            }
        }
        return text;
    };

    const executeWithModelFallback = async (): Promise<unknown> => {
        let lastErr: unknown;
        for (let idx = 0; idx < modelsToTry.length; idx++) {
            const m = modelsToTry[idx];
            try {
                return await executeCall(m);
            } catch (e) {
                lastErr = e;
                const msg = String((e as Error & { message?: string })?.message ?? e).toLowerCase();
                const is404 = /404|not found|NOT_FOUND/i.test(msg);
                const is503 = /503|unavailable|overloaded|service.?unavailable/i.test(msg);
                const isRate = /429|resource_exhausted|rate_limit_exceeded|quota/i.test(msg);
                if (is404 || is503 || isRate) {
                    logger.warning(
                        'Gemini model %s not available (%s), trying next',
                        m,
                        isRate ? '429' : (is503 ? '503' : '404')
                    );
                    // 429: limit tushishi uchun kutish; keyingi model boshqa kvota bo‘lishi mumkin
                    if (isRate) {
                        const base = 2500 * (idx + 1);
                        await sleep(Math.min(15000, base + Math.floor(Math.random() * 1200)));
                    } else if (is503) {
                        await sleep(2000 + idx * 800);
                    }
                    continue;
                }
                throw e;
            }
        }
        throw lastErr;
    };

    if (shouldRetry) {
        const mobile = isMobile();
        try {
            return await retry(executeWithModelFallback, {
                maxRetries: mobile ? 4 : 3,
                initialDelay: 2000,
                maxDelay: 28000,
                backoffMultiplier: 2,
                retryableErrors: [
                    'network', 'timeout', 'fetch', 'connection', '503', 'unavailable', 'overloaded',
                    'service unavailable', 'parse_json', "noto'g'ri", 'javob', 'invalid json',
                    'failed to parse', 'rate_limit_exceeded', '429', 'resource_exhausted', 'quota',
                ],
            });
        } catch (error) {
            logger.error(`Error calling Gemini (model=${geminiModel}) after retries:`, error);
            throw new Error(getUserFriendlyError(error, 'AI xizmati bilan muammo yuz berdi.'));
        }
    }
    try {
        return await executeWithModelFallback();
    } catch (error) {
        logger.error(`Error calling Gemini (model=${geminiModel}):`, error);
        throw new Error(getUserFriendlyError(error, 'AI xizmati bilan muammo yuz berdi.'));
    }
};

/** Build multimodal prompt for Gemini (used by stream fallback). */
const buildMultimodalMessages = (
    _systemInstr: string,
    prompt: { parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> },
    _wantJson: boolean
): { parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> } => prompt;

// Helper to construct multimodal prompts (Text + Images)
const buildMultimodalPrompt = (introText: string, data: PatientData, pastCases?: import('../types').AnonymizedCase[]) => {
    const { attachments, ...rest } = data;
    const textData = JSON.stringify(rest);
    const historyContext = getRelevantHistoryContext(data.complaints, pastCases);
    
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: `${introText}\n\n${historyContext}\n\nPATIENT CLINICAL DATA (Structured): ${textData}` }
    ];

    if (attachments && attachments.length > 0) {
        parts[0].text += `\n\n[MAJBURIY]: Bemor ${attachments.length} ta tibbiy hujjat (laboratoriya, rentgen, MRT/CT va h.k.) yuklagan. Ularni TO'LIQ TAHLIL QILING va xulosangizda ishlating. Bu hujjatlardagi ma'lumotlarni shifokordan QAYTA SO'RAMANG — ular allaqachon berilgan.`;
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

/** Doktor tez tahlili uchun: tarix kontekstisiz, minimal prompt - maksimal tezlik */
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


// --- SINGLE DOCTOR MODE (TEZKOR - faqat doktor profilida) ---
/** Tez tahlil: qisqa tizim - tez qaytish uchun */
const getFastDoctorSystemInstruction = (language: Language): string => {
    const til = langMap[language];
    return `Siz shifokor uchun amaliy tibbiy yordamchisiz. Javob: ${til}, FAQAT JSON.
QOIDALAR: Tashxis nomi aniq; justification 2-3 jumla dalilli; treatmentPlan 3-5 aniq qadam; medications: O'zbekistonda mavjud savdo nomi + doza + davomiylik; uzbekProtocolMatch: SSV protokolga mos yoki protokoldan chetga chiqish sababi (dalil bilan). criticalFinding faqat shoshilinch bo'lsa. Dastur maqsadi yangi samarali davolash topish — dalil bo'lsa protokoldan voz kechish mumkin.
ANIQLIK: Faqat berilgan ma'lumotga tayaning; probability ni dalil kuchiga mos qo'ying (KUCHLI dalil=90-97%, o'rtacha=85-89%, zaif=70-84%); reasoningChain har qadamda "nima uchun" javob bersin. SSV havola yoki protokoldan chetga chiqish sababini yozing.`;
};

export const generateFastDoctorConsultation = async (
    patientData: PatientData, 
    specialties: string[], 
    language: Language
): Promise<FinalReport> => {
    const systemInstr = getFastDoctorSystemInstruction(language);
    const promptText = `Tashxis (name, probability 0-100 dalilga mos — KUCHLI dalil=90-97%, o'rtacha=85-89%, zaif=70-84%; taxminiy 60/25/75 kabi shablon raqamlar yo'q, justification 2 jumla, reasoningChain 3 band, uzbekProtocolMatch). treatmentPlan 3-5 qadam. medications: name, dosage, frequency, duration, timing, instructions (qanday ichish, 1 jumla). recommendedTests, criticalFinding agar kerak. Til: ${langMap[language]}. JSON.`;

    const finalReportSchema = {
        type: 'object',
        properties: {
            primaryDiagnosis: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    probability: { type: 'number' },
                    justification: { type: 'string' },
                    reasoningChain: { type: 'array', items: { type: 'string' } },
                    uzbekProtocolMatch: { type: 'string' }
                }
            },
            treatmentPlan: { type: 'array', items: { type: 'string' } },
            medications: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        dosage: { type: 'string' },
                        frequency: { type: 'string' },
                        duration: { type: 'string' },
                        timing: { type: 'string' },
                        instructions: { type: 'string' }
                    }
                }
            },
            recommendedTests: { type: 'array', items: { type: 'string' } },
            criticalFinding: {
                type: 'object',
                properties: {
                    finding: { type: 'string' },
                    implication: { type: 'string' },
                    urgency: { type: 'string' }
                }
            }
        },
        required: ['primaryDiagnosis', 'treatmentPlan', 'medications']
    };

    const multimodalPrompt = buildFastDoctorPrompt(promptText, patientData);

    const usePro = (specialties?.length ?? 0) > 0;
    const DOCTOR_MODEL = usePro ? DEPLOY_PRO : DEPLOY_FAST;
    const runWithTokens = (maxTok: number) =>
        callGemini(multimodalPrompt, DOCTOR_MODEL, finalReportSchema, false, systemInstr, true, maxTok) as Promise<Record<string, unknown>>;

    let result: Record<string, unknown>;
    try {
        result = await runWithTokens(1280);
    } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        const isParseOrIncomplete = /parse_json|noto'g'ri|javob|invalid json|to'liq kelmadi/i.test(msg) || (firstErr as Error & { cause?: string })?.cause === 'parse_json';
        if (isParseOrIncomplete) {
            logger.warn('Doktor tahlil: qayta urinilmoqda (1536 token)');
            result = await runWithTokens(1536);
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
        consensusDiagnosis: normalizeConsensusDiagnosis(
            primaryDiag
                ? [{
                    name: String(primaryDiag.name || 'Tashxis'),
                    probability: primaryDiag.probability,
                    justification: String(primaryDiag.justification || ''),
                    evidenceLevel: 'High',
                    reasoningChain,
                    uzbekProtocolMatch: String(primaryDiag.uzbekProtocolMatch || 'SSV protokoliga muvofiq'),
                }]
                : [],
        ),
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

/** Strim: Gemini orqali javob, onChunk ga to'liq matn bir marta yuboriladi, oxirida FinalReport. */
export const generateFastDoctorConsultationStream = async (
    patientData: PatientData,
    specialties: string[],
    language: Language,
    onChunk: (text: string) => void
): Promise<FinalReport> => {
    const systemInstr = getSystemInstruction(language);
    const promptText = `Tez tahlil. Javobni FAQAT quyidagi JSON ko'rinishida bering, boshqa matn yozmang. primaryDiagnosis: { name, probability (0-100, KUCHLI dalil=90-97%, o'rtacha=85-89%, zaif=70-84%; taxminiy 60/25/75 kabi shablonlar yo'q), justification, reasoningChain, uzbekProtocolMatch }, treatmentPlan: [], medications: [{ name, dosage, frequency, duration, timing, instructions }], recommendedTests: [], criticalFinding: { finding, implication, urgency }. Til: ${langMap[language]}.`;
    const multimodalPrompt = buildMultimodalPrompt(promptText, patientData);
    let fullText = '';
    try {
        const result = await callGemini(multimodalPrompt, MODEL_FAST, { __json: true }, false, systemInstr, true, 1024);
        fullText = typeof result === 'string' ? result : JSON.stringify(result);
        onChunk(fullText);
    } catch (e) {
        logger.error('Gemini stream fallback error:', e);
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
        consensusDiagnosis: normalizeConsensusDiagnosis(
            primaryDiag
                ? [{
                    name: String(primaryDiag.name || 'Tashxis'),
                    probability: primaryDiag.probability,
                    justification: String(primaryDiag.justification || ''),
                    evidenceLevel: 'High',
                    reasoningChain: (primaryDiag.reasoningChain as string[]) || [],
                    uzbekProtocolMatch: String(primaryDiag.uzbekProtocolMatch || 'SSV protokoliga muvofiq'),
                }]
                : [],
        ),
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
    return callGemini(prompt, DEPLOY_FAST, undefined, false, systemInstr) as Promise<string>;
};

export const getDynamicSuggestions = async (complaintText: string, language: Language): Promise<{ relatedSymptoms: string[], diagnosticQuestions: string[] }> => {
    if (complaintText.trim().length < 15) {
        return { relatedSymptoms: [], diagnosticQuestions: [] };
    }
    const systemInstr = getSystemInstruction(language);
    const prompt = `Based on the patient's complaints: "${complaintText}", suggest 3 related symptoms and 3 key diagnostic questions a doctor might ask. Return JSON { "relatedSymptoms": ["..."], "diagnosticQuestions": ["..."] }. Output MUST be in ${langMap[language]}.`;
    const schema = {
        type: 'object',
        properties: {
            relatedSymptoms: { type: 'array', items: { type: 'string' } },
            diagnosticQuestions: { type: 'array', items: { type: 'string' } },
        }
    };
    return callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr);
};

/** Doctor Support via Gemini (frontend). Returns shape compatible with apiAiService.DoctorSupportResult. */
export const runDoctorSupportViaGemini = async (
    patientData: PatientData,
    options: { query?: string; taskType?: string; language?: string } = {},
): Promise<Record<string, unknown>> => {
    const taskType = options.taskType || 'quick_consult';
    const language = (options.language || 'uz-L') as Language;
    const query = options.query || '';
    const systemInstr = getSystemInstruction(language);
    const langLabel = langMap[language];
    const patientText = [
        `Bemor: ${patientData.firstName || ''} ${patientData.lastName || ''}, ${patientData.age || ''} yosh, ${patientData.gender || ''}.`,
        `Shikoyatlar: ${patientData.complaints || ''}`,
        patientData.history ? `Anamnez: ${patientData.history}` : '',
        patientData.objectiveData ? `Ob'ektiv: ${patientData.objectiveData}` : '',
        patientData.labResults ? `Lab: ${patientData.labResults}` : '',
        patientData.allergies ? `Allergiya: ${patientData.allergies}` : '',
        patientData.currentMedications ? `Dori-darmonlar: ${patientData.currentMedications}` : '',
        patientData.additionalInfo ? `Qo'shimcha: ${patientData.additionalInfo}` : '',
    ].filter(Boolean).join('\n');

    const taskPrompts: Record<string, { prompt: string; schema: Record<string, unknown> }> = {
        quick_consult: {
            prompt: `Shifokorga qisqa, aniq maslahat bering. Asosiy tashxis (dalil asosida), zaruriy tekshiruvlar, darhol choralar. probability ni dalil kuchiga mos qo'ying. Til: ${langLabel}.`,
            schema: {
                type: 'object',
                properties: {
                    summary: { type: 'string' },
                    primary_diagnosis: { type: 'string' },
                    probability: { type: 'number' },
                    immediate_actions: { type: 'array', items: { type: 'string' } },
                    medications: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dosage: { type: 'string' }, frequency: { type: 'string' }, duration: { type: 'string' }, instructions: { type: 'string' } } } },
                    recommended_tests: { type: 'array', items: { type: 'string' } },
                    follow_up: { type: 'string' },
                    critical_alert: { type: 'object', properties: { present: { type: 'boolean' }, message: { type: 'string' } } },
                },
            },
        },
        diagnosis: {
            prompt: `3-5 ta differensial tashxis bering. Har biri: name, probability (%) - dalil kuchiga mos, justification - nega shunday, evidence_level, reasoning_chain - har qadam "nima uchun", uzbek_protocol - aniq SSV protokol nomi/yo'nalishi. red_flags agar bor. Eng ehtimolini birinchi qo'ying. Til: ${langLabel}.`,
            schema: {
                type: 'object',
                properties: {
                    diagnoses: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, probability: { type: 'number' }, justification: { type: 'string' }, evidence_level: { type: 'string' }, reasoning_chain: { type: 'array', items: { type: 'string' } }, uzbek_protocol: { type: 'string' } } } },
                    red_flags: { type: 'array', items: { type: 'string' } },
                },
            },
        },
        treatment_plan: {
            prompt: `SSV protokoliga mos davolash rejasi: treatment_plan (aniq qadamlar), medications (name, dosage, frequency, duration, timing, instructions), non_pharmacological, monitoring, uzbek_protocol_ref - aniq protokol havolasi. Til: ${langLabel}.`,
            schema: {
                type: 'object',
                properties: {
                    treatment_plan: { type: 'array', items: { type: 'string' } },
                    medications: { type: 'array', items: { type: 'object' } },
                    non_pharmacological: { type: 'array', items: { type: 'string' } },
                    monitoring: { type: 'array', items: { type: 'string' } },
                    uzbek_protocol_ref: { type: 'string' },
                },
            },
        },
        drug_check: {
            prompt: `Dorilarni tahlil qiling: o'zaro ta'sirlar, dozalar, O'zbekistonda mavjudligi. interactions (drugs, severity, description), overall_safety, recommendations. Til: ${langLabel}.`,
            schema: {
                type: 'object',
                properties: {
                    drugs_analyzed: { type: 'array', items: { type: 'object' } },
                    interactions: { type: 'array', items: { type: 'object', properties: { drugs: { type: 'array', items: { type: 'string' } }, severity: { type: 'string' }, description: { type: 'string' } } } },
                    overall_safety: { type: 'string' },
                    recommendations: { type: 'array', items: { type: 'string' } },
                },
            },
        },
        lab_interpretation: {
            prompt: `Lab natijalarini O'zbekiston standartlari bo'yicha izohlang. interpretations (parameter, value, unit, reference, status, clinical_significance), summary, urgent_findings. Til: ${langLabel}.`,
            schema: {
                type: 'object',
                properties: {
                    interpretations: { type: 'array', items: { type: 'object' } },
                    summary: { type: 'string' },
                    urgent_findings: { type: 'array', items: { type: 'string' } },
                },
            },
        },
        follow_up: {
            prompt: `Kuzatuv rejasi: return_visit, red_flag_symptoms, monitoring_at_home, repeat_tests, lifestyle_advice, emergency_contact (103). Til: ${langLabel}.`,
            schema: {
                type: 'object',
                properties: {
                    return_visit: { type: 'string' },
                    red_flag_symptoms: { type: 'array', items: { type: 'string' } },
                    monitoring_at_home: { type: 'array', items: { type: 'string' } },
                    repeat_tests: { type: 'array', items: { type: 'string' } },
                    lifestyle_advice: { type: 'array', items: { type: 'string' } },
                    emergency_contact: { type: 'string' },
                },
            },
        },
    };

    const { prompt: taskPrompt, schema } = taskPrompts[taskType] || taskPrompts.quick_consult;
    const userContent = `BEMOR:\n${patientText}\n\n${query ? `SHIFOKOR SO'ROVI:\n${query}\n\n` : ''}${taskPrompt}\n\nJavobni FAQAT toza JSON formatida bering.`;

    const usePro = taskType === 'diagnosis' || taskType === 'treatment_plan';
    const model = usePro ? DEPLOY_PRO : DEPLOY_FAST;
    const maxTok = usePro ? 4096 : 3000;

    try {
        const raw = await callGemini(userContent, model, schema, false, systemInstr, true, maxTok) as Record<string, unknown>;
        if (!raw || typeof raw !== 'object') {
            return { _task_type: taskType, _language: language, error: 'AI javob qayta ishlashda xatolik' };
        }
        return { ...raw, _task_type: taskType, _language: language };
    } catch (e) {
        logger.warning('runDoctorSupportViaGemini error', e);
        return { _task_type: taskType, _language: language, error: e instanceof Error ? e.message : 'AI xizmati vaqtincha ishlamadi' };
    }
};


export const generateClarifyingQuestions = async (data: PatientData, language: Language): Promise<string[]> => {
    // Minimal text prompt - no images, no heavy system instruction to save tokens
    const patientSummary = [
        data.complaints ? `Shikoyat: ${data.complaints}` : '',
        data.history    ? `Anamnez: ${data.history}`    : '',
        data.objectiveData ? `Ob'ektiv: ${data.objectiveData}` : '',
    ].filter(Boolean).join('\n').slice(0, 800);

    const plainPrompt = `Quyidagi bemor SHIKOYATI (complaints) asosida FAQAT shu shikoyatda tilga olingan belgi/kasallik/simptom haqida 3 ta savol ber.
QAT'IY: Har bir savol matnida bemor yozgan shikoyatdagi aniq so'z yoki atama (kasallik nomi, organ, simptom) bo'lishi kerak. Shikoyatda yo'q mavzular haqida savol bermang (umumiy tibbiy savollar taqiqlangan).
Har savol ALOHIDA QATORDA. Raqam qo'yma. TIL: ${langMap[language]}.

${patientSummary}`;

    try {
        const ai = getGemini();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await ai.models.generateContent({
            model: DEPLOY_FAST,
            contents: plainPrompt,
            config: { temperature: 0.1, maxOutputTokens: 256 },
        });
        clearTimeout(timeoutId);
        const text = (response.text ?? '').trim();
        const questions = text
            .split('\n')
            .map(l => l.replace(/^[\d\.\-\*\s]+/, '').replace(/^["']|["']$/g, '').trim())
            .filter(l => l.length > 5 && l.length < 200);
        return questions.length >= 2 ? questions.slice(0, 4) : [];
    } catch (e) {
        logger.warning('generateClarifyingQuestions error', e);
        return [];
    }
};

export const recommendSpecialists = async (data: PatientData, language: Language): Promise<{ recommendations: { model: AIModel; reason: string }[] }> => {
    const systemInstr = getSystemInstruction(language);
    const availableSpecialists = Object.values(AIModel).filter(m => m !== AIModel.SYSTEM).join(', ');
    const prompt = buildMultimodalPrompt(
        `Analyze the patient's clinical case. Select 5-6 specialists from: [${availableSpecialists}]. For each give ONE short sentence reason (max 10-15 words). Return ONLY valid JSON: { "recommendations": [{ "model": "ExactNameFromList", "reason": "Short reason." }] }. Output Language: ${langMap[language]}.`,
        data
    );
    
    const schema = {
        type: 'object',
        properties: {
            recommendations: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        model: { type: 'string', enum: Object.values(AIModel) },
                        reason: { type: 'string' },
                    },
                    required: ['model', 'reason'],
                },
            },
        },
        required: ['recommendations'],
    };
    try {
        const result = await callGemini(prompt, DEPLOY_PRO, schema, false, systemInstr, true, 4096) as { recommendations?: Array<{ model?: string; reason?: string }> };
        const recs = Array.isArray(result?.recommendations) ? result.recommendations : [];
        const mapped = recs.map(r => ({
            model: (r?.model && Object.values(AIModel).includes(r.model as AIModel) ? r.model : AIModel.GEMINI) as AIModel,
            reason: typeof r?.reason === 'string' ? r.reason : '',
        })).filter(r => r.model && r.reason);
        return { recommendations: mapped.length > 0 ? mapped : [{ model: AIModel.GEMINI as AIModel, reason: 'Standart jamoa' }] };
    } catch (e) {
        logger.warning('recommendSpecialists error', e);
        return { recommendations: [{ model: AIModel.GEMINI as AIModel, reason: 'Standart jamoa' }] };
    }
};

export const generateInitialDiagnoses = async (data: PatientData, language: Language): Promise<Diagnosis[]> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = buildMultimodalPrompt(
        `Analyze the patient data. Generate 3-5 most likely differential diagnoses. O'ZBEKISTON KONTEKSTI MAJBURIY.
        MANDATORY FIELDS (keep each string SHORT to avoid truncation):
        1. "name": Diagnosis name in ${langMap[language]} (aniq, qisqa).
        2. "justification": 1-2 jumla - nega shunday tashxis; dalil asosida.
        3. "reasoningChain": 2-3 qisqa qadam: simptom → sabab → tashxis.
        4. "uzbekProtocolMatch": SSV protokol nomi yoki yo'nalishi (qisqa).
        ANIQLIK: probability ni dalil kuchiga mos qo'ying. Eng ehtimolini birinchi qo'ying.
        Output Language: ${langMap[language]}. Return ONLY valid JSON array.`,
        data
    );

    const schema = {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                probability: { type: 'number' },
                justification: { type: 'string' },
                evidenceLevel: { type: 'string' },
                reasoningChain: { type: 'array', items: { type: 'string' } },
                uzbekProtocolMatch: { type: 'string' }
            },
            required: ['name', 'probability', 'justification', 'evidenceLevel', 'reasoningChain'],
        },
    };
    try {
        const raw = await callGemini(prompt, DEPLOY_PRO, schema, false, systemInstr, true, 8192);
        const arr = Array.isArray(raw) ? raw : [];
        return arr.map((item: Record<string, unknown>) => ({
            name: String(item?.name ?? ''),
            probability: Number(item?.probability ?? 0),
            justification: String(item?.justification ?? ''),
            evidenceLevel: String(item?.evidenceLevel ?? 'Moderate'),
            reasoningChain: Array.isArray(item?.reasoningChain) ? (item.reasoningChain as string[]) : [],
            uzbekProtocolMatch: String(item?.uzbekProtocolMatch ?? ''),
        })) as Diagnosis[];
    } catch (e) {
        logger.warning('generateInitialDiagnoses parse/network error, returning empty list', e);
        return [];
    }
};

/** Normalize Gemini response to PrognosisReport; handles nested { prognosis: {...} } or truncated/incomplete JSON. */
function normalizePrognosisReport(raw: unknown): PrognosisReport | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = (raw as { prognosis?: unknown }).prognosis
        ? (raw as { prognosis: Record<string, unknown> }).prognosis
        : (raw as Record<string, unknown>);
    if (!obj || typeof obj !== 'object') return null;
    const shortTerm = typeof obj.shortTermPrognosis === 'string' ? obj.shortTermPrognosis : (typeof (obj as { summary?: string }).summary === 'string' ? (obj as { summary: string }).summary : '');
    const longTerm = typeof obj.longTermPrognosis === 'string' ? obj.longTermPrognosis : '';
    const keyFactors = Array.isArray(obj.keyFactors) ? obj.keyFactors.filter((f: unknown) => typeof f === 'string') as string[] : [];
    const confidenceScore = typeof obj.confidenceScore === 'number' && obj.confidenceScore >= 0 && obj.confidenceScore <= 1 ? obj.confidenceScore : 0.5;
    return {
        shortTermPrognosis: shortTerm || '-',
        longTermPrognosis: longTerm || '-',
        keyFactors,
        confidenceScore,
    };
}

/** AI yoki tarmoq xatosi bo'lsa ham konsensus va bemor ma'lumotlaridan to'liq prognoz blokini beradi */
function ensurePrognosisReport(
    pr: PrognosisReport | null | undefined,
    fr: FinalReport,
    patientData: PatientData,
    language: Language
): PrognosisReport {
    const dx = normalizeConsensusDiagnosis(fr.consensusDiagnosis);
    const dxNames = dx.map(d => d.name).filter(Boolean).join('; ') || 'klinik holat';
    const shortRaw = (pr?.shortTermPrognosis || '').trim();
    const longRaw = (pr?.longTermPrognosis || '').trim();
    const shortOk = shortRaw.length > 2 && shortRaw !== '-';
    const longOk = longRaw.length > 2 && longRaw !== '-';
    const factorsOk = Array.isArray(pr?.keyFactors) && pr!.keyFactors!.some(f => String(f).trim().length > 3);

    if (shortOk && longOk && factorsOk && pr) {
        return {
            ...pr,
            confidenceScore: typeof pr.confidenceScore === 'number' ? pr.confidenceScore : 0.65,
        };
    }

    const isRu = language === 'ru';
    const isEn = language === 'en';
    const shortTerm =
        shortOk && pr
            ? pr.shortTermPrognosis
            : isEn
              ? `Short term (1–3 months): based on the consensus (${dxNames}), expected course depends on adherence to the proposed plan and follow-up. Symptoms may improve as treatment takes effect; monitor for warning signs and repeat tests as advised.`
              : isRu
                ? `Краткосрочно (1–3 мес.): по консенсусу (${dxNames}) ожидается ответ на терапию при соблюдении плана; контроль симптомов и анализов по назначению.`
                : `Qisqa muddat (1–3 oy): konsensus bo'yicha asosiy yo'nalish — ${dxNames}. Taklif qilingan davolash va kuzatuvga rioya qilinsa, simptomlar vaqt o'tishi bilan yaxshilanishi yoki barqarorlashishi mumkin; ogohlantiruvchi belgilar va qayta tekshiruvlar bo'yicha shifokor ko'rsatmalariga amal qiling.`;

    const longTerm =
        longOk && pr
            ? pr.longTermPrognosis
            : isEn
              ? `Long term (1–5 years): prognosis depends on chronicity, comorbidities, lifestyle, and adherence. Regular follow-up and prevention reduce recurrence and complications.`
              : isRu
                ? `Долгосрочно (1–5 лет): прогноз зависит от хроничности, сопутствующих заболеваний и соблюдения терапии; профилактика и диспансеризация снижают риск обострений.`
                : `Uzoq muddat (1–5 yil): surunkali kasalliklar uchun prognoz yosh, qo'shimcha kasalliklar, hayot tarzi va davolashga rioya qilish bilan bog'liq. Muntazam kuzatuv va profilaktika qayta yuzaga kelish va asoratlarni kamaytiradi.`;

    const complaintsSnippet = (patientData.complaints || '').trim();
    const keyFactors: string[] = factorsOk && pr && pr.keyFactors
        ? pr.keyFactors.filter(f => String(f).trim().length > 0)
        : [
              `${isEn ? 'Consensus diagnosis' : 'Konsensus tashxis'}: ${dxNames}`,
              patientData.age ? (isEn ? `Age: ${patientData.age}` : `Yosh: ${patientData.age}`) : isEn ? 'Clinical context' : 'Klinik kontekst',
              complaintsSnippet
                  ? (isEn ? `Chief complaints: ${complaintsSnippet.slice(0, 200)}${complaintsSnippet.length > 200 ? '…' : ''}` : `Shikoyatlar: ${complaintsSnippet.slice(0, 200)}${complaintsSnippet.length > 200 ? '…' : ''}`)
                  : isEn
                    ? 'Treatment adherence and follow-up visits'
                    : 'Davolashga rioya qilish va qayta ko‘rish',
              isEn ? 'Comorbidities and risk factors from the record' : 'Qo‘shimcha kasalliklar va xavf omillari (ma\'lumotlar bo\'yicha)',
          ];

    return {
        shortTermPrognosis: shortTerm,
        longTermPrognosis: longTerm,
        keyFactors,
        confidenceScore: typeof pr?.confidenceScore === 'number' ? pr.confidenceScore : 0.55,
    };
}

const generatePrognosisUpdate = async (
    debateHistory: ChatMessage[],
    patientData: PatientData,
    language: Language,
    consensusHint?: string
): Promise<PrognosisReport | null> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...cleanData } = patientData;
    const debateSnippet = debateHistory.slice(-8).map(m => `[${m.author === AIModel.SYSTEM ? 'Professor' : m.author}]: ${(m.content || '').trim().slice(0, 200)}`).join('\n');
    const consensusBlock = consensusHint && consensusHint.trim()
        ? `\n\nYakuniy konsensus tashxis(lar) (prognozni shu bilan bog'lab yozing): ${consensusHint.trim()}`
        : '';
    const prompt = `Vazifa: Kasallik prognozi (aniq, batafsil). Bemor va munozara asosida quyidagi JSON ni to'ldiring. Umumiy iboralar yozmang — har bir maydon aniq ma'lumot bilan to'liq bo'lsin.

shortTermPrognosis: Qisqa muddatli prognoz (1–3 oy). 2–4 jumla. Yozing: bemorning kutilayotgan holati, davolash ta'siri, ehtimoliy yaxshilanish yoki asoratlar, qanday kuzatish kerak. Masalan: "Davolashga rioya qilsa 2–3 hafta ichida [simptom] kamayadi; 1 oydan keyin laboratoriya nazorati kerak; asoratlar bo'lsa darhol shifokorga murojaat."

longTermPrognosis: Uzoq muddatli prognoz (1–5 yil). 2–4 jumla. Yozing: uzoq muddatda kutilayotgan natija, surunkali risklar, qaytalash ehtimoli, hayot sifati. Masalan: "Davolash rejasiga rioya etilsa 1–2 yil ichida barqarorlashuv kutiladi; [kasallik] bo'yicha yillik tekshiruv tavsiya etiladi; [risk] ni kamaytirish uchun ..."

keyFactors: Prognozga ta'sir etuvchi asosiy omillar. 4–8 ta aniq band (har biri 1 jumla). Masalan: "Davolash rejasiga rioya qilish darajasi", "Bemor yoshi va yurak/jigar funksiyasi", "Asosiy kasallikning og'irlik darajasi", "Qo'shimcha kasalliklar (diabet, AH va h.k.)", "Iemish va hayot tarzi", "Oila qo'llab-quvvatlashi", "Dori-darmonlarni muntazam qabul qilish". Bemor va munozaraga mos aniq omillarni yozing.

confidenceScore: 0 dan 1 gacha (prognoz ishonchliligi).

TIL: ${langMap[language]}. Javobni FAQAT JSON da bering (shortTermPrognosis, longTermPrognosis, keyFactors, confidenceScore).

Munozara (oxirgi xabarlar): ${debateSnippet}
${consensusBlock}

Bemor: ${JSON.stringify(cleanData)}`;
    const schema = {
        type: 'object',
        properties: {
            shortTermPrognosis: { type: 'string' },
            longTermPrognosis: { type: 'string' },
            keyFactors: { type: 'array', items: { type: 'string' } },
            confidenceScore: { type: 'number' }
        }
    };
    try {
        const raw = await callGemini(prompt, DEPLOY_PRO, schema, false, systemInstr, true, 2048);
        return normalizePrognosisReport(raw);
    } catch (e) {
        try {
            const rawFast = await callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr, true, 2048);
            return normalizePrognosisReport(rawFast);
        } catch {
            return null;
        }
    }
};

export const runCouncilDebate = async (
    patientData: PatientData,
    diagnoses: Diagnosis[],
    specialistsConfig: { role: AIModel, backEndModel: string }[],
    orchestratorModel: string,
    onProgress: (update: ProgressUpdate) => void,
    getUserIntervention: () => string | null,
    language: Language,
    /** Serverdan yuklangan tahlillar — RAG konteksti uchun (barcha ma'lumot serverda) */
    userHistory?: AnalysisRecord[]
): Promise<void> => {
    const pastCasesForContext = userHistory?.length ? caseService.analysesToAnonymizedCases(userHistory) : undefined;
    const systemInstr = getSystemInstruction(language);
    const introMessages: Record<Language, string> = {
        'uz-L': 'O\'zbekiston yetakchi tibbiyot mutaxassislari yig\'ilmoqda...',
        'uz-C': 'Ўзбекистон етакчи тиббиёт мутахассислари йиғилмоқда...',
        'ru': 'Ведующие медицинские специалисты собираются...',
        'en': 'Leading medical specialists are gathering...'
    };
    
    onProgress({ type: 'status', message: introMessages[language] || introMessages['uz-C'] });
    let debateHistory: ChatMessage[] = [];

    const objectiveFull = (patientData.objectiveData || '').trim();
    const labText = (patientData.labResults || '').trim();
    const attachmentCount = patientData.attachments?.length ?? 0;
    const labAndDocsLine = labText
        ? `Laboratoriya/tahlil ma'lumoti: ${labText.slice(0, 400)}.`
        : '';
    const attachmentsLine = attachmentCount > 0
        ? `LABORATORIYA VA DIAGNOSTIKA HUJJATLARI: Bemor ${attachmentCount} ta fayl yuklagan (quyida/ilovada). Ularni TO'LIQ TAHLIL QILING, mutaxassislarga qisqacha xulosa bilan yetkazing. Bu hujjatlarni shifokordan QAYTA SO'RAMANG — allaqachon berilgan.`
        : '';
    const longitudinalBlock = (patientData.longitudinalClinicalNotes || '').trim();
    const longitudinalLine = longitudinalBlock
        ? `\n\nOLDINGI TAHLILLAR VA DINAMIKA (MUHIM — QAYTA KO'RISH, OLDINGI TAVSIYALAR BILAN ZIDLIK BO'LSA, SABABINI BAHOLANG):\n${longitudinalBlock.slice(0, 4500)}`
        : '';

    const patientSummaryForRais = `Bemor: ${(patientData.firstName || '')} ${(patientData.lastName || '')}, ${patientData.age || '-'} yosh.
Shikoyat: ${(patientData.complaints || '').slice(0, 500)}.
Anamnez: ${(patientData.history || '-').slice(0, 300)}.

OB'EKTIV KO'RIK (VITAL KO'RSATKICHLAR — SHIFOKOR KIRITGAN, MUNOZARADA QAYTA SO'RAMANG, HISOBGA OLING):
${objectiveFull || '(kiritilmagan)'}

${labAndDocsLine}
${attachmentsLine}
Dastlabki tashxislar: ${diagnoses.map(d => d.name).join(', ') || '-'}.
${longitudinalLine}

QOIDA: Ob'ektiv ko'rik va (agar bor bo'lsa) yuklangan laboratoriya/diagnostika hujjatlari berilgan; shifokordan ularni so'ramang. Barcha ma'lumotlardan to'liq foydalaning va mutaxassislarga aniq yetkazing.`;

    // Bitta Professor xabari: takrorlanmasin, ikki marta shu bemor haqida kirish yozilmasin. To'liq yakuniy gaplar (token limiti katta).
    const professorOpeningPrompt = `Siz Konsilium Professori. Bitta uzluksiz matn yozing (bir nechta paragraf bo'lishi mumkin).

QAT'IY:
- Bemor ism-familiyasi va yoshni FAQAT bir marta, matning boshida qisqa eslatib o'ting; keyin takrorlamang.
- Rasmiy mulozamat ("Hurmatli hamkasblar") yozmang.
- Avval: klinik holat va shikoyatlar bo'yicha qisqa umumlashtirish (3-5 jumla).
- Keyin: birinchi mavzu — asosiy shubhalar, differensial yo'nalishlar, mutaxassislardan nima kutish kerak; hujjatlar bo'lsa topilmalar (qisqa).
- Oxirida mutaxassislarga aniq yo'naltirish (qanday baho va xavf belgilari muhim).
- TIL: ${langMap[language]}.
- Javobni TO'LIQ yakunlang: oxirgi jumla nuqta bilan tugasin; jumla yarmida, so'z yarmida TO'XTAMANG. Agar joy yetmasa, qisqaroq yozing, lekin har bir jumla to'liq bo'lsin.

${patientSummaryForRais}`;
    const professorMultimodal =
        attachmentCount > 0 ? buildMultimodalPrompt(professorOpeningPrompt, patientData, pastCasesForContext) : professorOpeningPrompt;
    // Professor yakuniy gaplari uchun keng limit — oxirida kesilmasin
    let currentTopic = (await callGemini(professorMultimodal, DEPLOY_FAST, undefined, false, systemInstr, true, 8192)) as string;
    currentTopic = (currentTopic || '').trim();

    const orchestratorIntro: ChatMessage = {
        id: `sys-intro-${Date.now()}`,
        author: AIModel.SYSTEM,
        content: currentTopic,
        isSystemMessage: true,
    };
    onProgress({ type: 'message', message: orchestratorIntro });
    debateHistory.push(orchestratorIntro);

    // Raundlar tushunchasini UI dan olib tashlaymiz: ichki hisob-kitob uchun 1 marta aylanish
    const DEBATE_ROUNDS = 1;
    let lastLivePrognosis: PrognosisReport | null = null;

    for (let round = 1; round <= DEBATE_ROUNDS; round++) {
        // Raund raqamini ko'rsatmaymiz, faqat umumiy holat xabari
        const roundMessages: Record<Language, string> = {
            'uz-L': `Konsilium munozarasi davom etmoqda...`,
            'uz-C': `Консилиум муҳокамаси давом этмоқда...`,
            'ru': `Идёт обсуждение консилиума...`,
            'en': `Council debate in progress...`
        };
        onProgress({ type: 'status', message: roundMessages[language] });
        
        // Orchestrator Turn — savol matni aniq bo'lsagina foydalanuvchidan so'raymiz
        const questionMatch = currentTopic.match(/FOYDALANUVCHI UCHUN SAVOL:\s*(.+)/i) || currentTopic.match(/QUESTION FOR USER:\s*(.+)/i);
        const cleanQuestion = questionMatch ? questionMatch[1].trim() : '';
        const hasRealQuestion = cleanQuestion.length > 5;

        if ((currentTopic.includes("QUESTION FOR USER") || currentTopic.includes("FOYDALANUVCHI UCHUN SAVOL")) && hasRealQuestion) {
             const userQMsg = { id: `sys-${Date.now()}-${round}`, author: AIModel.SYSTEM, content: cleanQuestion, isSystemMessage: true };
             onProgress({ type: 'message', message: userQMsg });
             debateHistory.push(userQMsg);
             onProgress({ type: 'user_question', question: cleanQuestion });
             let userInput: string | null = null;
             while (!userInput) {
                await sleep(18);
                userInput = getUserIntervention();
             }
             const userMessage: ChatMessage = { id: `user-${Date.now()}`, author: AIModel.SYSTEM, content: `Javob: ${userInput}`, isUserIntervention: true, isSystemMessage: true };
             onProgress({ type: 'message', message: userMessage });
             debateHistory.push(userMessage);
        } else {
            // Professorning to'liq matni allaqachon yuqorida bitta xabar sifatida yuborilgan — shu yerda qayta yubormaymiz (takror va yarim gaplar oldini olish).
        }

        /** Eng ko'pi bilan 4 ta mutaxassis; parallel chaqiruv + qisqa javob (umumiy vaqt qisqaroq) */
        const limitedSpecialists = specialistsConfig.slice(0, 4);
        const recentDebate = debateHistory.slice(-14);
        const fullDebateText = recentDebate
            .map(m => {
                const author = m.author === AIModel.SYSTEM ? 'Konsilium Professori' : String(m.author);
                const content = (m.content || '').trim();
                return `[${author}]: ${content.length > 2000 ? content.slice(0, 2000) + '…' : content}`;
            })
            .join('\n\n');

        const objectiveForSpec = (patientData.objectiveData || '').trim();
        const labForSpec = (patientData.labResults || '').trim().slice(0, 300);
        const attachmentsNoteForSpec = attachmentCount > 0
            ? `\nLABORATORIYA/DIAGNOSTIKA HUJJATLARI: Bemor ${attachmentCount} ta fayl yuklagan (quyida ilovada). Ularni TAHLIL QILING, xulosangizda ishlating. Bu hujjatlar allaqachon berilgan — shifokordan SO'RAMANG.`
            : '';
        const bemorSummaryForSpec = `Shikoyat: ${(patientData.complaints || '').slice(0, 400)}.
VITAL KO'RSATKICHLAR (shifokor kiritgan — SO'RAMANG, hisobga oling):
${objectiveForSpec || '-'}
${labForSpec ? `Laboratoriya ma'lumoti: ${labForSpec}` : ''}${attachmentsNoteForSpec}`;

        const specialistOutcomes = await Promise.all(
            limitedSpecialists.map(async (spec, idx) => {
                onProgress({ type: 'thinking', model: spec.role });
                const specialist = AI_SPECIALISTS[spec.role];
                const specName = specialist?.name || String(spec.role);
                const specTitle = specialist?.title || 'mutaxassis';
                const textPrompt = `Siz - ${specName} (${specTitle}). QOIDA: Konsiliumda hech bir yozuv oldindan kiritilmaydi — suhbat va kasallikni o'qib, o'z fikringizni yozasiz. "Hurmatli professor" yoki boshqa rasmiy salomlashuv YOZMANG — to'g'ridan-to'g'ri tashxis va fikr. Bir-birini rozi qilish yoki mulozamat ko'rsatish maqsad emas; muhimi aniq tashxis va dalilli, CHUQUR tahlil; e'tibor kasallikga. Ob'ektiv ko'rik va laboratoriya/hujjatlar berilgan — shifokordan so'ramang.

--- BEMOR MA'LUMOTLARI (ob'ektiv ko'rik, lab va hujjatlar allaqachon kiritilgan — hisobga oling, qayta so'ramang) ---
${bemorSummaryForSpec}
--- TUGADI ---

--- SUHBAT TARIXI (avval o'qing, keyin o'z fikringizni yozing) ---
${fullDebateText}
--- TUGADI ---

Professorning hozirgi mavzusi: "${currentTopic}"

QOIDALAR:
1. Aloqasi BOR bo'lsa: Boshqa mutaxassislar gaplariga javob (qo'shilish, rad, savol), o'z sohangizdagi aniq taklif. Hammasi faqat yuqoridagi suhbatdan kelib chiqsin. Rasmiy salomlashuvsiz, mazmunan.
2. Aloqasi YO'Q bo'lsa: Bitta juda qisqa jumla o'zingiz yozing, keyin to'xtang.
3. Shifokordan savol: faqat hayotiy xavf yoki tashxisni aniqlash uchun boshqa iloji bo'lmaganda "FOYDALANUVCHI UCHUN SAVOL: [savol]" yozing; aks holda yozmang.
4. Ob'ektiv ko'rik (qon bosimi, puls, harorat, SpO2, nafas) yuqorida berilgan — shifokordan HECH QACHON so'ramang, xulosangizda hisobga oling.
5. Laboratoriya va diagnostika hujjatlari (agar yuklangan bo'lsa) quyida/ilovada — ularni tahlil qiling, xulosangizda ishlating. Bu ma'lumotlarni shifokordan SO'RAMANG — allaqachon berilgan.
6. Javob tuzilishi (faqat matn, bullet/yulduzcha yo'q): (1) Asosiy tashxis va 2 ta asosiy dalil — har biri 1 qisqa jumla. (2) 2 ta differensial — har biri 1 jumla (nimaga kamroq ehtimol). (3) Tavsiya — 1–2 jumla (tekshiruv + davolash yo'nalishi).

JAMI 4–6 QISQA, ANIQ jumla. Ortiqcha tafsilot va tantana YO'Q. TIL: ${langMap[language]}.
OXIRGI QOIDA: oxirgi jumla nuqta bilan tugasin; yarim qoldirmang.`;

                const specialistMultimodalPrompt = buildMultimodalPrompt(textPrompt, patientData, pastCasesForContext);
                try {
                    const responseText = await callGemini(specialistMultimodalPrompt, DEPLOY_FAST, undefined, false, systemInstr, true, 4096) as string;
                    const trimmed = (responseText || '').trim();
                    const specialistMessage: ChatMessage = {
                        id: `${spec.role}-${Date.now()}-${idx}`,
                        author: spec.role,
                        content: trimmed,
                    };
                    return { ok: true as const, message: specialistMessage };
                } catch {
                    return { ok: false as const, message: null };
                }
            }),
        );

        for (const out of specialistOutcomes) {
            if (out.ok && out.message) {
                onProgress({ type: 'message', message: out.message });
                debateHistory.push(out.message);
            }
        }
        
        if (round < DEBATE_ROUNDS) {
            const debateSummary = debateHistory.slice(-10).map(m => `[${m.author === AIModel.SYSTEM ? 'Professor' : m.author}]: ${(m.content || '').trim().slice(0, 300)}`).join('\n');
            const summarizationPrompt = `Siz - Konsilium professori. QOIDA: Hech qanday oldindan kiritilgan matn bo'lmasin — faqat quyidagi suhbatni o'qib, o'zingiz keyingi mavzuni yozing. "Hurmatli hamkasblar" va boshqa rasmiy salomlashuv YOZMANG; to'g'ridan-to'g'ri mavzu va kasallik/tashxisga e'tibor. Ob'ektiv ko'rik (vital), laboratoriya va yuklangan hujjatlar allaqachon berilgan — shifokordan ularni qayta so'ramang.

--- ${round}-BOSQICH SUHBATI (o'qing, keyin o'zingiz yozing) ---
${debateSummary}
--- TUGADI ---

VAZIFA: Suhbatdagi asosiy fikr/farqni qisqacha ko'rsating va keyingi mavzu matnini TO'LIQ yozing — bo'sh qoldirmang. Rasmiy mulozamat yo'q; mazmun — tashxis va kasallik. FOYDALANUVCHI UCHUN SAVOLni faqat tashxis yoki shoshilinch qaror uchun mutlaqo zarur bo'lsagina ishlating (juda kam); aksincha keyingi mavzuni aniq jumla bilan yozing. Javobni oxirigacha yozing. TIL: ${langMap[language]}.`;
            // Agar yana bosqichlar qo'shilsa, keyingi mavzularni PRO modelda hisoblaymiz
            currentTopic = await callGemini(summarizationPrompt, DEPLOY_PRO, undefined, false, systemInstr, true, 3072) as string;
        }
    }

    const finalizingMessages: Record<Language, string> = {
        'uz-L': 'Yakuniy hisobot tayyorlanmoqda...',
        'uz-C': 'Якуний ҳисобот тайёрланмоқда...',
        'ru': 'Подготовка итогового отчёта...',
        'en': 'Preparing final report...'
    };
    onProgress({ type: 'status', message: finalizingMessages[language] });

    const finalReportSchema = {
        type: 'object',
        properties: {
            criticalFinding: {
                type: 'object',
                properties: { finding: { type: 'string' }, implication: { type: 'string' }, urgency: { type: 'string' } },
            },
            consensusDiagnosis: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, probability: { type: 'number' }, justification: { type: 'string' }, evidenceLevel: { type: 'string' }, reasoningChain: { type: 'array', items: { type: 'string' } }, uzbekProtocolMatch: { type: 'string' } } } },
            rejectedHypotheses: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }}},
            recommendedTests: { type: 'array', items: { type: 'string' } },
            treatmentPlan: { type: 'array', items: { type: 'string' } },
            medicationRecommendations: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dosage: { type: 'string' }, notes: { type: 'string' }, localAvailability: { type: 'string' }, priceEstimate: { type: 'string' } }}},
            unexpectedFindings: { type: 'string' },
            uzbekistanLegislativeNote: { type: 'string' }, 
            imageAnalysis: {
                type: 'object',
                properties: {
                    findings: { type: 'string' },
                    correlation: { type: 'string' }
                }
            },
            folkMedicine: {
                type: 'object',
                properties: {
                    intro: { type: 'string' },
                    disclaimer: { type: 'string' },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                plantName: { type: 'string' },
                                plantPart: { type: 'string' },
                                preparationOrUsage: { type: 'string' },
                                traditionalContext: { type: 'string' },
                                precautions: { type: 'string' },
                            },
                            required: ['plantName'],
                        },
                    },
                },
            },
            nutritionPrevention: {
                type: 'object',
                properties: {
                    intro: { type: 'string' },
                    disclaimer: { type: 'string' },
                    dietaryGuidelines: { type: 'array', items: { type: 'string' } },
                    preventionMeasures: { type: 'array', items: { type: 'string' } },
                },
            },
        },
        required: ['consensusDiagnosis', 'rejectedHypotheses', 'recommendedTests', 'treatmentPlan', 'medicationRecommendations', 'unexpectedFindings']
    };

    const finalReportLanguageRule: Record<Language, string> = {
        'uz-L': "TIL: Barcha maydonlar o'zbek tilida (lotin) bo'lsin. Inglizcha texnik so'zlarni keraksiz aralashtirmang.",
        'uz-C': "ТИЛ: Барча майдонлар ўзбек тилида (кирилл) бўлсин. Кераксиз инглизча техник сўзларни аралаштирманг.",
        'ru': 'ЯЗЫК: Все поля отчёта должны быть строго на русском языке.',
        'en': 'LANGUAGE: All report fields must be strictly in English.',
    };

    const finalReportTextPrompt = `
        Role: Council Chair. Create the Final Report. Be AQLLI and XAVFSIZ. O'ZBEKISTON KONTEKSTI MAJBURIY.
        ${finalReportLanguageRule[language]}
        LANGUAGE: ${langMap[language]}.
        REQUIREMENTS:
        1. consensusDiagnosis: har biri uchun reasoningChain, justification, evidenceLevel. uzbekProtocolMatch: qaysi SSV protokoliga mos yoki "protokoldan chetga chiqish: [sabab]" (agar yangi/samarali yondashuv taklif qilsangiz).
        2. treatmentPlan: MAJBURIY, bo'sh massiv QAYTARMANG. 3-7 ketma-ket qadam, har biri 1 qisqa, aniq jumla (amaliy). SSV protokollarini asos qiling; protokoldan chetga chiqsangiz 1 qisqa sabab. Shoshilinch bo'lsa birinchi qadamlar birinchi bo'lsin.
        3. medicationRecommendations: MAJBURIY — HECH QACHON bo'sh massiv qoldirmang. Tashxis va kasallik asosida o'zingiz (dalillarga tayanib) O'zbekistonda mavjud, bemor uchun eng foydali va kerakli dorilarni tavsiya qiling; ortiqcha dori yozmang — faqat zarur va samarali. Har bir dori uchun: (a) name — ANIQ SAVDO NOMI (Nimesil, Sumamed, Metformin, Paratsetamol, Amlodipin, Omeprazol, Enalapril, Augmentin, Ibuprofen va h.k.). (b) dosage — aniq doza (masalan "500 mg kuniga 2 marta, 7 kun"). (c) notes — HAR BIR DORI UCHUN qo'llanma: qanday ichish (ovqatdan oldin/keyin, suv bilan va h.k.), kuniga necha marta, davomiylik; qisqa yo'riqnoma. (d) localAvailability — "O'zbekistonda mavjud" yoki muqobil savdo nomlari. Allergiya va dori o'zaro ta'sirini hisobga oling. Kamida 1 ta, odatda 2–5 ta zarur dori bo'lsin.
        4. criticalFinding: MAJBURIY. Agar suhbatda yoki bemor ma'lumotlarida hayotga xavf, shoshilinch holat, kritik topilma (masalan anafilaksiya, miokard infarkt, insult, jiddiy qon ketish, septik shok, nafas yetishmovchiligi, xavfli aritmiya va h.k.) tilga olingan yoki ehtimoli bor bo'lsa — to'ldiring: finding (qisqa, aniq), implication (oqibat), urgency ("High" yoki "Medium"). Barchasi o'zbekcha. Yo'q bo'lsa null/bo'sh.
        5. recommendedTests: yetishmayotgan muhim tekshiruvlar (O'zbekiston LITS va standartlariga mos).
        6. uzbekistanLegislativeNote: "O'zbekiston Respublikasi sog'liqni saqlash qonunchiligi va SSV klinik protokollariga muvofiq" yoki agar takliflar protokoldan chetga chiqsa "Dalil asosida innovatsion/alternativ yondashuv sifatida taklif qilindi" kabi qisqacha eslatma.
        7. rejectedHypotheses: MAJBURIY. Munozarada ko'rib chiqilgan lekin rad etilgan tashxislar (differensial tashxislar). Har biri uchun name (tashxis nomi) va reason (nimaga rad etildi, qisqa sabab). Kamida 1-3 ta yozing agar bahsda boshqa variantlar tilga olingan bo'lsa; agar hech qanday rad etilgan tashxis bo'lmasa, bo'sh massiv [] qaytaring.
        8. folkMedicine (ALOHIDA BO'LIM, MAJBURIY): Konservativ davolash va reabilitatsiyaga MOS, O'zbekiston va Markaziy Osiyo xalq tabobatida ishlatiladigan dorivor o'simliklar haqida qisqa ma'lumot. Bu rasmiy dori-darmonlar o'rnini BOSMAYDI; shifokor bilan maslahat va qabul qilinayotgan dorilar bilan o'zaro ta'sirlar haqida ogohlantirish bo'lsin. Har bir o'simlik uchun: plantName (lotin yoki o'zbekcha nom), ixtiyoriy plantPart (gul, barg, ildiz), preparationOrUsage (qaynatma, choy, tashqiy ishlatish — qisqa va xavfsiz), traditionalContext (1 jumla qayerda qanday qo'llaniladi), precautions (homiladorlik, bolalar, allergiya, dori bilan ta'sir). Kamida 2 ta, odatda 2-5 ta o'simlik. intro: 1-2 jumla (masalan, qo'shimcha qo'llanma sifatida). disclaimer: "Rasmiy tibbiyot va shifokor ko'rsatmasini almashtirmaydi; individual sezuvchanlik va zaharli o'simliklardan xavfsizlik" mazmunida. Agar holat uchun xalq tabobati qo'llanishi ma'qul emas bo'lsa (masalan, o'tkir jiddiy holat), folkMedicine.items da kamida 1 ta qisqa qator bilan "hozirgi bosqichda xalq tabobati tavsiya etilmaydi" yoki shunga o'xshash sabab yozing.
        9. nutritionPrevention (ALOHIDA BO'LIM, MAJBURIY): Konsensus tashxis va bemor holatiga MOS ravishda kasalliklarni oldini olish, to'g'ri ovqatlanish va profilaktika bo'yicha aniq tavsiyalar. dietaryGuidelines: 4-8 ta qisqa band (masalan, tuz/shakar, suv, tolali mahsulotlar, ovqatlanish tartibi, mahalliy mahsulotlar — O'zbekiston oziq-ovqat realiati). preventionMeasures: 4-8 ta band (profilaktika: jismoniy faollik, uyqu, stress, gigiyena, skrining, vaksinatsiya agar mavzuga tegishli bo'lsa, qayta kasallanishning oldini olish). intro: 1-2 jumla (masalan, bu bo'limning maqsadi). disclaimer: ixtiyoriy qisqa — individual parhez va cheklovlar uchun shifokor/dietolog bilan kelishish kerakligi. Bu bo'lim davolash rejasi o'rnini bosmasin.
        ANIQLIK: consensusDiagnosis da har bir element uchun probability — 0-100 oralig'ida, faqat klinik dalil va justification ga mos RAQAM (taxminiy 60/25/20 yoki 75/15 kabi takrorlanuvchi shablonlar YO'Q). Bir nechta tashxis bo'lsa, probability lar yig'indisi 100% bo'lishi kerak (bir-birini istisno qiluvchi differensial ro'yxat). reasoningChain har qadamda "nima uchun" javob bersin (HAR BIR ELEMENT 1-2 JUMLADAN OSHMASIN, qisqa holda yozing - to'liq JSON kesilmasin); uzbekProtocolMatch — aniq protokol nomi/yo'nalishi yoki protokoldan chetga chiqish sababi. Taxminiy tashxisni yakuniy deb yozmang.
        KRITIK TOPILMA: Suhbat (debate history) yoki bemor ma'lumotlarida shoshilinch, hayotga xavf, kritik holat tilga olingan bo'lsa — criticalFinding ni albatta to'ldiring (finding, implication, urgency). Bo'sh qoldirmang.
        Debate history: ${JSON.stringify(debateHistory)}
    `;
    
    const finalReportMultimodalPrompt = buildMultimodalPrompt(finalReportTextPrompt, patientData, pastCasesForContext);

    const runFinalReport = async (maxTok: number): Promise<FinalReport> => {
        // Tezlikni oshirish uchun yakuniy hisobot FAST model orqali, lekin to'liq JSON struktura bilan
        const raw = await callGemini(finalReportMultimodalPrompt, DEPLOY_FAST, finalReportSchema, false, systemInstr, true, maxTok) as FinalReport;
        return {
            ...raw,
            consensusDiagnosis: normalizeConsensusDiagnosis(raw.consensusDiagnosis),
        };
    };

    try {
        let rawReport: FinalReport;
        try {
            // Yakuniy hisobot uchun kengroq token limiti — kesilmasdan to'liq JSON chiqishi uchun
            rawReport = await runFinalReport(8192);
        } catch (firstErr) {
            const isParseErr = (firstErr as Error & { cause?: string })?.cause === 'parse_json' || String((firstErr as Error).message).includes('AI_JSON_PARSE_ERROR');
            if (isParseErr) {
                logger.warn('Final report JSON kesilgan, qisqaroq reasoningChain bilan qayta urinilmoqda');
                const shortPrompt = finalReportTextPrompt + '\n\nQISQACHA: reasoningChain da har bir element FAQAT 1 jumla (max 15 so\'z). To\'liq yopilgan JSON qaytaring.';
                const shortMultimodal = buildMultimodalPrompt(shortPrompt, patientData, pastCasesForContext);
                const raw = await callGemini(shortMultimodal, DEPLOY_PRO, finalReportSchema, false, systemInstr, true, 8192) as FinalReport;
                rawReport = { ...raw, consensusDiagnosis: normalizeConsensusDiagnosis(raw.consensusDiagnosis) };
            } else {
                throw firstErr;
            }
        }
        if (rawReport.criticalFinding && rawReport.criticalFinding.finding) {
            onProgress({ type: 'critical_finding', data: rawReport.criticalFinding });
        }

        let rejectedHypotheses = Array.isArray(rawReport.rejectedHypotheses) && rawReport.rejectedHypotheses.length > 0
            ? rawReport.rejectedHypotheses.map((h: { name?: string; reason?: string }) => ({ name: String(h?.name ?? ''), reason: String(h?.reason ?? '') }))
            : (rawReport.rejectedHypotheses ?? []);
        // Hech qanday rad etilgan gipoteza bo'lmasa ham, foydalanuvchi uchun chala bo'lib ko'rinmasligi uchun izoh beramiz
        if (!Array.isArray(rejectedHypotheses) || rejectedHypotheses.length === 0) {
            rejectedHypotheses = [{
                name: 'Aniq rad etilgan differensial tashxislar kiritilmagan',
                reason: 'Konsilium davomida muqobil tashxislar ustida bahs bo\'lgan bo\'lishi mumkin, ammo yakuniy hisobotda aniq rad etilgan gipoteza alohida ko\'rsatilmagan.'
            }];
        }
        let medicationRecommendations = (Array.isArray(rawReport.medicationRecommendations) ? rawReport.medicationRecommendations : []).map((m: { name?: string; dosage?: string; notes?: string; localAvailability?: string; priceEstimate?: string }) => {
            const name = String(m?.name ?? '').trim();
            const localAvailability = String(m?.localAvailability ?? '').trim();
            return {
                name: name || localAvailability || 'Dori',
                dosage: String(m?.dosage ?? '').trim(),
                notes: String(m?.notes ?? ''),
                localAvailability: localAvailability || undefined,
                priceEstimate: m?.priceEstimate,
            };
        });
        // Agar dori tavsiyalari bo'sh bo'lsa, tashxis asosida o'zimiz aniqlaymiz (fallback)
        if (medicationRecommendations.length === 0) {
            const diagnosisNames = (normalizeConsensusDiagnosis(rawReport.consensusDiagnosis).map(d => d.name).filter(Boolean)).slice(0, 3);
            if (diagnosisNames.length > 0) {
                try {
                    const fallbackMedsPrompt = `Tashxis(lar): ${diagnosisNames.join(', ')}. Ushbu tashxis(lar) uchun O'zbekistonda mavjud, bemor uchun eng kerakli 2–5 ta dori tavsiya qiling. Har biri uchun: name (savdo nomi), dosage (aniq doza), notes (qanday ichish, ovqatdan oldin/keyin, kuniga necha marta — qisqa yo'riqnoma), localAvailability. FAQAT JSON massiv: [{"name":"...","dosage":"...","notes":"...","localAvailability":"..."}]. Ortiqcha dori yozmang. TIL: ${langMap[language]}.`;
                    const fallbackRaw = await callGemini(fallbackMedsPrompt, DEPLOY_FAST, { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dosage: { type: 'string' }, notes: { type: 'string' }, localAvailability: { type: 'string' } } } }, false, systemInstr, true, 2048) as unknown;
                    const fallbackArr = Array.isArray(fallbackRaw) ? fallbackRaw : (fallbackRaw && typeof fallbackRaw === 'object' && Array.isArray((fallbackRaw as Record<string, unknown>).medications) ? (fallbackRaw as Record<string, unknown>).medications : []);
                    const fallbackMeds = (Array.isArray(fallbackArr) ? fallbackArr : []).map((m: { name?: string; dosage?: string; notes?: string; localAvailability?: string }) => ({
                        name: String(m?.name ?? '').trim() || 'Dori',
                        dosage: String(m?.dosage ?? '').trim(),
                        notes: String(m?.notes ?? ''),
                        localAvailability: (m?.localAvailability && String(m.localAvailability).trim()) || undefined,
                    }));
                    if (fallbackMeds.length > 0) medicationRecommendations = fallbackMeds;
                } catch {
                    // ignore fallback failure
                }
            }
        }
        const planItemToStr = (item: unknown): string => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                const o = item as Record<string, unknown>;
                return [o.step, o.details, o.urgency, o.action, o.description, o.text]
                    .filter(v => v != null && String(v).trim()).map(String).join(' - ') || JSON.stringify(item);
            }
            return String(item ?? '');
        };
        const rawPlan = Array.isArray(rawReport.treatmentPlan) ? rawReport.treatmentPlan : [];
        let treatmentPlan = rawPlan.map(planItemToStr).filter(s => s.trim());
        if (treatmentPlan.length === 0) {
            const diagnosisNames = normalizeConsensusDiagnosis(rawReport.consensusDiagnosis)
                .map(d => d.name)
                .filter(Boolean)
                .slice(0, 3);
            const medHints = medicationRecommendations
                .map(m => `${String(m.name ?? '').trim()}: ${String(m.dosage ?? '').trim()}`)
                .filter(s => s.length > 3)
                .slice(0, 5)
                .join('; ');
            if (diagnosisNames.length > 0 || medHints) {
                try {
                    const fallbackPlanPrompt = `Klinik tashxis(lar): ${diagnosisNames.join(', ') || 'aniq emas'}.
Tavsiya etilgan dorilar (qisqa): ${medHints || 'kiritilmagan'}.
Vazifa: 3-5 ta ketma-ket davolash bosqichi — har biri bitta qisqa, aniq jumla (amaliy qadam). Ortiqcha izoh yo'q. TIL: ${langMap[language]}.
FAQAT JSON massiv: ["...","..."].`;
                    const fallbackRaw = await callGemini(
                        fallbackPlanPrompt,
                        DEPLOY_FAST,
                        { type: 'array', items: { type: 'string' } },
                        false,
                        systemInstr,
                        true,
                        1024,
                    ) as unknown;
                    const arr = Array.isArray(fallbackRaw) ? fallbackRaw : [];
                    const cleaned = arr.map((s) => String(s ?? '').trim()).filter(Boolean);
                    if (cleaned.length > 0) treatmentPlan = cleaned;
                } catch {
                    // ignore fallback failure
                }
            }
        }

        const prognosisStatusMessages: Record<Language, string> = {
            'uz-L': 'Kasallik prognozi tayyorlanmoqda...',
            'uz-C': 'Касаллик прогнози тайёрланмоқда...',
            'ru': 'Формируется прогноз заболевания...',
            'en': 'Generating disease prognosis...',
        };
        onProgress({ type: 'status', message: prognosisStatusMessages[language] || prognosisStatusMessages['uz-L'] });
        let generatedPrognosis: PrognosisReport | null = null;
        try {
            const consensusNames = normalizeConsensusDiagnosis(rawReport.consensusDiagnosis).map(d => d.name).filter(Boolean).join('; ');
            generatedPrognosis = await generatePrognosisUpdate(debateHistory, patientData, language, consensusNames || undefined);
        } catch (e) {
            logger.warn('prognosis generation failed', e);
        }
        const prognosisReport = ensurePrognosisReport(generatedPrognosis, rawReport, patientData, language);
        lastLivePrognosis = prognosisReport;
        onProgress({ type: 'prognosis_update', data: prognosisReport });

        const folkMedicine = normalizeFolkMedicine((rawReport as unknown as { folkMedicine?: unknown }).folkMedicine);
        const nutritionPrevention = normalizeNutritionPrevention(
            (rawReport as unknown as { nutritionPrevention?: unknown }).nutritionPrevention,
        );

        const reportWithPrognosis: FinalReport = {
            ...rawReport,
            prognosisReport,
            rejectedHypotheses,
            medicationRecommendations,
            treatmentPlan: treatmentPlan.length > 0 ? treatmentPlan : rawPlan.map((x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x))).filter(Boolean),
            unexpectedFindings: typeof rawReport.unexpectedFindings === 'string' ? rawReport.unexpectedFindings : String(rawReport.unexpectedFindings ?? ''),
            ...(folkMedicine ? { folkMedicine } : {}),
            ...(nutritionPrevention ? { nutritionPrevention } : {}),
        };
        onProgress({ type: 'report', data: reportWithPrognosis, detectedMedications: [] });
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
        type: 'object',
        properties: {
            rhythm: { type: 'string' },
            heartRate: { type: 'string' },
            prInterval: { type: 'string' },
            qrsDuration: { type: 'string' },
            qtInterval: { type: 'string' },
            axis: { type: 'string' },
            morphology: { type: 'string' },
            interpretation: { type: 'string' },
        },
        required: ['rhythm', 'heartRate', 'prInterval', 'qrsDuration', 'qtInterval', 'axis', 'morphology', 'interpretation']
    };
    
    return callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr);
};

const UZI_UTT_URGENCY: UziUttUrgency[] = ['routine', 'soon', 'urgent', 'emergent'];

/** AI ba'zan massiv ichiga obyekt qaytaradi — String(x) "[object Object]" bo'ladi; matnga aylantiramiz. */
function unknownToPlainString(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) {
        return v.map(unknownToPlainString).filter(Boolean).join('; ');
    }
    if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const tryKeys = [
            'text', 'finding', 'description', 'content', 'value', 'recommendation',
            'name', 'diagnosis', 'label', 'title', 'impression', 'summary',
        ];
        for (const k of tryKeys) {
            const x = o[k];
            if (typeof x === 'string' && x.trim()) return x.trim();
        }
        if (typeof o.code === 'string' && typeof o.description === 'string') {
            return `${o.code.trim()}: ${o.description.trim()}`;
        }
        try {
            return JSON.stringify(o);
        } catch {
            return '';
        }
    }
    return String(v);
}

function normalizeStringArrayField(value: unknown): string[] {
    if (value == null) return [];
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        const o = value as Record<string, unknown>;
        if (Array.isArray(o.items)) {
            return normalizeStringArrayField(o.items);
        }
        if (Array.isArray(o.keyFindings)) {
            return normalizeStringArrayField(o.keyFindings);
        }
        if (Array.isArray(o.findings)) {
            return normalizeStringArrayField(o.findings);
        }
        if (Array.isArray(o.recommendations)) {
            return normalizeStringArrayField(o.recommendations);
        }
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => unknownToPlainString(item))
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        const t = value.trim();
        if (!t) return [];
        if (t.includes('\n')) {
            return t
                .split(/\n/)
                .map((s) => s.replace(/^\s*[\d]+[.)]\s*/, '').replace(/^[•\-*]\s*/, '').trim())
                .filter(Boolean);
        }
        return [t];
    }
    if (typeof value === 'object') {
        const s = unknownToPlainString(value);
        return s ? [s] : [];
    }
    return [];
}

function normalizeDifferentialField(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (typeof value === 'string') {
        const t = value.trim();
        return t || undefined;
    }
    if (Array.isArray(value)) {
        const lines = normalizeStringArrayField(value);
        return lines.length ? lines.join('\n') : undefined;
    }
    const s = unknownToPlainString(value);
    return s || undefined;
}

function normalizeUziUttReport(raw: unknown): UziUttReport {
    const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const urg = String(r.urgencyLevel ?? 'routine');
    const urgencyLevel = UZI_UTT_URGENCY.includes(urg as UziUttUrgency) ? (urg as UziUttUrgency) : 'routine';
    return {
        studyType: unknownToPlainString(r.studyType),
        regionOrOrgan: unknownToPlainString(r.regionOrOrgan),
        techniqueNotes: normalizeDifferentialField(r.techniqueNotes),
        keyFindings: normalizeStringArrayField(r.keyFindings),
        measurements: r.measurements != null ? unknownToPlainString(r.measurements) : undefined,
        impression: unknownToPlainString(r.impression),
        clinicalConclusion: unknownToPlainString(r.clinicalConclusion),
        recommendations: normalizeStringArrayField(r.recommendations),
        differentialDiagnosis: normalizeDifferentialField(r.differentialDiagnosis),
        limitations: r.limitations != null ? unknownToPlainString(r.limitations) : undefined,
        urgencyLevel,
    };
}

/**
 * UZI/UTT: bir yoki bir nechta rasm yoki PDF protokolni tahlil qiladi (multimodal).
 */
export const analyzeUziUttDocuments = async (
    files: Array<{ base64Data: string; mimeType: string; fileName?: string }>,
    language: Language,
    clinicalContext?: string,
): Promise<UziUttReport> => {
    if (!files.length) {
        throw new Error("Kamida bitta fayl yuklang.");
    }
    const systemInstr = getSystemInstruction(language);
    const lang = langMap[language] || 'Uzbek';
    const ctx = (clinicalContext ?? '').trim();
    const intro = [
        'You are an expert radiologist and clinical ultrasound specialist.',
        'Analyze ALL attached documents (ultrasound UZI/UTT reports, scanned protocols, or still images). Studies may be any modality (abdomen, pelvis, thyroid, vascular, obstetric, etc.).',
        `Write every human-readable field in ${lang} (clinical style). Do not leave studyType, regionOrOrgan, keyFindings, impression, or clinicalConclusion empty unless the image truly has no readable data — then explain in limitations.`,
        ctx ? `Additional clinical context from the clinician: ${ctx}` : '',
        'Rules: (1) Summarize only what is supported by the attachments; (2) If text is illegible or quality is poor, state this in limitations; (3) Do not invent numeric measurements that are not visible; (4) Set urgencyLevel to emergent/urgent if critical or acute findings are described.',
        'JSON STRICT: keyFindings and recommendations MUST be JSON arrays of plain strings only — one short sentence per string. Never put objects inside arrays.',
        'differentialDiagnosis MUST be one plain string (or empty string), not an array of objects. limitations MUST be plain string in the same language as other fields.',
        'Return ONLY valid JSON matching the schema.',
    ].filter(Boolean).join('\n');

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: intro }];
    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        parts.push({ text: `Attachment ${i + 1}: ${f.fileName || 'file'}` });
        parts.push({ inlineData: { mimeType: f.mimeType, data: f.base64Data } });
    }

    const prompt = { parts };
    const schema = {
        type: 'object',
        properties: {
            studyType: { type: 'string', description: 'e.g. abdominal US, pelvic UTT' },
            regionOrOrgan: { type: 'string' },
            techniqueNotes: { type: 'string' },
            keyFindings: { type: 'array', items: { type: 'string' } },
            measurements: { type: 'string' },
            impression: { type: 'string' },
            clinicalConclusion: { type: 'string' },
            recommendations: { type: 'array', items: { type: 'string' } },
            differentialDiagnosis: { type: 'string' },
            limitations: { type: 'string' },
            urgencyLevel: { type: 'string', enum: ['routine', 'soon', 'urgent', 'emergent'] },
        },
        required: [
            'studyType',
            'regionOrOrgan',
            'keyFindings',
            'impression',
            'clinicalConclusion',
            'recommendations',
            'urgencyLevel',
        ],
    };

    const raw = await callGemini(prompt, DEPLOY_PRO, schema, false, systemInstr, true, 8192);
    return normalizeUziUttReport(raw);
};

export const getIcd10Codes = async (diagnosis: string, language: Language): Promise<Icd10Code[]> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Provide ICD-10 codes for "${diagnosis}". ICD-10 is used in Uzbekistan (O'zbekiston) for official statistics and documentation. Return JSON array [{code, description}]. Output Language: ${langMap[language]}.`;
    const schema = {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                code: { type: 'string' },
                description: { type: 'string' },
            },
            required: ['code', 'description'],
        }
    };
    return callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr);
};

export const searchClinicalGuidelines = async (query: string, language: Language): Promise<GuidelineSearchResult> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Summarize clinical guidelines for "${query}". Prefer and prioritize: (1) Uzbekistan SSV (Sog'liqni Saqlash Vazirligi) approved national clinical protocols, (2) WHO and international guidelines adopted in Uzbekistan. Output Language: ${langMap[language]}.`;
    // Azure OpenAI doesn't support Google Search grounding - plain text call
    const summary = await callGemini(prompt, DEPLOY_PRO, undefined, false, systemInstr) as string;
    return {
        summary,
        sources: [],
    };
};

export const interpretLabValue = async (labValue: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Interpret lab value: "${labValue}". Explain clinical significance. Use O'zbekiston LITS (Laboratoriya-indekslar va tibbiy standartlar) va SI birliklariga mos izoh bering; agar birlik ko'rsatilmasa, O'zbekistonda qo'llaniladigan odatiy birliklarni nazarda tuting. Output Language: ${langMap[language]}.`;
    return callGemini(prompt, DEPLOY_PRO, undefined, false, systemInstr) as Promise<string>;
};

export const generatePatientExplanation = async (clinicalText: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Translate clinical text to simple patient language. Text: "${clinicalText}". Output Language: ${langMap[language]}.`;
    return callGemini(prompt, DEPLOY_FAST, undefined, false, systemInstr) as Promise<string>;
};

export const expandAbbreviation = async (abbreviation: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Expand medical abbreviation "${abbreviation}". Output Language: ${langMap[language]}.`;
    return callGemini(prompt, DEPLOY_FAST, undefined, false, systemInstr) as Promise<string>;
};

export const generateDischargeSummary = async (patientData: PatientData, finalReport: FinalReport, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...rest } = patientData;
    const prompt = `Generate Discharge Summary. Patient: ${JSON.stringify(rest)}. Report: ${JSON.stringify(finalReport)}. Output Language: ${langMap[language]}.`;
    return callGemini(prompt, DEPLOY_PRO, undefined, false, systemInstr) as Promise<string>;
};

export const generateInsurancePreAuth = async (patientData: PatientData, finalReport: FinalReport, procedure: string, language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...rest } = patientData;
    const prompt = `Write Insurance Pre-Auth letter for "${procedure}". Patient: ${JSON.stringify(rest)}. Report: ${JSON.stringify(finalReport)}. Output Language: ${langMap[language]}.`;
    return callGemini(prompt, DEPLOY_PRO, undefined, false, systemInstr) as Promise<string>;
};

export const calculatePediatricDose = async (drugName: string, weightKg: number, language: Language): Promise<PediatricDose> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Calculate pediatric dose for ${drugName}, weight ${weightKg}kg. Return JSON {drugName, dose, calculation, warnings}. Output Language: ${langMap[language]}.`;
    const schema = {
        type: 'object',
        properties: {
            drugName: { type: 'string' },
            dose: { type: 'string' },
            calculation: { type: 'string' },
            warnings: { type: 'array', items: { type: 'string' } },
        },
        required: ['drugName', 'dose', 'calculation', 'warnings'],
    };
    return callGemini(prompt, DEPLOY_PRO, schema, false, systemInstr);
};

export const calculateRiskScore = async (scoreType: string, patientData: PatientData, language: Language): Promise<RiskScore> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...rest } = patientData;
    const prompt = `Calculate ${scoreType} score. Patient: ${JSON.stringify(rest)}. Return JSON {name, score, interpretation}. Output Language: ${langMap[language]}.`;
    const schema = {
        type: 'object',
        properties: {
            name: { type: 'string' },
            score: { type: 'string' },
            interpretation: { type: 'string' },
        },
        required: ['name', 'score', 'interpretation'],
    };
    return callGemini(prompt, DEPLOY_PRO, schema, false, systemInstr);
};

export const generatePatientEducationContent = async (report: FinalReport, language: Language): Promise<PatientEducationTopic[]> => {
    const systemInstr = getSystemInstruction(language);
    const prompt = `Create 3-4 patient education topics based on report. Return JSON array [{title, content}]. Output Language: ${langMap[language]}.`;
    const schema = {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                language: { type: 'string' },
            },
            required: ['title', 'content'],
        }
    };
    return callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr);
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
        Task: Respond to user and continue debate. Use SSV protocols as baseline; you may suggest evidence-based alternative or innovative options for better outcomes. Uzbekistan context (drugs, standards).
        LANGUAGE: ${langMap[language]}.
        History: ${JSON.stringify(debateHistory)}
    `;
    
    const prompt = buildMultimodalPrompt(promptText, patientData);
    const response = await callGemini(prompt, DEPLOY_FAST, undefined, false, systemInstr) as string;
    
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
        Task: Analyze "What if" scenario: "${scenario}". Use SSV klinik protokollari as baseline; if scenario justifies, suggest protocol-deviating or innovative options. Recommend drugs registered and available in Uzbekistan (Nimesil, Sumamed, Augmentin, Metformin va hokazo).
        LANGUAGE: ${langMap[language]}.
        Original Debate: ${JSON.stringify(debateHistory)}
    `;
    
    const prompt = buildMultimodalPrompt(promptText, patientData);

    const finalReportSchema = {
        type: 'object',
        properties: {
            consensusDiagnosis: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, probability: { type: 'number' }, justification: { type: 'string' }, evidenceLevel: { type: 'string' } } } },
            treatmentPlan: { type: 'array', items: { type: 'string' } },
            medicationRecommendations: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dosage: { type: 'string' }, notes: { type: 'string' } } } },
            rejectedHypotheses: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }}},
            recommendedTests: { type: 'array', items: { type: 'string' } },
            unexpectedFindings: { type: 'string' },
            uzbekistanLegislativeNote: { type: 'string' },
        },
    };

    return callGemini(prompt, DEPLOY_PRO, finalReportSchema, false, systemInstr) as Promise<FinalReport>;
};

export const explainRationale = async (message: ChatMessage, patientData: PatientData, debateHistory: ChatMessage[], language: Language): Promise<string> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...rest } = patientData;
    const prompt = `Explain medical rationale for message: "${message.content}". Reference symptoms and protocols. LANGUAGE: ${langMap[language]}. Patient: ${JSON.stringify(rest)}.`;
    return callGemini(prompt, DEPLOY_PRO, undefined, false, systemInstr) as Promise<string>;
};

export const suggestCmeTopics = async (history: AnalysisRecord[], language: Language): Promise<CMETopic[]> => {
    if (history.length === 0) return [];
    const systemInstr = getSystemInstruction(language);
    const prompt = `Suggest 2-3 CME topics based on history. Return JSON array [{topic, relevance}]. LANGUAGE: ${langMap[language]}. History: ${JSON.stringify(history.map(r => (Array.isArray(r.finalReport?.consensusDiagnosis) ? r.finalReport.consensusDiagnosis : [])[0]?.name))}.`;
    const schema = {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                topic: { type: 'string' },
                relevance: { type: 'string' },
            },
            required: ['topic', 'relevance'],
        },
    };
    return callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr);
};

export const runResearchCouncilDebate = async (
    diseaseName: string,
    onProgress: (update: ResearchProgressUpdate) => void,
    language: Language
): Promise<void> => {
    const systemInstr = getSystemInstruction(language);
    onProgress({ type: 'status', message: `Research Topic: "${diseaseName}". Gathering data...` });

    const specialists = [AIModel.GPT, AIModel.LLAMA, AIModel.CLAUDE];
    for (const model of specialists) {
        const translatedIntro = await callGemini(`Translate to ${langMap[language]}: "I am ${model}, ready to analyze the latest research on ${diseaseName}."`, DEPLOY_FAST, undefined, false, systemInstr);
        onProgress({ type: 'message', message: { id: `${model}-${Date.now()}`, author: model, content: translatedIntro as string, isThinking: false } });
    }
    
    onProgress({ type: 'status', message: 'Discussing innovative strategies...' });
    
    const prompt = `Provide detailed research report on "${diseaseName}". Use web search for latest data. Return ONLY valid JSON (no markdown, no extra text). The JSON must have these fields: diseaseName, summary, epidemiology {prevalence, incidence, keyRiskFactors[]}, pathophysiology, emergingBiomarkers [{name, type, description}], clinicalGuidelines [{guidelineTitle, source, recommendations [{category, details[]}]}], potentialStrategies [{name, mechanism, evidence, pros[], cons[], riskBenefit {risk, benefit}, developmentRoadmap [{stage, duration, cost}], molecularTarget {name, pdbId}, ethicalConsiderations[], requiredCollaborations[], companionDiagnosticNeeded}], pharmacogenomics {relevantGenes [{gene, mutation, impact}], targetSubgroup}, patentLandscape {competingPatents [{patentId, title, assignee}], whitespaceOpportunities[]}, relatedClinicalTrials [{trialId, title, status, url}], strategicConclusion, sources [{title, uri}]. LANGUAGE: ${langMap[language]}.`;

    const researchReportSchema = {
      type: 'object',
      properties: {
        diseaseName: { type: 'string' },
        summary: { type: 'string' },
        epidemiology: {
          type: 'object',
          properties: {
            prevalence: { type: 'string' },
            incidence: { type: 'string' },
            keyRiskFactors: { type: 'array', items: { type: 'string' } },
          },
        },
        pathophysiology: { type: 'string' },
        emergingBiomarkers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
        clinicalGuidelines: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    guidelineTitle: { type: 'string' },
                    source: { type: 'string' },
                    recommendations: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                category: { type: 'string' },
                                details: { type: 'array', items: { type: 'string' } },
                            },
                        },
                    },
                },
            },
        },
        potentialStrategies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              mechanism: { type: 'string' },
              evidence: { type: 'string' },
              pros: { type: 'array', items: { type: 'string' } },
              cons: { type: 'array', items: { type: 'string' } },
              riskBenefit: {
                type: 'object',
                properties: {
                  risk: { type: 'string' },
                  benefit: { type: 'string' },
                },
              },
              developmentRoadmap: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        stage: { type: 'string' },
                        duration: { type: 'string' },
                        cost: { type: 'string' },
                    }
                }
              },
              molecularTarget: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    pdbId: { type: 'string' }
                }
              },
              ethicalConsiderations: { type: 'array', items: { type: 'string' } },
              requiredCollaborations: { type: 'array', items: { type: 'string' } },
              companionDiagnosticNeeded: { type: 'string' },
            },
          },
        },
        pharmacogenomics: {
            type: 'object',
            properties: {
                relevantGenes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            gene: { type: 'string' },
                            mutation: { type: 'string' },
                            impact: { type: 'string' },
                        }
                    }
                },
                targetSubgroup: { type: 'string' },
            }
        },
        patentLandscape: {
            type: 'object',
            properties: {
                competingPatents: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            patentId: { type: 'string' },
                            title: { type: 'string' },
                            assignee: { type: 'string' },
                        }
                    }
                },
                whitespaceOpportunities: { type: 'array', items: { type: 'string' } }
            }
        },
        relatedClinicalTrials: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    trialId: { type: 'string' },
                    title: { type: 'string' },
                    status: { type: 'string' },
                    url: { type: 'string' },
                }
            }
        },
        strategicConclusion: { type: 'string' },
        sources: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    uri: { type: 'string' },
                }
            }
        }
      },
    };

    try {
        // Azure OpenAI - JSON response (no grounding/web search available)
        const rawText = await callGemini(prompt, DEPLOY_PRO, {}, false, systemInstr) as string;
        const cleanedText = (rawText || '').replace(/^```json\s*|```\s*$/g, '').trim();

        let reportData: ResearchReport;
        try {
            reportData = JSON.parse(cleanedText);
        } catch {
            const repaired = tryRepairTruncatedJson(cleanedText);
            if (repaired) {
                reportData = repaired as ResearchReport;
            } else {
                throw new Error("Tadqiqot hisoboti JSON formatida kelmadi.");
            }
        }
        // No grounding sources from Azure
        if (!reportData.sources) reportData.sources = [];

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
O'zbekistonda mavjud dori vositalari va SSV protokollarini asos qiling; dalil bo'lsa alternativ yoki innovatsion yondashuvlarni ham ko'rsating.
JSON tashqarisida hech qanday matn yozmang.`;
};

export const checkDrugInteractions = async (drugs: string[], language: Language): Promise<{
    severity: string;
    description: string;
    clinicalSignificance: string;
    recommendations: string[];
}> => {
    const systemInstr = getDrugToolSystemInstruction(language);
    const prompt = `Quyidagi dorilarni BIRGA qabul qilish xavfsizmi? Dorilar: ${drugs.join(', ')}.

Har bir kombinatsiya bo'yicha klinik jihatdan CHUQUR tahlil qiling:
- Farmakodinamik va farmakokinetik mexanizmlarini qisqacha tushuntiring.
- Real amaliyotdagi asosiy xavflarni va eng yomon ssenariyni aytib bering.
- Monitoring va dozani o'zgartirish bo'yicha aniq, amaliy tavsiyalar yozing.

JSON formatda faqat quyidagilarni qaytaring (batafsil matnlar bilan):
{
  "severity": "High | Moderate | Low | None",
  "description": "O'zaro ta'sirning batafsil tavsifi (kamida 3-4 jumla, klinik misollar bilan)",
  "clinicalSignificance": "Bemor uchun klinik ahamiyati (nimalarga e'tibor berish kerak, qaysi guruh bemorlarda xavf yuqori)",
  "recommendations": [
    "Qaysi dori(lar) dozasini o'zgartirish yoki bekor qilish kerak (aniq misol bilan)",
    "Monitoring (bosim, EKG, INR, buyrak/jigar funktsiyasi va h.k.) bo'yicha aniq tavsiyalar",
    "Qachon shoshilinch shifokorga murojaat qilish kerak (aniq klinik belgilar bilan)",
    "Zarur bo'lsa, muqobil xavfsizroq dori kombinatsiyasi"
  ]
}

Output Language: ${langMap[language]}.`;

    const schema = {
        type: 'object',
        properties: {
            severity: { type: 'string', enum: ['High', 'Moderate', 'Low', 'None'] },
            description: { type: 'string' },
            clinicalSignificance: { type: 'string' },
            recommendations: { type: 'array', items: { type: 'string' } }
        }
    };

    const raw = await callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr, true, 896) as Record<string, unknown>;

    const sevRaw = String((raw as any).severity || '').toLowerCase();
    let severityUz = 'Xavf aniqlanmadi';
    if (sevRaw.includes('high') || sevRaw.includes('yuqori')) severityUz = 'Yuqori';
    else if (sevRaw.includes('moderate') || sevRaw.includes("o'rta") || sevRaw.includes('orta')) severityUz = "O'rta";
    else if (sevRaw.includes('low') || sevRaw.includes('past')) severityUz = 'Past';

    const recs = Array.isArray(raw.recommendations)
        ? (raw.recommendations as unknown[]).map(r => String(r)).filter(Boolean)
        : [];

    let description = String((raw as any).description || '');
    let clinicalSignificance = String((raw as any).clinicalSignificance || '');

    // Agar model qisqa yoki bo'sh matn bergan bo'lsa, dorilarga asoslangan batafsil matnni alohida so'raymiz
    if (!description) {
        if (severityUz === 'Yuqori' || severityUz === "O'rta" || severityUz === 'Past') {
            try {
                const descPrompt = `
Siz klinik farmakologsiz. Quyidagi dorilar kombinatsiyasi bo'yicha BATTAFSIL izoh yozing:
Dorilar: ${drugs.join(', ')}.
Xavf darajasi: ${severityUz}.

Talablar:
- Har bir dori nomini matnda qayta tilga oling.
- O'zaro ta'sirning asosiy farmakodinamik va/yoki farmakokinetik mexanizmini tushuntiring.
- Klinik misol(lar) keltiring: qaysi holatlarda ayniqsa xavfli bo'ladi.
- Kamida 3-4 jumla yozing.

Faqat soddalashtirilgan matn yozing, hech qanday ro'yxat, bullet, JSON yoki kod ishlatmang.
Javob tili: ${langMap[language]}.
`;
                description = await callGemini(descPrompt, DEPLOY_FAST, undefined, false, getSystemInstruction(language)) as string;
            } catch {
                description = `Quyidagi dorilar kombinatsiyasi (${drugs.join(', ')}) uchun AI aniq mexanizmni qaytarmadi, lekin xavf darajasi "${severityUz}". Klinik holatga qarab ehtiyotkorlik bilan qo'llash va qo'shimcha manbalarni ko'rib chiqish zarur.`;
            }
        } else {
            description = `Mavjud ma'lumotlarga ko'ra ${drugs.join(', ')} kombinatsiyasi bo'yicha klinik ahamiyatli o'zaro ta'sir aniqlanmadi. Shunga qaramay, bemorning umumiy holatini individual baholash kerak.`;
        }
    }

    if (!clinicalSignificance) {
        if (severityUz === 'Yuqori' || severityUz === "O'rta" || severityUz === 'Past') {
            try {
                const signifPrompt = `
Siz tajribali klinik farmakologsiz. Quyidagi dorilar kombinatsiyasi (${drugs.join(', ')}) uchun
"${severityUz}" xavf darajasiga mos ravishda BEMOR UCHUN KLINIK AHAMIYATINI batafsil tushuntiring.

Talablar:
- Qaysi bemor guruhlari uchun (yoshi katta, surunkali buyrak/jigar yetishmovchiligi, yurak yetishmovchiligi va h.k.) xavf yuqori bo'lishi mumkinligini aniq yozing.
- Qanday monitoring zarur: qon bosimi, yurak urishi, EKG, INR, buyrak/jigar funksiyasi va h.k.
- Qachon dozani o'zgartirish yoki dori(lar)ni almashtirish kerak bo'lishi mumkinligini tushuntiring.
- Kamida 3-4 jumla yozing.

Faqat izoh matnini yozing, ro'yxat va JSON ishlatmang.
Javob tili: ${langMap[language]}.
`;
                clinicalSignificance = await callGemini(signifPrompt, DEPLOY_FAST, undefined, false, getSystemInstruction(language)) as string;
            } catch {
                clinicalSignificance = `Ushbu kombinatsiya (${drugs.join(', ')}) uchun "${severityUz}" xavf darajasi taxmin qilinmoqda. Ayniqsa xavf guruhi hisoblangan bemorlarda (keksa yosh, ko'p dori qabul qiladiganlar, yurak yoki buyrak/jigar yetishmovchiligi borlar) yaqin monitoring va dozani ehtiyotkorlik bilan tanlash zarur.`;
            }
        } else {
            clinicalSignificance = `Mavjud ma'lumotlarga ko'ra ${drugs.join(', ')} kombinatsiyasi odatda xavfsiz hisoblanadi, lekin individual bemor holatini hisobga olib, standart klinik kuzatuv o'tkazish tavsiya etiladi.`;
        }
    }

    return {
        severity: severityUz,
        description,
        clinicalSignificance,
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
        type: 'object',
        properties: {
            name: { type: 'string' },
            activeIngredient: { type: 'string' },
            dosage: { type: 'string' },
            indications: { type: 'array', items: { type: 'string' } },
            contraindications: { type: 'array', items: { type: 'string' } },
            sideEffects: { type: 'array', items: { type: 'string' } },
            dosageInstructions: { type: 'string' },
            availabilityInUzbekistan: { type: 'string' },
            priceRange: { type: 'string' }
        }
    };

    const raw = await callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr, true, 640) as Record<string, unknown>;
    const toArray = (v: unknown): string[] => {
        if (!v) return [];
        if (Array.isArray(v)) return v.map(x => String(x)).filter(Boolean);
        return [String(v)];
    };

    let indications = toArray((raw as any).indications);
    let contraindications = toArray((raw as any).contraindications);
    let sideEffects = toArray((raw as any).sideEffects);

    if (indications.length === 0) indications = ["Ma'lumot topilmadi"];
    if (contraindications.length === 0) contraindications = ["Ma'lumot topilmadi"];
    if (sideEffects.length === 0) sideEffects = ["Ma'lumot topilmadi"];

    const dosageInstructions = String((raw as any).dosageInstructions || "Ma'lumot topilmadi");
    const availabilityInUzbekistan = String((raw as any).availabilityInUzbekistan || "Ma'lumot topilmadi");
    const priceRange = String((raw as any).priceRange || "Ma'lumot topilmadi");

    return {
        name: String((raw as any).name || ''),
        activeIngredient: String((raw as any).activeIngredient || "Ma'lumot topilmadi"),
        dosage: String((raw as any).dosage || "Ma'lumot topilmadi"),
        indications,
        contraindications,
        sideEffects,
        dosageInstructions,
        availabilityInUzbekistan,
        priceRange,
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
        type: 'object',
        properties: {
            name: { type: 'string' },
            activeIngredient: { type: 'string' },
            dosage: { type: 'string' },
            indications: { type: 'array', items: { type: 'string' } },
            contraindications: { type: 'array', items: { type: 'string' } },
            sideEffects: { type: 'array', items: { type: 'string' } },
            dosageInstructions: { type: 'string' },
            availabilityInUzbekistan: { type: 'string' },
            priceRange: { type: 'string' }
        }
    };

    const raw = await callGemini(prompt, DEPLOY_FAST, schema, false, systemInstr, true, 640) as Record<string, unknown>;
    const toArray = (v: unknown): string[] => {
        if (!v) return [];
        if (Array.isArray(v)) return v.map(x => String(x)).filter(Boolean);
        return [String(v)];
    };

    let indications = toArray((raw as any).indications);
    let contraindications = toArray((raw as any).contraindications);
    let sideEffects = toArray((raw as any).sideEffects);

    if (indications.length === 0) indications = ["Ma'lumot topilmadi"];
    if (contraindications.length === 0) contraindications = ["Ma'lumot topilmadi"];
    if (sideEffects.length === 0) sideEffects = ["Ma'lumot topilmadi"];

    const dosageInstructions = String((raw as any).dosageInstructions || "Ma'lumot topilmadi");
    const availabilityInUzbekistan = String((raw as any).availabilityInUzbekistan || "Ma'lumot topilmadi");
    const priceRange = String((raw as any).priceRange || "Ma'lumot topilmadi");

    return {
        name: String((raw as any).name || ''),
        activeIngredient: String((raw as any).activeIngredient || "Ma'lumot topilmadi"),
        dosage: String((raw as any).dosage || "Ma'lumot topilmadi"),
        indications,
        contraindications,
        sideEffects,
        dosageInstructions,
        availabilityInUzbekistan,
        priceRange,
    };
};