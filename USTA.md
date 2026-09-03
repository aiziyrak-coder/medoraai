# USTA.md — AiDoktor tuzatish yo'l xaritasi

**Maqsad:** 4 ta auditda topilgan barcha muammolarni bartaraf etish.
**Boshlangan:** 2026-09-03 · **Bazaviy commit:** `25217fa`

Qaytish: `git reset --hard 25217fa` (barcha tuzatishlar bekor bo'ladi)

---

## 0-bosqich — BAJARILDI ✅
- Tezkor tahlil (SSE oqimi) uzilib qolishi tuzatildi: `sseParser.ts`, `apiAiService.ts`, `azure_utils.stream_model()`, `doctor_support.py`. 5 test + build o'tdi.

---

## 1-bosqich — Bemor ma'lumotlari xavfsizligi (KRITIK) — BAJARILDI ✅
- [x] FHIR endpointlari ochiq (`integrations/fhir_views.py`) — obuna + klinika filtri
- [x] `dossier?id=` bo'yicha sanab chiqish (`patients/views.py:350`)
- [x] `get_object()` — begona bemorni tahrirlash (`patients/views.py:109`)
- [x] `registry-search` klinika filtrisiz (`patients/views.py:196`)
- [x] `primary_care_access.py` — guruh o'chirilsa cheklovsiz kirish
- [x] Telegram webhook siri majburiy bo'lsin (`accounts/views.py:890`)
- [x] Tashkilot parollari deterministik (`accounts/org_catalog.py:96`)
- [x] Bulk foydalanuvchilar umumiy parol (`create_fjsti_bulk_users.py`)
- [x] `create_superuser.py` — kodda parol
- [x] Har yangi user standart guruhga tushishi (`accounts/models.py:154,281`)
- [x] `X-Forwarded-For` ishonchi → rate limit aylanib o'tiladi (`middleware.py:202`)
- [x] `/admin/` rate limitdan chiqarilgan (`middleware.py:165`)
- [x] Token muddati 7 kun, rotatsiya yo'q (`settings.py:218`)
- [x] `_CORS_ALWAYS_APPEND` operator sozlamasini bosib o'tadi (`settings.py:241`)
- [x] `/media/` autentifikatsiyasiz (nginx + `patients/models.py:108`)

## 2-bosqich — To'qilgan klinik ma'lumot (KRITIK) — BAJARILDI ✅
- [x] `clinical_decision_engine.py:127` — AI yiqilsa soxta triaj
- [x] `consensus_repair.py:705` — regex bilan o'ylab topilgan dorilar
- [x] `prognosis_builder.py:15` — shablon prognoz, qotirilgan 0.55
- [x] `uzbekistan_knowledge_base.py:179` — "SSV buyrug'i No. XX"
- [x] `ai_services/views.py:344` — xatoda `success: true`
- [x] `caseService.ts:6` — aniqlik 90% dan past chiqmaydi
- [x] `LandingPage.tsx:271` — to'qilgan raqamlar (15,000+, 50+, 100K+)
- [x] `riskScores.ts` — o'ylab topilgan xavf foizlari
- [x] `aiCouncilService.ts:2073` — "Dori" nomli retsept
- [x] `DataInputForm.tsx:608` — bir bosishda soxta hayotiy ko'rsatkichlar

### Yangi: 103 Tezkor triaj — BAJARILDI ✅
- `emergency_triage.py`, `emergency_views.py`, `emergencyComplaints.ts` (90+ shikoyat),
  `EmergencyTriageView.tsx`, 13 test. Dashboardga ulandi.

## 3-bosqich — Frontend kirish nazorati
- [x] `App.tsx:1296` — rol tekshiruvsiz rektor/admin paneli
- [x] `apiAuthService.ts:216` — localStorage'ga ishonch, paywall aylanadi
- [x] `api.ts:230` — parallel 401 da bir nechta refresh (single-flight + timeout)

## 4-bosqich — Backend ishonchliligi
- [x] `multi_agent_system.py:183` — global holat, so'rovlar aralashadi
- [x] AI klientlarda timeout yo'q (`claude_utils.py:100`, `azure_utils.py:50`)
- [x] `ai_services` migrations yo'q → `ProtocolOutcome` jadvali yo'q
- [x] JWT muddati 5 soat noto'g'ri (`accounts/views.py:263`)
- [x] Audit jurnali jim yiqiladi (`analyses/views.py:61`)
- [x] Aholi statistikasi butun jadvalni xotiraga oladi
- [x] SQLite 999 o'zgaruvchi cheklovi (`primary_care_service.py:802`)
- [x] Dead code: `multi_agent_consilium.py`, `jarvis_*` (~1750 qator)

## 5-bosqich — TypeScript va sifat
- [x] TS xatolari: 359 → **0** (`as const` sababi + qolganlari)
- [ ] `tsconfig.json` da strict yo'q
- [x] `npm audit`: 3 high + 1 moderate
- [x] Tarjima kalitlari: ru +275, uzC +275, kaa +325 — yetishmayotgani yo'q
- [~] i18n: kritik ogohlantirish modali 5 tilga o'tkazildi. Qolgan panellar
      (ClinicAdmin, RegionalStats, Rector, Subscription, AboutInstitute) va
      103 ekrani (hozir uz+ru) — keyingi bosqich.
- [x] `index.html` CDN importmap, `vite.config.ts` kalit singdirishi

### Yangi topilma — hal qilindi ✅
- [x] `docs/*_LOGINS.csv` — 63 ta tashkilot **paroli ochiq CSV'da commit qilingan edi**.
  Git'dan chiqarildi, `.gitignore`ga qo'shildi, `scripts/check_secrets.py` endi
  parol ustunli CSV'ni ushlaydi.

## 6-bosqich — Repozitoriy va deploy
- [x] Sirlarni fayllardan tozalash (47 joyda parol, 15 faylda API kalit)
- [x] Deploy skriptlarida `DEBUG=True`
- [x] 42 ta md faylni tartibga solish
- [x] Eskirgan paketlar (Django 5.0.1 EOL, gunicorn CVE)
- [x] CI'da test/lint yo'q

---

## ⚠️ Faqat siz qila oladigan ishlar  <- HOZIR SHU YERDA (kod bilan hal bo'lmaydi)
1. Server root parolini almashtirish + SSH'da parol kirishini o'chirish
2. Gemini API kaliti va Telegram bot tokenini bekor qilish
3. `SECRET_KEY` ni almashtirish
4. Git tarixini tozalash (`git filter-repo`) — parol tarixda qoladi
