# 🏥 K12 Qurilmalarini Frontend Orqali Ulash

## ✅ Backend API Yaratildi

### **Yangi Endpoint:**
```
POST /api/v1/devices/bulk-register/
```

### **Request Format:**
```json
{
  "devices": [
    {
      "model": "creative_k12",
      "serial_number": "K12_001",
      "room": 1,
      "host": "192.168.168.254",
      "port": 6006,
      "meta": {
        "ward": "ICU",
        "bed": "1"
      }
    },
    {
      "model": "creative_k12",
      "serial_number": "K12_002",
      "room": 2,
      "host": "192.168.168.253",
      "port": 6006,
      "meta": {
        "ward": "ICU",
        "bed": "2"
      }
    }
  ]
}
```

### **Response:**
```json
{
  "success": true,
  "total": 2,
  "created": 2,
  "failed": 0,
  "results": {
    "success": [
      {
        "serial_number": "K12_001",
        "id": 1,
        "status": "created"
      }
    ],
    "failed": []
  }
}
```

---

## 🎨 **Frontend UI Qo'shish**

MonitoringDashboard.tsx ga qo'shiladi:

1. **"Add Device"** tugmasi
2. **Modal forma** - ko'p qurilma kiritish uchun
3. **CSV import** imkoniyati
4. **Table view** - barcha qurilmalar ro'yxati

---

## 📝 **Qurilma Ma'lumotlari:**

Har bir K12 qurilmasi uchun:
- **Model**: creative_k12
- **Serial Number**: Unikal nom (masalan: K12_001)
- **Room**: Xona raqami (ID)
- **Host**: IP manzil (masalan: 192.168.168.254)
- **Port**: Port raqami (masalan: 6006)
- **Meta**: Qo'shimcha ma'lumotlar (ward, bed)

---

## 🔧 **Serverda Bajarish:**

### **1. Backend yangilash:**
```bash
ssh root@167.71.53.238
cd /root/AiDoktorai
git pull origin main
cd backend
source venv/bin/activate
python manage.py migrate
pkill -f gunicorn
nohup gunicorn AiDoktorai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 &
sudo systemctl reload nginx
```

### **2. Test:**
```bash
curl -X POST https://AiDoktorapi.fargana.uz/api/v1/devices/bulk-register/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "devices": [
      {
        "model": "creative_k12",
        "serial_number": "K12_TEST",
        "room": 1,
        "host": "192.168.168.254",
        "port": 6006
      }
    ]
  }'
```

---

**To'liq frontend kodu hali yaratilmadi. Serverga deploy qilishdan oldin frontend komponentini qo'shish kerak.**
-NoNewline
