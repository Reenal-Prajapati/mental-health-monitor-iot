const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const defaultDb = {
  thresholds: {
    heartRate: { normal: [60, 90], moderate: [91, 110] },
    stressScore: { normal: [0, 40], moderate: [41, 60] },
    spo2: { normal: [95, 100], moderate: [92, 94] },
    temperature: { normal: [36, 37], moderate: [37.1, 38] },
    skinConductance: { normal: [0, 500], moderate: [501, 650] },
    motionIndex: { normal: [45, 100], moderate: [25, 44] },
    sleepHours: { normal: [7, 9], moderate: [5, 6.9] },
  },
  users: [
    {
      id: "patient-101",
      role: "patient",
      name: "John Doe",
      email: "patient@dami.ai",
      password: "123456",
      assignedDoctorId: "doctor-201",
      deviceId: "band-101",
      age: 27,
    },
    {
      id: "doctor-201",
      role: "doctor",
      name: "Dr. Alex Smith",
      email: "doctor@dami.ai",
      password: "123456",
      speciality: "Mental Wellness",
      assignedPatients: ["patient-101"],
    },
    {
      id: "admin-301",
      role: "admin",
      name: "Admin Sarah",
      email: "admin@dami.ai",
      password: "123456",
    },
  ],
  messages: [
    {
      id: "msg-1",
      patientId: "patient-101",
      doctorId: "doctor-201",
      senderRole: "doctor",
      message: "Hello, John. I reviewed your latest health report. Your stress levels are a bit elevated but manageable.",
      timestamp: "2026-04-24T08:37:00.000Z",
    },
    {
      id: "msg-2",
      patientId: "patient-101",
      doctorId: "doctor-201",
      senderRole: "patient",
      message: "Thank you doctor. What should I do today?",
      timestamp: "2026-04-24T08:40:00.000Z",
    },
    {
      id: "msg-3",
      patientId: "patient-101",
      doctorId: "doctor-201",
      senderRole: "doctor",
      message: "Practice deep breathing, light stretching, and try to keep tonight's sleep above 7 hours.",
      timestamp: "2026-04-24T08:42:00.000Z",
    },
  ],
  suggestions: [
    {
      id: "sug-1",
      patientId: "patient-101",
      doctorId: "doctor-201",
      title: "Practice relaxation",
      body: "Practice deep breathing or short meditation for 10 minutes.",
      icon: "breath",
    },
    {
      id: "sug-2",
      patientId: "patient-101",
      doctorId: "doctor-201",
      title: "Hydration reminder",
      body: "Drink water regularly and avoid staying dehydrated during the day.",
      icon: "water",
    },
    {
      id: "sug-3",
      patientId: "patient-101",
      doctorId: "doctor-201",
      title: "Light exercise",
      body: "Take a 15 minute walk or stretching break in the morning.",
      icon: "moon",
    },
  ],
  sensorReadings: [],
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seeded = seedDatabase(structuredClone(defaultDb));
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.sensorReadings)) {
      throw new Error("Database shape is incomplete");
    }
  } catch (_error) {
    const seeded = seedDatabase(structuredClone(defaultDb));
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
  }
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedDatabase(db) {
  if (db.sensorReadings.length > 0) {
    return db;
  }

  const now = Date.now();
  for (let i = 47; i >= 0; i -= 1) {
    const timestamp = new Date(now - i * 30 * 60 * 1000).toISOString();
    const stressScore = 35 + Math.round(18 * Math.sin(i / 4)) + (i % 5);
    const heartRate = 78 + Math.round(10 * Math.cos(i / 5)) + (i % 4);
    const spo2 = 96 + ((i + 1) % 3 === 0 ? 0 : 1);
    const temperature = Number((36.3 + ((i % 6) * 0.08)).toFixed(1));
    const skinConductance = 520 + ((i * 11) % 120);
    const motionIndex = 38 + ((i * 7) % 45);
    const sleepHours = Number((7.1 + ((i % 3) * 0.2)).toFixed(1));
    db.sensorReadings.push(
      buildReading(
        db,
        {
          user_id: "patient-101",
          heart_rate: heartRate,
          spo2,
          temperature,
          stress_score: stressScore,
          skin_conductance: skinConductance,
          motion_index: motionIndex,
          sleep_hours: sleepHours,
          sleep_duration: formatHours(sleepHours),
          battery_level: 73,
          timestamp,
        },
        true
      )
    );
  }

  return db;
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  let changed = false;
  db.sensorReadings = db.sensorReadings.map((reading) => {
    if (Array.isArray(reading.alerts) && reading.alerts.length > 0) {
      return reading;
    }
    const rebuilt = {
      ...reading,
      alerts: buildAlerts(reading),
    };
    changed = true;
    return rebuilt;
  });
  if (changed) {
    writeDb(db);
  }
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function getThresholdStatus(value, config, direction = "high") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "unknown";
  }

  const numericValue = Number(value);
  const [normalMin, normalMax] = config.normal;
  const [moderateMin, moderateMax] = config.moderate;

  if (direction === "low") {
    if (numericValue >= normalMin) {
      return "normal";
    }
    if (numericValue >= moderateMin && numericValue <= moderateMax) {
      return "moderate";
    }
    return "high";
  }

  if (numericValue >= normalMin && numericValue <= normalMax) {
    return "normal";
  }
  if (numericValue >= moderateMin && numericValue <= moderateMax) {
    return "moderate";
  }
  return "high";
}

function formatHours(hours) {
  const safeHours = Math.max(0, Number(hours || 0));
  const wholeHours = Math.floor(safeHours);
  const minutes = Math.round((safeHours - wholeHours) * 60);
  return `${wholeHours}h ${String(minutes).padStart(2, "0")}m`;
}

function buildAnalysis(db, input) {
  const threshold = db.thresholds;
  const statuses = {
    heartRate: getThresholdStatus(input.heart_rate, threshold.heartRate),
    stressScore: getThresholdStatus(input.stress_score, threshold.stressScore),
    spo2: getThresholdStatus(input.spo2, threshold.spo2, "low"),
    temperature: getThresholdStatus(input.temperature, threshold.temperature),
    skinConductance: getThresholdStatus(input.skin_conductance, threshold.skinConductance),
    motionIndex: getThresholdStatus(input.motion_index, threshold.motionIndex, "low"),
    sleepHours: getThresholdStatus(input.sleep_hours, threshold.sleepHours, "low"),
  };

  const reasons = [];
  let severityPoints = 0;

  for (const [metric, status] of Object.entries(statuses)) {
    if (status === "moderate") {
      severityPoints += 1;
      reasons.push(`${labelize(metric)} is moderately outside the ideal range`);
    }
    if (status === "high") {
      severityPoints += 2;
      reasons.push(`${labelize(metric)} is in a critical range`);
    }
  }

  let condition = "Normal";
  if (severityPoints >= 6 || (statuses.stressScore === "high" && statuses.sleepHours !== "normal" && statuses.motionIndex !== "normal")) {
    condition = "Severe Anxiety / Depression Risk";
  } else if (severityPoints >= 4 || (statuses.skinConductance === "high" && statuses.heartRate !== "normal")) {
    condition = "Moderate Anxiety";
  } else if (severityPoints >= 2 || statuses.stressScore === "moderate") {
    condition = "Mild Stress / Anxiety";
  }

  const confidence = Math.min(96, 58 + severityPoints * 6);

  return {
    condition,
    confidence,
    reasons,
    statuses,
    summary:
      reasons.length === 0
        ? "Your recent readings are within the safe range and the system classifies your current condition as Normal."
        : `The system detected ${reasons.slice(0, 3).join(", ")}. Current assessment: ${condition}.`,
  };
}

function labelize(metric) {
  return metric
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());
}

function buildAlerts(reading) {
  const alerts = [];
  const statusMap = reading.analysis.statuses;
  const pushAlert = (level, title, detail) => {
    alerts.push({
      id: `${reading.id}-${alerts.length + 1}`,
      level,
      title,
      detail,
      timestamp: reading.timestamp,
    });
  };

  if (statusMap.stressScore === "high") {
    pushAlert("red", "High stress detected", "Stress score crossed the high threshold.");
  } else if (statusMap.stressScore === "moderate") {
    pushAlert("yellow", "Stress rising", "Stress score is elevated above baseline.");
  }

  if (statusMap.heartRate !== "normal") {
    pushAlert(statusMap.heartRate === "high" ? "red" : "yellow", "Elevated heart rate", "Heart rate is outside the normal range.");
  }

  if (statusMap.sleepHours !== "normal") {
    pushAlert("yellow", "Sleep quality concern", "Sleep duration is below the target range.");
  }

  if (statusMap.skinConductance !== "normal") {
    pushAlert(statusMap.skinConductance === "high" ? "red" : "yellow", "Skin conductance changing", "GSR indicates elevated stress response.");
  }

  if (alerts.length === 0) {
    pushAlert("green", "Vitals stable", "All key values are currently within the safe range.");
  }

  return alerts;
}

function buildReading(db, payload, includeComputed = true) {
  const normalized = {
    id: payload.id || `reading-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: payload.user_id || payload.userId || "patient-101",
    heartRate: Number(payload.heart_rate ?? payload.heartRate ?? 0),
    spo2: Number(payload.spo2 ?? 0),
    temperature: Number(payload.temperature ?? 0),
    stressScore: Number(payload.stress_score ?? payload.stressScore ?? 0),
    skinConductance: Number(payload.skin_conductance ?? payload.skinConductance ?? 0),
    motionIndex: Number(payload.motion_index ?? payload.motionIndex ?? 0),
    sleepHours: Number(payload.sleep_hours ?? 0),
    sleepDuration: payload.sleep_duration || formatHours(payload.sleep_hours || 0),
    batteryLevel: Number(payload.battery_level ?? 0),
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  const analysis = buildAnalysis(db, {
    heart_rate: normalized.heartRate,
    spo2: normalized.spo2,
    temperature: normalized.temperature,
    stress_score: normalized.stressScore,
    skin_conductance: normalized.skinConductance,
    motion_index: normalized.motionIndex,
    sleep_hours: normalized.sleepHours,
  });

  const reading = {
    ...normalized,
    analysis,
    alerts: [],
  };

  if (includeComputed) {
    reading.alerts = buildAlerts(reading);
  }

  return reading;
}

function getLatestReading(db, userId) {
  return [...db.sensorReadings].reverse().find((item) => item.userId === userId);
}

function getPatientSnapshot(db, patientId) {
  const patient = db.users.find((user) => user.id === patientId && user.role === "patient");
  if (!patient) {
    return null;
  }

  const latest = getLatestReading(db, patientId);
  const history = db.sensorReadings.filter((item) => item.userId === patientId).slice(-24);
  const doctor = db.users.find((user) => user.id === patient.assignedDoctorId);
  const patientMessages = db.messages
    .filter((message) => message.patientId === patientId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const patientSuggestions = db.suggestions.filter((item) => item.patientId === patientId);

  const averages = history.reduce(
    (accumulator, item) => {
      accumulator.heartRate += item.heartRate;
      accumulator.stressScore += item.stressScore;
      accumulator.spo2 += item.spo2;
      accumulator.temperature += item.temperature;
      accumulator.skinConductance += item.skinConductance;
      accumulator.motionIndex += item.motionIndex;
      accumulator.sleepHours += item.sleepHours;
      return accumulator;
    },
    { heartRate: 0, stressScore: 0, spo2: 0, temperature: 0, skinConductance: 0, motionIndex: 0, sleepHours: 0 }
  );
  const divisor = history.length || 1;

  return {
    patient: sanitizeUser(patient),
    doctor: sanitizeUser(doctor),
    latest,
    history,
    suggestions: patientSuggestions,
    messages: patientMessages,
    report: {
      generatedAt: new Date().toISOString(),
      averageHeartRate: Math.round(averages.heartRate / divisor),
      averageStress: Math.round(averages.stressScore / divisor),
      averageSpo2: Number((averages.spo2 / divisor).toFixed(1)),
      averageTemperature: Number((averages.temperature / divisor).toFixed(1)),
      averageSkinConductance: Math.round(averages.skinConductance / divisor),
      averageMotion: Math.round(averages.motionIndex / divisor),
      averageSleepHours: Number((averages.sleepHours / divisor).toFixed(1)),
      finalCondition: latest ? latest.analysis.condition : "Normal",
      summary: latest ? latest.analysis.summary : "No recent readings available.",
    },
  };
}

function getDoctorSnapshot(db, doctorId) {
  const doctor = db.users.find((user) => user.id === doctorId && user.role === "doctor");
  if (!doctor) {
    return null;
  }

  const patients = doctor.assignedPatients.map((patientId) => {
    const patient = db.users.find((user) => user.id === patientId);
    const latest = getLatestReading(db, patientId);
    return {
      id: patient.id,
      name: patient.name,
      latest,
      unreadCount: db.messages.filter((message) => message.patientId === patientId && message.senderRole === "patient").length,
    };
  });

  return { doctor: sanitizeUser(doctor), patients };
}

function getAdminSnapshot(db) {
  const patients = db.users.filter((user) => user.role === "patient");
  const doctors = db.users.filter((user) => user.role === "doctor");
  const latestReadings = patients
    .map((patient) => ({ patient, latest: getLatestReading(db, patient.id) }))
    .filter((item) => item.latest);

  const criticalCount = latestReadings.filter((item) => item.latest.analysis.condition !== "Normal").length;

  return {
    totals: {
      users: patients.length,
      doctors: doctors.length,
      devicesOnline: latestReadings.length,
      criticalCases: criticalCount,
    },
    thresholds: db.thresholds,
    records: latestReadings,
  };
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  const { password, ...safeUser } = user;
  return safeUser;
}

function buildExportRows(history) {
  const header = ["Date", "Heart Rate", "Stress Score", "Sleep", "SpO2", "Temperature", "Skin Conductance", "Motion", "Condition"];
  const rows = history.map((item) => [
    item.timestamp,
    item.heartRate,
    item.stressScore,
    item.sleepDuration,
    item.spo2,
    item.temperature,
    item.skinConductance,
    item.motionIndex,
    item.analysis.condition,
  ]);
  return [header, ...rows];
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(",")
    )
    .join("\n");
}

function handleApi(req, res, url) {
  const db = readDb();

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { status: "ok", service: "dami-monitoring-platform" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    parseBody(req)
      .then((body) => {
        const user = db.users.find((item) => item.email === body.email && item.password === body.password);
        if (!user) {
          sendJson(res, 401, { error: "Invalid email or password" });
          return;
        }
        sendJson(res, 200, {
          token: `demo-token-${user.id}`,
          user: {
            id: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
          },
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sensor-data") {
    parseBody(req)
      .then((body) => {
        const reading = buildReading(db, body);
        db.sensorReadings.push(reading);
        writeDb(db);
        sendJson(res, 201, { message: "Sensor data received", reading });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/user/latest") {
    const userId = url.searchParams.get("user_id") || "patient-101";
    const snapshot = getPatientSnapshot(db, userId);
    if (!snapshot || !snapshot.latest) {
      sendJson(res, 404, { error: "User or latest reading not found" });
      return;
    }
    sendJson(res, 200, snapshot);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/user/history") {
    const userId = url.searchParams.get("user_id") || "patient-101";
    const status = url.searchParams.get("status");
    const date = url.searchParams.get("date");
    let history = db.sensorReadings.filter((item) => item.userId === userId);

    if (status) {
      history = history.filter((item) => item.analysis.condition.toLowerCase().includes(status.toLowerCase()));
    }
    if (date) {
      history = history.filter((item) => item.timestamp.startsWith(date));
    }

    sendJson(res, 200, { history: history.slice(-100) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/doctor/overview") {
    const doctorId = url.searchParams.get("doctor_id") || "doctor-201";
    const snapshot = getDoctorSnapshot(db, doctorId);
    if (!snapshot) {
      sendJson(res, 404, { error: "Doctor not found" });
      return;
    }
    sendJson(res, 200, snapshot);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/doctor/message") {
    parseBody(req)
      .then((body) => {
        const message = {
          id: `msg-${Date.now()}`,
          patientId: body.patientId,
          doctorId: body.doctorId,
          senderRole: body.senderRole || "doctor",
          message: body.message,
          timestamp: new Date().toISOString(),
        };
        db.messages.push(message);
        writeDb(db);
        sendJson(res, 201, { message: "Message sent", data: message });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/overview") {
    sendJson(res, 200, getAdminSnapshot(db));
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/thresholds") {
    parseBody(req)
      .then((body) => {
        db.thresholds = { ...db.thresholds, ...body };
        writeDb(db);
        sendJson(res, 200, { message: "Thresholds updated", thresholds: db.thresholds });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/report/export") {
    const userId = url.searchParams.get("user_id") || "patient-101";
    const snapshot = getPatientSnapshot(db, userId);
    if (!snapshot) {
      sendJson(res, 404, { error: "User not found" });
      return;
    }
    const csv = toCsv(buildExportRows(snapshot.history));
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${userId}-report.csv\"`,
    });
    res.end(csv);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/demo/simulate") {
    const latest = getLatestReading(db, "patient-101");
    const nextStress = Math.max(28, Math.min(92, latest.stressScore + (Math.random() > 0.5 ? 5 : -4)));
    const nextHeart = Math.max(65, Math.min(128, latest.heartRate + (Math.random() > 0.5 ? 4 : -3)));
    const nextMotion = Math.max(12, Math.min(86, latest.motionIndex + (Math.random() > 0.5 ? 6 : -5)));
    const nextSleep = Number(Math.max(4.5, Math.min(8.8, latest.sleepHours + (Math.random() > 0.5 ? 0.1 : -0.1))).toFixed(1));
    const payload = {
      user_id: "patient-101",
      heart_rate: nextHeart,
      spo2: Math.max(90, Math.min(99, latest.spo2 + (Math.random() > 0.65 ? -1 : 0))),
      temperature: Number(Math.max(36, Math.min(38.7, latest.temperature + (Math.random() > 0.7 ? 0.2 : -0.1))).toFixed(1)),
      stress_score: nextStress,
      skin_conductance: Math.max(430, Math.min(730, latest.skinConductance + (Math.random() > 0.5 ? 14 : -11))),
      motion_index: nextMotion,
      sleep_hours: nextSleep,
      sleep_duration: formatHours(nextSleep),
      battery_level: Math.max(15, latest.batteryLevel - (Math.random() > 0.8 ? 1 : 0)),
      timestamp: new Date().toISOString(),
    };
    const reading = buildReading(db, payload);
    db.sensorReadings.push(reading);
    writeDb(db);
    sendJson(res, 201, { message: "Demo reading generated", reading });
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }

  let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  sendFile(res, filePath);
});

ensureDb();
server.listen(PORT, () => {
  console.log(`DAMI platform running at http://localhost:${PORT}`);
});
