# Bemor Monitoring — qanday test qilish

Serverda deploy qilgach va K12 ulagach, quyidagi qadamlarni ketma-ket bajarib tekshiring.

---

## 1. Serverda deploy va restart

```bash
cd /root/medoraai
git pull
sudo bash deploy/server-deploy.sh
```

Yoki qisqa variant (faqat backend + gateway restart):

```bash
cd /root/medoraai && git pull
cd /root/medoraai/backend && source venv/bin/activate && python manage.py migrate --noinput
sudo systemctl restart medoraai-backend-8001.service
sudo systemctl restart medoraai-gateway-9000.service
```

---

## 2. Loglarni tekshirish (xatolik bormi?)

**Backend (Django):**
```bash
sudo journalctl -u medoraai-backend-8001.service -n 50 --no-pager
```
Xato bo‘lsa qizil satrlar chiqadi. Oddiy ishlasa "GET /api/..." va 200 ko‘rinadi.

**Gateway (HL7 + TCP):**
```bash
sudo journalctl -u medoraai-gateway-9000.service -n 50 --no-pager
```
Kutiladi: `HL7 MLLP server listening on ('0.0.0.0', 6006)`. Xato bo‘lsa "Error", "Traceback" qidiring.

**Real vaqtda kuzatish (K12 ulaganda):**
```bash
sudo journalctl -u medoraai-gateway-9000.service -f
```
K12 ni yoqing / Sozlamalar → Tarmoq saqlang. Bir necha soniyada `HL7 client connected from ('...', ...)` chiqishi kerak. `Ctrl+C` bilan chiqing.

---

## 3. Port va health tekshiruvi

**6006 porti tinglanayaptimi (HL7):**
```bash
ss -tlnp | grep 6006
```
Natija: `0.0.0.0:6006` ko‘rinishi kerak. Bo‘lmasa — gateway 6006 ni ochmagan.

**Gateway health (9000):**
```bash
curl -s http://127.0.0.1:9000/health
```
Natija: `{"status":"ok","service":"monitoring-gateway"}`

**Backend health (8001):**
```bash
curl -s http://127.0.0.1:8001/health/
```
Natija: HTTP 200 va "ok" ga o‘xshash javob.

---

## 4. Platforma (brauzer) orqali test

1. **Kirish:** https://medora.cdcgroup.uz — monitoring rolida login (masalan +998907000001 / monitoring_demo yoki o‘zingiz yaratgan foydalanuvchi).
2. **Qurilmalar:** "Qurilmalar (monitorlar)" tab — K12_001 (yoki boshqa seriya) ro‘yxatda, **Holat** = online bo‘lishi kerak (K12 ulangan va ma’lumot kelgach).
3. **Dashboard:** "Dashboard" tab — bemor kartochkasi va vitals (HR, SpO2, NIBP) ko‘rinishi kerak (bemor qurilmaga biriktirilgan va K12 ma’lumot yuborayotgan bo‘lsa).
4. **Masofadan:** Telefonda https://medora.cdcgroup.uz ochib xuddi shunday ko‘rish — bir xil ma’lumot chiqishi kerak.

---

## 5. Qisqa tekshiruv jadvali

| # | Qayerda | Buyruq yoki harakat | Kutiladigan natija |
|---|---------|----------------------|---------------------|
| 1 | Server | `ss -tlnp \| grep 6006` | `0.0.0.0:6006` |
| 2 | Server | `curl -s http://127.0.0.1:9000/health` | `"status":"ok"` |
| 3 | Server | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/` | `200` |
| 4 | Server | `journalctl -u medoraai-gateway-9000 -n 20` | Xato yo‘q, "listening on 6006" bor |
| 5 | Brauzer | https://medora.cdcgroup.uz → Qurilmalar | K12_001 online |
| 6 | Brauzer | Dashboard → bemor kartochkasi | Vitals raqamlar ko‘rinadi |

---

## 6. Xato bo‘lsa

- **6006 ko‘rinmasa:** Gateway ishlamayapti yoki xato. `journalctl -u medoraai-gateway-9000 -n 100` da "Error" / "Traceback" qidiring.
- **"HL7 client connected" chiqmasa:** K12 serverga ulana olmayapti — K12 da Server IP = 167.71.53.238, Port = 6006 tekshiring; cloud firewall da 6006 ochiqmi tekshiring.
- **Qurilma offline:** K12 ulangan va ma’lumot kelgach 1–2 daqiqada online bo‘ladi. Logda "HL7 client connected" bor bo‘lsa, K12 da vitals yuborilayotganini tekshiring.
- Batafsil: `deploy/TROUBLESHOOT_K12_OFFLINE.md`
