# "API key not valid" – Gemini kalitini to‘g‘rilash

Xato: **API key not valid. Please pass a valid API key.** / **API_KEY_INVALID**

## Sabab
- Kalit noto‘g‘ri nusxalangan (ortiqcha bo‘sh joy, qirqilgan).
- Kalit bekor qilingan yoki o‘chirilgan.
- **Generative Language API** kalit uchun yoqilmagan.
- Kalit cheklovlari (masalan, faqat ma’lum domen) brauzer/originni bloklayapti.

## Qadamlar

### 1. Yangi kalit olish (Google AI Studio)
1. https://aistudio.google.com/apikey ga kiring (Google hisobi bilan).
2. **Create API key** → loyiha tanlang yoki yangi yarating.
3. Kalitni nusxalang (faqat bir marta ko‘rsatiladi).

### 2. API yoqilganligini tekshirish (Google Cloud)
Agar kalit Cloud Console orqali yaratilgan bo‘lsa:
1. https://console.cloud.google.com/apis/library
2. **Generative Language API** qidiring va **Enable** qiling.

### 3. Serverda kalitni yangilash
```bash
nano /var/www/medoraai/.env.production
```
- `GEMINI_API_KEY=` qatoriga **faqat** yangi kalitni yozing (bo‘sh joy, qo‘shtirnoq yo‘q).
- Saqlang (Ctrl+O, Enter, Ctrl+X).

### 4. Frontendni qayta build qilish
Kalit build vaqtida “ichiga” yoziladi, shuning uchun build qayta kerak:
```bash
cd /var/www/medoraai/frontend
npm run build
```

### 5. Brauzerda tekshirish
- https://medora.cdcgroup.uz ni yangilang (Ctrl+Shift+R).
- AI (konsilium) funksiyasini qayta urinib ko‘ring.

---

**Eslatma:** Kalit brauzer orqali ham ishlashi kerak (frontend to‘g‘ridan-to‘g‘ri Gemini ga so‘rov yuboradi). Agar kalitda “HTTP referrer” yoki “IP” cheklovi bo‘lsa, medora.cdcgroup.uz domenini (yoki `*`) ruxsatga qo‘shing.
