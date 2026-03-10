# Medora AI – AI integratsiya g‘oyalari

Bu hujjatda loyihaga **qanday va qayerda** AI (asosan Gemini) ni zo‘r qilib integratsiya qilish mumkinligi bo‘yicha aniq takliflar keltirilgan.

---

## 0. Amalga oshirilgan monitoring AI (2025)

Barcha 7 ta taklif + **o‘lim xavfi bashorati** qo‘shildi.

| # | Funksiya | Backend | Frontend (SinglePatientView) |
|---|----------|---------|------------------------------|
| 1 | Yomonlashuv xavfi (risk score) | `POST /api/ai/monitoring/risk-score/` | AI tahlil → "Yuklash" |
| 2 | Alarm tushuntirishi | `POST /api/ai/monitoring/explain-alarm/` | Har bir alarmda "AI tushuntirish" |
| 3 | Kunlik xulosa | `POST /api/ai/monitoring/daily-summary/` | AI tahlil → Kunlik xulosa |
| 4 | Eslatma qoralamasi | `POST /api/ai/monitoring/draft-note/` | Eslatmalar → "AI yordamida yozish" |
| 5 | Trend bashorat (SpO2/nafas) | `POST /api/ai/monitoring/trend-prediction/` | AI tahlil → Trend bashorat |
| 6 | Sepsis erta ogohlantirish | `POST /api/ai/monitoring/early-warning/` | AI tahlil → Sepsis |
| 7 | Alarm chegaralari taklifi | `POST /api/ai/monitoring/suggest-thresholds/` | Alarm chegaralari → "AI taklif" |
| 8 | **O‘lim xavfi bashorati** | `POST /api/ai/monitoring/mortality-prediction/` | AI tahlil → O‘lim xavfi bashorati |

**Fayllar:** `backend/ai_services/monitoring_ai.py`, `backend/ai_services/views.py`, `backend/ai_services/urls.py`, `frontend/src/services/monitoringApiService.ts`, `frontend/src/components/MonitoringDashboard.tsx`.

---

## 1. Hozirgi holat (qisqacha)

| Joy | AI ishlatilishi |
|-----|------------------|
| **Klinik (shifokor)** | Savol aniqlashtirish, mutaxassislar tavsiyasi, differensial tashxis, konsilium munozarasi – backend + frontend Gemini |
| **Monitoring (palata)** | 8 ta AI: risk, explain alarm, kunlik xulosa, draft note, trend, sepsis, suggest thresholds, **o‘lim bashorati** |

**Infrastruktura:** `backend/ai_services/gemini_utils.py`, `backend/ai_services/monitoring_ai.py`, `GEMINI_API_KEY`, frontend `monitoringApiService.ts` – barchasi ishlatiladi.

---

## 2. Monitoring uchun AI g‘oyalari (prioritet bo‘yicha)

### 2.1 Bemor holatining yomonlashuvi xavfi (Deterioration / Risk score)

**Nima:** Vitals vaqt qatoriga qarab AI “xavf balli” yoki “yomonlashuv ehtimoli” beradi (masalan 0–100 yoki past/o‘rta/yuqori).

**Qayerda:**
- **Backend:** `POST /api/ai/monitoring/risk-score/` – `patient_monitor_id`, `from`, `to`; so‘rovda oxirgi N ta `VitalReading` o‘qib, promptda jamlab Gemini ga yuboramiz; javobda `risk_level`, `score`, `reason` (qisqa tushuntirish).
- **Frontend:** `PatientCard` da kichik badge (masalan “AI risk: o‘rta”) yoki bitta bemor ochilganda “AI tahlil” bloki.

**Fayllar:**  
`backend/ai_services/views.py` (yangi view), `backend/ai_services/urls.py`, `backend/monitoring/models.py` (ixtiyoriy: `PatientMonitor` ga `last_ai_risk` cache).  
Frontend: `monitoringApiService.ts` (yangi `getMonitoringRiskScore`), `MonitoringDashboard.tsx` (PatientCard va SinglePatientView).

**Qisqa prompt g‘oyasi:**  
“Quyidagi vital belgilar vaqt ketma-ketligi berilgan. Tibbiy nuqtai nazardan bemor holatining yomonlashuvi xavfini baholang: past / o‘rta / yuqori. Qisqa asos (1–2 jumla) va 0–100 ball bering. Javobni JSON da qaytaring.”

---

### 2.2 Alarmlar uchun “AI tushuntirishi” (Explain alarm)

**Nima:** Hamshira alarmni bosganda “Nima uchun bu alarm ishga tushdi?” degan savolga AI qisqa, tushunarli javob beradi (masalan: “SpO2 88% – kislorod yetishmasligi belgisi, nafas olishni kuzatish kerak”).

**Qayerda:**
- **Backend:** `POST /api/ai/monitoring/explain-alarm/` – `alarm_id` yoki `patient_monitor_id` + vitals va alarm qoidasi; Gemini ga kontekst berib, 2–3 jumlali tushuntirish so‘raymiz.
- **Frontend:** Alarm ro‘yxatida yoki bitta alarm detailida “Tushuntirish” tugmasi → modal yoki tooltip da AI javobi.

**Fayllar:**  
`backend/ai_services/views.py`, `backend/ai_services/urls.py`, `MonitoringDashboard.tsx` (alarm UI).

---

### 2.3 Bemor uchun kunlik qisqa xulosa (Daily summary)

**Nima:** Bir bemor uchun oxirgi 24 soat vitals + alarmlar asosida AI “bugun nima bo‘ldi” degan 3–5 jumlali xulosa yozadi (masalan: “SpO2 bir necha marta 90 dan past tushdi, 2 marta alarm. HR barqaror.”).

**Qayerda:**
- **Backend:** `GET /api/ai/monitoring/daily-summary/?patient_monitor_id=...&date=...` – vitals va alarmlarni yig‘ib, Gemini ga beramiz; javob matn.
- **Frontend:** Single patient view da “Kunlik xulosa” bo‘limi yoki export (PDF) ichiga AI xulosani qo‘shamiz.

**Fayllar:**  
`backend/ai_services/views.py`, `monitoring/views.py` (vitals/alarms ma’lumotini olish), `MonitoringDashboard.tsx`.

---

### 2.4 Sepsis / jiddiy infektsiya uchun erta ogohlantirish (Early warning)

**Nima:** Vitals (HR, temp, nafas, SpO2, AQB) va ixtiyoriy lab ma’lumotlari bo‘lsa, AI “sepsis ehtimoli” yoki “jiddiy infektsiya uchun erta belgi” bo‘yicha qisqa baho beradi. Bu klinik qarorlarni almashtirmaydi, faqat e’tiborni tortadi.

**Qayerda:**
- **Backend:** `POST /api/ai/monitoring/early-warning/` – `patient_monitor_id`, time range; vitals + ixtiyoriy metadata (yoshi, jinsi va hokazo) → Gemini; javob: `concern_level`, `suggested_actions` (masalan “infeksion mutaxassisga murojaat”).
- **Frontend:** Faqat bitta bemor ekranida “AI erta ogohlantirish” bloki (shaffof va ehtiyotkorlik bilan).

**Fayllar:**  
`backend/ai_services/views.py`, `MonitoringDashboard.tsx` (SinglePatientView).  
**Muhim:** Javobda har doim “tibbiy tashxis emas, faqat qo‘llab-quvvatlash” degan disclaimer bo‘lsin.

---

### 2.5 SpO2 / nafas trendi – “Keyingi 1 soatda tushishi mumkin” (Trend prediction)

**Nima:** Oxirgi 1–2 soatlik SpO2 va nafas o‘lchamlari berilganda, AI “keyingi soatda SpO2 90 dan past tushishi ehtimoli” kabi oddiy bashorat beradi (ball yoki “past / o‘rta / yuqori”).

**Qayerda:**
- **Backend:** `POST /api/ai/monitoring/trend-prediction/` – `patient_monitor_id`, `metric` (spo2 | respiration), `horizon_minutes`; vitals o‘qib, promptda trend va sonlarni beramiz; javob JSON (masalan `deterioration_risk`, `reason`).
- **Frontend:** Single patient view da “Trend” yoki “Bashorat” kichik blok.

**Fayllar:**  
`backend/ai_services/views.py`, `MonitoringDashboard.tsx`.

---

### 2.6 Shaxsiy alarm chegaralarini AI taklif qilishi (Suggested thresholds)

**Nima:** Bemorning oxirgi 7 kunlik vitals statistikasiga qarab AI “bu bemor uchun HR yuqori chegarani 125 qilish mantiqiy” kabi taklif beradi. Hamshira/shifokor qabul qiladi yoki rad etadi.

**Qayerda:**
- **Backend:** `POST /api/ai/monitoring/suggest-thresholds/` – `patient_monitor_id`; vitals statistikasi (min/max/o‘rtacha, percentillar) → Gemini; javob: `suggested_hr_high`, `suggested_spo2_low` va hokazo + qisqa asos.
- **Frontend:** Bitta bemor → “Alarm chegaralari” oynasida “AI taklif” tugmasi; taklifni ko‘rsatamiz, “Qo‘llash”/“Bekor qilish”.

**Fayllar:**  
`backend/ai_services/views.py`, `backend/monitoring/views.py` (AlarmThreshold), `MonitoringDashboard.tsx`.

---

### 2.7 Eslatma va protokol yozishda yordam (Notes / handover draft)

**Nima:** Bemor uchun oxirgi vitals, alarmlar va mavjud eslatmalar berilganda, AI “kechki shift uchun qisqa handover” yoki “bemor holati haqida eslatma qoralamasi” yozadi. Hamshira tahrir qilib saqlaydi.

**Qayerda:**
- **Backend:** `POST /api/ai/monitoring/draft-note/` – `patient_monitor_id`, `type`: `handover` | `progress_note`; kontekst yig‘ib Gemini ga beramiz; javob matn.
- **Frontend:** Single patient → “Eslatmalar” → “AI yordamida yozish” → draft ko‘rsatiladi, tahrir, saqlash.

**Fayllar:**  
`backend/ai_services/views.py`, `MonitoringDashboard.tsx` (notes panel).

---

## 3. Klinik (shifokor) tomonda qo‘shimcha AI

- **Tashxis va reja qisqacha:** Konsiliumdan keyin “bemor uchun 3 jumlali xulosa” yoki “ota-onaga tushunarli tushuntirish” – hozirgi `aiCouncilService` va backend AI ga yangi endpoint qo‘shish mumkin.
- **Retsept va SSV:** “O‘zbekiston dorilari va SSV qoidalariga mos” – allaqachon mavjud; uni monitoring bilan bog‘lash shart emas, lekin bir interfeysda “bemor monitoring + klinik tashxis” birlashtirilgan ko‘rinishi keyinchalik qo‘shilishi mumkin.

---

## 4. Texnik qadamlar (umumiy)

1. **Backend:**  
   - `backend/ai_services/` da yangi funksiyalar (masalan `monitoring_ai.py`) yoki mavjud `views.py` ga yangi view’lar.  
   - `gemini_utils._call_gemini()` dan foydalanish, javoblarni JSON yoki matn qilib parse qilish.  
   - `api/ai/` ostida yangi URL’lar: `/api/ai/monitoring/risk-score/`, `/api/ai/monitoring/explain-alarm/` va hokazo.

2. **Monitoring ma’lumoti:**  
   - Yangi AI view’lar `monitoring` app dan `VitalReading`, `Alarm`, `PatientMonitor` o‘qishi kerak (import va filter by `patient_monitor_id`, `device_serial`, vaqt oralig‘i).

3. **Frontend:**  
   - `monitoringApiService.ts` da yangi API chaqiriqlar.  
   - `MonitoringDashboard.tsx` da: PatientCard da kichik AI badge, SinglePatientView da “AI tahlil”, “Tushuntirish”, “Kunlik xulosa”, “AI eslatma qoralamasi” va hokazo.

4. **Xavfsizlik va disclaimers:**  
   - Barcha AI chiqishlarida “Tibbiy tashxis emas, qo‘llab-quvvatlash vositasi” kabi matn.  
   - API’da rate limit va faqat autentifikatsiya qilingan foydalanuvchilar.

---

## 5. Qisqacha prioritet ro‘yxati

| # | G‘oya | Murakkablik | Ta’sir | Boshlash |
|---|------|-------------|--------|----------|
| 1 | Risk score / deterioration | O‘rta | Yuqori | Backend `risk-score` endpoint + frontend badge |
| 2 | Alarm tushuntirishi (Explain) | Past | Yuqori | Backend `explain-alarm` + alarm UI da tugma |
| 3 | Kunlik xulosa | O‘rta | O‘rta | Backend `daily-summary` + single patient view |
| 4 | Eslatma / handover qoralamasi | Past | O‘rta | Backend `draft-note` + notes panel |
| 5 | Trend prediction (SpO2/nafas) | O‘rta | O‘rta | Backend `trend-prediction` + kichik blok |
| 6 | Sepsis erta ogohlantirish | Yuqori | Yuqori | Klinik talab va disclaimer bilan |
| 7 | AI taklif qiladigan chegaralar | O‘rta | O‘rta | Backend + threshold sozlamalarida “AI taklif” |

Agar birinchi marta qo‘shmoqchi bo‘lsangiz, **1 (risk score)** va **2 (alarm tushuntirishi)** dan boshlash eng ma’qul – infratuzilma bir xil, foydalanuvchi darhol ko‘radi va “AI zo‘r qilib ishlatilmoqda” hissi beradi.
