# MedoraAI — Obuna (SaaS): Klinika va Shifokor

## Ikki tur obuna

| Tur | Narx | To'lov usuli | Faollashuv |
|-----|------|----------------|------------|
| **Klinika (Konsilium)** | **500 $/oy** | Shartnoma asosida. Hisob raqamdan o'tkazma. | Admin to'lovni tekshirgach obunani 30 kunga faollashtiradi. |
| **Shifokor** | **10 $/oy** | Chek yuborish (karta yoki boshqa usul). | Admin chekni tasdiqlagach **30 kunga** obuna faollashadi. |

- **Klinika** — Obuna sahifasida 500$/oy va bank rekvizitlari (hisob raqam, MFO, INN) ko'rsatiladi. To'lovni hisob raqamdan o'tkazadilar.
- **Shifokor** — 10$/oy, to'lov chekini yuklash. Admin tasdiqlagach 30 kun faol.
- **Trial** — Yangi ro'yxatdan o'tgan shifokorlar uchun 7 kunlik trial avtomatik beriladi.

---

## Backend

### Migratsiyalar

```bash
cd backend
python manage.py makemigrations accounts
python manage.py migrate
```

### Default rejalar

```bash
python manage.py create_default_plans
```

Bu buyruq 2 ta reja yaratadi: **Klinika (Konsilium)** 500$/oy, **Shifokor (oylik)** 10$/oy, 30 kun (agar `clinic`/`doctor` slug'li rejalar bo'lmasa).

### Admin

- **Obuna rejalari** — Reja qo'shish/tahrirlash: `/admin/accounts/subscriptionplan/`
- **Obuna to'lovlari** — Kutilayotgan to'lovlarni ko'rish va **"Tanlangan to'lovlarni tasdiqlash"** action bilan tasdiqlash: `/admin/accounts/subscriptionpayment/`

To'lov tasdiqlanganda foydalanuvchining `subscription_status` = `active`, `subscription_plan` va `subscription_expiry` o'rnatiladi.

### API

| Endpoint | Tavsif |
|----------|--------|
| `GET /api/auth/plans/` | Barcha faol obuna rejalari (auth shart emas) |
| `GET /api/auth/subscription/` | Joriy foydalanuvchi obunasi (token kerak) |
| `POST /api/auth/send-payment-receipt/` | Chek yuborish (file, user_name, user_phone, user_role, amount, plan_id) |

---

## Frontend

- **Obuna sahifasi** — Rejalar API dan yuklanadi, foydalanuvchi reja tanlaydi, summa va chek yuboriladi; `plan_id` backend'ga yuboriladi.
- **Profil** — Shifokor profilida obuna rejasi, trial qolgan kunlar yoki obuna tugash sanasi ko'rsatiladi.
- **Kirish tekshiruvi** — `hasActiveSubscription(user)` trial va `subscription_expiry` ni hisobga oladi; faol obuna bo'lmasa `SubscriptionPage` ko'rsatiladi.

---

## Trial

- Ro'yxatdan o'tishda **doctor** roli uchun avtomatik: `subscription_status = 'active'`, `trial_ends_at = hozir + 7 kun`.
- Trial tugagach (yoki obuna muddati tugagach) foydalanuvchi yana obuna sahifasiga yo'naltiriladi va to'lov qilishi kerak.

---

## Bank rekvizitlari (klinika)

Klinikalar uchun hisob raqam **frontend** da `SubscriptionPage.tsx` ichida `BANK_ACCOUNT` konstantada. Haqiqiy bank nomi, hisob raqam, MFO, INN va qabul qiluvchi nomini qo'ying.

## Xulosa

- **Klinika:** 500$/oy, shartnoma asosida, hisob raqamdan o'tkazma → admin tasdiqlagach 30 kun faol.
- **Shifokor:** 10$/oy, chek yuborish → admin tasdiqlagach 30 kun faol.
- Backend: `SubscriptionPlan` (plan_type: clinic/doctor), `SubscriptionPayment`, admin tasdiqlash.
- Frontend: klinika uchun bank rekvizitlari, shifokor uchun chek yuklash.
