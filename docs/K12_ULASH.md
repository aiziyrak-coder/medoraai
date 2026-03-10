# Creative Medical K12 monitorni platformaga ulash

K12 ekranida **Интернет** tabida ko‘rsatilgan sozlamalar orqali monitor **bizning server**ga ulanadi va HL7 orqali vitals yuboradi.

---

## 1. K12 da qadamlarda qanday to‘ldiraman?

Monitor **ekranini** (sensorli yoki tugmalar bilan) boshqaring.

1. **Интернет** tabini oching  
   Yuqoridagi tablar: Общий, Дата/Время, **Интернет**, AI-ECG. **«Интернет»** ni bosing.

2. **Server IP (IP-адрес сервера)**  
   To‘rtta maydon ko‘rinadi. Har biriga shu raqamlarni kiriting:
   - 1‑maydon: **192**
   - 2‑maydon: **168**
   - 3‑maydon: **168**
   - 4‑maydon: **254**  
   (Agar serveringiz boshqa IP da bo‘lsa, shu kompyuterning IP sini shu to‘rtta qismga kiriting.)

3. **Port (Разъем)**  
   «Разъем» yonidagi bitta maydonga: **6006** kiriting.

4. **Saqlash**  
   Pastdagi **«Подтвердить»** (Tasdiqlash) tugmasini bosing. Sozlamalar saqlanadi.  
   Xato bo‘lsa **«Отмена»** (Bekor qilish) bosing.

Локальный IP, маска, шлюз – odatda avtomatik yoki tarmoqda allaqachon to‘g‘ri. Agar tarmoq ishlasa, ularni o‘zgartirish shart emas.

---

## 2. K12 da qanday sozlash (jadval)

Monitor ekranida (sizning rasmda):

| Sozlama | Qiymat | Izoh |
|--------|--------|------|
| **IP-адрес сервера** (Server IP) | `192.168.168.254` | Gateway (yoki server) ishlaydigan kompyuterning IP manzili |
| **Разъем** (Port) | `6006` | HL7 MLLP port (gateway shu portda tinglaydi) |
| **Локальный IP** | `192.168.168.226` | K12 ning o‘zi (avtomatik yoki qo‘lda) |
| **Маска подсети** | `255.255.255.0` | Odatiy |
| **Шлюз** | `192.168.168.1` | Router |
| **HL7 protocol** | Yoqilgan | HL7 orqali yuborish |

**"Подтвердить" (Tasdiqlash)** bosing – sozlamalar saqlanadi.

---

## 3. Server (Gateway) tomonda

Gateway ishlaydigan kompyuter **192.168.168.254** IP ga ega bo‘lishi kerak (yoki K12 da Server IP ni shu kompyuterning IP si ga qo‘ying).

### 3.1 Gateway ni HL7 server rejimida ishga tushirish

```bash
cd monitoring_gateway
# Port 6006 da tinglash (K12 ning "Разъем" bilan bir xil)
set GATEWAY_HL7_PORT=6006
set GATEWAY_HL7_HOST=0.0.0.0
set GATEWAY_BACKEND_URL=http://localhost:8000/api
set GATEWAY_INGEST_API_KEY=monitoring-ingest-secret-change-in-production
# K12 ning seriya raqami backend da ro'yxatdan o'tgan bo'lishi kerak
set GATEWAY_HL7_DEFAULT_DEVICE_ID=K12_01

uvicorn monitoring_gateway.main:app --host 0.0.0.0 --port 9000
```

- **9000** – FastAPI va WebSocket (dashboard uchun).
- **6006** – HL7 MLLP server (K12 shu portga ulanadi). Gateway avtomatik 6006 ni ham ochadi.

### 3.2 Backend da qurilma ro‘yxatdan o‘tkazish

K12 dan keladigan ma’lumot **device_id** (seriya) orqali taniladi. Backend da bu seriya ro‘yxatdan o‘tgan bo‘lishi kerak:

1. **Monitoring** dashboard → **Boshqaruv** → **Qurilmalar** → **+ Qurilma qo‘shish**.
2. **Seriya raqami:** `K12_01` (yoki `GATEWAY_HL7_DEFAULT_DEVICE_ID` da qo‘ygan qiymat).
3. **Model:** Creative Medical K12.
4. **Palata** tanlang.
5. Keyin **Bemor monitor** yarating va shu qurilmani kravatga birikting.

Agar K12 HL7 xabarida **MSH** segmentida yuboruvchi ID bo‘lsa, backend da Device **serial_number** ni shu ID ga mos qiling.

---

## 4. IP ni o‘zgartirish (masalan server boshqa IP da)

- **Variant A:** Server kompyuteriga IP `192.168.168.254` bering (LAN sozlamalari).
- **Variant B:** K12 da **IP-адрес сервера** ni serverning haqiqiy IP si ga o‘zgartiring (masalan `192.168.1.100`). Port **6006** qolsin.

Gateway har doim `0.0.0.0:6006` da tinglaydi – ya’ni barcha interfeyslar orqali 6006 portini ochadi. Muhimi: **firewall** da 6006 porti ochik bo‘lishi kerak.

---

## 5. Tekshirish

1. Gateway ishga tushganida log da: `HL7 MLLP server listening on ('0.0.0.0', 6006)`.
2. K12 ni yoqing, tarmoq ulangan bo‘lsin – bir necha soniyadan keyin gateway log da: `HL7 client connected from ('192.168.168.226', ...)`.
3. Dashboard da shu qurilma biriktirilgan bemor kartochkasida vitals yangilanadi (real-time yoki 5 s polling).

---

## 6. Qisqa sxema

```
[K12 monitor]  --(HL7/TCP, 192.168.168.254:6006)-->  [Gateway :6006]
                                                              |
                                                              v
[Browser Dashboard]  <--(WebSocket :9000)--  [Gateway]  --(POST /api/monitoring/ingest/)-->  [Django backend]
```

Shu sozlamalar bilan K12 ni platformaga ulashingiz mumkin.
