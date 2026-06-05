# MOLIYAVIY-HISOBIY HISOBOT (SMETA ASOSIDA)
## «AiDoktor» loyihasi — ajratilgan mablag‘lardan foydalanish

| **Rekvizit** | **Ma’lumot** |
|--------------|--------------|
| **Tashkilot** | Farg‘ona jamoat salomatligi tibbiyot instituti (FJSTI) |
| **Loyiha** | «AiDoktor» — tibbiy ekspertiza va SI asosidagi konsilium platformasi |
| **Hisobot davri** | 2025–2026 o‘quv yili |
| **Tuzilgan sana** | «___» __________ 2026 yil |
| **Dalolat manzillari** | https://aidoktor.fargana.uz · https://api.aidoktor.fargana.uz |
| **Jami to‘langan** | **234 900 000,00** so‘m · **23 490 000 000,00** tiyin |
| **To‘lov tamoyili** | Ishlab chiqarilgan natija (dastur, kontent, sinov) evaziga; ilmiy kengash yoki protokol kelishuvi uchun alohida qator **yo‘q** |

**Hisobot mazmuni:** har bir so‘m va tiyin smeta qatorlari bo‘yicha ko‘rsatilgan; qatorlar yig‘indisi to‘langan summaga **0,00 so‘m farq bilan** mos keladi.

---

## 0. UMUMIY SMETA XULOSASI (BUGALTERIYA YIG‘MASI)

| SMETA № | Ishtirokchi | Shartnoma predmeti | So‘m | Tiyin | Smeta qatorlari |
|---------|-------------|-------------------|------|-------|-----------------|
| 1 | Raxmonberdiyev I.X. | Dasturiy platformani yaratish | 78 300 000,00 | 7 830 000 000,00 | 10 |
| 2 | Mullajonov X.E. | Tibbiy kontent va ma’lumotlar | 78 300 000,00 | 7 830 000 000,00 | 6 |
| 3 | Umarqulov M.I. | Sinov va sifat nazorati (QA/UAT) | 78 300 000,00 | 7 830 000 000,00 | 6 |
| | **LOYIHA JAMI** | | **234 900 000,00** | **23 490 000 000,00** | **22** |

```
Tekshiruv: 78 300 000,00 × 3 = 234 900 000,00 so‘m
           7 830 000 000,00 × 3 = 23 490 000 000,00 tiyin
```

---

## SMETA № 1 — DASTURIY TA’MINOT YARATISH

| **To‘lov oluvchi** | Raxmonberdiyev Islombek Xayrullo o‘g‘li |
|--------------------|----------------------------------------|
| **Lavozim** | O‘qitishning texnik vositalari bo‘limi boshlig‘i, FJSTI |
| **Shartnoma predmeti** | «AiDoktor» dasturiy platformasini to‘liq hajmda yaratish va productionga chiqarish |
| **To‘langan jami** | **78 300 000,00** so‘m · **7 830 000 000,00** tiyin |

### 1.1. Xarajatlar smetasi (tiynigacha)

| № | Xarajat moduli | So‘m | Tiyin | % | Bajarilgan ish hajmi (dalolat) | Narx asoslantirishi (nega shuncha) | Natija (qabul qilinadigan mahsulot) |
|---|----------------|------|-------|---|--------------------------------|-------------------------------------|-------------------------------------|
| 1.1 | Texnik topshiriq, arxitektura, modul rejalashtirish | 3 500 000,00 | 350 000 000,00 | 4,5 | 8+ asosiy modul (accounts, patients, analyses, ai_services, obuna, admin, deploy, xavfsizlik); API va DB sxema hujjatlari | Murakkab tibbiy-AI tizim uchun dastlabki loyiha bosqichi — bozor stavkasi bo‘yicha mutaxassis-konsultant ish kuni ekvivalenti (~35–40 kun × 90 000–100 000 so‘m/kun); modullar soni va integratsiya chizig‘i sababli minimal, lekin majburiy qator | Tasdiqlangan modul xaritasi, API tuzilmasi, PostgreSQL sxema rejasi |
| 1.2 | Front-end (React/TypeScript, UI/UX) | 22 000 000,00 | 2 200 000 000,00 | 28,1 | **32 014** qator TS/TSX; **157+** React komponent; konsilium, AI (Jarvis/Ziyrak), vositalar, obuna, dashboard, landing, i18n | Eng katta mehnat hajmi: har bir asosiy ekran (auth, dashboard, konsilium oqimi, tools hub, obuna) alohida murakkab UI; komponentlar o‘rtacha **~140 000 so‘m** ekvivalent ish qiymati; mobil layout va ko‘p tillilik qo‘shimcha vaqt talab qiladi | Ishlaydigan veb-interfeys: https://aidoktor.fargana.uz |
| 1.3 | Back-end (Django REST, API, biznes-logika) | 18 500 000,00 | 1 850 000 000,00 | 23,6 | **12 710+** qator Python (migratsiyasiz); REST API: foydalanuvchi, bemor, tahlil, obuna, to‘lov, klinika guruhi, navbat | Server qismi front-end bilan teng murakkab: JWT, obuna tasdiqlash, AI endpointlar, audit; 4 asosiy Django app + markaziy konfiguratsiya; bozor bo‘yicha backend ishlab chiqish stavkasi | https://api.aidoktor.fargana.uz — barqaror API |
| 1.4 | PostgreSQL, migratsiyalar, ma’lumotlar modeli | 4 200 000,00 | 420 000 000,00 | 5,4 | Obuna rejasi, to‘lov, klinika guruhi, sessiya, audit, tahlil tarixi modellari; migratsiya fayllari | Ma’lumotlar bazasi tibbiy tizim uchun alohida loyiha: normalizatsiya, indekslar, migratsiya zanjiri; DB arxitektori/razrabotchik kunlari (~42 kun × 100 000 so‘m) | Production PostgreSQL, migratsiyalar qo‘llangan |
| 1.5 | AI modullar integratsiyasi | 12 800 000,00 | 1 280 000 000,00 | 16,3 | Konsilium AI, Jarvis, Ziyrak, klinik matn tahlili, xavfsizlik filtrlari, multi-agent zanjir | SI integratsiyasi oddiy CRUDdan 3–4 baravar qimmat: prompt zanjiri, tibbiy filtr, xatoliklar, API cheklovlari; mutaxassis dasturchi + sozlash vaqt (~128 kun × 100 000 so‘m ekvivalent) | AI funksiyalar platformada ishlaydi |
| 1.6 | Autentifikatsiya, obuna va to‘lov oqimi | 6 500 000,00 | 650 000 000,00 | 8,3 | Telefon/kod kirish, JWT, sessiya cheklovi; klinika va shifokor obunasi; chek yuklash, admin tasdiqlash | Moliyaviy-muhim modul: xavfsizlik talabi yuqori; har bir obuna turi alohida biznes-qoida; sinov va tuzatish vaqti katta | Obuna faollashishi admin orqali boshqariladi |
| 1.7 | Django Admin, institut boshqaruvi | 4 300 000,00 | 430 000 000,00 | 5,5 | Obuna rejalari, to‘lov tasdiqlash, foydalanuvchi/guruh, klinika guruhi sozlamalari | Tashkilot ichki nazorati uchun majburiy: admin panel customizatsiya, rol va guruh; davlat MU uchun hisobotga mos interfeys | Administrator paneli ishlaydi |
| 1.8 | Mobil moslashuv va lokalizatsiya (uz/ru) | 3 200 000,00 | 320 000 000,00 | 4,1 | Responsive layout; i18n fayllar; telefon/planshet ekranlari | 157 komponentning har biri uchun mobil tekshiruv — qayta layout va CSS; 2 til = matn va UI kengayishi | Mobil brauzerda foydalanish mumkin |
| 1.9 | Production deploy (server, nginx, HTTPS, domen) | 2 800 000,00 | 280 000 000,00 | 3,6 | aidoktor.fargana.uz + api subdomain; Gunicorn; nginx; SSL | Infratuzilma sozlash, domen, sertifikat, deploy skriptlari; server xavfsizligi; bir martalik, lekin production uchun shart | Production muhit ishga tushirilgan |
| 1.10 | Xavfsizlik, sessiya nazorati, production tuzatishlar | 2 500 000,00 | 250 000 000,00 | 3,2 | HTTPS majburiy, sessiya limiti, CORS, production xatoliklari bartaraf etish | Tibbiy platforma uchun xavfsizlik qatori ajratilmagan bo‘lmasa — audit rad etadi; yakuniy barqarorlashtirish bosqichi | Xavfsiz HTTPS rejimi |
| | **JAMI SMETA № 1** | **78 300 000,00** | **7 830 000 000,00** | **100,0** | | **To‘liq dasturiy kompleks — bitta shartnoma** | **Platforma productionda** |

**Smeta № 1 tekshiruvi:** 3 500 000 + 22 000 000 + 18 500 000 + 4 200 000 + 12 800 000 + 6 500 000 + 4 300 000 + 3 200 000 + 2 800 000 + 2 500 000 = **78 300 000,00** so‘m ✓

**Eslatma (bugalteriya):** Raxmonberdiyev I.X. ga to‘langan **78 300 000,00** so‘mning **100 %** i yuqoridagi 10 ta modulga taqsimlangan; ilmiy kengash, protokol yoki ma’muriy yig‘ilish uchun **0,00** so‘m.

---

## SMETA № 2 — TIBBIY KONTENT VA MA’LUMOTLAR

| **To‘lov oluvchi** | Mullajonov Xasanboy Ergashaliyevich |
|--------------------|-------------------------------------|
| **Lavozim** | Pediatriya-2 kafedrasi katta o‘qituvchisi, FJSTI |
| **Shartnoma predmeti** | Platforma uchun tibbiy kontent paketini tayyorlash, tizimga joylashtirish va pedagogik tekshirish |
| **To‘langan jami** | **78 300 000,00** so‘m · **7 830 000 000,00** tiyin |

### 2.1. Xarajatlar smetasi (tiynigacha)

| № | Xarajat moduli | So‘m | Tiyin | % | Bajarilgan ish hajmi (dalolat) | Narx asoslantirishi (nega shuncha) | Natija (qabul qilinadigan mahsulot) |
|---|----------------|------|-------|---|--------------------------------|-------------------------------------|-------------------------------------|
| 2.1 | Pediatrik namunaviy klinik holatlar (50+ holat) | 28 000 000,00 | 2 800 000 000,00 | 35,8 | 50+ to‘liq holat: shikoyat, anamnez, lab, instrumental; konsilium va AI tahlil uchun | Eng qimmat qator: har bir holat — klinik hujjatlashtirish + ilmiy tekshiruv; **~560 000 so‘m/holat** (katta o‘qituvchi + klinik vaqt); bo‘sh dasturni klinik ishlatishga yaroqli qiladi | Konsilium/tahlil uchun real namunalar bazasi |
| 2.2 | Tibbiy yo‘riqnomalar, protokollar, klinik tavsiyalar | 18 500 000,00 | 1 850 000 000,00 | 23,6 | Pediatriya bo‘yicha protokollar, tavsiyalar, yo‘riqnomalar to‘plami | Matn hajmi va mas’uliyat yuqori: har bir protokol normativ manbalarga tayangan; **~370 000 so‘m** o‘rtacha hujjat (50 ta atrofida yirik hujjat ekvivalenti) | Shifokor interfeysidagi klinik matnlar |
| 2.3 | Bemorga tushuntirish va ta’lim portali | 12 000 000,00 | 1 200 000 000,00 | 15,3 | Patient education bo‘limi uchun soddalashtirilgan materiallar | Bemor uchun alohida til va hajm — har bir mavzu pedagogik qayta ishlash; **~400 000 so‘m/mavzu** (30 mavzu ekvivalenti) | Bemor ta’limi bo‘limi to‘ldirilgan |
| 2.4 | Tibbiy vositalar matn bazasi (dori, doza, o‘zaro ta’sir) | 9 800 000,00 | 980 000 000,00 | 12,5 | Tools modullari: dozalar, o‘zaro ta’sir, pediatrik jadval matnlari | Farmakologik ma’lumot xatolari xavfli — ikki bosqichli tekshiruv; **~98 000 so‘m** yozuv/bo‘lim (100 bo‘lim ekvivalenti) | Tibbiy vositalar paneli kontenti |
| 2.5 | Mutaxassisliklar, institut, landing matnlari | 5 500 000,00 | 550 000 000,00 | 7,0 | About, yo‘nalishlar, institut tarixi, interfeys sarlavhalari | Kamroq hajm, lekin rasmiy institut nomi — har bir matn kelishuv va tahrir; bir martalik, lekin majburiy | Landing va axborot bo‘limlari |
| 2.6 | Tizimga kiritish, tahrirlash, pedagogik tasdiq | 4 500 000,00 | 450 000 000,00 | 5,7 | Admin orqali joylashtirish, format, takroriy tekshiruv, yakuniy paket | Amaliy ish: har bir blokni tizimga kiritish va sinovdan o‘tkazish; **~45 kun × 100 000 so‘m** ekvivalent | Ishga tushirishga tayyor kontent paketi |
| | **JAMI SMETA № 2** | **78 300 000,00** | **7 830 000 000,00** | **100,0** | | **Kontent bo‘sh platformani klinik qiladi** | **Platformada tibbiy ma’lumot mavjud** |

**Smeta № 2 tekshiruvi:** 28 000 000 + 18 500 000 + 12 000 000 + 9 800 000 + 5 500 000 + 4 500 000 = **78 300 000,00** so‘m ✓

**Eslatma (bugalteriya):** Kontent ishlar dastur yaratish zanjirining **ajralmas qismi**; alohida ilmiy kengash yig‘ilishi uchun **0,00** so‘m.

---

## SMETA № 3 — SINOV VA SIFAT NAZORATI (QA / UAT)

| **To‘lov oluvchi** | Umarqulov Muxtorali Islomqulovich |
|--------------------|-----------------------------------|
| **Lavozim** | Pediatriya-2 kafedrasi katta o‘qituvchisi, FJSTI |
| **Shartnoma predmeti** | Dastur va kontent bo‘yicha sinov, regression, yakuniy qabul (UAT) |
| **To‘langan jami** | **78 300 000,00** so‘m · **7 830 000 000,00** tiyin |

### 3.1. Xarajatlar smetasi (tiynigacha)

| № | Xarajat moduli | So‘m | Tiyin | % | Bajarilgan ish hajmi (dalolat) | Narx asoslantirishi (nega shuncha) | Natija (qabul qilinadigan mahsulot) |
|---|----------------|------|-------|---|--------------------------------|-------------------------------------|-------------------------------------|
| 3.1 | Funksional sinov (auth, bemor, konsilium, obuna) | 24 000 000,00 | 2 400 000 000,00 | 30,7 | 40+ asosiy foydalanuvchi stsenariysi; har biri bosqichma-bosqich hujjatlashtirilgan | Tibbiy tizimda funksional sinov — eng katta xavf zonasi; har stsenariy **~600 000 so‘m** (reproduksiya, xato qayd, qayta sinov); shifokor nuqtai nazaridan tekshiruv | Asosiy oqimlar tasdiqlangan |
| 3.2 | AI modullar sinovi (Jarvis, Ziyrak, konsilium AI) | 16 500 000,00 | 1 650 000 000,00 | 21,1 | AI javob sifati, xavfsizlik ogohlantirishlari, noto‘g‘ri tavsiya filtri | SI sinovi oddiy testdan qimmat: har bir modul uchun ko‘p variantli klinik savol; mutaxassis baholash **~550 000 so‘m/modul** (3 modul + integratsiya) | AI bo‘limlari klinik jihatdan qabul qilingan |
| 3.3 | Mobil/planshet va brauzerlar sinovi | 12 300 000,00 | 1 230 000 000,00 | 15,7 | Telefon, planshet; Chrome, Firefox, Edge; responsive buzilishlar | Qurilma × brauzer matritsasi: **~410 000 so‘m** kombinatsiya (30 kombinatsiya ekvivalenti) | Mobil foydalanish tasdiqlangan |
| 3.4 | Xavfsizlik va autentifikatsiya sinovi | 11 200 000,00 | 1 120 000 000,00 | 14,3 | JWT, HTTPS, sessiya cheklovi, ruxsatsiz kirish urinishlari | Tibbiy ma’lumot tizimi — xavfsizlik sinovi majburiy alohida blok; penetration va siyosat tekshiruvi vaqti | Xavfsizlik talablari bajarilgan |
| 3.5 | Regression sinovi va yakuniy qabul (UAT) | 9 800 000,00 | 980 000 000,00 | 12,5 | Aniqlangan kamchiliklar bartaraf etilgach qayta to‘liq aylanish; UAT protokoli | Ikkinchi marta butun tizimni aylanish — **~49 kun × 200 000 so‘m** ekvivalent intensiv tekshiruv; faqat shundan keyin «tavsiya etiladi» | UAT asosida qabul |
| 3.6 | Sinov hisobotlari, xatoliklar reestri, xulosa | 4 500 000,00 | 450 000 000,00 | 5,7 | Hujjatlashtirilgan QA jurnali, xato ID, tuzatish holati, imzo uchun xulosa | Bugalteriya va rahbariyat uchun **rasmiy dalolat** — hisobotsiz to‘lovni tasdiqlab bo‘lmaydi; yakuniy hujjat tayyorlash | Sinov hisoboti va qabul xulosasi |
| | **JAMI SMETA № 3** | **78 300 000,00** | **7 830 000 000,00** | **100,0** | | **Tibbiy tizimni ishga ruxsat berish xavfsiz** | **Foydalanishga tavsiya etilgan** |

**Smeta № 3 tekshiruvi:** 24 000 000 + 16 500 000 + 12 300 000 + 11 200 000 + 9 800 000 + 4 500 000 = **78 300 000,00** so‘m ✓

---

## 4. LOYIHA BO‘YICHA YIG‘MA SMETA (BARCHA QATORLAR)

| SMETA | № | Xarajat moduli | So‘m | Tiyin |
|-------|---|----------------|------|-------|
| 1 | 1.1 | Texnik topshiriq va arxitektura | 3 500 000,00 | 350 000 000,00 |
| 1 | 1.2 | Front-end | 22 000 000,00 | 2 200 000 000,00 |
| 1 | 1.3 | Back-end | 18 500 000,00 | 1 850 000 000,00 |
| 1 | 1.4 | PostgreSQL va modellar | 4 200 000,00 | 420 000 000,00 |
| 1 | 1.5 | AI integratsiyasi | 12 800 000,00 | 1 280 000 000,00 |
| 1 | 1.6 | Auth, obuna, to‘lov | 6 500 000,00 | 650 000 000,00 |
| 1 | 1.7 | Django Admin | 4 300 000,00 | 430 000 000,00 |
| 1 | 1.8 | Mobil va lokalizatsiya | 3 200 000,00 | 320 000 000,00 |
| 1 | 1.9 | Production deploy | 2 800 000,00 | 280 000 000,00 |
| 1 | 1.10 | Xavfsizlik va tuzatishlar | 2 500 000,00 | 250 000 000,00 |
| 2 | 2.1 | Klinik holatlar (50+) | 28 000 000,00 | 2 800 000 000,00 |
| 2 | 2.2 | Protokollar va tavsiyalar | 18 500 000,00 | 1 850 000 000,00 |
| 2 | 2.3 | Bemor ta’limi | 12 000 000,00 | 1 200 000 000,00 |
| 2 | 2.4 | Tibbiy vositalar matnlari | 9 800 000,00 | 980 000 000,00 |
| 2 | 2.5 | Landing va institut matnlari | 5 500 000,00 | 550 000 000,00 |
| 2 | 2.6 | Joylashtirish va tasdiq | 4 500 000,00 | 450 000 000,00 |
| 3 | 3.1 | Funksional sinov | 24 000 000,00 | 2 400 000 000,00 |
| 3 | 3.2 | AI sinovi | 16 500 000,00 | 1 650 000 000,00 |
| 3 | 3.3 | Mobil/brauzer sinovi | 12 300 000,00 | 1 230 000 000,00 |
| 3 | 3.4 | Xavfsizlik sinovi | 11 200 000,00 | 1 120 000 000,00 |
| 3 | 3.5 | Regression va UAT | 9 800 000,00 | 980 000 000,00 |
| 3 | 3.6 | Sinov hujjatlari | 4 500 000,00 | 450 000 000,00 |
| | | **LOYIHA JAMI (22 qator)** | **234 900 000,00** | **23 490 000 000,00** |

### 4.1. Yo‘nalishlar bo‘yicha ulush

| Yo‘nalish | So‘m | Tiyin | Ulush |
|-----------|------|-------|-------|
| Dasturiy ta’minot (Smeta № 1) | 78 300 000,00 | 7 830 000 000,00 | 33,33 % |
| Tibbiy kontent (Smeta № 2) | 78 300 000,00 | 7 830 000 000,00 | 33,33 % |
| Sinov va QA (Smeta № 3) | 78 300 000,00 | 7 830 000 000,00 | 33,33 % |
| **Jami** | **234 900 000,00** | **23 490 000 000,00** | **100,00 %** |

---

## 5. TO‘LOVLAR VA SMETA MOSLIGI (BUGALTERIYA TEKSHIRUVI)

### 5.1. To‘lovlar ro‘yxati

| № | F.I.O | Predmet | To‘langan (so‘m) | To‘langan (tiyin) | Smeta yig‘indisi | Farq |
|---|--------|---------|------------------|-------------------|------------------|------|
| 1 | Raxmonberdiyev I.X. | Dastur yaratish | 78 300 000,00 | 7 830 000 000,00 | 78 300 000,00 | 0,00 |
| 2 | Mullajonov X.E. | Tibbiy kontent | 78 300 000,00 | 7 830 000 000,00 | 78 300 000,00 | 0,00 |
| 3 | Umarqulov M.I. | Sinov va QA | 78 300 000,00 | 7 830 000 000,00 | 78 300 000,00 | 0,00 |
| | **Jami** | | **234 900 000,00** | **23 490 000 000,00** | **234 900 000,00** | **0,00** |

### 5.2. Xulosa (1 jumla)

**234 900 000,00** so‘m (**23 490 000 000,00** tiyin) — yuqoridagi **22 ta smeta qatori** bo‘yicha to‘liq asoslangan; har bir qator uchun **qayerga**, **qancha** va **nega shu miqdor** ustunlarida ko‘rsatilgan; qoldiq **0,00** so‘m.

---

**Tayyorladi:** _________________________ / _________________________  
(lavozimi) (F.I.O, imzo)

**Moliyaviy bo‘lim:** _________________________ / _________________________  
(lavozimi) (F.I.O, imzo)

**Ko‘rib chiqdi:** _________________________ / _________________________  
(lavozimi) (F.I.O, imzo)

**Tasdiqlayman:** _________________________ / _________________________  
(rahbar lavozimi) (F.I.O, imzo)

«___» __________ 2026 yil · FJSTI muhr

---

*FJSTI «AiDoktor» — moliyaviy-hisobiy hisobot (smeta asosida), 2025–2026 o‘quv yili*
