
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PatientData } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import UploadCloudIcon from './icons/UploadCloudIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import { useTranslation } from '../hooks/useTranslation';
import { useSpeechToText } from '../hooks/useSpeechToText';
import MicrophoneIcon from './icons/MicrophoneIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import { validateFileSize, validateFileType, validateAge, validateRequired, validateVitalSign } from '../utils/validation';
import { calculateBmi, bmiCategoryColor } from '../utils/bmi';
import { handleError } from '../utils/errorHandler';
import { validatePatientDataSmart, getSmartValidationMessage } from '../utils/smartValidation';
import { scoreClinicalCompleteness } from '../utils/clinicalCompleteness';
import {
    getPatient,
    findPatientMatches,
    smartSearchPatients,
    getRecentImagingStudies,
    convertPatientToPatientData,
    passportToPatientData,
    type Patient,
    type SmartPatientHit,
} from '../services/apiPatientService';
import { mergeImagingStudiesIntoPatientData } from '../utils/imagingContext';
import type { ImagingStudyRecord } from '../types';
import { getAuthToken } from '../services/api';
import { formatPatientRegistryId } from '../utils/patientRegistryId';
import SearchIcon from './icons/SearchIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import StethoscopeIcon from './icons/StethoscopeIcon';
import HeartPulseIcon from './icons/HeartPulseIcon';
import ImageIcon from './icons/ImageIcon';
import FlaskIcon from './icons/FlaskIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import LightBulbIcon from './icons/LightBulbIcon';
import AddressCombobox from './address/AddressCombobox';

type SectionTone = 'blue' | 'indigo' | 'violet' | 'teal' | 'emerald' | 'amber' | 'rose';

const SECTION_TONES: Record<
    SectionTone,
    { stripe: string; header: string; icon: string; badge: string }
> = {
    blue: {
        stripe: 'border-l-blue-500',
        header: 'bg-gradient-to-r from-blue-50 via-sky-50/90 to-white',
        icon: 'bg-gradient-to-br from-blue-500 to-sky-500 shadow-md shadow-blue-300/40',
        badge: 'bg-gradient-to-br from-blue-600 to-sky-600',
    },
    indigo: {
        stripe: 'border-l-indigo-500',
        header: 'bg-gradient-to-r from-indigo-50 via-violet-50/90 to-white',
        icon: 'bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-300/40',
        badge: 'bg-gradient-to-br from-indigo-600 to-violet-600',
    },
    violet: {
        stripe: 'border-l-violet-500',
        header: 'bg-gradient-to-r from-violet-50 via-purple-50/90 to-white',
        icon: 'bg-gradient-to-br from-violet-500 to-purple-500 shadow-md shadow-violet-300/40',
        badge: 'bg-gradient-to-br from-violet-600 to-purple-600',
    },
    teal: {
        stripe: 'border-l-teal-500',
        header: 'bg-gradient-to-r from-teal-50 via-cyan-50/90 to-white',
        icon: 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-md shadow-teal-300/40',
        badge: 'bg-gradient-to-br from-teal-600 to-cyan-600',
    },
    emerald: {
        stripe: 'border-l-emerald-500',
        header: 'bg-gradient-to-r from-emerald-50 via-green-50/90 to-white',
        icon: 'bg-gradient-to-br from-emerald-500 to-green-500 shadow-md shadow-emerald-300/40',
        badge: 'bg-gradient-to-br from-emerald-600 to-green-600',
    },
    amber: {
        stripe: 'border-l-amber-500',
        header: 'bg-gradient-to-r from-amber-50 via-orange-50/90 to-white',
        icon: 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-md shadow-amber-300/40',
        badge: 'bg-gradient-to-br from-amber-600 to-orange-600',
    },
    rose: {
        stripe: 'border-l-rose-500',
        header: 'bg-gradient-to-r from-rose-50 via-pink-50/90 to-white',
        icon: 'bg-gradient-to-br from-rose-500 to-pink-500 shadow-md shadow-rose-300/40',
        badge: 'bg-gradient-to-br from-rose-600 to-pink-600',
    },
};

const FormSection: React.FC<{
    step: number;
    title: string;
    tone: SectionTone;
    icon: React.FC<{ className?: string }>;
    gridClass?: string;
    orderClass?: string;
    children: React.ReactNode;
}> = ({ step, title, tone, icon: Icon, gridClass = '', orderClass = '', children }) => {
    const c = SECTION_TONES[tone];
    return (
        <section
            className={`glass-panel flex flex-col min-h-0 h-full overflow-hidden border-l-[5px] ${c.stripe} ${gridClass} ${orderClass}`}
        >
            <header className={`flex items-center gap-3 px-3 py-2.5 border-b border-slate-100/90 shrink-0 ${c.header}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${c.icon}`}>
                    <Icon className="w-[18px] h-[18px]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight flex-1 min-w-0">{title}</h3>
                <span className={`w-7 h-7 rounded-lg text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-sm ${c.badge}`}>
                    {step}
                </span>
            </header>
            <div className="p-3 sm:p-3.5 flex flex-col flex-1 min-h-0 gap-2.5 overflow-y-auto custom-scrollbar">{children}</div>
        </section>
    );
};

type SpecialtyKey = 'gastro' | 'cardio' | 'neuro' | 'therapist' | 'endo' | 'pulmo' | 'nephro' | 'derma' | 'ortho' | 'gynec' | 'uro' | 'ophth' | 'ent' | 'reuma' | 'psych';

// Get complaint templates from i18n based on current language
const getComplaintTemplates = (t: (key: string) => string): Record<SpecialtyKey, string[]> => ({
    gastro: Array.from({ length: 27 }, (_, i) => t(`tmpl_gastro_comp_${i}`)),
    cardio: Array.from({ length: 24 }, (_, i) => t(`tmpl_cardio_comp_${i}`)),
    neuro: Array.from({ length: 23 }, (_, i) => t(`tmpl_neuro_comp_${i}`)),
    therapist: Array.from({ length: 23 }, (_, i) => t(`tmpl_therapist_comp_${i}`)),
    endo: Array.from({ length: 17 }, (_, i) => t(`tmpl_endo_comp_${i}`)),
    pulmo: Array.from({ length: 19 }, (_, i) => t(`tmpl_pulmo_comp_${i}`)),
    nephro: Array.from({ length: 15 }, (_, i) => t(`tmpl_nephro_comp_${i}`)),
    derma: Array.from({ length: 15 }, (_, i) => t(`tmpl_derma_comp_${i}`)),
    ortho: Array.from({ length: 13 }, (_, i) => t(`tmpl_ortho_comp_${i}`)),
    gynec: Array.from({ length: 11 }, (_, i) => t(`tmpl_gynec_comp_${i}`)),
    uro: Array.from({ length: 11 }, (_, i) => t(`tmpl_uro_comp_${i}`)),
    ophth: Array.from({ length: 10 }, (_, i) => t(`tmpl_ophth_comp_${i}`)),
    ent: Array.from({ length: 10 }, (_, i) => t(`tmpl_ent_comp_${i}`)),
    reuma: Array.from({ length: 9 }, (_, i) => t(`tmpl_reuma_comp_${i}`)),
    psych: Array.from({ length: 18 }, (_, i) => t(`tmpl_psych_comp_${i}`)),
});

// Get history templates from i18n based on current language
const getHistoryTemplates = (t: (key: string) => string): Record<SpecialtyKey, string[]> => ({
    gastro: Array.from({ length: 21 }, (_, i) => t(`tmpl_gastro_hist_${i}`)),
    cardio: Array.from({ length: 17 }, (_, i) => t(`tmpl_cardio_hist_${i}`)),
    neuro: Array.from({ length: 15 }, (_, i) => t(`tmpl_neuro_hist_${i}`)),
    therapist: Array.from({ length: 14 }, (_, i) => t(`tmpl_therapist_hist_${i}`)),
    endo: Array.from({ length: 13 }, (_, i) => t(`tmpl_endo_hist_${i}`)),
    pulmo: Array.from({ length: 8 }, (_, i) => t(`tmpl_pulmo_hist_${i}`)),
    nephro: Array.from({ length: 7 }, (_, i) => t(`tmpl_nephro_hist_${i}`)),
    derma: Array.from({ length: 5 }, (_, i) => t(`tmpl_derma_hist_${i}`)),
    ortho: Array.from({ length: 5 }, (_, i) => t(`tmpl_ortho_hist_${i}`)),
    gynec: Array.from({ length: 5 }, (_, i) => t(`tmpl_gynec_hist_${i}`)),
    uro: Array.from({ length: 4 }, (_, i) => t(`tmpl_uro_hist_${i}`)),
    ophth: Array.from({ length: 3 }, (_, i) => t(`tmpl_ophth_hist_${i}`)),
    ent: Array.from({ length: 3 }, (_, i) => t(`tmpl_ent_hist_${i}`)),
    reuma: Array.from({ length: 3 }, (_, i) => t(`tmpl_reuma_hist_${i}`)),
    psych: Array.from({ length: 8 }, (_, i) => t(`tmpl_psych_hist_${i}`)),
});

// Batafsil va keng shikoyat shablonlari — doktor tanlab to'liq matn oladi (fallback)
const COMPLAINT_TEMPLATES: Record<SpecialtyKey, string[]> = {
    gastro: [
        "Qorin og'riqi, asosan epigastriyada, ovqatdan keyin kuchayadi va kechasi och qoringa og'riq.",
        "Ko'ngil aynishi, qusish, ishtaha yo'q, vazn biroz tushgan.",
        "Qabziyat va ich ketish almashinib turadi, qorin dam bo'lishi, gaz.",
        "Ko'krak ortida achishish, nordon kekirish, reflyuks alomatlari, sternum ortida kuydiradi.",
        "Epigastriyada bosuvchi og'riq, kecha va och qoringa xususiy, oshqozon yarasi shubha.",
        "Najasda qon yoki qora (melena) paydo bo'ldi, gemorroy yoki yuqori yo'l shubha.",
        "O'ng qovurg'a ostida og'irlik, to'qib og'riq, o't pufagi yoki o't yo'llari bilan bog'liq.",
        "Oshqozon-ichak reflyuksi, ovqatdan keyin noqulaylik, dispepsiya.",
        "Yutish qiyinlashishi (disfagiya), qattiq ovqatda yoki suyuqlikda.",
        "Sariq rang, najas rangining o'zgarishi, jigar yoki o't yo'llari shubha.",
        "Qusish qon aralash yoki qora, yuqori yo'l qon ketishi shubha.",
        "Pankreatit shubha: qorin og'rig'i belga tarqaladi, qusish, og'ir.",
        "Gastrit yoki oshqozon yarasi (YAB) alomatlari, PPI dan keyin yaxshilanadi.",
        "O't pufagi sohasida og'riq, o't toshi yoki xoletsistit shubha.",
        "Funktsional dispepsiya, ovqatdan keyin qorin to'lib qoladi, gaz.",
        "Jigar sohasida og'irlik, gepatit yoki jigar kasalligi ekv.",
        "Ichak peristaltikasi buzilishi, qorincha shishi, ovqatdan keyin.",
        "Ishtaha yo'qotish, vazn tushishi, surunkali oshqozon-ichak yoki umumiy shikoyat.",
        "X.pylori yoki reflyuks davolangan, shikoyatlar qaytgan yoki nazorat kerak.",
        "Gemorroy, najasda qon, og'riq, ichak bo'shishda.",
        "Ichak burmalari (spazm), qabziyat bilan almashinadi.",
        "Oshqozon yarasi perforatsiyasi ekv. — tez jarrohlik kerak.",
        "O't yo'llari to'silishi, sariq rang, qotish.",
        "Pankreatit o'tkir yoki surunkali, alkogol anamnezi.",
        "Seliak yoki oziq-ovqat intoleransiyasi shubha.",
        "Oshqozon o'tkazuvchanligi buzilishi (gastroparezi).",
        "Gastroskopiya yoki kolonoskopiya natijasi mavjud.",
    ],
    cardio: [
        "Ko'krakda bosuvchi og'riq, jismoniy zo'riqishda yoki stressda kuchayadi, stenokardiya tipi.",
        "Nafas qisilishi, zinadan chiqishda va yotganda kuchayadi, yurak etishmovchiligi shubha.",
        "Yurak tez urishi, aritmiya hissi, \"urib qo'yadi\" deb ta'riflaydi.",
        "Pastki oyoqlarda shish, kun oxirida kuchayadi, ikkala oyoqda.",
        "Bosh aylanishi, hushdan ketish xurujlari, sinkop yoki presinkop.",
        "Qon bosimi ko'tarilishi bilan bosh og'rig'i, ensa sohasida yoki diffuz.",
        "Tunda bo'g'ilish, yotganda nafas qiyin, 2-3 yostiqda uxlaydi.",
        "Ko'krak og'rig'i chap qo'l, jag' yoki bo'yinga tarqaladi, infarkt ekv.",
        "Zaiflik, tez charchash, kuchsizlik, jismoniy zo'riqishga chidamsiz.",
        "Qon bosimi yuqori, uyda o'lchaganda ham barqaror yuqori, nazoratsiz.",
        "Stenokardiya: jismoniy harakatda ko'krak siqilishi, dam olishda yoki nitratdan yaxshilanadi.",
        "Yurak etishmovchiligi alomatlari — shish, nafas qisilishi, charchash.",
        "Aritmiya, yurak urishi notekis, \"qo'tirib qo'yadi\" yoki \"tushib qoladi\" hissi.",
        "O'tkir ko'krak og'rig'i, uzoq davom etadi, infarkt ekv. va tez tekshiruv kerak.",
        "Stent qo'yilgan yoki ShAKB o'tkazilgan, oxirgi vaqtda yana ko'krak og'rig'i yoki nafas qisilishi.",
        "Yurak shovqini, auskultatsiyada ovoz, yangi yoki o'zgargan.",
        "Gipertenziya krizisi: bosim keskin ko'tarilgan, bosh og'rig'i, ko'ngil aynishi.",
        "Bradikardiya yoki puls juda past, charchash, bosh aylanishi.",
        "Kardiyak sinkop: zo'riqishda yoki to'satdan hushdan ketish.",
        "Perikardit: ko'krak og'rig'i yotganda kuchayadi.",
        "Plevrit yoki pnevmoniya ekv. — nafasda og'riq.",
        "Yurak implant (EKS, ICD) o'rnatilgan.",
        "Vena trombozi yoki emboliya tarixi.",
        "Kardiyologik tekshiruv va stress-test kerak.",
    ],
    neuro: [
        "Bosh og'rig'i takrorlanadi, migren yoki tension tipi, oxirgi oylarda chastotasi oshgan.",
        "Qo'l yoki oyoqlarda uvishish, karaxtlik, \"ignaq tegadi\" hissi, neyropatiya shubha.",
        "Bosh aylanishi, vertigo, beqaror yurish, quloq shovqin bilan yoki undan mustasno.",
        "Gapirish qiyinlashishi, til chalg'ishi, so'zni topa olmaydi, stroke ekv.",
        "Qisqa muddatli hushdan ketish, sinkop, og'rig'siz.",
        "Tutilish (epileptik) xurujlari, ongsizlik, qisqa muddat.",
        "Bir ko'zda yoki bir tomonda ko'rish pasayishi, ko'z o'qi yoki miya shubha.",
        "Yuz nervi falaji, mimika buzilishi, bir tomonda.",
        "Uyqu buzilishi, tunda tez-tez uyg'onish, ertalab charchoq.",
        "Xotira pasayishi, diqqatni jamlay olmaslik, yaqin vaqt hodisalarini unutadi.",
        "Migren: bosh og'rig'i bir tomonda, ko'rish buzilishi (aura), ko'ngil aynishi.",
        "Stroke shubha: falaj, nutq buzilishi, bosh aylanishi — tez tekshiruv kerak.",
        "Neyropatiya: oyoq-qo'l uvishishi, og'riq, kechasi kuchayadi.",
        "Parkinson shubha: titroq, harakat sekinligi, qotish, yurish qiyin.",
        "Disk herniyasi: bo'yin yoki bel og'rig'i, uvishish qo'l/oyoqda.",
        "Bosh miya jarohati (YUT) o'tkazgan, keyingi kuzatuv yoki bosh og'rig'i davom etmoqda.",
        "Vertigo, bosh aylanishi, quloq shovqin, BPPV yoki vestibulyar shubha.",
        "Tremor, qo'l titroqi, dam olishda yoki harakatda.",
        "Miasteniya: mushak zaifligi, charchash, ko'z qopqog'i.",
        "Bosh miya o'simtasi ekv., bosh og'rig'i, qusish.",
        "Encephalitis yoki meningitis ekv. — tez tekshiruv.",
        "Kognitiv pasayish, demans shubha.",
        "Radikulopatiya: beldan oyoqka uvishish.",
    ],
    therapist: [
        "Umumiy holsizlik, tez charchash, isitma yo'q yoki subfebril.",
        "Isitma uzoq davom etadi, yo'tal yoki boshqa infeksiya belgilari bilan.",
        "Ishtaha yo'q, vazn tushdi, zaiflik — surunkali yoki yangi.",
        "Bo'g'imlarda og'riq va qotish, shish, harakatda kuchayadi.",
        "Yo'tal quruq yoki balg'amli, nafas qisilishi, O'RVI yoki bronxit.",
        "Terida toshmalar, qichishish, allergik reaksiya yoki infektsiya shubha.",
        "Uyqu va kayfiyat buzilishi, depressiya yoki bezovtalik shubha.",
        "Qon bosimi o'zgaruvchan, bosh og'rig'i, bosim yuqori yoki past.",
        "Anemiya: zaiflik, rangparlik, bosh aylanishi, lablar oq.",
        "Surunkali kasallik fonida ahvol yomonlashdi, kompensatsiya buzilgan.",
        "O'RVI: isitma, yo'tal, burun oqishi, bo'g'oz og'rig'i.",
        "Nafas olish qiyin, ko'krak siqilishi, jismoniy harakatda kuchayadi.",
        "Ko'krak og'rig'i, nafas olishda kuchayadi, plevrit yoki mushak og'rig'i.",
        "Lymph tugunlari kattalashgan, bo'yin yoki boshqa joyda, og'riqli yoki og'riqsiz.",
        "Pnevmoniya shubha: isitma, yo'tal, nafas qisilishi, ko'krak og'rig'i.",
        "Surunkali bronxit yoki KOAB, yo'tal va balg'am uzoq davom etadi.",
        "Allergik rinit, bronxial astma, mavsumiy yoki doimiy.",
        "Umumiy tekshiruv, profilaktik ko'rik, hech qanday aniq shikoyat yo'q.",
        "Qon quyqasi yoki tromboz tarixi.",
        "Immunitet pasaygan, tez-tez infeksiya.",
        "Jigar yoki o't sohasida og'irilik.",
        "Buyrak yoki siydik yo'llari shikoyatlari.",
        "Rentgen yoki KT natijalari mavjud.",
    ],
    endo: [
        "Chanqash, polidipsiya, tez-tez siyish (poliuriya), diabet alomatlari.",
        "Vazn yo'qotish yoki ortishi, ishtaha o'zgarishi, surunkali.",
        "Oyoq-qo'l uvishishi, diabetik neyropatiya alomatlari, kechasi kuchayadi.",
        "Teri quruqligi, soch to'kilishi, tirnoklar o'zgarishi, gormon yoki metabolik.",
        "Issiq yoki sovuqqa toqat qilmaslik, teri o'zgarishi.",
        "Bo'yin oldida bo'rtma, qalqonsimon bez kattalashgan, gipertiroidizm yoki nodul.",
        "Hayz sikli buzilishi, bepushtlik, gormon disbalansi shubha.",
        "Uyquchanlik, bradikardiya yoki aksincha yurak tez urishi, gipotireoz/gipertiroidizm.",
        "Qand qoni yuqori, diabet nazoratsiz, uyda o'lchaganda ham yuqori.",
        "Gipoglikemiya: terlash, titroq, ochlik hissi, zaiflik — tez oziq-ovqatdan yaxshilanadi.",
        "Diabetik retinopatiya yoki nefropatiya aniqlangan, nazorat kerak.",
        "Gormon disbalansi, hayz va libido o'zgarishi, charchoq.",
        "Qalqonsimon bez nodullari yoki kistalar, tekshiruv yoki kuzatuv kerak.",
        "Insulin rezistentligi, metabolik sindrom, vazn ortiqcha bilan.",
        "Adrenal yetishmovchilik shubha, zaiflik, pigmentatsiya.",
        "Osteoporoz, suyak sinishi xavfi.",
        "Cushing yoki feyoxromotsitoma ekv.",
    ],
    pulmo: [
        "Yo'tal uzoq davom etadi, quruq yoki balg'amli, kechasi kuchayadi.",
        "Nafas qisilishi, jismoniy harakatda kuchayadi, zinadan chiqishda.",
        "Ko'krak og'rig'i, nafas olishda kuchayadi, plevrit yoki mushak.",
        "Havo yetishmasligi, bo'g'ilish hissi, stressda yoki dam olishda.",
        "Balg'am ajralishi, rang o'zgarishi, yashil yoki sariq.",
        "Isitma, yo'tal, nafas qisilishi bilan birga, pnevmoniya shubha.",
        "Vizillik, nafas chiqarishda xirillash, bronxial astma.",
        "Qon aralash yo'tal, plevra yoki bronxial shubha.",
        "Surunkali yo'tal, chekish anamnezi, KOAB shubha.",
        "Tunda nafas to'xtashi, xurujlar, uyqu apnoe.",
        "Ko'krak qafasida siqilish, stenokardiya ekv. yoki plevrit.",
        "O'tkir bronxit: isitma, yo'tal, O'RVI dan keyin.",
        "Allergik yo'tal, mavsumiy yoki changdan.",
        "Pnevmoniya o'tkazgan, keyin nafas qisilishi davom etadi.",
        "Tuberkulyoz ekv.: uzoq yo'tal, vazn tushishi, kecha terlash.",
        "Plevral effuziya shubha, nafas qisilishi va ko'krak og'rig'i.",
        "Astma: xurujlar, allergen yoki zo'riqishda.",
        "Interstitsial o'pka kasalligi shubha.",
        "Pulmonologik tekshiruv, rentgen yoki KT kerak.",
    ],
    nephro: [
        "Siydik chiqarishda og'riq, tez-tez siyishga chiqish, kuyish.",
        "Siydikda qon (gematuriya), ko'rinadi yoki mikroskopik.",
        "Yuz va oyoqlarda shish, ertalab yuzda kuchayadi.",
        "Orqa bel sohasida og'riq, bir yoki ikkala tomonda.",
        "Siydik kam chiqadi yoki to'xtab qoladi, oliguriya.",
        "Qon bosimi yuqori, nazoratsiz, buyrak etishmovchiligi bilan.",
        "Zaiflik, rangparlik, anemiya — surunkali buyrak kasalligi.",
        "Ko'p siyish (poliuriya) va chanqash, diabet yoki buyrak.",
        "Nefrotik sindrom: katta shish, oqsil yo'qotish.",
        "Buyrak toshi shubha: belda og'riq xuruji, siydikda qon.",
        "Siydik yo'llari infeksiyasi: isitma, kuyish, tez siyish.",
        "Surunkali buyrak yetishmovchiligi kuzatuvda, kreatinin oshgan.",
        "Dializda yoki dializga tayyorgarlik.",
        "Oteki, gipertenziya va siydikda oqsil — glomerulonefrit.",
        "Nefrologik tekshiruv, siydik tahlili va kreatinin kerak.",
    ],
    derma: [
        "Terida toshma, qichishish, qizarish, turli joylarda.",
        "Qichishish kuchli, tunda uyqu buziladi.",
        "Pustula yoki pufakchalar, yiringli yoki suyuq.",
        "Pigment o'zgarishi, qorong'u yoki och dog'lar.",
        "Teri quruq, qotish, shishilish.",
        "Soch to'kilishi, yoki soqol/qosh.",
        "Tirnoq o'zgarishi, rang, qatlamlanish, mog'or.",
        "Yara yoki eksema uzoq davom etadi, davolashga javob bermaydi.",
        "Allergik dermatit, allergen bilan aloqa.",
        "Bakterial yoki qo'zg'atuvchi infektsiya shubha.",
        "O'tkir yoki surunkali urtikariya.",
        "Akne, yuzda yoki tanada.",
        "Psoriaz shubha, plaklar, qotish.",
        "Gribok (mikoz), oyoq yoki tirnoq.",
        "Dermatologik tekshiruv va biopsiya kerak.",
    ],
    ortho: [
        "Bel og'rig'i, harakatda kuchayadi, disk herniyasi shubha.",
        "Bo'yin og'rig'i, qo'lga uvishish tarqaladi.",
        "Tizza yoki son bo'g'imida og'riq, yurishda.",
        "Yelka og'rig'i, qo'lni ko'tarishda cheklangan.",
        "Suyak sinishi yoki chayqalish, travma keyin.",
        "Bo'g'im shishi, qizarish, harakat cheklangan — artrit.",
        "Oyoq yoki qo'lida uzoq davom etuvchi og'riq.",
        "Ortez yoki gipsdan keyin kuzatuv.",
        "Osteoporoz, suyak sinishi oson, vazn tushgan.",
        "Revmatoid artrit yoki artroz bilan og'riq.",
        "Jarrohlik (artroplastika va h.k.) keyin reabilitatsiya.",
        "Mushak yoki ligament zo'riqishi.",
        "Ortopedik tekshiruv, rentgen yoki MRT kerak.",
    ],
    gynec: [
        "Qorin ostida og'riq, hayz davrida yoki doimiy.",
        "Hayz sikli buzilishi, kechikish yoki ortiqcha qon ketish.",
        "Bepushtlik, uzoq vaqt homilador bo'la olmaydi.",
        "Vaginal ajralma o'zgarishi, hid yoki rang.",
        "Ko'ngil aynishi, qusish, homiladorlik shubha.",
        "Klimaks alomatlari: issiq basish, kayfiyat o'zgarishi.",
        "Ko'krak og'rig'i yoki shishi, hayz oldida.",
        "Jinsiy aloqada og'riq (dispareuniya).",
        "Bachadon yoki appendiks sohasida bo'rtma shubha.",
        "Endometrioz yoki mioma shubha.",
        "Ginekologik tekshiruv va USG kerak.",
    ],
    uro: [
        "Siydik chiqarishda og'riq yoki kuyish.",
        "Tez-tez siyishga chiqish (pollakiuriya), kechasi ham.",
        "Siydikda qon, makro yoki mikro gematuriya.",
        "Peshnobda og'riq, to'satdan xohish, inkontinensiya.",
        "Orqa belda og'riq, bir tomonda, buyrak toshi ekv.",
        "Peshnob oqimi zaif yoki uziladi, prostata shubha.",
        "Toshakda peshnobni ushlab turolmaydi.",
        "Jinsiy funksiya buzilishi, erectil disfunktsiya.",
        "Prostata kattalashgan, LUTS alomatlari.",
        "Buyrak toshi yoki siydik yo'llari infeksiyasi davolangan.",
        "Urologik tekshiruv va USG kerak.",
    ],
    ophth: [
        "Ko'rish pasayishi, bir yoki ikkala ko'zda.",
        "Ko'z qichishishi, qizarish, ajralma.",
        "Bir narsani ikki ko'radi (diplopiya).",
        "Ko'z oldida parda yoki chandiq.",
        "Yorug'likka sezgirlik oshgan.",
        "Ko'z ichida og'riq yoki bosim.",
        "Glaukoma kuzatuvda, tomchilar qabul qiladi.",
        "Katarakta shubha, xira ko'rish.",
        "Diabetik retinopatiya, ko'z tubi tekshirilgan.",
        "Oftalmologik tekshiruv kerak.",
    ],
    ent: [
        "Quloq og'rig'i, bir yoki ikkala qulochda.",
        "Quloqdan ajralma yoki shovqin, eshitish pasaygan.",
        "Burning og'rig'i, yutishda kuchayadi.",
        "Burun tiqilishi, oqim, allergiya yoki infeksiya.",
        "Bosh ovozi o'zgarishi, xirillash.",
        "Burning qichishishi yoki qon ketishi.",
        "Vertigo, bosh aylanishi, quloq bilan bog'liq.",
        "Tonsillit: bo'g'oz og'rig'i, isitma.",
        "Sinusit shubha: peshana og'rig'i, burun tiqilishi.",
        "LOR tekshiruv kerak.",
    ],
    reuma: [
        "Bo'g'imlarda og'riq va shish, ikkala qo'l/oyoqda simmetrik.",
        "Ertalab qotish, harakatdan keyin yaxshilanadi.",
        "Terida toshma, yuzda yoki quyosh ta'sirida.",
        "Umumiy zaiflik, charchash, isitma subfebril.",
        "Revmatoid artrit kuzatuvda, MTX yoki boshqa dorilar.",
        "Artroz: tizza yoki son bo'g'imida og'riq.",
        "Osteoporoz, suyak sinishi xavfi.",
        "Behchet yoki boshqa vaskulit shubha.",
        "Revmatologik tekshiruv va qon tahlili kerak.",
    ],
    psych: [
        "2 haftadan ortiq davom etuvchi tushkunlik, hech narsadan zavq olmaslik, charchoq — asosiy depressiya shubhasi.",
        "Doimiy tashvish, bezovtalik, yurak urishi yoki terlash — bezovtalik buzilishlari shubhasi.",
        "Panik xurujlari: yurak urishi, nafas yetishmasligi, o'lim qo'rquvi.",
        "Ko'tarilgan kayfiyat, uyquga ehtiyoj kamayishi, impulsiv xarajatlar — manik yoki gipomanik alomatlar.",
        "Ovozlar eshitish (akkustik gallutsinatsiya), debiya, ijtimoiy chekinish — psixoz / shizofreniya spektri shubhasi.",
        "O'z joniga qasd qilish fikrlari, reja yoki o'ziga zarar yetkazish xohishi — xavfsizlikni baholash, shoshilinch.",
        "Uyqu buzilishi, erta uyg'onish, uyqudan keyin tiklanmaslik hissi.",
        "Alkogol yoki moddalarni boshqarolmaslik, sustlashish, yoki ulardan qat'iy kamaytira olmaslik.",
        "Diqqatni jamlashda qiyinchilik, ish yoki o'qishda pasayish — kattalarda ADHD yoki stressga bog'liq kognitiv alomatlar.",
        "Majburiy fikrlar va kunlik hayotga xalaqit beradigan ritual — OCD alomatlari.",
        "Travmadan keyin tasavvurlar, qo'rquvli tushlar, gigervojilantlik — PTSD alomatlari.",
        "Ovqatni keskin cheklash yoki ovqat yeb keyin qusish tsikllari — ovqatlanish buzilishlari shubhasi.",
        "Xotira yo'qolishi, orientatsiya buzilishi, shaxs o'zgarishi — neyrokognitiv buzilish shubhasi.",
        "Hayajonlanish, agressiya, o'tkir chalkashlik — delirium yoki psixiatrik favqulodda holat.",
        "Psixotrop dorilar yon ta'siri yoki rejaga rioya qilmaslik — dori maslahati.",
        "Birinchi marta psixoz — keng qamrovli psixiatrik baholash shoshilinch.",
        "Uzoq davom etgan qayg'u bilan funksional buzilish — depressiya va qayg'u farqi.",
        "Bolada/yosh o'smanda: xulq-atvor muammolari, maktabdan qochish, o'ziga zarar — rivoj bahosi.",
    ],
};

// Batafsil va keng anamnez shablonlari — doktor tanlab to'liq matn oladi
const HISTORY_TEMPLATES: Record<SpecialtyKey, string[]> = {
    gastro: [
        "Shikoyatlar taxminan 6 oy oldin boshlangan, asta-sekin kuchayib bormoqda.",
        "Ovqat rejimi buzilganda va yog'li ovqatdan keyin dispepsiya kuchayadi.",
        "Ilgari oshqozon-ichak kasalliklari bo'yicha davolangan, to'liq remissiya bo'lmagan.",
        "NSAID yoki og'riq qoldiruvchi dorilarni uzoq muddat qabul qilgan.",
        "Chekish, choy yoki kofe ko'p iste'mol qiladi.",
        "Oilada oshqozon yarasi yoki o't pufagi kasalligi bor.",
        "Appendektomiya yoki boshqa jarrohlik aralashuvi o'tkazilgan.",
        "Stress davrlarida shikoyatlar aniq kuchayadi.",
        "Gastroskopiya uzoq o'tkazilmagan yoki kolonoskopiya tavsiya etilgan.",
        "O't pufagi olib tashlangan (xoletsistektomiya), keyin ham o'zgarishlar bor.",
        "Reflyuks oezofagit uzoq davom etadi, PPI qabul qiladi.",
        "X.pylori aniqlangan, eradikatsiya davolangan yoki davolash kerak.",
        "Oshqozon yarasi (YAB) tarixi, recidiv yoki yara yopilgan.",
        "Surunkali gastrit yoki duodenit, parhezga rioya qiladi.",
        "Jigar, o't yo'llari yoki pankreas kasalligi anamnezi bor.",
        "Antibiotiklar yoki PPI uzoq qabul qilgan, hozir ham davom etmoqda.",
        "Alkogol iste'moli mavjud, miqdori va davomiyligi.",
        "Vazn tushgan yoki ortgan, oxirgi oylarda.",
        "Ichak yallig'lanishi (Krohn, YABK) ekv. yoki oilada.",
        "B12 yoki temir yetishmovchiligi aniqlangan.",
        "Parhez: yog'li, qovurilgan ovqat ko'p.",
    ],
    cardio: [
        "Arterial gipertenziya bir necha yil oldin qo'yilgan, davolash rejimiga rioya qilmaydi.",
        "Oilada yurak ishemiyasi, infarkt yoki insult bor.",
        "Chekish staji 10 yildan ortiq.",
        "Jismoniy faollik kam, asosan o'tirish turmush tarzi.",
        "Dislipidemiya aniqlangan, statinlar qabul qiladi lekin LDL hali yuqori.",
        "Stenokardiya yoki yurak ishemiyasi bo'yicha kardiolog kuzatuvda.",
        "Qon bosimi uyda muntazam o'lchanmaydi yoki barqaror yuqori.",
        "O'RVI yoki infeksiyadan keyin yurak sohasida shikoyatlar kuchaygan.",
        "Emosional stressda ko'krak og'rig'i paydo bo'ladi.",
        "O'tkir miokard infarkti o'tkazgan, stent qo'yilgan yoki konservativ davolangan.",
        "Aritmiya (fibrilatsiya va boshqalar) davolangan, antikoagulyantlar qabul qiladi.",
        "Yurak etishmovchiligi (XSN), diuretiklar va boshqa dorilar rejimida.",
        "EKG yoki EchoKG da ilgari o'zgarishlar aniqlangan.",
        "Stent qo'yilgan yoki ShAKB o'tkazilgan, reabilitatsiya o'tgan.",
        "Diabet yoki metabolik sindrom bilan birga, vazn ortiqcha.",
        "Uyqu apnoe shubha yoki CPAP ishlatadi.",
        "Qon lipidlari yuqori, statinlar qabul qiladi.",
    ],
    neuro: [
        "Bosh og'rig'i yillab takrorlanib keladi, oxirgi oylarda chastotasi oshgan.",
        "Uyqu yetishmasligi va ish stressi fonida simptomlar kuchayadi.",
        "Bosh miya jarohati (YUT) o'tkazgan, keyingi kuzatuv.",
        "Oilada migren, epilepsiya yoki insult bor.",
        "Migren bo'yicha davolangan, profilaktika kurslari bajarilmagan.",
        "Qon bosimi o'zgarishi bosh aylanishi bilan birga kuzatiladi.",
        "Epilepsiya kuzatuvda, dori rejimiga rioya qiladi.",
        "Kompyuterda uzoq ishlash, bo'yin mushaklari zo'riqishi.",
        "Stroke (insult) o'tkazgan, reabilitatsiya davom etmoqda.",
        "Parkinson yoki tremor shubha, nevrolog hali ko'rmagan.",
        "Umurtqa pog'onasi disk herniyasi davolangan, recidiv yoki yangi shikoyat.",
        "Neyropatiya (diabetik yoki boshqa) tarixi bor.",
        "Antikoagulyantlar yoki antiagregantlar qabul qiladi, qon quyilishi xavfi.",
        "Bosh miya MRT/KT ilgari o'tkazilgan yoki hozir kerak.",
        "EEG yoki EMG natijalari mavjud.",
    ],
    therapist: [
        "Surunkali kasalliklar fonida so'nggi oyda umumiy ahvol yomonlashgan.",
        "So'nggi 2–3 oy davomida tez-tez O'RVI bilan og'rigan.",
        "Ovqatlanish tartibi buzilgan, kunlik ratsion balanssiz.",
        "Uyda o'z-o'zini davolash, dorilarni nazoratsiz qabul qilgan.",
        "Profilaktik ko'riklarga uzoq vaqtdan beri qatnashmagan.",
        "Allergik anamnez ijobiy, mavsumiy rinit yoki toshmalar.",
        "Anemiya bo'yicha ilgari laborator o'zgarishlar aniqlangan.",
        "Emlashlar kalendarga mos emas yoki o'tkazilmagan.",
        "Surunkali bronxit yoki KOAB, bronxodilatatorlar qabul qiladi.",
        "Pnevmoniya o'tkazgan, rentgen da yaxshilangan, keyingi kuzatuv.",
        "Tuberkulyoz ekv. yoki oilada bor, tekshiruv tavsiya etilgan.",
        "Jismoniy faollik yetarli emas, uyqu rejimi buzilgan.",
        "Qon umumiy tahlili va biokimyosi kerak.",
        "Ko'krak rentgeni yoki KT ilgari o'tkazilgan.",
    ],
    endo: [
        "Qandli diabet bir necha yil oldin qo'yilgan, nazorat yetarli emas.",
        "Insulin yoki peroral dori rejimiga to'liq rioya qilmaydi.",
        "Oilada diabet, tiroid yoki boshqa endokrin kasallik bor.",
        "Qalqonsimon bez bo'yicha avval tekshiruvdan o'tgan yoki davolangan.",
        "Oxirgi oylarda vazn va ishtaha keskin o'zgardi.",
        "Poliuriya va polidipsiya simptomlari asta-sekin paydo bo'lgan.",
        "Gipoglikemiya epizodlari kuzatilgan, sababi aniqlanmagan.",
        "Ayollarda hayz sikli buzilishi yoki bepushtlik shikoyati bor.",
        "Steroid dorilarni uzoq muddat qabul qilgan.",
        "Tiroid funksiyasi past (gipotireoz) yoki yuqori (gipertiroidizm) davolangan.",
        "Diabetik neyropatiya yoki retinopatiya aniqlangan, ko'z tubi tekshirilgan.",
        "Nefropatiya shubha, albuminuriya yoki kreatinin oshgan.",
        "Qand qoni uyda tez-tez o'lchanadi, natijalar o'zgaruvchan.",
    ],
    pulmo: [
        "Chekish staji uzoq, hozir ham chekadi yoki to'xtatgan.",
        "Surunkali bronxit yoki KOAB tashxisi bor, bronxodilatatorlar.",
        "Pnevmoniya bir necha marta o'tkazgan.",
        "Tuberkulyoz ekv. yoki oilada bor, tekshiruv o'tkazilgan.",
        "Astma bolalikdan yoki keyinroq, allergen ma'lum.",
        "Allergik rinit, mavsumiy yoki doimiy.",
        "Ko'krak rentgeni yoki KT ilgari o'tkazilgan.",
        "Uyquda nafas to'xtashi (apnoe) shubha yoki CPAP.",
    ],
    nephro: [
        "Buyrak kasalligi yoki siydik yo'llari infeksiyasi ilgari.",
        "Qon bosimi yuqori yillab, nazoratsiz.",
        "Diabet yoki yurak kasalligi bilan birga.",
        "Buyrak toshi o'tkazgan yoki davolangan.",
        "Siydik tahlilida oqsil yoki qon aniqlangan.",
        "Kreatinin oshgan, nefrolog kuzatuvda.",
        "Dializ rejimida yoki transplantatsiya keyin.",
    ],
    derma: [
        "Terida xronik kasallik, ekzema yoki psoriaz.",
        "Allergiya anamnezi, dori yoki ovqatga.",
        "Quyosh ta'sirida ishlash yoki ko'p vaqt ochiq.",
        "Dermatolog davolagan, recidiv yoki yangi toshma.",
        "Steroid kremlar uzoq ishlatgan.",
    ],
    ortho: [
        "Bel yoki bo'yin operatsiyasi o'tkazilgan.",
        "Travma yoki suyak sinishi ilgari.",
        "Artrit yoki artroz tashxisi bor.",
        "Osteoporoz aniqlangan, dorilar qabul qiladi.",
        "Jismoniy ish og'ir, zo'riqish ko'p.",
    ],
    gynec: [
        "Hayz sikli notekis yoki og'riqli.",
        "Homiladorliklar va tug'ruqlar soni, asoratlar.",
        "Bepushtlik davolangan yoki tekshiruv o'tkazilgan.",
        "Klimaks yoki GKT qabul qilgan.",
        "Ginekologik operatsiya (mioma va h.k.) o'tkazilgan.",
    ],
    uro: [
        "Siydik yo'llari infeksiyasi takrorlanadi.",
        "Buyrak toshi yoki prostata kasalligi bor.",
        "Prostata operatsiyasi yoki LUTS davolangan.",
        "Urolog tekshiruv va USG o'tkazilgan.",
    ],
    ophth: [
        "Ko'z kasalligi ilgari, glaukoma yoki katarakta.",
        "Diabet yoki gipertenziya bor, ko'z tubi tekshirilgan.",
        "Ko'z operatsiyasi o'tkazilgan.",
    ],
    ent: [
        "Surunkali tonzillit yoki sinusit.",
        "Eshitish pasaygan, apparat ishlatadi.",
        "Allergik rinit yoki polipoz.",
    ],
    reuma: [
        "Revmatoid artrit yoki boshqa autoimmun kasallik.",
        "Bo'g'im jarrohligi yoki endoprotez.",
        "Kortikosteroidlar yoki MTX qabul qilgan.",
    ],
    psych: [
        "Oldin qo'yilgan psixiatrik tashxis (depressiya, bipolyar buzilish, shizofreniya spektri va h.k.).",
        "Oldin psixiatrik statsionarda bo'lgan yoki o'ziga qasd urinish tarixi.",
        "Oilada ruhiy kasallik yoki o'ziga qasd tarixi.",
        "Hozirgi psixotrop dorilar (nomlari, dozalari, qabul qilish intizomi).",
        "Modda ishlatish (alkogol, kanabinoidlar, stimulyatorlar) — naqsh va chastota.",
        "Psixosotsial og'ir stressorlar — yo'qotish, nizo, moliyaviy qiyinchilik.",
        "Kayfiyat va fikrlashga ta'sir qiluvchi somatik kasalliklar (qalqon bezi, B12 yetishmovchiligi, epilepsiya).",
        "Oldin psixoterapiya, TMS yoki EKT o'tkazilgan.",
    ],
};

interface DataInputFormProps {
    isAnalyzing: boolean;
    onSubmit: (data: PatientData) => void;
    /** Tanlangan bemor patient.id (string) — App longitudinal kontekst uchun */
    linkedPatientKey?: string | null;
    onLinkedPatientChange?: (patientKey: string | null) => void;
    /** Bazadan yuklangan bemor — anamnez qayta so'ralmaydi */
    returnVisitMode?: boolean;
    /** To'liq bazaviy klinik ma'lumot (tahlilda ishlatiladi) */
    onPatientBaselineLoaded?: (baseline: PatientData) => void;
}

type VitalsState = {
    weight: string;
    height: string;
    bpSystolic: string;
    bpDiastolic: string;
    heartRate: string;
    temperature: string;
    spO2: string;
    respirationRate: string;
};

const emptyVitals = (): VitalsState => ({
    weight: '',
    height: '',
    bpSystolic: '',
    bpDiastolic: '',
    heartRate: '',
    temperature: '',
    spO2: '',
    respirationRate: '',
});

/** Ob'ektiv matndan vital ko'rsatkichlarni qisman ajratish (avtoimport) */
function parseVitalsFromObjective(text: string | undefined): Partial<VitalsState> {
    const raw = (text || '').replace(/\s+/g, ' ');
    const out: Partial<VitalsState> = {};
    const bp = raw.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (bp) {
        out.bpSystolic = bp[1];
        out.bpDiastolic = bp[2];
    }
    const hr = raw.match(/(?:puls|pulse|HR)[:\s]*(\d{2,3})\b/i) || raw.match(/\b(\d{2,3})\s*bpm\b/i);
    if (hr) out.heartRate = hr[1];
    const temp = raw.match(/(?:°C|temp)[:\s]*(\d{1,2}[.,]\d)/i) || raw.match(/\b(\d{1,2}[.,]\d)\s*°?\s*C/i);
    if (temp) out.temperature = temp[1].replace(',', '.');
    const spo2 = raw.match(/SpO[2₂]?[:\s]*(\d{2,3})/i);
    if (spo2) out.spO2 = spo2[1];
    const rr = raw.match(/(?:resp|nafas)[:\s]*(\d{1,2})\s*\/?\s*min/i);
    if (rr) out.respirationRate = rr[1];
    const weight = raw.match(/(?:vazn|weight|tana\s*vazni)[:\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i);
    if (weight) out.weight = weight[1].replace(',', '.');
    const height = raw.match(/(?:bo[''`]y|height|рост)[:\s]*(\d{2,3}(?:[.,]\d)?)\s*(?:cm|sm|см)?/i);
    if (height) out.height = height[1].replace(',', '.');
    return out;
}

// Ultra-compact Input (barcha yozuvlar kichik — sig‘ishi uchun)
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }> = ({ id, label, className, ...props }) => (
    <div className={`flex flex-col ${className}`}>
        <label htmlFor={id} className="text-[10px] font-bold text-slate-700 uppercase tracking-wide ml-0.5 mb-1">
            {label}
        </label>
        <input id={id} {...props} className="block w-full text-xs text-slate-800 common-input py-2 px-2.5 bg-white focus:bg-white placeholder-slate-400 transition-all duration-200 border border-slate-200/90 shadow-sm focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 rounded-lg" />
    </div>
);

// Ultra-compact Textarea — compact: anamnez, lab (ekran sig'ishi uchun)
const Textarea: React.FC<
    React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string; compact?: boolean; grow?: boolean }
> = React.forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string; compact?: boolean; grow?: boolean }
>(({ id, label, className, compact = false, grow = false, rows, ...props }, ref) => (
     <div className={`flex flex-col min-h-0 ${grow ? 'flex-1' : compact ? 'flex-shrink-0' : 'max-lg:min-h-min max-lg:h-auto lg:min-h-0 lg:h-full'} ${className ?? ''}`}>
        {label ? (
            <label htmlFor={id} className="text-[9px] font-bold text-slate-700 uppercase tracking-wide ml-0.5 mb-0.5 break-words shrink-0">
                {label}
            </label>
        ) : null}
        <textarea
            id={id}
            {...props}
            data-compact={compact && !grow ? 'true' : undefined}
            rows={rows ?? (compact && !grow ? 2 : undefined)}
            className={`block w-full text-[11px] sm:text-xs text-slate-800 common-input bg-white/80 focus:bg-white placeholder-slate-500 border border-slate-200 transition-all duration-200 shadow-sm focus:ring-1 focus:ring-blue-400 rounded ${
                grow
                    ? 'flex-1 min-h-[5rem] py-2 px-2.5 resize-y rounded-lg'
                    : compact
                      ? 'min-h-[2.75rem] max-h-[4.5rem] py-1 px-1.5 lg:flex-none resize-y'
                      : 'min-h-[72px] max-lg:flex-none lg:flex-grow py-2 px-2 sm:py-1.5 sm:px-1.5 resize-y'
            }`}
            ref={ref}
        />
    </div>
));

const VitalInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; unit: string; id?: string; error?: string }> = ({ label, unit, id, error, ...props }) => {
    const inputId = id || `vital-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
        <div className="flex flex-col min-w-0">
            <div className={`bg-white p-2 rounded-lg border flex flex-col justify-between gap-1 min-h-[3.75rem] lg:min-h-[4.25rem] ${
                error ? 'border-red-400 bg-red-50/50' : 'border-slate-200/90 shadow-sm'
            }`}>
                <label htmlFor={inputId} className="text-[9px] font-bold text-slate-600 uppercase leading-tight break-words">{label}</label>
                <div className="flex items-baseline gap-1 min-w-0">
                    <input id={inputId} name={inputId} aria-label={label} {...props} className={`min-w-0 flex-1 bg-transparent text-sm font-bold outline-none p-0 ${
                        error ? 'text-red-700' : 'text-slate-800'
                    }`} placeholder="0" />
                    <span className="text-[8px] text-slate-600 shrink-0">{unit}</span>
                </div>
            </div>
            {error && (
                <p className="text-[8px] text-red-600 mt-0.5 px-0.5 font-medium leading-tight">{error}</p>
            )}
        </div>
    );
};

const DataInputForm: React.FC<DataInputFormProps> = ({
    isAnalyzing,
    onSubmit,
    linkedPatientKey = null,
    onLinkedPatientChange,
    returnVisitMode = false,
    onPatientBaselineLoaded,
}) => {
    const { t } = useTranslation();
    const { isListening, transcript, startListening, stopListening, isSupported } = useSpeechToText();
    const wasListeningRef = useRef(false);
    const [regionId, setRegionId] = useState('');
    const [districtId, setDistrictId] = useState('');

    const [formData, setFormData] = useState<Partial<PatientData>>({
        firstName: '',
        lastName: '',
        fatherName: '',
        age: '',
        gender: '',
        phone: '',
        address: '',
        complaints: '',
        history: '',
        allergies: '',
        currentMedications: '',
        familyHistory: '',
        additionalInfo: '',
        labResults: '',
        regionalContext: '',
        differentialDiagnosesNotes: '',
    });
    const [allowIncompleteClinical, setAllowIncompleteClinical] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyKey | ''>('');
    const [selectedComplaintIdx, setSelectedComplaintIdx] = useState<number | ''>('');
    const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | ''>('');
    
    // Vitals State
    const [vitals, setVitals] = useState<VitalsState>(() => emptyVitals());
    const [vitalErrors, setVitalErrors] = useState<Record<string, string>>({});

    const [attachments, setAttachments] = useState<File[]>([]);
    const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [smartMessage, setSmartMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [patientSearch, setPatientSearch] = useState('');
    const [smartHits, setSmartHits] = useState<SmartPatientHit[]>([]);
    const [patientSearchLoading, setPatientSearchLoading] = useState(false);
    const [nameMatches, setNameMatches] = useState<Patient[]>([]);
    const [recentImagingStudies, setRecentImagingStudies] = useState<ImagingStudyRecord[]>([]);
    const [includePriorImaging, setIncludePriorImaging] = useState(true);
    const [linkedRegistryNumber, setLinkedRegistryNumber] = useState<string | null>(null);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nameMatchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get templates based on current language
    const complaintTemplates = getComplaintTemplates(t);
    const historyTemplates = getHistoryTemplates(t);

    const applyPatientDataToForm = useCallback((pd: PatientData) => {
        setRegionId(pd.regionId || '');
        setDistrictId(pd.districtId || '');
        setFormData({
            firstName: pd.firstName || '',
            lastName: pd.lastName || '',
            fatherName: pd.fatherName || '',
            age: pd.age || '',
            gender: pd.gender || '',
            phone: pd.phone || '',
            address: pd.address || '',
            complaints: pd.complaints || '',
            history: pd.history || '',
            allergies: pd.allergies || '',
            currentMedications: pd.currentMedications || '',
            familyHistory: pd.familyHistory || '',
            additionalInfo: pd.additionalInfo || '',
            labResults: pd.labResults || '',
            regionalContext: pd.regionalContext || '',
            differentialDiagnosesNotes: pd.differentialDiagnosesNotes || '',
        });
        setAllowIncompleteClinical(!!pd.allowIncompleteClinical);
        const parsed = parseVitalsFromObjective(pd.objectiveData);
        setVitals({
            ...emptyVitals(),
            ...parsed,
            weight: pd.weightKg || parsed.weight || '',
            height: pd.heightCm || parsed.height || '',
        });
        setVitalErrors({});
        setSelectedSpecialty('');
        setSelectedComplaintIdx('');
        setSelectedHistoryIdx('');
        setAttachments([]);
        setFileErrors({});
    }, []);

    useEffect(() => {
        if (!getAuthToken()) return;
        const q = patientSearch.trim();
        const minLen = /^\d+$/.test(q) ? 1 : 2;
        if (q.length < minLen) {
            setSmartHits([]);
            setPatientSearchLoading(false);
            return;
        }
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        setPatientSearchLoading(true);
        searchDebounceRef.current = setTimeout(() => {
            smartSearchPatients(q)
                .then(res => {
                    if (res.success && Array.isArray(res.data)) setSmartHits(res.data);
                    else setSmartHits([]);
                })
                .catch(() => setSmartHits([]))
                .finally(() => setPatientSearchLoading(false));
        }, 320);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [patientSearch]);

    useEffect(() => {
        if (!getAuthToken() || !linkedPatientKey || !/^\d+$/.test(linkedPatientKey.trim())) {
            setRecentImagingStudies([]);
            return;
        }
        const pid = Number(linkedPatientKey.trim());
        getRecentImagingStudies(pid, 30)
            .then((res) => {
                if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                    setRecentImagingStudies(res.data);
                    setIncludePriorImaging(true);
                } else {
                    setRecentImagingStudies([]);
                }
            })
            .catch(() => setRecentImagingStudies([]));
    }, [linkedPatientKey]);

    useEffect(() => {
        if (!getAuthToken() || linkedPatientKey) {
            setNameMatches([]);
            return;
        }
        const fn = (formData.firstName || '').trim();
        const ln = (formData.lastName || '').trim();
        const phone = (formData.phone || '').trim();
        if ((fn.length < 2 || ln.length < 2) && phone.length < 9) {
            setNameMatches([]);
            return;
        }
        if (nameMatchDebounceRef.current) clearTimeout(nameMatchDebounceRef.current);
        nameMatchDebounceRef.current = setTimeout(() => {
            findPatientMatches(fn, ln, formData.phone, formData.fatherName, formData.age)
                .then(res => {
                    if (res.success && Array.isArray(res.data)) setNameMatches(res.data.slice(0, 5));
                    else setNameMatches([]);
                })
                .catch(() => setNameMatches([]));
        }, 500);
        return () => {
            if (nameMatchDebounceRef.current) clearTimeout(nameMatchDebounceRef.current);
        };
    }, [formData.firstName, formData.lastName, formData.phone, formData.fatherName, formData.age, linkedPatientKey]);

    useEffect(() => {
        if (!linkedPatientKey) {
            setLinkedRegistryNumber(null);
        }
    }, [linkedPatientKey]);

    const selectPassportOnly = useCallback(
        (passportData: PatientData, patientId: number, withClinical = false, registryNumber?: string) => {
            if (withClinical) {
                getPatient(patientId)
                    .then((res) => {
                        if (res.success && res.data) {
                            const baseline = convertPatientToPatientData(res.data);
                            onPatientBaselineLoaded?.(baseline);
                            applyPatientDataToForm({
                                ...baseline,
                                complaints: baseline.complaints || '',
                            });
                        } else {
                            applyPatientDataToForm(passportData);
                        }
                    })
                    .catch(() => applyPatientDataToForm(passportData));
            } else {
                applyPatientDataToForm({
                    ...passportData,
                    complaints: '',
                    history: '',
                    allergies: '',
                    currentMedications: '',
                    familyHistory: '',
                    objectiveData: '',
                    labResults: '',
                });
            }
            setVitals(emptyVitals());
            onLinkedPatientChange?.(String(patientId));
            setLinkedRegistryNumber(registryNumber || formatPatientRegistryId({ id: patientId }));
            setPatientSearch('');
            setSmartHits([]);
            setNameMatches([]);
        },
        [applyPatientDataToForm, onLinkedPatientChange, onPatientBaselineLoaded],
    );

    const selectFromApiPatient = useCallback(
        (p: Patient) => {
            const baseline = convertPatientToPatientData(p);
            selectPassportOnly(baseline, p.id, true, formatPatientRegistryId(p));
        },
        [selectPassportOnly],
    );

    const selectFromSmartHit = useCallback(
        (hit: SmartPatientHit) => {
            const passport = passportToPatientData(hit);
            selectPassportOnly(
                passport,
                hit.id,
                Boolean(hit.can_view_clinical),
                formatPatientRegistryId(hit),
            );
        },
        [selectPassportOnly],
    );

    const formatHitDate = (iso: string) => {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleDateString();
        } catch {
            return '';
        }
    };

    const clearPatientLink = useCallback(() => {
        onLinkedPatientChange?.(null);
        setRecentImagingStudies([]);
    }, [onLinkedPatientChange]);

  const bmiResult = React.useMemo(
    () => calculateBmi(vitals.weight, vitals.height),
    [vitals.weight, vitals.height],
  );

  const buildObjectivePreview = useCallback((): string | undefined => {
    const lines: string[] = [];
    if (vitals.weight) lines.push(`${t('data_form_vitals_summary_weight')}: ${vitals.weight} kg`);
    if (vitals.height) lines.push(`${t('data_form_vitals_summary_height')}: ${vitals.height} cm`);
    if (bmiResult) {
      lines.push(
        `${t('data_form_vitals_summary_bmi')}: ${bmiResult.value} — ${t(bmiResult.gradeKey)}`,
      );
    }
    if (vitals.bpSystolic || vitals.heartRate || vitals.temperature || vitals.spO2) {
      lines.push(
        `${t('data_form_vitals_summary_bp')}: ${vitals.bpSystolic || '-'}/${vitals.bpDiastolic || '-'} mm.Hg`,
        `${t('data_form_vitals_summary_pulse')}: ${vitals.heartRate || '-'} bpm`,
        `${t('data_form_vitals_summary_temp')}: ${vitals.temperature || '-'} °C`,
        `${t('data_form_vitals_summary_spo2')}: ${vitals.spO2 || '-'} %`,
        `${t('data_form_vitals_summary_resp')}: ${vitals.respirationRate || '-'} /min`,
      );
    }
    return lines.length ? lines.join('\n') : undefined;
  }, [vitals, bmiResult, t]);

    // Aqlli validatsiya: form ma'lumotlari o'zgarganda maslahat/warning yangilash
    React.useEffect(() => {
        const payload: Partial<PatientData> = {
            ...formData,
            weightKg: vitals.weight,
            heightCm: vitals.height,
            bmi: bmiResult ? String(bmiResult.value) : undefined,
            objectiveData: buildObjectivePreview(),
            attachments: attachments.length
                ? attachments.map(f => ({ name: f.name, base64Data: 'x', mimeType: f.type }))
                : undefined,
        };
        const res = validatePatientDataSmart(payload);
        const msg = getSmartValidationMessage(res, t);
        setSmartMessage(msg);
    }, [formData, attachments, vitals.weight, vitals.height, bmiResult, buildObjectivePreview, t]);

    const completenessLive = React.useMemo(() => {
        return scoreClinicalCompleteness({
            ...formData,
            weightKg: vitals.weight,
            heightCm: vitals.height,
            bmi: bmiResult ? String(bmiResult.value) : undefined,
            objectiveData: buildObjectivePreview(),
            attachments: attachments.length
                ? attachments.map(f => ({ name: f.name, base64Data: 'x', mimeType: f.type }))
                : undefined,
        });
    }, [formData, attachments, vitals.weight, vitals.height, bmiResult, buildObjectivePreview]);

    const appendToField = (field: 'complaints' | 'history', text: string) => {
        setFormData(prev => {
            const base = (prev[field] || '').trim();
            const sep = base ? '\n' : '';
            return { ...prev, [field]: `${base}${sep}${text}` };
        });
    };

    useEffect(() => {
        if (wasListeningRef.current && !isListening && transcript.trim()) {
            appendToField('complaints', transcript.trim());
        }
        wasListeningRef.current = isListening;
    }, [isListening, transcript]);

    const handleChange = (field: keyof PatientData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        // Real-time validatsiya yosh uchun
        if (field === 'age') {
            const validation = validateAge(value);
            if (!validation.isValid) {
                setFormErrors(prev => ({ ...prev, age: validation.error || '' }));
            } else {
                setFormErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.age;
                    return newErrors;
                });
            }
        } else {
            // Clear error when user starts typing (boshqa fieldlar uchun)
            if (formErrors[field]) {
                setFormErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[field];
                    return newErrors;
                });
            }
        }
    };

    const fillNormalVitals = () => {
        setVitals({
            bpSystolic: '120',
            bpDiastolic: '80',
            heartRate: '72',
            temperature: '36.6',
            spO2: '98',
            respirationRate: '16'
        });
        setVitalErrors({});
    };

    const handleVitalChange = (field: keyof typeof vitals, value: string) => {
        // Bo'sh, yoki raqam (minus, kasr qo'llab-quvvatlanadi)
        if (value !== '' && !/^-?\d*\.?\d*$/.test(value)) return;
        
        // Validatsiya
        const vitalTypeMap: Record<string, 'weight' | 'height' | 'bpSystolic' | 'bpDiastolic' | 'heartRate' | 'temperature' | 'spO2' | 'respirationRate'> = {
            weight: 'weight',
            height: 'height',
            bpSystolic: 'bpSystolic',
            bpDiastolic: 'bpDiastolic',
            heartRate: 'heartRate',
            temperature: 'temperature',
            spO2: 'spO2',
            respirationRate: 'respirationRate'
        };
        
        const validationType = vitalTypeMap[field as string];
        if (validationType && value !== '') {
            const validation = validateVitalSign(value, validationType);
            if (!validation.isValid) {
                setVitalErrors(prev => ({ ...prev, [field]: validation.error || '' }));
            } else {
                setVitalErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[field];
                    return newErrors;
                });
            }
        } else if (value === '') {
            // Bo'sh bo'lsa, xatolikni o'chirish
            setVitalErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
        
        setVitals(prev => ({ ...prev, [field]: value }));
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        
        const newFiles = Array.from(e.target.files);
        const errors: Record<string, string> = {};
        
        newFiles.forEach((file: File) => {
            // Validate file size (max 10MB)
            const sizeValidation = validateFileSize(file, 10);
            if (!sizeValidation.isValid) {
                errors[file.name] = sizeValidation.error || t('data_form_file_too_large');
                return;
            }
            
            // Validate file type
            const typeValidation = validateFileType(file);
            if (!typeValidation.isValid) {
                errors[file.name] = typeValidation.error || t('data_form_file_type_not_supported');
                return;
            }
        });
        
        // Only add files without errors
        const validFiles = newFiles.filter((file: File) => !errors[file.name]);
        
        if (validFiles.length > 0) {
            setAttachments(prev => [...prev, ...validFiles]);
        }
        
        if (Object.keys(errors).length > 0) {
            setFileErrors(prev => ({ ...prev, ...errors }));
            // Clear errors after 5 seconds
            setTimeout(() => {
                setFileErrors({});
            }, 5000);
        }
        
        // Reset input
        e.target.value = '';
    };

    const removeAttachment = useCallback((fileName: string) => {
        setAttachments(prev => prev.filter(f => f.name !== fileName));
        // Clear error if file was removed
        if (fileErrors[fileName]) {
            setFileErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fileName];
                return newErrors;
            });
        }
    }, [fileErrors]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate required fields
        const errors: Record<string, string> = {};
        
        if (!formData.firstName?.trim()) errors.firstName = t('validation_required', { field: t('data_input_patient_name') });
        if (!formData.lastName?.trim()) errors.lastName = t('validation_required', { field: t('data_input_patient_lastname') });
        
        const ageValidation = validateAge(formData.age || '');
        if (!ageValidation.isValid) errors.age = ageValidation.error || "";
        
        if (!formData.gender?.trim()) errors.gender = t('validation_required', { field: t('data_input_gender') });
        if (!formData.complaints?.trim()) errors.complaints = t('validation_required', { field: t('data_input_complaints_label') });

        const nextVitalErrors: Record<string, string> = {};
        if (!vitals.weight.trim()) {
            nextVitalErrors.weight = t('validation_required', { field: t('data_form_vitals_weight') });
        } else {
            const wv = validateVitalSign(vitals.weight, 'weight');
            if (!wv.isValid) nextVitalErrors.weight = wv.error || '';
        }
        if (!vitals.height.trim()) {
            nextVitalErrors.height = t('validation_required', { field: t('data_form_vitals_height') });
        } else {
            const hv = validateVitalSign(vitals.height, 'height');
            if (!hv.isValid) nextVitalErrors.height = hv.error || '';
        }
        if (Object.keys(nextVitalErrors).length > 0) {
            setVitalErrors(prev => ({ ...prev, ...nextVitalErrors }));
        }
        
        // Validate vitals if provided
        if (vitals.bpSystolic) {
            const bpSysValidation = validateVitalSign(vitals.bpSystolic, 'bpSystolic');
            if (!bpSysValidation.isValid) errors.bpSystolic = bpSysValidation.error || "";
        }
        if (vitals.bpDiastolic) {
            const bpDiaValidation = validateVitalSign(vitals.bpDiastolic, 'bpDiastolic');
            if (!bpDiaValidation.isValid) errors.bpDiastolic = bpDiaValidation.error || "";
        }
        if (vitals.heartRate) {
            const hrValidation = validateVitalSign(vitals.heartRate, 'heartRate');
            if (!hrValidation.isValid) errors.heartRate = hrValidation.error || "";
        }
        if (vitals.temperature) {
            const tempValidation = validateVitalSign(vitals.temperature, 'temperature');
            if (!tempValidation.isValid) errors.temperature = tempValidation.error || "";
        }
        if (vitals.spO2) {
            const spo2Validation = validateVitalSign(vitals.spO2, 'spO2');
            if (!spo2Validation.isValid) errors.spO2 = spo2Validation.error || "";
        }
        if (vitals.respirationRate) {
            const respValidation = validateVitalSign(vitals.respirationRate, 'respirationRate');
            if (!respValidation.isValid) errors.respirationRate = respValidation.error || "";
        }
        
        if (Object.keys(errors).length > 0 || Object.keys(nextVitalErrors).length > 0) {
            setFormErrors(errors);
            return;
        }
        
        // Construct Objective Data String from Vitals (translated labels)
        const objectiveString = buildObjectivePreview() || '';

        let attachmentData: PatientData['attachments'] = [];
        if (attachments.length > 0) {
            try {
                attachmentData = await Promise.all(
                    attachments.map(file => new Promise<{ name: string; base64Data: string; mimeType: string }>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const base64Data = (event.target?.result as string).split(',')[1];
                                resolve({ name: file.name, base64Data, mimeType: file.type });
                            } catch (error) {
                                reject(handleError(error, 'File reading'));
                            }
                        };
                        reader.onerror = () => reject(new Error(`${t('data_form_file_read_error')}: ${file.name}`));
                        reader.readAsDataURL(file);
                    }))
                );
            } catch (error) {
                const appError = handleError(error, 'File upload');
                setFormErrors({ attachments: appError.message });
                return;
            }
        }

        const fullPatientData: PatientData = {
            firstName: formData.firstName || '',
            lastName: formData.lastName || '',
            fatherName: formData.fatherName || '',
            age: formData.age || '',
            gender: formData.gender as 'male' | 'female' | 'other' | '',
            phone: formData.phone || undefined,
            address: formData.address || undefined,
            regionId: regionId || formData.regionId,
            districtId: districtId || formData.districtId,
            complaints: formData.complaints || '',
            history: formData.history || '',
            allergies: formData.allergies || undefined,
            currentMedications: formData.currentMedications || undefined,
            familyHistory: formData.familyHistory || undefined,
            additionalInfo: formData.additionalInfo || '',
            objectiveData: objectiveString || undefined,
            weightKg: vitals.weight.trim() || undefined,
            heightCm: vitals.height.trim() || undefined,
            bmi: bmiResult ? String(bmiResult.value) : undefined,
            labResults: (formData.labResults || '').trim()
                || (attachments.length > 0 ? t('data_form_lab_uploaded') : undefined),
            regionalContext: (formData.regionalContext || '').trim() || undefined,
            differentialDiagnosesNotes: (formData.differentialDiagnosesNotes || '').trim() || undefined,
            allowIncompleteClinical: allowIncompleteClinical || undefined,
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
        };

        const smartRes = validatePatientDataSmart(fullPatientData);
        if (!smartRes.valid && smartRes.missingCriticalKeys.length > 0) {
            const fields = smartRes.missingCriticalKeys.map((k) => t(k)).join(', ');
            setFormErrors(prev => ({ ...prev, _smart: t('smart_validation_critical_list', { fields }) }));
            return;
        }
        if (smartRes.completeness.complaintOnly && !allowIncompleteClinical) {
            const proceed = window.confirm(t('data_form_completeness_confirm'));
            if (!proceed) return;
            fullPatientData.allowIncompleteClinical = true;
        }

        let payload = fullPatientData;
        if (includePriorImaging && recentImagingStudies.length > 0) {
            payload = mergeImagingStudiesIntoPatientData(fullPatientData, recentImagingStudies);
        }

        onSubmit(payload);
    };

    return (
        <div className="data-input-compact data-form-rich data-form-root w-full min-w-0 max-w-full flex flex-col flex-1 animate-fade-in-up min-h-0 lg:min-h-[calc(100dvh-11rem)]">
            
            <form onSubmit={handleSubmit} className="flex flex-col w-full flex-1 min-h-0">
                
                {/* Header & Submit Button */}
                <div className="flex-shrink-0 flex justify-between items-center mb-3 px-1 gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">{t('data_form_new_case')}</h2>
                        <p className="text-[11px] text-slate-600 mt-0.5">{t('data_form_subtitle')}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden max-w-[140px]">
                                <div
                                    className={`h-full transition-all ${
                                        completenessLive.level === 'high'
                                            ? 'bg-emerald-500'
                                            : completenessLive.level === 'medium'
                                              ? 'bg-amber-500'
                                              : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${completenessLive.score}%` }}
                                />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-600">
                                {t('data_form_completeness')}: {completenessLive.score}%
                            </span>
                        </div>
                        {smartMessage && (
                            <p className="text-[9px] text-amber-700 mt-0.5 leading-snug">{smartMessage}</p>
                        )}
                    </div>
                    <button 
                        type="submit" 
                        disabled={isAnalyzing} 
                        className="shadow shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs py-2 px-4 rounded-lg transform transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500/30 flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? (
                            <>
                                <SpinnerIcon className="w-4 h-4 text-white/90" />
                                <span>{t('data_form_analyzing')}</span>
                            </>
                        ) : (
                            <>
                                <span>{t('data_form_start_analysis')}</span>
                                <ChevronRightIcon className="w-4 h-4 opacity-80" />
                            </>
                        )}
                    </button>
                </div>

                {/* Aqlli maslahat / ogohlantirish */}
                {(smartMessage || formErrors._smart) && (
                    <div className={`flex-shrink-0 mb-2 px-2 py-1.5 rounded-lg text-[10px] font-medium ${formErrors._smart ? 'bg-red-100 border border-red-300 text-red-800' : 'bg-blue-100 border border-blue-300 text-blue-900'}`}>
                        {formErrors._smart ? formErrors._smart : smartMessage}
                    </div>
                )}

                <div className="data-form-mobile-flow w-full min-w-0 flex flex-col flex-1 gap-3 min-h-0 max-lg:pb-2 lg:overflow-hidden">

                    <div className="data-form-main-grid flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-2 gap-3 auto-rows-min">
                        <FormSection
                            step={1}
                            title={t('data_form_section_passport')}
                            tone="blue"
                            icon={UserCircleIcon}
                            orderClass="order-1"
                            gridClass="lg:col-start-1 lg:row-start-1 lg:col-span-3 lg:row-span-2"
                        >
                            <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-blue-50/50 px-2.5 py-2 space-y-2 shrink-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                    <p className="text-[10px] font-bold text-sky-900 uppercase tracking-wide">{t('data_form_smart_search_title')}</p>
                                    <p className="text-[9px] text-sky-700/90 mt-0.5">{t('data_form_smart_search_hint')}</p>
                                </div>
                                {linkedPatientKey && (
                                    <button
                                        type="button"
                                        onClick={clearPatientLink}
                                        className="text-[9px] font-semibold text-rose-700 hover:underline"
                                    >
                                        {t('data_form_patient_clear_link')}
                                    </button>
                                )}
                            </div>
                            {linkedPatientKey && (
                                <p className="text-[9px] text-sky-800 font-mono bg-white/60 rounded px-2 py-1 border border-sky-100">
                                    {t('data_form_patient_linked', {
                                        id: linkedRegistryNumber || formatPatientRegistryId({ id: Number(linkedPatientKey) }),
                                    })}
                                </p>
                            )}
                            {getAuthToken() && (
                                <div className="relative">
                                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="search"
                                        value={patientSearch}
                                        onChange={e => setPatientSearch(e.target.value)}
                                        placeholder={t('data_form_patient_search_placeholder')}
                                        className="w-full rounded-lg border border-slate-200 bg-white/90 pl-7 pr-2 py-1.5 text-[10px] text-slate-800 placeholder:text-slate-400"
                                        autoComplete="off"
                                    />
                                    {patientSearchLoading && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-slate-500">{t('data_form_patient_searching')}</span>
                                    )}
                                    {patientSearch.trim().length >= (/^\d+$/.test(patientSearch.trim()) ? 1 : 2) && !patientSearchLoading && smartHits.length === 0 && (
                                        <p className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] text-slate-500 shadow-lg">
                                            {t('data_form_smart_search_empty')}
                                        </p>
                                    )}
                                    {patientSearch.trim().length >= (/^\d+$/.test(patientSearch.trim()) ? 1 : 2) && smartHits.length > 0 && (
                                        <ul className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg text-[10px]">
                                            {smartHits.map(hit => (
                                                <li key={hit.id}>
                                                    <button
                                                        type="button"
                                                        className="w-full text-left px-2 py-2 hover:bg-sky-50 border-b border-slate-50 last:border-0"
                                                        onClick={() => selectFromSmartHit(hit)}
                                                    >
                                                        <span className="font-semibold text-slate-900">
                                                            {hit.last_name} {hit.first_name} {hit.father_name}
                                                        </span>
                                                        <span className="text-slate-500 ml-1">
                                                            · {formatPatientRegistryId(hit)} · {hit.age} {t('years_short')}
                                                        </span>
                                                        {(hit.region_name || hit.district_name) && (
                                                            <span className="block text-[9px] text-slate-500 mt-0.5">
                                                                {[hit.region_name, hit.district_name].filter(Boolean).join(', ')}
                                                            </span>
                                                        )}
                                                        {hit.phone && (
                                                            <span className="block text-[9px] text-slate-500 mt-0.5">{hit.phone}</span>
                                                        )}
                                                        {hit.last_diagnosis && (
                                                            <span className="block text-[9px] text-indigo-800 mt-0.5">
                                                                {t('data_form_smart_last_dx')}: {hit.last_diagnosis}
                                                            </span>
                                                        )}
                                                        <span className="block text-[8px] text-slate-400 mt-0.5">
                                                            {hit.analysis_count > 0
                                                                ? t('data_form_smart_meta', {
                                                                    count: hit.analysis_count,
                                                                    date: formatHitDate(hit.last_analysis_at),
                                                                    doctor: hit.last_physician || '—',
                                                                })
                                                                : t('data_form_smart_no_analyses')}
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                            {recentImagingStudies.length > 0 && (
                                <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2 py-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={includePriorImaging}
                                        onChange={(e) => setIncludePriorImaging(e.target.checked)}
                                        className="mt-0.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-[9px] text-emerald-900 leading-snug">
                                        <span className="font-bold block">{t('data_form_include_imaging_title')}</span>
                                        {t('data_form_include_imaging_hint', { count: recentImagingStudies.length })}
                                    </span>
                                </label>
                            )}
                            </div>
                            <div>
                                <Input id="firstName" label={t('data_input_patient_name')} type="text" value={formData.firstName || ''} onChange={e => handleChange('firstName', e.target.value)} required placeholder={t('data_input_placeholder_firstname')} />
                                {formErrors.firstName && <p className="text-[9px] text-red-500 mt-0.5 ml-0.5">{formErrors.firstName}</p>}
                            </div>
                            <div>
                                <Input id="lastName" label={t('data_input_patient_lastname')} type="text" value={formData.lastName || ''} onChange={e => handleChange('lastName', e.target.value)} required placeholder={t('data_input_placeholder_lastname')} />
                                {formErrors.lastName && <p className="text-[9px] text-red-500 mt-0.5 ml-0.5">{formErrors.lastName}</p>}
                            </div>
                            {!linkedPatientKey && nameMatches.length > 0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-2 py-1.5 space-y-1">
                                    <p className="text-[9px] font-semibold text-amber-900">{t('data_form_patient_match_banner')}</p>
                                    {nameMatches.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => selectFromApiPatient(p)}
                                            className="block w-full text-left text-[9px] px-2 py-1 rounded bg-white border border-amber-100 hover:border-sky-300"
                                        >
                                            {p.first_name} {p.last_name} · {formatPatientRegistryId(p)} · {p.age} {t('years_short')}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div>
                                <Input
                                    id="fatherName"
                                    label={t('data_input_patient_fathername')}
                                    type="text"
                                    value={formData.fatherName || ''}
                                    onChange={e => handleChange('fatherName', e.target.value)}
                                    placeholder={t('data_input_placeholder_fathername')}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                    <div className="flex flex-col">
                                        <div className={formErrors.age ? 'border-2 border-red-500 rounded-lg' : ''}>
                                            <Input id="age" label={t('data_input_age')} type="number" value={formData.age || ''} onChange={e => handleChange('age', e.target.value)} required placeholder={t('data_input_placeholder_age')} min="0" max="120" />
                                        </div>
                                        {formErrors.age && (
                                            <p className="text-[9px] text-red-600 mt-0.5 px-0.5 font-medium leading-tight">{formErrors.age}</p>
                                        )}
                                    </div>
                                    {formErrors.age && <p className="text-[9px] text-red-500 mt-0.5 ml-0.5">{formErrors.age}</p>}
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="gender" className="text-[9px] font-bold text-slate-700 uppercase tracking-wide ml-0.5 mb-0.5">{t('data_input_gender')}</label>
                                    <select id="gender" value={formData.gender || ''} onChange={e => handleChange('gender', e.target.value)} required className={`block w-full text-[11px] common-input py-1 px-1.5 bg-white/60 focus:bg-white border-none rounded ${formErrors.gender ? 'ring-1 ring-red-500' : ''}`}>
                                        <option value="">{t('data_input_gender_select')}</option>
                                        <option value="male">{t('data_input_gender_male')}</option>
                                        <option value="female">{t('data_input_gender_female')}</option>
                                    </select>
                                    {formErrors.gender && <p className="text-[9px] text-red-500 mt-0.5 ml-0.5">{formErrors.gender}</p>}
                                </div>
                            </div>
                            <Input
                                id="phone"
                                label={t('phone_label')}
                                type="tel"
                                value={formData.phone || ''}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                placeholder="+998..."
                            />
                            <AddressCombobox
                                regionId={regionId}
                                districtId={districtId}
                                onChange={(rId, dId) => {
                                    setRegionId(rId);
                                    setDistrictId(dId);
                                    setFormData((prev) => ({ ...prev, regionId: rId, districtId: dId }));
                                }}
                            />
                            <Input
                                id="addressExtra"
                                label={t('address_extra_label')}
                                type="text"
                                value={formData.address || ''}
                                onChange={(e) => handleChange('address', e.target.value)}
                                placeholder={t('address_extra_placeholder')}
                            />
                        </FormSection>

                        <FormSection
                            step={2}
                            title={t('data_form_clinical_data')}
                            tone="indigo"
                            icon={StethoscopeIcon}
                            orderClass="order-2"
                            gridClass="lg:col-start-4 lg:row-start-1 lg:col-span-5"
                        >
                            <div className="flex flex-col flex-1 min-h-0 gap-2.5">
                                <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-bold text-slate-700 uppercase tracking-wide ml-0.5 mb-0.5">
                                                {t('data_input_specialty_templates')}
                                            </label>
                                            <select
                                                value={selectedSpecialty}
                                                onChange={e => {
                                                    const value = e.target.value as SpecialtyKey | '';
                                                    setSelectedSpecialty(value);
                                                    setSelectedComplaintIdx('');
                                                    setSelectedHistoryIdx('');
                                                }}
                                                className="block w-full text-[11px] common-input py-1 px-1.5 bg-white/60 focus:bg-white border-none rounded"
                                            >
                                                <option value="">{t('template_free_text')}</option>
                                                <option value="gastro">{t('specialty_gastro')}</option>
                                                <option value="cardio">{t('specialty_cardio')}</option>
                                                <option value="neuro">{t('specialty_neuro')}</option>
                                                <option value="therapist">{t('specialty_therapist')}</option>
                                                <option value="endo">{t('specialty_endo')}</option>
                                                <option value="pulmo">{t('specialty_pulmo')}</option>
                                                <option value="nephro">{t('specialty_nephro')}</option>
                                                <option value="derma">{t('specialty_derma')}</option>
                                                <option value="ortho">{t('specialty_ortho')}</option>
                                                <option value="gynec">{t('specialty_gynec')}</option>
                                                <option value="uro">{t('specialty_uro')}</option>
                                                <option value="ophth">{t('specialty_ophth')}</option>
                                                <option value="ent">{t('specialty_ent')}</option>
                                                <option value="reuma">{t('specialty_reuma')}</option>
                                                <option value="psych">{t('specialty_psychiatrist')}</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-bold text-slate-700 uppercase tracking-wide ml-0.5 mb-0.5">
                                                {t('data_input_typical_complaint')}
                                            </label>
                                            <select
                                                value={selectedComplaintIdx}
                                                onChange={e => {
                                                    const idx = e.target.value === '' ? '' : Number(e.target.value);
                                                    setSelectedComplaintIdx(idx);
                                                    if (selectedSpecialty && idx !== '' && complaintTemplates[selectedSpecialty][idx]) {
                                                        appendToField('complaints', complaintTemplates[selectedSpecialty][idx]);
                                                    }
                                                }}
                                                disabled={!selectedSpecialty}
                                                className="block w-full text-[11px] common-input py-1 px-1.5 bg-white/60 focus:bg-white border-none rounded disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                <option value="">{t('template_select')}</option>
                                                {selectedSpecialty &&
                                                    complaintTemplates[selectedSpecialty].map((item, idx) => {
                                                        // Create a short label from first 60 chars + add index
                                                        const shortLabel = item.slice(0, 60) + (item.length > 60 ? '...' : '');
                                                        return (
                                                            <option key={idx} value={idx} title={item}>
                                                                {idx + 1}. {shortLabel}
                                                            </option>
                                                        );
                                                    })}
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-bold text-slate-700 uppercase tracking-wide ml-0.5 mb-0.5">
                                                {t('data_input_history_template')}
                                            </label>
                                            <select
                                                value={selectedHistoryIdx}
                                                onChange={e => {
                                                    const idx = e.target.value === '' ? '' : Number(e.target.value);
                                                    setSelectedHistoryIdx(idx);
                                                    if (selectedSpecialty && idx !== '' && historyTemplates[selectedSpecialty][idx]) {
                                                        appendToField('history', historyTemplates[selectedSpecialty][idx]);
                                                    }
                                                }}
                                                disabled={!selectedSpecialty}
                                                className="block w-full text-[11px] common-input py-1 px-1.5 bg-white/60 focus:bg-white border-none rounded disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                <option value="">{t('template_select')}</option>
                                                {selectedSpecialty &&
                                                    historyTemplates[selectedSpecialty].map((item, idx) => {
                                                        // Create a short label from first 60 chars + add index
                                                        const shortLabel = item.slice(0, 60) + (item.length > 60 ? '...' : '');
                                                        return (
                                                            <option key={idx} value={idx} title={item}>
                                                                {idx + 1}. {shortLabel}
                                                            </option>
                                                        );
                                                    })}
                                            </select>
                                        </div>
                                </div>
                                <div className="flex flex-1 min-h-0 gap-2 flex-col lg:flex-row">
                                    <div className="flex flex-1 flex-col min-h-0">
                                        <div className="flex items-center justify-between gap-2 mb-0.5 shrink-0">
                                            <span className="text-[10px] font-bold text-slate-700 uppercase">{t('data_input_complaints_label')}</span>
                                            {isSupported && (
                                                <button
                                                    type="button"
                                                    onClick={() => (isListening ? stopListening() : startListening())}
                                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                                                        isListening
                                                            ? 'bg-red-50 border-red-300 text-red-700'
                                                            : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                                                    }`}
                                                    title={isListening ? t('voice_input_stop') : t('voice_input_start')}
                                                >
                                                    <MicrophoneIcon className="w-3.5 h-3.5" isMuted={!isListening} />
                                                    {isListening ? t('voice_input_stop') : t('voice_input_start')}
                                                </button>
                                            )}
                                        </div>
                                        <Textarea
                                            id="complaints"
                                            label=""
                                            grow
                                            placeholder={t('data_input_complaints_placeholder')}
                                            value={formData.complaints || ''}
                                            onChange={e => handleChange('complaints', e.target.value)}
                                        />
                                        {formErrors.complaints && <p className="text-[9px] text-red-500 mt-0.5 ml-0.5">{formErrors.complaints}</p>}
                                    </div>
                                    {returnVisitMode ? (
                                        <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 min-h-0 overflow-y-auto">
                                            <p className="text-[9px] font-bold text-emerald-900 mb-1">{t('data_form_return_visit_anamnesis')}</p>
                                            <p className="text-[10px] text-slate-700 whitespace-pre-wrap">
                                                {formData.history?.trim() || t('data_form_return_visit_no_history')}
                                            </p>
                                        </div>
                                    ) : (
                                        <Textarea
                                            id="history"
                                            grow
                                            label={t('data_input_history_label')}
                                            placeholder={t('data_input_history_placeholder')}
                                            value={formData.history || ''}
                                            onChange={e => handleChange('history', e.target.value)}
                                        />
                                    )}
                                </div>
                            </div>
                        </FormSection>

                        <FormSection
                            step={3}
                            title={t('data_form_vitals_section_title')}
                            tone="violet"
                            icon={HeartPulseIcon}
                            orderClass="order-3"
                            gridClass="lg:col-start-9 lg:row-start-1 lg:col-span-4"
                        >
                            <div className="flex justify-end shrink-0 -mt-1 mb-1">
                                <button
                                    type="button"
                                    onClick={fillNormalVitals}
                                    className="text-[10px] font-semibold px-3 py-1 rounded-lg bg-violet-100 text-violet-800 hover:bg-violet-200 border border-violet-200 transition-colors"
                                >
                                    {t('vitals_normal_btn')}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1 content-stretch">
                                <VitalInput
                                    id="vital-weight"
                                    label={`${t('data_form_vitals_weight')} *`}
                                    unit="kg"
                                    type="number"
                                    min="2"
                                    max="350"
                                    step="0.1"
                                    value={vitals.weight}
                                    onChange={e => handleVitalChange('weight', e.target.value)}
                                    error={vitalErrors.weight}
                                />
                                <VitalInput
                                    id="vital-height"
                                    label={`${t('data_form_vitals_height')} *`}
                                    unit="cm"
                                    type="number"
                                    min="40"
                                    max="250"
                                    step="0.1"
                                    value={vitals.height}
                                    onChange={e => handleVitalChange('height', e.target.value)}
                                    error={vitalErrors.height}
                                />
                                <div className={`rounded border p-1.5 sm:p-1 flex flex-col justify-between min-h-[3rem] ${
                                    bmiResult ? bmiCategoryColor(bmiResult.category, bmiResult.grade) : 'bg-white/70 border-slate-200'
                                }`}>
                                    <span className="text-[8px] font-bold uppercase leading-tight">{t('data_form_vitals_bmi')}</span>
                                    {bmiResult ? (
                                        <>
                                            <div className="text-[13px] font-black leading-none">{bmiResult.value}</div>
                                            <div className="text-[8px] font-semibold leading-tight mt-0.5 line-clamp-2">{t(bmiResult.gradeKey)}</div>
                                        </>
                                    ) : (
                                        <div className="text-[9px] text-slate-500 leading-tight">{t('data_form_vitals_bmi_hint')}</div>
                                    )}
                                </div>
                                <VitalInput id="vital-bp-systolic" label={t('data_form_vitals_bp_sys')} unit="mm" value={vitals.bpSystolic} onChange={e => handleVitalChange('bpSystolic', e.target.value)} error={vitalErrors.bpSystolic} />
                                <VitalInput id="vital-bp-diastolic" label={t('data_form_vitals_bp_dia')} unit="mm" value={vitals.bpDiastolic} onChange={e => handleVitalChange('bpDiastolic', e.target.value)} error={vitalErrors.bpDiastolic} />
                                <VitalInput id="vital-heart-rate" label={t('data_form_vitals_pulse')} unit="bpm" value={vitals.heartRate} onChange={e => handleVitalChange('heartRate', e.target.value)} error={vitalErrors.heartRate} />
                                <VitalInput id="vital-temperature" label={t('data_form_vitals_temp')} unit="°C" value={vitals.temperature} onChange={e => handleVitalChange('temperature', e.target.value)} error={vitalErrors.temperature} />
                                <VitalInput id="vital-spo2" label={t('data_form_vitals_spo2')} unit="%" value={vitals.spO2} onChange={e => handleVitalChange('spO2', e.target.value)} error={vitalErrors.spO2} />
                                <VitalInput id="vital-respiration" label={t('data_form_vitals_resp')} unit="/min" value={vitals.respirationRate} onChange={e => handleVitalChange('respirationRate', e.target.value)} error={vitalErrors.respirationRate} />
                            </div>
                        </FormSection>

                        <FormSection
                            step={4}
                            title={t('data_form_diagnostics_card')}
                            tone="teal"
                            icon={ImageIcon}
                            orderClass="order-4"
                            gridClass="lg:col-start-4 lg:row-start-2 lg:col-span-2"
                        >
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="min-h-[72px] flex-shrink-0 border-2 border-dashed border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50/80 rounded-xl flex items-center justify-center gap-2 px-3 cursor-pointer hover:from-teal-100 hover:border-teal-400 transition-all group"
                                >
                                    <UploadCloudIcon className="h-5 w-5 text-teal-600 shrink-0 group-hover:scale-110 transition-transform" />
                                    <div className="min-w-0 text-left">
                                        <p className="text-[9px] font-bold text-teal-700 leading-tight">{t('data_form_upload_files')}</p>
                                        <p className="text-[7px] text-teal-600/80 leading-tight line-clamp-2">{t('data_form_upload_hint')}</p>
                                    </div>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" ref={fileInputRef} onChange={handleFileChange} multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx" />
                                </div>
                                <div className="mt-1.5 flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-0.5">
                                    {attachments.map(file => (
                                        <div key={file.name} className="flex items-center justify-between bg-white/60 px-1.5 py-0.5 rounded border border-slate-200 text-[9px]">
                                            <div className="flex items-center gap-1 overflow-hidden min-w-0">
                                                <DocumentTextIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                <span className="truncate font-medium text-slate-700" title={file.name}>{file.name}</span>
                                            </div>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); removeAttachment(file.name); }} className="text-slate-400 hover:text-red-500 font-bold p-0.5 rounded hover:bg-red-50 transition-colors text-sm leading-none shrink-0" aria-label={`${t('data_form_remove_file')} ${file.name}`}>&times;</button>
                                        </div>
                                    ))}
                                    {Object.keys(fileErrors).length > 0 && Object.entries(fileErrors).map(([fileName, error]) => (
                                        <div key={fileName} className="text-[8px] text-red-500 bg-red-50 px-1 py-0.5 rounded border border-red-200">
                                            <strong>{fileName}:</strong> {error}
                                        </div>
                                    ))}
                                    {attachments.length === 0 && Object.keys(fileErrors).length === 0 && (
                                        <p className="text-[9px] text-center text-slate-400 italic py-2">{t('data_form_no_files')}</p>
                                    )}
                                </div>
                        </FormSection>

                        <FormSection
                            step={5}
                            title={t('analysis_labs_title')}
                            tone="emerald"
                            icon={FlaskIcon}
                            orderClass="order-5"
                            gridClass="lg:col-start-6 lg:row-start-2 lg:col-span-3"
                        >
                                <Textarea
                                    id="labResults"
                                    grow
                                    label={t('data_form_lab_results')}
                                    placeholder={t('data_form_lab_results_ph')}
                                    value={formData.labResults || ''}
                                    onChange={e => handleChange('labResults', e.target.value)}
                                />
                        </FormSection>

                        <FormSection
                            step={6}
                            title={t('data_form_section_safety')}
                            tone="amber"
                            icon={ShieldCheckIcon}
                            orderClass="order-6"
                            gridClass="lg:col-start-9 lg:row-start-2 lg:col-span-2"
                        >
                            {returnVisitMode && (
                                <p className="text-[9px] font-medium text-emerald-700 shrink-0">({t('data_form_return_visit_saved')})</p>
                            )}
                            <Textarea id="allergies" grow label={t('data_input_allergies')} value={formData.allergies || ''} onChange={e => handleChange('allergies', e.target.value)} placeholder={t('data_input_allergies_placeholder')} readOnly={returnVisitMode} />
                            <Textarea id="currentMedications" grow label={t('data_input_current_medications')} value={formData.currentMedications || ''} onChange={e => handleChange('currentMedications', e.target.value)} placeholder={t('data_input_current_medications_placeholder')} readOnly={returnVisitMode} />
                            <Textarea id="familyHistory" grow label={t('data_input_family_history')} value={formData.familyHistory || ''} onChange={e => handleChange('familyHistory', e.target.value)} placeholder={t('data_input_family_history_placeholder')} readOnly={returnVisitMode} />
                        </FormSection>

                        <FormSection
                            step={7}
                            title={t('data_form_section_other_info')}
                            tone="rose"
                            icon={LightBulbIcon}
                            orderClass="order-7"
                            gridClass="lg:col-start-11 lg:row-start-2 lg:col-span-2"
                        >
                            <Textarea
                                id="additionalInfo"
                                grow
                                label={t('data_form_extra_notes')}
                                placeholder={t('data_form_extra_notes_placeholder')}
                                value={formData.additionalInfo || ''}
                                onChange={e => handleChange('additionalInfo', e.target.value)}
                            />
                            <Textarea
                                id="regionalContext"
                                grow
                                label={t('data_form_regional_context')}
                                placeholder={t('data_form_regional_context_ph')}
                                value={formData.regionalContext || ''}
                                onChange={e => handleChange('regionalContext', e.target.value)}
                            />
                            <Textarea
                                id="differentialDiagnosesNotes"
                                grow
                                label={t('data_form_ddx_notes')}
                                placeholder={t('data_form_ddx_notes_ph')}
                                value={formData.differentialDiagnosesNotes || ''}
                                onChange={e => handleChange('differentialDiagnosesNotes', e.target.value)}
                            />
                        </FormSection>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default DataInputForm;