# Bemor Monitoring Platform (v2.0)

Platformaga **Monitoring** rejimi qo‘shildi – markazlashgan bemor monitoringi (konsilium/shifokor/registratordan ajratilgan, lekin bir xil tizim va backend).

## Kirish

- **Kirish:** Auth sahifada **Monitoring** tugmasini tanlang.
- **Demo:** Telefon `+998907000001`, parol `monitoring_demo`.

Mahalliy (localStorage) fallback ishlatilsa, demo hisob avtomatik mavjud. Backend ishlatilsa, quyidagi qadamni bajarish kerak.

## Backend (Django)

1. **Migration:** Monitoring app jadvallarini yarating:
   ```bash
   cd backend
   python manage.py migrate monitoring
   ```

2. **Demo foydalanuvchi:** Monitoring roli uchun demo user yarating:
   ```bash
   python manage.py create_monitoring_demo_user
   ```
   Bu `+998907000001` / `monitoring_demo` hisobini yaratadi yoki yangilaydi.

3. **API:** Barcha monitoring endpointlari `/api/monitoring/` ostida, JWT auth:
   - `GET /api/monitoring/dashboard/` – grid uchun bemorlar va oxirgi vitals
   - `GET /api/monitoring/devices/status/` – qurilmalar holati
   - `POST /api/monitoring/devices/register/` – yangi monitor ro‘yxatdan o‘tkazish
   - `GET /api/monitoring/vitals/?patient_monitor_id=...` – vital o‘qishlar
   - `GET /api/monitoring/alarms/` – alarmlar
   - `POST /api/monitoring/alarms/<id>/acknowledge/` – alarmni qabul qilish
   - `GET/POST /api/monitoring/rooms/`, `GET/POST /api/monitoring/patient-monitors/` va boshqalar

4. **Ingest (gateway uchun):** `POST /api/monitoring/ingest/` – header `X-API-Key` = `MONITORING_INGEST_API_KEY`. Body: `device_id` (Device.serial_number), `heart_rate`, `spo2`, `bp_sys`, `bp_dia`, `respiration`, `temperature`, `timestamp`.

## Gateway (real-time TCP → Django + WebSocket)

**monitoring_gateway** (FastAPI) – faqat monitoring uchun:

- Monitorlar LAN da TCP orqali stream yuboradi (masalan: `HR:78`, `SPO2:97`, `NIBP:120/80`, `RESP:16`, `TEMP:36.7`).
- Gateway har monitorga async ulanadi, qatorlarni parse qiladi, JSON ga o'giradi.
- JSON Django `POST /api/monitoring/ingest/` ga yuboriladi; WebSocket `ws://host:9000/ws/vitals` orqali dashboard ga push qilinadi.
- Uzilishda avtomatik qayta ulanish.

Ishga tushirish va sozlash: **monitoring_gateway/README.md**.

## Arxitektura (texnik topshiriq bo‘yicha)

- **Baza bitta:** Monitoring jadvallari (`monitoring_*`) asosiy PostgreSQL da, alohida dastur emas.
- **Rol:** `User.role = 'monitoring'` – kirish faqat shu rol uchun, obuna tekshiruvi o‘tkazilmaydi.
- **Keyingi qadamlar (iste’dod):**
  - Gateway: TCP/HL7 server va device driverlar (K12, HL7) alohida servis yoki Django background task sifatida.
  - Real-vaqt: WebSocket (Django Channels) yoki Redis Pub/Sub orqali push.
  - Time-series: Vitals uchun TimescaleDB/InfluxDB yoki joriy PostgreSQL da retention/agregatsiya.
  - Alarm engine: Threshold tekshiruv va latching to‘liq ulash (hozir API va model mavjud).

## Frontend

- **MonitoringDashboard:** Grid (12–16 ta mini-kartochka), bitta bemor tanlansa – batafsil ko‘rinish (oxirgi vitals, alarmlar, vital tarix).
- **Polling:** Dashboard har 5 soniyada yangilanadi.
- **WebSocket:** Agar gateway ishlasa (`VITE_MONITORING_WS_URL`, default dev da `ws://localhost:9000/ws/vitals`), kartochkalarda real-time vitals ko‘rsatiladi.
