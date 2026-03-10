# Hospital-Grade Centralized Patient Monitoring System – Architecture

This document describes the full architecture for a scalable, hospital-grade patient monitoring system that integrates with multiple bedside monitors (e.g. Creative Medical K12) and supports large hospitals with multiple wards, ICUs, and operating rooms.

---

## 1. System Overview

- **Device integration layer**: TCP/IP, serial, HL7; hundreds of simultaneous device connections.
- **Real-time processing**: Stream processing, normalization, device–patient mapping, message queue (Redis/Kafka).
- **Central dashboard**: Wards, beds, patient cards, color coding (green/yellow/red), real-time waveforms and trends.
- **Alarm system**: Clinical alarms (SpO2, HR, BP), visual/audible/Telegram/SMS, alarm history.
- **Hospital management**: Patient profiles, room/bed, device-to-bed assignment, auto-attach on admission.
- **Historical data**: Time-series storage, trends, export, reports.
- **Scalability**: Microservices, load balancing, async, high availability.
- **Security**: HTTPS, RBAC, audit logs, secure device communication.
- **Future AI**: Predictive deterioration, sepsis, oxygen prediction, automatic clinical alerts.

---

## 2. Device Integration Layer

### 2.1 Connectivity

- **LAN TCP/IP**: Primary; gateway maintains persistent sockets to each monitor (Creative K12 and compatible).
- **Serial ports**: Optional adapter service (serial → TCP or direct parser) for legacy devices.
- **HL7**: HL7 v2.x receiver/parser for devices that send HL7 messages.

### 2.2 Gateway Service (Current: `monitoring_gateway`)

- **Role**: Connect to monitors over TCP (and optionally serial/HL7), parse streams, output standardized JSON.
- **Capabilities**:
  - Persistent TCP connections per device.
  - Auto-reconnect with backoff on drop.
  - Per-device parser (K12 binary/text, HL7, generic text e.g. `HR:78`).
  - Standardized JSON: `device_id`, `heart_rate`, `spo2`, `bp_sys`, `bp_dia`, `respiration`, `temperature`, `timestamp`, optional `ecg_waveform`.
- **Scaling to hundreds of devices**:
  - One gateway process handles N connections (async I/O).
  - For 500+ devices: run multiple gateway instances; each instance owns a subset of devices (config-driven). Load balance by device list partition.
  - Optional: dedicated gateway per ward/floor.

### 2.3 Data Streamed per Monitor

- Heart rate, SpO2, blood pressure, respiration rate, temperature.
- ECG waveform when available (buffer and stream to frontend via WebSocket with optional downsampling).

---

## 3. Real-Time Data Processing

### 3.1 Pipeline

1. **Ingest**: Gateway sends JSON to backend (HTTP ingest API or message queue).
2. **Message queue (recommended for 500+ patients)**:
   - **Redis Streams** or **Kafka**: Gateway publishes to a stream/topic; backend consumers process.
   - Prevents data loss on backend restart; buffering and at-least-once processing.
3. **Processing**:
   - **Normalization**: Unit and format consistency (e.g. mmHg, bpm, °C).
   - **Device–patient mapping**: `device_id` → Device → PatientMonitor (bed/room) → Patient.
   - **Timestamp sync**: Use server timestamp or NTP-corrected device timestamp.
4. **Write**: Store in time-series store (PostgreSQL/TimescaleDB) and update cache; trigger alarm evaluation.

### 3.2 Backend Components

- **Ingest API** (existing): `POST /api/monitoring/ingest/` with API key; creates VitalReading, updates device last_seen.
- **Queue consumer** (optional): Consumes from Redis Stream/Kafka, same logic as ingest API, then writes to DB.
- **Device–patient mapping**: Device.serial_number ↔ PatientMonitor ↔ Room/Bed; patient admission attaches device to patient.

---

## 4. Central Monitoring Dashboard

### 4.1 Main Dashboard

- **Wards view**: List wards (e.g. ICU, OR, general); expand to show rooms and beds.
- **Beds view**: Grid of patient cards per room/ward.
- **Per-card**:
  - Heart rate, SpO2, blood pressure, respiration, temperature.
  - **Color coding**:
    - **Green**: All values in normal range.
    - **Yellow**: Warning (configurable thresholds, e.g. SpO2 90–94, HR 100–130 or 40–50).
    - **Red**: Critical (e.g. SpO2 &lt; 90, HR &gt; 130 or &lt; 40, critical BP).
- **Status**: Connection status (online/offline) per device/bed.

### 4.2 Patient View Panel

- **Real-time waveforms**: WebSocket stream for ECG/waveform (when available).
- **Real-time trends**: Heart rate, SpO2, BP, respiration (Chart.js or high-performance library), updated via WebSocket.
- **Historical charts**: Trend over hours/days (time-series queries).

### 4.3 Technology

- **Frontend**: React, TypeScript, WebSocket for live data.
- **Charts**: Chart.js / lightweight high-performance library for real-time and historical trends.

---

## 5. Alarm and Alert System

### 5.1 Detection Rules (Examples)

- SpO2 &lt; 90 (critical).
- Heart rate &gt; 130 (critical).
- Heart rate &lt; 40 (critical).
- Critical BP: e.g. systolic &gt; 180 or &lt; 90, diastolic &gt; 120 or &lt; 60.
- Configurable per-patient thresholds (AlarmThreshold model).

### 5.2 Actions on Alarm

- **Visual**: Red/warning on dashboard card and patient view; alarm banner.
- **Audible**: Browser audio alert (dashboard); optional hospital PA integration.
- **Mobile**: Push notifications (PWA or native) to staff.
- **Telegram / SMS**: Send to configured staff groups (e.g. Telegram bot, SMS gateway).

### 5.3 Alarm History

- All alarms stored (Alarm model: patient_monitor, param, value, severity, timestamp, acknowledged_at).
- Dashboard and API for alarm history per patient/ward.

---

## 6. Hospital Management Integration

### 6.1 Patient Profile

- Patient name, age, gender, room number, bed number, medical notes.
- Stored in PatientMonitor and/or linked Patient model (e.g. from main hospital EHR).

### 6.2 Device–Bed Assignment

- Devices assigned to beds/rooms (Device.room, PatientMonitor.room + bed_label).
- On **admission**: Staff assigns patient to bed → system links device at that bed to patient (PatientMonitor record); monitoring starts automatically.

---

## 7. Historical Data and Analytics

- **Storage**: Vital signs in time-series table (VitalReading; optional migration to TimescaleDB hypertable for scale).
- **Retention**: Configurable (e.g. 7 days full resolution, then aggregated).
- **Features**:
  - Review patient history; trends over hours/days.
  - Export reports (PDF/Excel).
  - Generate medical charts for rounds/discharge.

---

## 8. Scalability and Performance (500+ Patients)

- **Microservices**: Gateway, ingest API, queue consumers, dashboard API, WebSocket service.
- **Load balancing**: Multiple gateway and API instances behind LB.
- **Async**: Async I/O in gateway and FastAPI; Django async/workers for API.
- **High availability**: Stateless services; queue and DB as durability layer; restart-safe consumers.

---

## 9. Security and Compliance

- **HTTPS**: All client and server communication over TLS.
- **RBAC**: Administrator, Doctor, Nurse, Technician (Django auth/permissions).
- **Audit logs**: Log critical actions (admission, device assign, alarm acknowledge, config change).
- **Device communication**: API key or mTLS for gateway → backend; devices on isolated VLAN.

---

## 10. Technology Stack

| Layer        | Technology |
|-------------|------------|
| Backend     | Python, Django (main API), FastAPI (gateway/optional services) |
| Database    | PostgreSQL (relational), TimescaleDB (time-series vitals) |
| Queue/Cache | Redis (streams/cache), optional Kafka |
| Real-time   | WebSocket (gateway → dashboard) |
| Frontend    | React, TypeScript, Chart.js / high-performance charts |

---

## 11. Future AI Modules

Architecture allows plug-in AI modules:

- **Predictive deterioration**: Model consuming time-series vitals; outputs risk score; can trigger early alarms.
- **Early sepsis detection**: Similar pipeline; sepsis-specific features and model.
- **Oxygen level prediction**: SpO2 and related trends → prediction; alerts.
- **Automatic clinical alerts**: AI suggests or triggers alerts based on patterns (in addition to rule-based alarms).

Recommended: separate AI service(s) that read from the same time-series and alarm pipeline and write back suggested alerts or risk scores.

---

## 12. Implementation Status (This Codebase)

| Module              | Status | Notes |
|---------------------|--------|--------|
| Device integration  | Done   | TCP gateway, K12-style text parser, multiple monitors via config |
| Ingest API          | Done   | `POST /api/monitoring/ingest/`, device→patient mapping |
| Dashboard           | Done   | Grid cards, WebSocket, Chart.js trends, wards/rooms/beds via Room |
| Color coding        | Done   | Green/yellow/red in UI (extended in code) |
| Alarms              | Done   | SpO2&lt;90, HR&gt;130; HR&lt;40 and BP in code; alarm history in DB |
| Patient/bed         | Done   | PatientMonitor (name, bed, room), device assign |
| Historical          | Done   | VitalReading stored; trends in dashboard |
| Message queue       | Optional | Redis Streams/Kafka path documented; direct ingest implemented |
| Telegram/SMS        | Optional | Hook points and env for Telegram bot |
| TimescaleDB         | Optional | Can migrate VitalReading to hypertable |
| RBAC / Audit        | Partial | Roles in auth; audit model and logging can be added |

This architecture and the codebase together provide a hospital-grade monitoring system that can be extended to full 500+ bed deployment with queue, TimescaleDB, and AI modules as needed.
