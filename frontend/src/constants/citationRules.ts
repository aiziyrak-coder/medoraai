/** AI konsilium va hisobot uchun manba ko'rsatish qoidalari (promptlarda ishlatiladi). */
export const AI_CITATION_FORMAT_RULES = `
Klinik matn: faqat bemorning aniq faktlarini yozing — vital, lab, anamnez, tasvir.
MANBA VA URL YO'ZMASLIG: (SSV protokoli), (PubMed), (WHO) kabi qavs ichidagi iqtiboslar taqiqlangan.
Manbalar tizim tomonidan avtomatik qo'shiladi: avval O'zbekiston SSV protokollari (lex.uz, ssv.uz),
keyin xalqaro jurnallar (PubMed, Cochrane, Lancet, NEJM, WHO/ESC/NICE qidiruv havolalari).
Spekulyatsiya, o'ylab topilgan manba va tasdiqlanmagan da'vo YO'Q.
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
