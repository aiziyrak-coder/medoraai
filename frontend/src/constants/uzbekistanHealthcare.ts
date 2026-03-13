/**
 * O'zbekiston Respublikasi sog'liqni saqlash qonunchiligi, SSV protokollari
 * va mahalliy dori-darmonlar konteksti. Platformani O'zbekiston uchun to'liq moslashtirish.
 */

/** SSV va qonunchilik haqida qisqacha */
export const UZBEKISTAN_HEALTHCARE_CONTEXT = {
  legislation: [
    "O'zbekiston Respublikasining В«Sog'liqni saqlash to'g'risidaВ» Qonuni вЂ“ barcha tibbiy faoliyat ushbu qonun asosida amalga oshiriladi.",
    "SSV (Sog'liqni Saqlash Vazirligi) buyruqlari va qarorlari вЂ“ davolash yordami standartlari va klinik protokollar SSV tomonidan tasdiqlanadi.",
    "Tibbiy xizmatlar ko'rsatilishi, retsept yozish, davolash rejalari SSV tasdiqlangan klinik protokollarga muvofiq bo'lishi shart.",
  ],
  clinicalProtocols: [
    "SSV 2024 yil tasdiqlangan milliy klinik protokollar (110+ nozologiya): arterial gipertenziya, surunkali yurak ishemik kasalligi, bronxial astma, O'OBB, qandli diabet 1 va 2-tur, virusli gepatit B va C, jigar sirrozi, antenatal parvarish va boshqalar.",
    "Tashxis va davolash rejasi SSV klinik protokoliga mos kelishi kerak; protokol raqami yoki yo'nalishi (masalan: В«Arterial gipertenziya bo'yicha SSV klinik protokoliga muvofiqВ») keltirilishi ma'qul.",
    "ICD-10 O'zbekistonda qo'llaniladi вЂ“ tashxislar xalqaro ICD-10 kodlari bilan ifodalanishi mumkin.",
  ],
  drugsAndPharmacy: [
    "Faqat O'zbekiston Respublikasida ro'yxatdan o'tgan va davlat ro'yxatiga kiritilgan dori-darmonlarni tavsiya qiling.",
    "Savdo nomlari: O'zbekiston aptekalarida mavjud savdo nomlari (masalan: Nimesil, Nise вЂ“ nimesulid; Sumamed вЂ“ azitromitsin; Augmentin, Amoksiklav вЂ“ amoksitsillin/klavulanat; Metformin, Glucophage вЂ“ metformin; Enalapril, Enap вЂ“ enalapril; Amlodipin, Norvask вЂ“ amlodipin; Omeprazol, Omez вЂ“ omeprazol; Paratsetamol, Panadol вЂ“ paratsetamol; Ibuprofen, Nurofen вЂ“ ibuprofen; Loratadin, Klaritin вЂ“ loratadin va boshqalar).",
    "Retsept rejimi: SSV qoidalariga muvofiq, retsept talab qilinadigan preparatlar retseptda ko'rsatilishi kerak; retseptsiz sotiladigan dori-darmonlar uchun ham dozani va qabul qilish tartibini aniq bering.",
    "Dori aralashuvlari va allergiya: bemor allergiyasi va joriy dori-darmonlarni hisobga oling; O'zbekistonda mavjud bo'lgan alternativalarni taklif qiling.",
  ],
  terminologyAndStandards: [
    "Tibbiy hujjatlar va tashxislar o'zbek (yoki tanlangan til) tibbiy terminologiyasida; SSV qabul qilgan atamalar va tasniflar ishlatiladi.",
    "Laboratoriya birliklari: O'zbekiston LITS va davlat standartlarida qo'llaniladigan birliklar (mmol/l, mg/dl, bpm va hokazo).",
    "Shoshilinch yordam va tezkor xabar: hayot uchun xavfli holatlar SSV belgilangan shoshilinch yordam tartibiga muvofiq darhol tavsiya etiladi.",
  ],
} as const;

/** AI uchun bitta matnli kontekst (promptga qo'shish uchun) */
export function getUzbekistanContextForAI(language: 'uz-L' | 'uz-C' | 'ru' | 'en' | 'kaa'): string {
  const sep = '\n· ';
  const legislation = UZBEKISTAN_HEALTHCARE_CONTEXT.legislation.join(sep);
  const protocols = UZBEKISTAN_HEALTHCARE_CONTEXT.clinicalProtocols.join(sep);
  const drugs = UZBEKISTAN_HEALTHCARE_CONTEXT.drugsAndPharmacy.join(sep);
  const standards = UZBEKISTAN_HEALTHCARE_CONTEXT.terminologyAndStandards.join(sep);

  const intro =
    language === 'en'
      ? 'UZBEKISTAN HEALTHCARE CONTEXT (mandatory for all recommendations):'
      : language === 'ru'
        ? 'РљРћРќРўР•РљРЎРў РЈР—Р‘Р•РљРРЎРўРђРќРђ (РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РґР»СЏ РІСЃРµС… СЂРµРєРѕРјРµРЅРґР°С†РёР№):'
        : language === 'kaa'
          ? 'Г“ZBEKISTAN SOG\'LIQ KONTEKSTI (barlД±q maslahatlar ushД±n majbГєri):'
          : 'O\'ZBEKISTON SOG\'LIQNI SAQLASH KONTEKSTI (barcha tavsiyalar uchun majburiy):';

  return `${intro}
1) Qonunchilik:${sep}${legislation}
2) Klinik protokollar:${sep}${protocols}
3) Dori-darmonlar:${sep}${drugs}
4) Atamalar va standartlar:${sep}${standards}`;
}