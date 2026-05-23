/** Yakuniy tashxis va differensial tahlil uchun qo'shimcha aniqlik qoidalari */
export const DIAGNOSIS_ACCURACY_RULES = `
TASHXIS ANIQLIGI (MAJBURIY):
1. Faqat kiritilgan shikoyat, anamnez, ob'ektiv ko'rik, lab va hujjatlar asosida xulosa — taxminiy bo'lsa probability past bo'lsin.
2. Differensial tashxislar bir-birini istisno qilsin; probability lar yig'indisi ~100%.
3. Har bir asosiy tashxis uchun reasoningChain: simptom → dalil → xulosa (qisqa, aniq).
4. SSV protokoliga moslik yoki protokoldan chetga chiqish sababi (dalil bilan).
5. Qizil bayroq, allergiya, joriy dorilar va buyrak/jigar funksiyasini hisobga oling.
6. Ma'lumot yetishmasa "Tasdiqlash uchun ... tekshiruv kerak" deb aniq yozing.
`.trim();
