# Frontend ishlamasa — Node.js o'rnatish

Frontend **npm** va **Node.js** talab qiladi. Agar `npm run dev` ishlamasa yoki "npm topilmadi" xabari chiqsa, quyidagilarni bajarishingiz kerak.

---

## 1. Node.js o'rnatish

1. **Node.js yuklab oling:** https://nodejs.org/  
   - **LTS** versiyasini tanlang (masalan, 20.x yoki 22.x).

2. **O'rnatish** paytida quyidagilarni belgilang:
   - **"Add to PATH"** — belgilangan bo'lsin (Node va npm global PATH ga qo'shiladi).

3. O'rnatish tugagach **kompyuterni qayta ishga tushiring** yoki yangi terminal/PowerShell oching.

---

## 2. Tekshirish

Yangi terminalda:

```powershell
node -v
npm -v
```

Ikkalasi ham versiya ko'rsatsa (masalan `v20.10.0` va `10.2.0`), Node.js to'g'ri o'rnatilgan.

---

## 3. Frontend uchun paketlar va ishga tushirish

```powershell
cd E:\medoraai\frontend
npm install
npm run dev
```

Bundan keyin frontend **http://localhost:3000** da ochiladi.

---

## 4. Muammolar

### "npm topilmadi" / "npm is not recognized"
- Node.js o'rnatilmagan yoki PATH ga qo'shilmagan.
- Qayta o'rnating va **"Add to PATH"** ni belgilang, keyin terminalni yoping oching.

### "EACCES" / "Permission denied"
- PowerShell yoki CMD ni **Administrator** sifatida ochib, `npm install` ni qayta ishlating.
- Yoki loyihani boshqa papkaga (masalan, `C:\medoraai`) ko'chirib sinab ko'ring.

### "node_modules topilmadi"
- Avval `npm install` ni ishlating, keyin `npm run dev`.

---

## 5. Qisqacha

| Qadam | Buyruq |
|-------|--------|
| 1 | Node.js o'rnating (nodejs.org), PATH ga qo'shing |
| 2 | `cd E:\medoraai\frontend` |
| 3 | `npm install` |
| 4 | `npm run dev` |

Frontend **3000** portda ishlaydi: http://localhost:3000
