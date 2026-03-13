import { GoogleGenAI } from '@google/genai';
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
import { normalizeConsensusDiagnosis } from '../types';
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

/* v1beta: 1.5-flash and 2.0-flash-exp 404; use stable IDs per Google docs */
const MODEL_FAST = 'gemini-2.5-flash';
const MODEL_PRO = 'gemini-2.5-pro';
/** Aliases used across council/debate */
const DEPLOY_FAST = MODEL_FAST;
const DEPLOY_PRO = MODEL_PRO;

/** Map model label to Gemini model name */
function mapModel(modelLabel: string): string {
  const m = (modelLabel || '').toLowerCase();
  if (m.includes('flash') || m.includes('mini')) return MODEL_FAST;
  return MODEL_PRO;
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
    1. Har bir xulosa uchun QADAMMA-QADAM MANTIQIY ZANJIR (chain-of-thought) yozing: "Sabab A в†’ natija B в†’ shuning uchun C."
    2. Differensial tashxisda har bir variant uchun "Nega bu ehtimol?" va "Nega boshqasi kamroq?" javob bering.
    3. Ishonch darajasini aniq bering (yuqori/o'rta/past) va qaysi ma'lumot yetishmasligi aniqlikni kamaytirishini ayting.
    4. XAVFSIZLIK: Bemor allergiyasi, joriy dori-darmonlar va buyrak/jigar funksiyasi bo'yicha har doim o'ylab bering; xavfli aralashuvlarni darhol bildiring.
    5. Qizil bayroqlar: keskin og'riq, nafas qisilishi, xushni yo'qotish, og'ir anemiya, septik belgilar kabi holatlarda shoshilinch tavsiya bering.
    6. ANATOMIK MANTIQ: Aniq anatomik jihatdan imkonsiz iboralarni (masalan, "tovonimdagi yurak", "oyog'im ichidagi jigar", bosh suyagida oshqozon va hokazo) so'zma-so'z qabul qilmang. Bunday hollarda:
       - ularni AQLGA TO'G'RI KELMAYDIGAN yoki ehtimol noto'g'ri yozilgan deb baholang;
       - bunday joylashuvga asoslangan tashxis/davolash bermang;
       - bemor/shifokorga muloyimlik bilan bu anatomik jihatdan mumkin emasligini tushuntiring va kerak bo'lsa to'g'ri joylashuvni aniqlashtirish uchun savol bering.
    7. FIZIOLOGIYA VA FIZIONOMIYA: Har bir holatda bemorning YOSHI, JINSI, VAZNI, VITAL KO'RSATKICHLARI (BP, yurak urishi, harorat, SpO2, nafas soni) va umumiy ko'rinishi (kaxeksiya, semizlik, shish, sianoz, rangparlik, dismorfik belgilar) NI INOBATGA OLING. 
       - Pediatr bemorlar (0вЂ“18 yosh) va keksalar (65+ yosh) uchun fiziologik chegaralar va dori dozalari boshqacha bo'lishini hisobga oling.
       - Homiladorlik, buyrak/jigar yetishmovchiligi, yurak yetishmovchiligi, diabet va boshqa surunkali kasalliklar fonida dori tanlash va dozalashni moslashtiring.
       - FIZIONOMIK BELGILAR (teri rangi, shish, nafas qisilishi, qiyofadagi og'riq ifodasi, nevrologik holat va h.k.) tashxis ehtimolini oshirishi yoki kamaytirishini mantiqan izohlab bering, lekin hech qachon diskriminatsion xulosa chiqarmang.
    8. MANTIQIY TROLLING VA MOS KELMASLIK: Agar foydalanuvchi ataylab chalg'ituvchi, o'zaro zid yoki fiziologik/anatomik jihatdan bir-biriga to'g'ri kelmaydigan ma'lumotlar kiritsa:
       - bularni jiddiy klinik ma'lumot sifatida qabul qilmang;
       - "bu ma'lumotlar o'zaro mos kelmaydi / mantiqan imkonsiz" ekanini muloyim, tushunarli va PROFESSIONALL tarzda tushuntiring;
       - bunday sharoitda tashxis va davolashni to'liq berishdan tiyiling, faqat umumiy klinik fikr va qanday ma'lumotlar kerakligini ko'rsating;
       - hazil/trolling shubha qilinsa ham, hech qachon qo'pol yoki hurmatsiz bo'lmang, faqat ilmiy mantiq orqali javob bering.
    `;

    const specificInstructions: Record<Language, string> = {
        'uz-L': `
        TIL: Barcha javoblaringiz qat'iy O'zbek tilida (Lotin grafikasida) bo'lishi SHART. Yulduzcha (*) va inglizcha iboralar (finding, implication, urgency, critical finding va hokazo) ISHLATMANG — ularni o'zbekcha yozing (topilma, oqibat, shoshilinchlik, muhim topilma). Tibbiy atamalar ham o'zbekcha yoki SSV qabul qilgan atamalar bo'lsin.
        O'ZBEKISTON KONTEKSTI (MAJBURIY): Tashxis, davolash rejasi va dori-darmonlar faqat O'zbekiston Respublikasi qonunchiligi va SSV (Sog'liqni Saqlash Vazirligi) tasdiqlangan klinik protokollarga muvofiq bo'lsin. Dori-darmonlar faqat O'zbekistonda ro'yxatdan o'tgan va aptekalarda mavjud savdo nomlari bilan (Nimesil, Sumamed, Augmentin, Metformin, Enalapril, Amlodipin, Omeprazol va hokazo).
        TERMINOLOGIYA: O'zbek tibbiyot terminologiyasi va SSV qabul qilgan atamalar.
        `,
        'uz-C': `
        РўРР›: Р‘Р°СЂС‡Р° Р¶Р°РІРѕР±Р»Р°СЂРёРЅРіРёР· Т›Р°С‚СЉРёР№ РЋР·Р±РµРє С‚РёР»РёРґР° (РљРёСЂРёР»Р» РіСЂР°С„РёРєР°СЃРёРґР°) Р±СћР»РёС€Рё РЁРђР Рў.
        РЋР—Р‘Р•РљРРЎРўРћРќ РљРћРќРўР•РљРЎРўР (РњРђР–Р‘РЈР РР™): РўР°С€С…РёСЃ, РґР°РІРѕР»Р°С€ СЂРµР¶Р°СЃРё РІР° РґРѕСЂРё-РґР°СЂРјРѕРЅР»Р°СЂ С„Р°Т›Р°С‚ РЋР·Р±РµРєРёСЃС‚РѕРЅ Р РµСЃРїСѓР±Р»РёРєР°СЃРё Т›РѕРЅСѓРЅС‡РёР»РёРіРё РІР° РЎРЎР’ С‚Р°СЃРґРёТ›Р»Р°РіР°РЅ РєР»РёРЅРёРє РїСЂРѕС‚РѕРєРѕР»Р»Р°СЂРіР° РјСѓРІРѕС„РёТ› Р±СћР»СЃРёРЅ. Р”РѕСЂРё-РґР°СЂРјРѕРЅР»Р°СЂ С„Р°Т›Р°С‚ РЋР·Р±РµРєРёСЃС‚РѕРЅРґР° СЂСћР№С…Р°С‚РґР°РЅ СћС‚РіР°РЅ РІР° Р°РїС‚РµРєР°Р»Р°СЂРґР° РјР°РІР¶СѓРґ СЃР°РІРґРѕ РЅРѕРјР»Р°СЂРё Р±РёР»Р°РЅ.
        РўР•Р РњРРќРћР›РћР“РРЇ: РЋР·Р±РµРє С‚РёР±Р±РёС‘С‚ С‚РµСЂРјРёРЅРѕР»РѕРіРёСЏСЃРё РІР° РЎРЎР’ Т›Р°Р±СѓР» Т›РёР»РіР°РЅ Р°С‚Р°РјР°Р»Р°СЂ.
        `,
        'kaa': `
        TIL: BarlД±q juwaplarД±Е„Д±z qataЕ„ Qaraqalpaq tilinde (Lotin grafikasД±nda) bolД±wД± SHГЃRT.
        Г“ZBEKISTAN KONTEKSTI (MAJBГљRI): Tashxis, emlew rejasi hГЎm dГЎri-darmonlar tek Г“zbekistan RespublikasД± qonunshД±lД±ЗµД± hГЎm SSV tasdД±qlagan klinikalД±q protokollarga sГЎykes bolsД±n. DГЎri-darmonlar tek Г“zbekistonda dizimnen Гіtken hГЎm aptekalarda bar savdo atlarД± menen.
        TERMINOLOGIYA: Qaraqalpaq/O'zbek medicinalД±q terminologiyasД±.
        `,
        'ru': `
        РЇР—Р«Рљ: Р’СЃРµ РІР°С€Рё РѕС‚РІРµС‚С‹ Р”РћР›Р–РќР« Р±С‹С‚СЊ СЃС‚СЂРѕРіРѕ РЅР° Р СѓСЃСЃРєРѕРј СЏР·С‹РєРµ.
        РљРћРќРўР•РљРЎРў РЈР—Р‘Р•РљРРЎРўРђРќРђ (РћР‘РЇР—РђРўР•Р›Р¬РќРћ): Р”РёР°РіРЅРѕР·, РїР»Р°РЅ Р»РµС‡РµРЅРёСЏ Рё РїСЂРµРїР°СЂР°С‚С‹ вЂ“ СЃС‚СЂРѕРіРѕ РІ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёРё СЃ Р·Р°РєРѕРЅРѕРґР°С‚РµР»СЊСЃС‚РІРѕРј Р РµСЃРїСѓР±Р»РёРєРё РЈР·Р±РµРєРёСЃС‚Р°РЅ Рё РєР»РёРЅРёС‡РµСЃРєРёРјРё РїСЂРѕС‚РѕРєРѕР»Р°РјРё, СѓС‚РІРµСЂР¶РґС‘РЅРЅС‹РјРё РњРёРЅР·РґСЂР°РІРѕРј (РЎРЎР’). РџСЂРµРїР°СЂР°С‚С‹ вЂ“ С‚РѕР»СЊРєРѕ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅС‹Рµ РІ РЈР·Р±РµРєРёСЃС‚Р°РЅРµ Рё РґРѕСЃС‚СѓРїРЅС‹Рµ РІ Р°РїС‚РµРєР°С… (С‚РѕСЂРіРѕРІС‹Рµ РЅР°Р·РІР°РЅРёСЏ: РќРёРјРёСЃРёР», РЎСѓРјР°РјРµРґ, РђСѓРіРјРµРЅС‚РёРЅ, РњРµС‚С„РѕСЂРјРёРЅ, Р­РЅР°Р»Р°РїСЂРёР» Рё С‚.Рґ.).
        РўР•Р РњРРќРћР›РћР“РРЇ: РџСЂРѕС„РµСЃСЃРёРѕРЅР°Р»СЊРЅР°СЏ РјРµРґРёС†РёРЅСЃРєР°СЏ С‚РµСЂРјРёРЅРѕР»РѕРіРёСЏ РЅР° СЂСѓСЃСЃРєРѕРј; РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё вЂ“ С‚РµСЂРјРёРЅС‹, РїСЂРёРЅСЏС‚С‹Рµ РІ РЈР·Р±РµРєРёСЃС‚Р°РЅРµ.
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
    AMALIY YORDAM (majburiy): Javoblaringiz shifokor darhol qo'llashi mumkin bo'lsin. Dori nomi + aniq doza + kuniga necha marta + davomiyligi; davolash rejasi 1-qadam, 2-qadam tarzida; SSV protokol nomi yoki yo'nalishi keltiring; "darhol qilish kerak" va "keyinroq/kuzatuv" ni ajrating. Umumiy so'zlar o'rniga konkret, amaliy tavsiyalar bering.
    ANIQLIK (majburiy): (1) Faqat kiritilgan ma'lumot va klinik dalillarga asoslangan xulosa chiqaring; ma'lumot yetishmasa "Tasdiqlash uchun ... tekshiruv kerak" deb aniq yozing. (2) Har bir tashxis uchun probability ni dalil kuchiga mos qo'ying; shubha bo'lsa pastroq bering. (3) reasoningChain va justification da "nima uchun shunday" savoliga aniq javob bo'lsin; umumiy iboralardan saqlaning. (4) SSV protokol havolasini aniq keltiring (yo'nalish yoki protokol nomi). (5) Taxminiy tashxisni yakuniy deb yozmang; differensial tashxisda eng ehtimolini birinchi qo'ying va dalil asosini ko'rsating.
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

/** Mobil qurilma (telefon) вЂ” sekin tarmoq va kesilishlarda ko'proq qayta urinish kerak */
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
    const sys = systemInstruction || "Siz professional tibbiy AI yordamchisiz. O'zbekiston SSV klinik protokollariga muvofiq javob bering.";

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

    const modelsToTry: string[] = [geminiModel];
    if (geminiModel === MODEL_FAST || geminiModel === DEPLOY_FAST) {
        modelsToTry.push('gemini-2.0-flash', 'gemini-1.5-flash-8b');
    }

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
        for (const m of modelsToTry) {
            try {
                return await executeCall(m);
            } catch (e) {
                lastErr = e;
                const msg = String((e as Error & { message?: string })?.message ?? e);
                const is404 = /404|not found|NOT_FOUND/i.test(msg);
                if (is404) {
                    logger.warning('Gemini model %s not available, trying next', m);
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
                maxRetries: mobile ? 2 : 1,
                initialDelay: mobile ? 600 : 400,
                retryableErrors: [
                    'network', 'timeout', 'fetch', 'connection', '503', 'unavailable', 'overloaded',
                    'parse_json', "noto'g'ri", 'javob', 'invalid json', 'failed to parse',
                    'rate_limit_exceeded', '429',
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

/** Doktor tez tahlili uchun: tarix kontekstisiz, minimal prompt вЂ” maksimal tezlik */
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


// --- SINGLE DOCTOR MODE (TEZKOR вЂ” faqat doktor profilida) ---
/** Tez tahlil: qisqa tizim вЂ” tez qaytish uchun */
const getFastDoctorSystemInstruction = (language: Language): string => {
    const til = langMap[language];
    return `Siz shifokor uchun amaliy tibbiy yordamchisiz. Javob: ${til}, FAQAT JSON.
QOIDALAR: Tashxis nomi aniq; justification 2-3 jumla dalilli (nega shunday tashxis); treatmentPlan 3-5 aniq qadam (1-qadam, 2-qadam); medications: O'zbekistonda mavjud savdo nomi (Nimesil, Sumamed, Metformin, Enalapril va h.k.) + doza + kuniga necha marta + davomiylik; uzbekProtocolMatch: qaysi SSV protokoliga mos (aniq nomi yoki yo'nalishi). criticalFinding faqat shoshilinch bo'lsa. Barcha tavsiyalar shifokor darhol qo'llashi mumkin bo'lsin.
ANIQLIK: Faqat berilgan ma'lumotga tayaning; probability ni dalil kuchiga mos qo'ying; reasoningChain har qadamda "nima uchun" javob bersin. SSV protokol havolasini aniq yozing.`;
};

export const generateFastDoctorConsultation = async (
    patientData: PatientData, 
    specialties: string[], 
    language: Language
): Promise<FinalReport> => {
    const systemInstr = getFastDoctorSystemInstruction(language);
    const promptText = `Tashxis (name, probability, justification 2 jumla, reasoningChain 3 band, uzbekProtocolMatch). treatmentPlan 3-5 qadam. medications: name, dosage, frequency, duration, timing, instructions (qanday ichish, 1 jumla). recommendedTests, criticalFinding agar kerak. Til: ${langMap[language]}. JSON.`;

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

/** Strim: Gemini orqali javob, onChunk ga to'liq matn bir marta yuboriladi, oxirida FinalReport. */
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
            prompt: `3–5 ta differensial tashxis bering. Har biri: name, probability (%) — dalil kuchiga mos, justification — nega shunday, evidence_level, reasoning_chain — har qadam "nima uchun", uzbek_protocol — aniq SSV protokol nomi/yo'nalishi. red_flags agar bor. Eng ehtimolini birinchi qo'ying. Til: ${langLabel}.`,
            schema: {
                type: 'object',
                properties: {
                    diagnoses: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, probability: { type: 'number' }, justification: { type: 'string' }, evidence_level: { type: 'string' }, reasoning_chain: { type: 'array', items: { type: 'string' } }, uzbek_protocol: { type: 'string' } } } },
                    red_flags: { type: 'array', items: { type: 'string' } },
                },
            },
        },
        treatment_plan: {
            prompt: `SSV protokoliga mos davolash rejasi: treatment_plan (aniq qadamlar), medications (name, dosage, frequency, duration, timing, instructions), non_pharmacological, monitoring, uzbek_protocol_ref — aniq protokol havolasi. Til: ${langLabel}.`,
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
    const schema = { type: 'array', items: { type: 'string' } };
    try {
        const result = await callGemini(prompt, DEPLOY_PRO, schema, false, systemInstr, true, 2048);
        const arr = Array.isArray(result) ? (result as string[]).filter((q): q is string => typeof q === 'string') : [];
        return arr.length > 0 ? arr : [];
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
        2. "justification": 1-2 jumla — nega shunday tashxis; dalil asosida.
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
        shortTermPrognosis: shortTerm || '—',
        longTermPrognosis: longTerm || '—',
        keyFactors,
        confidenceScore,
    };
}

const generatePrognosisUpdate = async (debateHistory: ChatMessage[], patientData: PatientData, language: Language): Promise<PrognosisReport | null> => {
    const systemInstr = getSystemInstruction(language);
    const { attachments, ...cleanData } = patientData;
    const prompt = `Based on patient data and debate history, update prognosis. Consider O'zbekiston SSV klinik protokollari va mahalliy davolash imkoniyatlari. Return JSON with keys: shortTermPrognosis, longTermPrognosis, keyFactors (array of strings), confidenceScore (0-1). Output Language: ${langMap[language]}. Debate: ${JSON.stringify(debateHistory.slice(-5))}. Patient: ${JSON.stringify(cleanData)}.`;
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
        const raw = await callGemini(prompt, DEPLOY_PRO, schema, false, systemInstr, true, 1024);
        return normalizePrognosisReport(raw);
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
        'ru': 'Ведующие медицинские специалисты собираются...',
        'en': 'Leading medical specialists are gathering...'
    };
    
    onProgress({ type: 'status', message: introMessages[language] || introMessages['uz-C'] });
    let debateHistory: ChatMessage[] = [];
    
    // History context for the debate
    const historyContext = getRelevantHistoryContext(patientData.complaints);

    // Orchestrator Intro
    const introContentPrompt = `Generate a short intro message for the Council Chair (System) starting the medical council debate. Mention: the goal is to find the best diagnosis and treatment in accordance with Uzbekistan SSV (Sog'liqni Saqlash Vazirligi) approved clinical protocols and legislation; only drugs registered and available in Uzbekistan will be recommended. Output Language: ${langMap[language]}.`;
    const introContent = await callGemini(introContentPrompt, DEPLOY_PRO, undefined, false, systemInstr, true, 1024) as string;
    
    const orchestratorIntro: ChatMessage = { id: `sys-intro-${Date.now()}`, author: AIModel.SYSTEM, content: introContent, isSystemMessage: true };
    onProgress({ type: 'message', message: orchestratorIntro });
    debateHistory.push(orchestratorIntro);
    await sleep(12);

    const DEBATE_ROUNDS = 3;
    let currentTopicPrompt = `Summarize the initial state: Patient data and initial diagnoses: ${JSON.stringify(diagnoses)}. Ask specialists for their initial evaluation and Red Flags. Output Language: ${langMap[language]}.`;
    let currentTopic = await callGemini(currentTopicPrompt, DEPLOY_PRO, undefined, false, systemInstr, true, 1024) as string;

    for (let round = 1; round <= DEBATE_ROUNDS; round++) {
        const roundMessages: Record<Language, string> = {
            'uz-L': `${round}-bosqich munozarasi boshlanmoqda...`,
            'uz-C': `${round}-боскич мунозараси бошланмоқда...`,
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
                await sleep(18);
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
        
        await sleep(22);

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
                const responseText = await callGemini(specialistMultimodalPrompt, DEPLOY_FAST, undefined, false, systemInstr) as string;
                const specialistMessage: ChatMessage = { id: `${spec.role}-${Date.now()}`, author: spec.role, content: responseText };
                onProgress({ type: 'message', message: specialistMessage });
                debateHistory.push(specialistMessage);
                await sleep(15);
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
            currentTopic = await callGemini(summarizationPrompt, DEPLOY_PRO, undefined, false, systemInstr, true, 1024) as string;
        }
    }

    const finalizingMessages: Record<Language, string> = {
        'uz-L': 'Yakuniy hisobot tayyorlanmoqda...',
        'uz-C': 'Якуний ҳисобот тайёрланмоқда...',
        'kaa': 'Juwmaqlawşı esabat tayarlanbaqta...',
        'ru': 'Подготовка итогового отчёта...',
        'en': 'Preparing final report...'
    };
    onProgress({ type: 'status', message: finalizingMessages[language] });
    await sleep(22);

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
            }
        },
        required: ['consensusDiagnosis', 'rejectedHypotheses', 'recommendedTests', 'treatmentPlan', 'medicationRecommendations', 'unexpectedFindings']
    };

    const finalReportTextPrompt = `
        Role: Council Chair. Create the Final Report. Be AQLLI and XAVFSIZ. O'ZBEKISTON KONTEKSTI MAJBURIY.
        TIL: Barcha maydonlar faqat o'zbek tilida (Lotin). Inglizcha so'zlar (finding, implication, urgency va h.k.) va yulduzcha (*) ishlatmang.
        LANGUAGE: ${langMap[language]}.
        REQUIREMENTS:
        1. consensusDiagnosis: har biri uchun reasoningChain, justification, evidenceLevel. uzbekProtocolMatch: qaysi SSV klinik protokoliga mos (masalan: "Arterial gipertenziya / Qandli diabet bo'yicha SSV klinik protokoliga muvofiq") yoki "SSV tasdiqlangan milliy klinik protokollariga muvofiq" deb yozing.
        2. treatmentPlan: SSV protokollariga muvofiq, batafsil va tartibli; shoshilinch bo'lsa birinchi qadamlar aniq.
        3. medicationRecommendations: FAQAT O'zbekiston Respublikasida ro'yxatdan o'tgan va aptekalarda mavjud savdo nomlari (Nimesil, Sumamed, Augmentin, Metformin, Enalapril, Amlodipin, Omeprazol, Paratsetamol, Ibuprofen va hokazo). Allergiya va dori aralashuvini hisobga oling. localAvailability: "O'zbekistonda mavjud" yoki qisqacha izoh.
        4. criticalFinding: hayotga xavf yoki shoshilinch davolash kerak bo'lsa to'ldiring (finding, implication, urgency — barchasi o'zbekcha); yo'q bo'lsa bo'sh qoldiring.
        5. recommendedTests: yetishmayotgan muhim tekshiruvlar (O'zbekiston LITS va standartlariga mos).
        6. uzbekistanLegislativeNote: "O'zbekiston Respublikasi sog'liqni saqlash qonunchiligi va SSV tasdiqlangan klinik protokollariga muvofiq" yoki tegishli qisqacha eslatma.
        ANIQLIK: consensusDiagnosis da probability ni dalil kuchiga mos qo'ying; reasoningChain har qadamda "nima uchun" javob bersin; uzbekProtocolMatch aniq protokol nomi/yo'nalishi. Taxminiy tashxisni yakuniy deb yozmang.
        Debate history: ${JSON.stringify(debateHistory)}
    `;
    
    const finalReportMultimodalPrompt = buildMultimodalPrompt(finalReportTextPrompt, patientData);

    try {
        const rawReport = await callGemini(finalReportMultimodalPrompt, DEPLOY_PRO, finalReportSchema, false, systemInstr, true, 8192) as FinalReport;
        const finalReport: FinalReport = {
            ...rawReport,
            consensusDiagnosis: normalizeConsensusDiagnosis(rawReport.consensusDiagnosis),
        };

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
    // Azure OpenAI doesn't support Google Search grounding вЂ“ plain text call
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
        Task: Respond to user and continue debate. Keep in mind SSV clinical protocols and Uzbekistan context.
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
        Task: Analyze "What if" scenario: "${scenario}". Follow O'zbekiston SSV klinik protokollari. Recommend only drugs registered and available in Uzbekistan (savdo nomlari: Nimesil, Sumamed, Augmentin, Metformin va hokazo).
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
    await sleep(18);

    const specialists = [AIModel.GPT, AIModel.LLAMA, AIModel.CLAUDE];
    for (const model of specialists) {
        const translatedIntro = await callGemini(`Translate to ${langMap[language]}: "I am ${model}, ready to analyze the latest research on ${diseaseName}."`, DEPLOY_FAST, undefined, false, systemInstr);
        onProgress({ type: 'message', message: { id: `${model}-${Date.now()}`, author: model, content: translatedIntro as string, isThinking: false } });
        await sleep(10);
    }
    
    onProgress({ type: 'status', message: 'Discussing innovative strategies...' });
    await sleep(18);
    
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
        // Azure OpenAI вЂ“ JSON response (no grounding/web search available)
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
Faqat O'zbekistonda mavjud dori vositalari va SSV klinik protokollariga tayangan holda javob bering.
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
- Kamida 3вЂ“4 jumla yozing.

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
- Kamida 3вЂ“4 jumla yozing.

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