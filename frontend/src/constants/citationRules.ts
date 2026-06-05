/** AI konsilium va hisobot uchun manba ko'rsatish qoidalari (promptlarda ishlatiladi). */
export const AI_CITATION_FORMAT_RULES = `
MANBA VA DALIL (majburiy): Har bir muhim klinik da'vo, tashxis, dori yoki tavsiya oxirida qavs ichida manba yozing.
Format: (Manba nomi yoki jurnal/protokol, https://to-liq-url)
Misol: ...arterial gipertenziya ehtimoli yuqori (ESC Hypertension Guidelines 2023, https://pubmed.ncbi.nlm.nih.gov/?term=ESC+hypertension+2023)
Aniq URL bilmasangiz PubMed qidiruv URLini yozing. "Quyidagi bo'limda", "batafsil pastda", "(qisqa)" kabi yo'naltiruvchi yoki bo'sh placeholder matn YO'Q.
`;

export const PLACEHOLDER_SECTION_INTRO = [
  /qo'shimcha sifatida\s*\(qisqa\)/i,
  /kasalliklarni oldini olish va ovqatlanish\s*\(qisqa\)/i,
  /quyidagi alohida bo'limda/i,
  /quyidagi óz aldına bólimda/i,
  /bo'limida\.?\s*$/i,
  /bólimida\.?\s*$/i,
  /batafsil\s*[—-]\s*ovqatlanish/i,
  /to'liq ro'yxat va ehtiyot choralar/i,
];

export function isPlaceholderSectionIntro(text: string | undefined | null): boolean {
  const s = (text || '').trim();
  if (!s) return true;
  if (s.length < 24 && /\(qisqa\)/i.test(s)) return true;
  return PLACEHOLDER_SECTION_INTRO.some((re) => re.test(s));
}
