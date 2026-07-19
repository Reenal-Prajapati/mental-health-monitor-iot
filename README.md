# DAMI Monitoring Platform

This is a runnable full-stack prototype for the DAMI (Depression & Anxiety Monitoring Intelligence) website.

## What is included

- 3 dashboards and roles: Patient, Doctor, Admin
- Hardware ingestion API for ESP32 and wearable sensor data
- Live cards for heart rate, stress, sleep, SpO2, temperature, and skin conductance
- AI classification logic for normal, mild, moderate, and severe risk
- Doctor suggestion and messaging module
- Admin threshold editor
- Report export in CSV
- Local JSON storage that can later be replaced by Firebase, MongoDB, MySQL, or another backend

## Run locally

```powershell
node server.js
```

Then open:

```text
http://localhost:3000
```

## Demo accounts

- Patient: `patient@dami.ai`
- Doctor: `doctor@dami.ai`
- Admin: `admin@dami.ai`
- Password: `123456`

## Hardware integration

Send JSON from ESP32 to:

```text
POST /api/sensor-data
```

Example payload:

```json
{
  "user_id": "patient-101",
  "heart_rate": 85,
  "spo2": 97,
  "temperature": 36.5,
  "stress_score": 46,
  "skin_conductance": 570,
  "motion_index": 61,
  "sleep_hours": 7.5,
  "sleep_duration": "7h 30m",
  "battery_level": 73,
  "timestamp": "2026-04-24T10:30:00Z"
}
```

## Suggested production upgrade path

- Replace `data/db.json` with Firebase Firestore, MongoDB, or MySQL
- Add real authentication with JWT and hashed passwords
- Add WebSocket or Firebase realtime updates from the device
- Add push notifications, email, and SMS alerts
- Add doctor-only access control and audit logs
