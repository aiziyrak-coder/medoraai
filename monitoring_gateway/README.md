# Monitoring Gateway (faqat monitoring uchun)

Real-time vital sign stream: **TCP (monitor)** → **Gateway (parse, JSON)** → **Django API** + **WebSocket (dashboard)**.

## Qisqacha

- Monitorlar LAN orqali TCP da ma'lumot yuboradi (masalan: `HR:78`, `SPO2:97`, `NIBP:120/80`, `RESP:16`, `TEMP:36.7`).
- Gateway har bir monitorga async ulanadi, qatorlarni parse qiladi, JSON ga o'giradi.
- JSON Django `POST /api/monitoring/ingest/` ga yuboriladi (API key bilan).
- Xuddi shu JSON WebSocket orqali dashboard ga yuboriladi (real-time).

## Sozlash

### 1. Django

`.env` yoki muhitda:

```env
MONITORING_INGEST_API_KEY=monitoring-ingest-secret-change-in-production
```

Django da **Device** va **PatientMonitor** bo‘lishi kerak; `Device.serial_number` = gateway dagi `device_id` (masalan `monitor_12`).

### 2. Gateway

```env
GATEWAY_BACKEND_URL=http://localhost:8000/api
GATEWAY_INGEST_API_KEY=monitoring-ingest-secret-change-in-production
GATEWAY_MONITORS=monitor_12:192.168.1.10:5000,monitor_13:192.168.1.11:5000
```

Format: `device_id:host:port` (vergul bilan ajratilgan).

## Ishga tushirish

```bash
cd monitoring_gateway
pip install -r requirements.txt
uvicorn monitoring_gateway.main:app --host 0.0.0.0 --port 9000
```

Gateway: **http://localhost:9000**  
WebSocket: **ws://localhost:9000/ws/vitals**

## Mock monitor (test)

Haqiqiy monitor yo‘q bo‘lsa, TCP server ni simulyatsiya qilish:

```bash
# Terminal 1: mock monitor (5000 port)
python -m monitoring_gateway.mock_monitor

# Terminal 2: gateway (127.0.0.1:5000 ga ulanadi)
set GATEWAY_MONITORS=monitor_12:127.0.0.1:5000
uvicorn monitoring_gateway.main:app --host 0.0.0.0 --port 9000
```

Django da `serial_number=monitor_12` bo‘lgan Device va unga biriktirilgan PatientMonitor bo‘lishi kerak.

## API

| Endpoint | Tavsif |
|----------|--------|
| `GET /health` | Gateway holati |
| `GET /monitors` | Sozlangan monitorlar ro‘yxati |
| `WS /ws/vitals` | Real-time vitals (JSON har bir yangilanishda) |

## Keladigan JSON (misol)

```json
{
  "device_id": "monitor_12",
  "heart_rate": 78,
  "spo2": 97,
  "bp_sys": 120,
  "bp_dia": 80,
  "nibp_systolic": 120,
  "nibp_diastolic": 80,
  "respiration": 16,
  "temperature": 36.7,
  "timestamp": "2026-03-08T02:00:00.000Z"
}
```

## Uzilishda qayta ulanish

TCP ulanish uzilsa, gateway avtomatik qayta ulanadi (2s dan 60s gacha orttirma kechikish bilan).

## Scaling (500+ monitors)

- **Single process**: Async I/O handles many TCP connections; one gateway instance can serve dozens of monitors.
- **Multiple instances**: For hundreds of devices, run several gateway instances; assign each instance a subset of monitors via `GATEWAY_MONITORS` (e.g. instance 1: monitors 1–200, instance 2: 201–400). Use a load balancer in front of the backend; gateway talks to the same Django ingest API.
- **Optional queue**: For fail-safe buffering, push parsed vitals to Redis Streams or Kafka and let a separate consumer write to Django (see `docs/MEDORA_MONITORING_ARCHITECTURE.md`).

## HL7 and serial

- **HL7**: For devices that send HL7 v2.x messages, add an HL7 listener (e.g. MLLP over TCP) and parse OBR/OBX into the same JSON format; then call `send_to_backend` and `broadcast_vitals`. Placeholder: `monitoring_gateway/parser_hl7.py`.
- **Serial**: Use a serial-to-TCP bridge or a small adapter process that reads from COM port and forwards lines to the gateway or parses and POSTs to ingest.
