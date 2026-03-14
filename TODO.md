# TODO — Professional dastur uchun vazifalar

---

## 1. Hisobot va eksport — BAJARILDI
- [x] Konsilium/tahlil yakunida **PDF** va **Word** hisobot (DownloadPanel, pdfGenerator, docxGenerator).
- [x] Eksport tugmalari va sarlavhalar i18n orqali tarjimalandi (export_report_title, export_download_pdf, export_download_word, export_specialist_conclusion).

---

## 2. Audit izi (kim, nima, qachon) — BAJARILDI
- [x] Backend: **AnalysisAuditLog** modeli (action: created/updated/viewed, user, created_at).
- [x] Tahlil yaratilganda va yangilanganda avtomatik yozuv.
- [x] GET `/analyses/:id/audit/` — audit ro‘yxatini olish.

---

## 4. Shifokor fikri va reyting — BAJARILDI
- [x] Backend: **AnalysisUsefulnessFeedback** (useful: bool, comment: text). POST `/analyses/:id/usefulness-feedback/`.
- [x] Frontend: **UsefulnessFeedbackCard** — yakuniy xulosa qutida "Foydali / Foydali emas" + ixtiyoriy izoh, yuborish.

---

## 7. Til barqarorligi
- [ ] Barcha ekranlar va AI chiqishlari tanlangan tilda uyumli (asosan mavjud; kerak bo‘lsa qolgan matnlarni i18n ga o‘tkazish).

---

## 8. Tez ishlash va yuklanish — QISQACHA BAJARILDI
- [x] **Lazy load**: HistoryView, ResearchView, CaseLibraryView — `React.lazy` + `Suspense` (yuklanmoqda fallback).
- [ ] Keshlash (masalan API javoblari) va katta rasmlar optimallashtirish — keyingi bosqichda.

---

## 9. Yordam va qisqa yo'riqnoma — BAJARILDI
- [x] UserGuide ichida **"Tez-tez so‘raladigan savollar"** bo‘limi (help_faq_title, help_faq_1_q/a, 2, 3).
- [x] Yo‘riqnoma bo‘limlari: Boshlash, Tahlil, Xulosa, Tadqiqot, Registrator, FAQ.

---

## 10. Xato va uzilishda aniq xabar — BAJARILDI
- [x] **ErrorWithRetry** komponenti: aniq xabar (error_connection_or_service) + **Qayta urinish** tugmasi.
- [x] AnalysisView da xato chiqganda ErrorWithRetry ko‘rsatiladi, onRetry orqali xatolik tozalanadi.

---

*Bajarilgan bandlar: 1, 2, 4, 8 (qisman), 9, 10.*
