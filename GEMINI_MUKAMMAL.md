# 🤖 Mukammal Gemini AI Integration
## Farg'ona Jamoat Salomatligi Tibbiyot Instituti - AiDoktor

---

## 🎯 Maqsad

Barcha AI xizmatlarini **Google Gemini API** orqali mukammal ishlashini ta'minlash.

---

## ✨ Yangi Xususiyatlar

### **1. Mukammal Gemini Service** (`mukammal_gemini.py`)

```python
from ai_services.mukammal_gemini import get_gemini_service

# Get service instance
service = get_gemini_service()

# Analyze patient case
result = service.analyze_medical_case(
  patient_data={...},
    analysis_type='comprehensive',
    language='uz'
)
```

### **2. Gemini Modellar**

| Model | Nomi | Ishlatilishi |
|-------|------|--------------|
| **Flash** | `gemini-2.0-flash-exp` | Tezkor javoblar, triage |
| **Pro** | `gemini-1.5-pro` | Murakkab tahlillar, konsilium |
| **Thinking** | `gemini-2.0-flash-thinking-exp` | Chuqur fikrlash, multi-step |

### **3. API Key Sozlash**

**.env fayl:**
```env
# Mukammal Gemini API
GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
GEMINI_MODEL_FLASH=gemini-2.0-flash-exp
GEMINI_MODEL_PRO=gemini-1.5-pro
GEMINI_MODEL_THINKING=gemini-2.0-flash-thinking-exp
AI_MODEL_DEFAULT=gemini-2.0-flash-exp
```

---

## 🔧 O'rnatish

### **1. Dependencies**

```bash
cd /root/medoraai/backend
source venv/bin/activate
pip install google-genai>=1.0.0
```

### **2. API Key Olish**

1. https://aistudio.google.com/app/apikey ga o'ting
2. Google account bilan kiring
3. **"Create API Key"** tugmasini bosing
4. Kalitni nusxalang va `.env` ga qo'shing

### **3. Test**

```bash
cd /root/medoraai/backend
source venv/bin/activate
python manage.py shell
```

Python shell'da:
```python
from ai_services.mukammal_gemini import get_gemini_service

service = get_gemini_service()
if service.client:
    print("✅ Gemini AI initialized successfully!")
else:
    print("❌ Gemini AI not initialized. Check GEMINI_API_KEY")
```

---

## 📋 AI Xizmat Turlari

### **1. Tezkor Tahlil (Quick Analysis)**
```python
result = service.analyze_medical_case(
  patient_data=data,
    analysis_type='quick'  # 5-10 soniya
)
```

**Javob:**
```json
{
  "diagnosis": "O'tkir respirator virusli infeksiya",
  "recommendations": [
    "Ko'proq suyuqlik ichish",
    "Parasetamol 500mg haroratda"
  ],
  "urgency": "low"
}
```

### **2. To'liq Differensial Tashxis**
```python
result = service.analyze_medical_case(
  patient_data=data,
    analysis_type='diagnosis'  # 15-20 soniya
)
```

**Javob:**
```json
{
  "primary_diagnosis": "Pnevmoniya",
  "icd10_code": "J18.9",
  "differential_diagnoses": [
    "Bronxit",
    "Plevrit",
    "TB"
  ],
  "confidence": 0.87,
  "reasoning": "Rentgen va laborator ko'rsatkichlar asosida..."
}
```

### **3. Davolash Rejasi**
```python
result = service.analyze_medical_case(
  patient_data=data,
    analysis_type='treatment'
)
```

**Javob:**
```json
{
  "medications": [
    {
      "name": "Amoksitsillin",
      "dose": "500mg",
      "frequency": "3 marta kuniga",
      "duration": "7 kun"
    }
  ],
  "non_pharmacological": [
    "To'shak rejimi",
    "Ko'p suyuqlik"
  ],
  "follow_up": "7 kundan keyin nazorat"
}
```

### **4. Mukammal Konsilium (Comprehensive)**
```python
result = service.analyze_medical_case(
  patient_data=data,
    analysis_type='comprehensive'  # 30-40 soniya
)
```

**Javob:**
```json
{
  "diagnoses": [...],
  "tests_recommended": [...],
  "treatment_plan": {...},
  "follow_up": "...",
  "red_flags": [...]
}
```

---

## 🏥 Tibbiy Qo'llanmalar

### **Anamnez Yig'ish**
```python
prompt = """
Bemor shikoyatlari asosida anamnez savollari tuzing:
- Asosiy shikoyat
- Kasallik boshlanishi
- Avvalgi kasalliklar
- Allergiyalar
- Dorilar
"""

history_questions = service.generate_response(prompt, model='flash')
```

### **Dori Dozasi Hisoblash**
```python
schema = {
    'type': 'object',
    'properties': {
        'medication': {'type': 'string'},
        'pediatric_dose': {'type': 'string'},
        'adult_dose': {'type': 'string'},
        'contraindications': {'type': 'array'}
    }
}

dose_info = service.generate_structured(prompt, schema)
```

### **ICD-10 Kodlash**
```python
prompt = f"""
Tashxis uchun ICD-10 kodini aniqlang:
Tashxis: {diagnosis_text}
"""

icd_result = service.generate_structured(prompt, icd_schema)
```

---

## 🔐 Xavfsizlik

### **API Key Himoyalash**

1. **Hech qachon `.env` ni GitHub'ga joylamang!**
2. Serverda faqat environment variables ishlatilsin
3. API key rotation har 90 kun

### **Rate Limiting**

```python
# settings.py
GEMINI_RATE_LIMIT = {
    'requests_per_minute': 60,
    'tokens_per_day': 100000
}
```

### **Log Yozish**

```python
logger.info(f"Gemini request: model={model}, tokens={tokens}")
```

---

## 📊 Performance

### **Benchmark (o'rtacha):**

| Model | Tokens/sec | Latency | Cost/1K |
|-------|-----------|---------|---------|
| Flash | ~80 | 1-2s | $0.000075 |
| Pro | ~40 | 3-5s | $0.0005 |
| Thinking | ~20 | 8-12s | $0.0003 |

### **Optimizatsiya:**

```python
# Kichik vazifalar uchun Flash ishlatish
if task_complexity < threshold:
   model = 'flash'
else:
   model = 'pro'
```

---

## 🆘 Troubleshooting

### **Error: "Gemini API key not configured"**

```bash
# Tekshirish
echo $GEMINI_API_KEY

# .env ga qo'shish
echo "GEMINI_API_KEY=your_key_here" >> backend/.env
```

### **Error: "google-genai not installed"**

```bash
source venv/bin/activate
pip install google-genai
```

### **Error: "Rate limit exceeded"**

```python
# Retry with backoff
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(wait=wait_exponential(multiplier=1, min=4, max=10),
       stop=stop_after_attempt(3))
def call_gemini_with_retry(...):
   pass
```

---

## 🚀 Production Deploy

### **Serverda:**

```bash
ssh root@167.71.53.238

cd /root/medoraai
git pull origin main

cd backend
source venv/bin/activate
pip install -r requirements.txt

# .env tekshirish
cat .env | grep GEMINI

# Restart
pkill -f gunicorn
nohup gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3 &
```

### **Test:**

```bash
curl https://api.aidoktor.fargana.uz/api/ai/consilium/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patient_data": {...}}'
```

---

## 📈 Monitoring

### **Dashboard:**

```python
# AI usage statistics
from ai_services.mukammal_gemini import get_gemini_service

service = get_gemini_service()
stats = service.get_usage_stats(days=30)
```

### **Alerts:**

- API key expiry: 7 days oldin
- Rate limit: 80% yetganda
- Error rate: >5% bo'lsa

---

## 🎓 Best Practices

1. ✅ **Har doim 'flash' modelni birinchi urinib ko'ring**
2. ✅ **Murakkab vazifalar uchun 'pro' ishlatilsin**
3. ✅ **JSON output uchun `response_format='json'`**
4. ✅ **System instruction har doim aniq bo'lsin**
5. ✅ **Temperature 0.1-0.3 tibbiy maslahat uchun**
6. ✅ **Xatoliklar uchun retry mechanism**

---

## 📚 Resources

- [Gemini API Docs](https://ai.google.dev/docs)
- [Python SDK](https://github.com/googleapis/python-genai)
- [Pricing](https://ai.google.dev/pricing)
- [Best Practices](https://ai.google.dev/gemini-api/docs/best-practices)

---

**🏥 Farg'ona Jamoat Salomatligi Tibbiyot Instituti - AiDoktor**
**🤖 Powered by Google Gemini AI**
