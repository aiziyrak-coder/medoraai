# Avtonom Davolash Protokollari Tizimi

## Umumiy Ma'lumot

MEDORA AI tizimiga avtonom davolash protokollarini yaratish va boshqarish imkoniyati qo'shildi. Bu tizim inson aralashuvini minimal qilib, davolash jarayonini to'liq avtomatlashtiradi.

## Asosiy Komponentlar

### 1. Autonomous Protocol Generator (`autonomous_protocol_generator.py`)

**Funksiyalari:**
- Bemor ma'lumotlariga asoslangan holda to'liq avtonom davolash protokolini yaratadi
- Xavfsizlik baholash va risklarni aniqlash
- O'zbekiston SSV protokollariga muvofiqlashtirish
- O'rganish natijalarini integratsiya qilish

**Asosiy metodlar:**
- `generate_autonomous_protocol()` - Asosiy protokol generatsiyasi
- `_perform_safety_assessment()` - Xavfsizlik baholashi
- `_apply_safety_modifications()` - Xavfsizlik o'zgarishlari
- `_optimize_for_uzbekistan()` - O'zbekiston uchun optimallashtirish

### 2. Clinical Decision Engine (`clinical_decision_engine.py`)

**Funksiyalari:**
- Klinik qarorlarni avtonom qabul qilish
- Triaj (shoshilinchlik) baholashi
- Ixtisoslashgan klinik algoritmlar
- Risk-foyda analizi

**Klinik algoritmlar:**
- Kardiovaskulyar algoritmi
- Respirator algoritmi  
- Gastroenterologik algoritmi
- Nevrologik algoritmi
- Infeksion kasalliklar algoritmi
- Pediatrik algoritmi
- Geriatrik algoritmi

### 3. Self-Learning System (`self_learning_system.py`)

**Funksiyalari:**
- Davolash natijalarini o'rganish
- Protokolarni avtomatik yaxshilash
- Muvaffaqiyatli va muvaffaqiyatsiz naqshlarni aniqlash
- Doimiy o'rganish va adaptatsiya

**O'rganish mexanizmlari:**
- `ProtocolOutcome` modeli - natijalarni saqlash
- `analyze_protocol_outcome()` - natijalarni tahlil qilish
- `get_improved_protocol_template()` - yaxshilangan protokol

### 4. Continuous Monitoring (`continuous_monitoring.py`)

**Funksiyalari:**
- Real-time monitoring sessiyalari
- Vital belgilarni avtomatik tahlil qilish
- Ogohlantirishlar va tavsiyalar
- Protokol adaptatsiyasi

**Monitoring xususiyatlari:**
- Qon bosimi monitoringi
- Yurak urishi monitoringi
- Harorat monitoringi
- SpO2 monitoringi
- Og'riq darajasi monitoringi

## API Endpointlar

### Avtonom Protokol Yaratish
```
POST /api/ai-services/autonomous-protocol/
{
    "patient_data": {...},
    "language": "uz-L"
}
```

### Klinik Qaror Qabul Qilish
```
POST /api/ai-services/clinical-decision/
{
    "patient_data": {...},
    "language": "uz-L"
}
```

### Monitoringni Boshlash
```
POST /api/ai-services/monitoring/start/
{
    "protocol_id": "protocol_123",
    "patient_data": {...},
    "treatment_plan": {...}
}
```

### Vital Belgilarni Yozish
```
POST /api/ai-services/monitoring/record/
{
    "session_id": "session_123",
    "vital_data": {
        "blood_pressure_systolic": 120,
        "blood_pressure_diastolic": 80,
        "heart_rate": 72,
        "temperature": 36.6,
        "oxygen_saturation": 98
    }
}
```

### Natijalarni Yozish (O'rganish)
```
POST /api/ai-services/learning/outcome/
{
    "protocol_id": "protocol_123",
    "patient_data": {...},
    "outcome_data": {
        "treatment_success": true,
        "patient_satisfaction": 8,
        "recovery_time_days": 5,
        "complication_occurred": false
    }
}
```

## Xavfsizlik Choralari

### 1. Ko'p darajali xavfsizlik tekshiruvi
- Hayotga xavf holatlarini aniqlash
- Shoshilinch aralashuv talablari
- Inson nazorati shartlari

### 2. O'zbekiston standartlari
- Faqat ro'yxatdan o'tgan dorilar
- SSV klinik protokollari
- Mahalliy imkoniyatlar

### 3. Doimiy monitoring
- Real-time vital belgilar monitoringi
- Avtomatik ogohlantirishlar
- Protokol adaptatsiyasi

## Foydalanish Qoidalari

### Avtonom rejimga o'tish shartlari:
1. Xavfsizlik balli > 0.9
2. Avtonom xavf < 0.1  
3. Shoshilinchlik < 0.5
4. Muvaffaqiyat ehtimoli > 0.8

### Inson nazorati talab qilinadi:
- Kritik holatlar
- Yuqori xavfli protokollar
- Noaniq tashxislar
- Nojo'ya ta'sirlar

## Integration

### Frontend integration:
```javascript
// Avtonom protokol yaratish
const response = await fetch('/api/ai-services/autonomous-protocol/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        patient_data: patientData,
        language: 'uz-L'
    })
});

const protocol = await response.json();
```

### Monitoring integration:
```javascript
// Monitoringni boshlash
const sessionResponse = await fetch('/api/ai-services/monitoring/start/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        protocol_id: protocolId,
        patient_data: patientData,
        treatment_plan: treatmentPlan
    })
});

// WebSocket orqali real-time yangilanishlar
const ws = new WebSocket(`ws://localhost:8000/ws/monitoring/${sessionId}/`);
```

## Konfiguratsiya

### .env ga qo'shish:
```env
# Avtonom tizim sozlamalari
AUTONOMOUS_ENABLED=true
MIN_SAFETY_SCORE=0.85
MAX_AUTONOMOUS_RISK=0.15
LEARNING_ENABLED=true
MONITORING_ENABLED=true
```

### Django sozlamalari:
```python
# settings.py
INSTALLED_APPS += [
    'ai_services',
]

# Avtonom tizim konfiguratsiyasi
AUTONOMOUS_SETTINGS = {
    'MIN_CASES_FOR_LEARNING': 10,
    'SUCCESS_RATE_THRESHOLD': 0.8,
    'SAFETY_THRESHOLD': 0.9,
    'ENABLE_AUTO_ADAPTATION': True
}
```

## Monitoring va Loglar

### Log fayllari:
- `/logs/autonomous_protocols.log` - Protokol generatsiyasi
- `/logs/clinical_decisions.log` - Klinik qarorlar
- `/logs/monitoring.log` - Monitoring sessiyalari
- `/logs/learning.log` - O'rganish jarayoni

### Monitoring metrikalar:
- Protokol generatsiyasi soni
- Muvaffaqiyat darajasi
- Xavfsizlik hodisalari
- O'rganish samaradorligi

## Testlash

### Unit testlar:
```bash
python manage.py test ai_services.tests.test_autonomous_protocol
python manage.py test ai_services.tests.test_clinical_decision
python manage.py test ai_services.tests.test_self_learning
```

### Integration testlar:
```bash
python manage.py test ai_services.tests.test_integration
```

## Xavfsizlik va Etika

### Etik ko'rib chiqish:
- Har doim inson hayotini birinchi o'ringa qo'yish
- Shifokor nazoratini saqlab qolish
- Shaffoflik va izlanuvchanlik
- Bemor roziligi

### Xavfsizlik choralar:
- Ma'lumotlarni shifrlash
- Foydalanuvchi autentifikatsiyasi
- Rollar va ruxsatlar
- Audit loglar

## Kelajakdagi Rivojlanish

### Rejalashtirilgan xususiyatlar:
- Multi-modallik (tasvir, audio tahlili)
- Advanced NLP for symptom analysis
- Predictive analytics
- Integration with IoT devices
- Mobile app integration

### AI model yaxshilashlari:
- Custom medical AI models training
- Federated learning
- Real-time adaptation
- Personalized medicine protocols

---

**Eslatma:** Bu tizim faqat shifokor nazorati ostida ishlatilishi kerak. Avtonom qarorlar har doim tekshiruvdan o'tishi va inson tomonidan tasdiqlanishi shart.
