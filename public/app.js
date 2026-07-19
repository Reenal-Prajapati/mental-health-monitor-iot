const state = {
  selectedRole: "patient",
  currentPage: "dashboard",
  currentUser: {
    patient: { id: "patient-101", name: "John Doe" },
    doctor: { id: "doctor-201", name: "Dr. Alex Smith" },
    admin: { id: "admin-301", name: "Admin Sarah" },
  },
  patient: null,
  doctor: null,
  admin: null,
  historyFilters: {
    date: "",
    status: "",
  },
  loading: false,
};

const metricConfig = [
  { key: "heartRate", label: "Heart Rate", unit: "BPM", icon: "❤", color: "#ef5f7b" },
  { key: "stressScore", label: "Stress Level", unit: "", icon: "◔", color: "#66c69a" },
  { key: "sleepDuration", label: "Sleep Duration", unit: "", icon: "☾", color: "#5ba7f7" },
  { key: "spo2", label: "SpO₂", unit: "%", icon: "🩸", color: "#60a9ff" },
  { key: "temperature", label: "Body Temperature", unit: "°C", icon: "🌡", color: "#ffb44c" },
  { key: "skinConductance", label: "Skin Conductance", unit: "", icon: "◉", color: "#f16a6f" },
];

const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "report", label: "Report" },
  { id: "history", label: "History" },
  { id: "doctor", label: "Doctor Panel" },
  { id: "admin", label: "Admin Thresholds" },
  { id: "api", label: "Hardware API" },
];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(payload.error || "Request failed");
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/csv")) {
    return response.text();
  }
  return response.json();
}

async function loadData() {
  state.loading = true;
  render();
  try {
    const [patient, doctor, admin] = await Promise.all([
      api(`/api/user/latest?user_id=${state.currentUser.patient.id}`),
      api(`/api/doctor/overview?doctor_id=${state.currentUser.doctor.id}`),
      api("/api/admin/overview"),
    ]);
    state.patient = patient;
    state.doctor = doctor;
    state.admin = admin;
  } catch (error) {
    console.error(error);
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="shell">
      ${renderSidebar()}
      <main class="content">
        ${renderTopbar()}
        ${state.loading ? renderLoading() : renderPage()}
      </main>
    </div>
  `;
  bindEvents();
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">⌘</div>
        <div class="brand-copy">
          <h1>DAMI AI</h1>
          <p>Depression & Anxiety Monitoring</p>
        </div>
      </div>

      <div class="nav-group">
        ${["patient", "doctor", "admin"]
          .map(
            (role) => `
            <button class="role-btn ${state.selectedRole === role ? "active" : ""}" data-role="${role}">
              ${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
            </button>
          `
          )
          .join("")}
      </div>

      <div class="nav-group">
        ${navItems
          .map(
            (item) => `
              <button class="nav-item ${state.currentPage === item.id ? "active" : ""}" data-page="${item.id}">
                ${item.label}
              </button>
            `
          )
          .join("")}
      </div>

      <div class="sidebar-footer">
        <div class="sidebar-card">
          <h3>Demo logins</h3>
          <p>Patient: patient@dami.ai</p>
          <p>Doctor: doctor@dami.ai</p>
          <p>Admin: admin@dami.ai</p>
          <p>Password: 123456</p>
        </div>
        <div class="sidebar-card">
          <h3>Hardware stream</h3>
          <p>ESP32 can post JSON to <code>/api/sensor-data</code> every few seconds.</p>
        </div>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const activeUser = state.currentUser[state.selectedRole];
  return `
    <section class="topbar">
      <div>
        <h2>${titleForPage()}</h2>
        <div class="muted tiny">Live monitoring, AI analysis, alerts, reports, and doctor workflows</div>
      </div>
      <label class="search">
        <span>🔎</span>
        <input type="text" placeholder="Search patient, reading, alert..." />
      </label>
      <div class="profile-chip">
        <div class="avatar">${initials(activeUser.name)}</div>
        <div>
          <div>${activeUser.name}</div>
          <div class="muted tiny">${state.selectedRole}</div>
        </div>
      </div>
    </section>
  `;
}

function titleForPage() {
  const map = {
    dashboard: "Overview Dashboard",
    report: "Health Report",
    history: "Reading History",
    doctor: "Doctor Collaboration",
    admin: "Admin Control Center",
    api: "Hardware Integration API",
  };
  return map[state.currentPage] || "DAMI Platform";
}

function renderLoading() {
  return `<section class="panel"><div class="panel-body">Loading dashboard data...</div></section>`;
}

function renderPage() {
  if (!state.patient || !state.doctor || !state.admin) {
    return `<section class="panel"><div class="panel-body">Unable to load platform data.</div></section>`;
  }

  if (state.currentPage === "report") {
    return renderReportPage();
  }
  if (state.currentPage === "history") {
    return renderHistoryPage();
  }
  if (state.currentPage === "doctor") {
    return renderDoctorPage();
  }
  if (state.currentPage === "admin") {
    return renderAdminPage();
  }
  if (state.currentPage === "api") {
    return renderApiPage();
  }
  return renderDashboardPage();
}

function renderDashboardPage() {
  if (state.selectedRole === "doctor") {
    return renderDoctorPage();
  }
  if (state.selectedRole === "admin") {
    return renderAdminPage();
  }

  const latest = state.patient.latest;
  return `
    <div class="grid-main">
      <section>
        <div class="hero">
          <h1>Hello, ${state.patient.patient.name}</h1>
          <p>Here is your latest health report from the DAMI monitoring wristband.</p>
        </div>

        <div class="metrics-grid">
          ${metricConfig.map((metric) => renderMetricCard(metric, latest)).join("")}
        </div>

        <div class="chart-grid">
          ${renderLineChartPanel("Heart Rate Over Time", "Latest BPM trend", state.patient.history, "heartRate", "#ef5f7b")}
          ${renderBarChartPanel("Stress Level Over Time", "Normal, moderate, and high periods", state.patient.history, "stressScore")}
        </div>

        <div class="secondary-grid">
          <section class="panel">
            <div class="panel-body">
              <div class="panel-header">
                <div>
                  <h3>AI Analysis</h3>
                  <p>Mental health status and risk detection</p>
                </div>
              </div>
              <div class="ai-analysis">
                <div>
                  <div class="status-pill ${statusClass(latest.analysis.condition)}">${latest.analysis.condition}</div>
                  <p>${latest.analysis.summary}</p>
                  <div class="legend">
                    ${latest.analysis.reasons.length
                      ? latest.analysis.reasons.map((reason) => `<span class="line-yellow">${reason}</span>`).join("")
                      : '<span class="line-green">All monitored values are stable</span>'}
                  </div>
                </div>
                <div class="score-badge">
                  <div class="muted tiny">Confidence</div>
                  <strong>${latest.analysis.confidence}%</strong>
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-body">
              <div class="panel-header">
                <div>
                  <h3>Device & Recovery</h3>
                  <p>Hardware readiness and care guidance</p>
                </div>
              </div>
              <div class="suggestion-list">
                <div class="suggestion-item">
                  <h4>Battery Level</h4>
                  <p>${latest.batteryLevel}% remaining from the Li-ion band pack.</p>
                </div>
                ${state.patient.suggestions.map(renderSuggestionCard).join("")}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="panel">
        <div class="panel-body">
          <div class="panel-header">
            <div>
              <h3>Recent Alerts</h3>
              <p>Generated from live sensor values</p>
            </div>
            <button class="ghost-button" data-action="simulate">Simulate Live Reading</button>
          </div>
          <div class="alert-list">
            ${latest.alerts.map(renderAlertItem).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderMetricCard(metric, latest) {
  const rawValue = latest[metric.key];
  const statusKey = metric.key === "sleepDuration" ? "sleepHours" : metric.key;
  const status = latest.analysis.statuses[statusKey] || "normal";
  const value = metric.key === "sleepDuration" ? rawValue : `${rawValue}${metric.unit ? ` ${metric.unit}` : ""}`;
  return `
    <section class="metric-card">
      <div class="metric-icon" style="background:${metric.color}">${metric.icon}</div>
      <h3>${metric.label}</h3>
      <p>Live from hardware</p>
      <div class="metric-value">${value}</div>
      <div class="status-pill ${statusClass(status)}">${capitalize(status)}</div>
    </section>
  `;
}

function renderLineChartPanel(title, subtitle, history, key, color) {
  return `
    <section class="panel">
      <div class="panel-body">
        <div class="panel-header">
          <div>
            <h3>${title}</h3>
            <p>${subtitle}</p>
          </div>
        </div>
        ${renderLineChart(history.map((item) => item[key]), color)}
        <div class="legend"><span class="line-red">${title}</span></div>
      </div>
    </section>
  `;
}

function renderBarChartPanel(title, subtitle, history, key) {
  return `
    <section class="panel">
      <div class="panel-body">
        <div class="panel-header">
          <div>
            <h3>${title}</h3>
            <p>${subtitle}</p>
          </div>
        </div>
        ${renderBarChart(history.map((item) => item[key]))}
        <div class="legend">
          <span class="line-red">High</span>
          <span class="line-yellow">Moderate</span>
          <span class="line-green">Normal</span>
        </div>
      </div>
    </section>
  `;
}

function renderReportPage() {
  const report = state.patient.report;
  const latest = state.patient.latest;
  return `
    <div class="grid-main">
      <section class="panel">
        <div class="panel-body">
          <div class="panel-header">
            <div>
              <h3>Health Report</h3>
              <p>Generated report analysis for ${state.patient.patient.name}</p>
            </div>
            <button class="button" data-action="download-report">Download CSV Report</button>
          </div>
          <p>${report.summary}</p>
          <table class="report-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Average Heart Rate</td><td>${report.averageHeartRate} BPM</td></tr>
              <tr><td>Stress Level</td><td>${report.averageStress}</td></tr>
              <tr><td>Sleep Duration</td><td>${formatSleep(report.averageSleepHours)}</td></tr>
              <tr><td>SpO₂</td><td>${report.averageSpo2}%</td></tr>
              <tr><td>Body Temperature</td><td>${report.averageTemperature}°C</td></tr>
              <tr><td>Skin Conductance</td><td>${report.averageSkinConductance}</td></tr>
              <tr><td>Motion Index</td><td>${report.averageMotion}</td></tr>
              <tr><td>Final Condition</td><td>${report.finalCondition}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel-body">
          <div class="panel-header">
            <div>
              <h3>Doctor's Suggestions</h3>
              <p>${state.patient.doctor.name} is assigned to this patient</p>
            </div>
          </div>
          <div class="suggestion-list">
            <div class="suggestion-item">
              <h4>${state.patient.doctor.name}</h4>
              <p>Your assigned doctor is online and can review alerts.</p>
            </div>
            ${state.patient.suggestions.map(renderSuggestionCard).join("")}
            <div class="suggestion-item">
              <h4>Current Risk Status</h4>
              <p>${latest.analysis.condition} with ${latest.analysis.confidence}% confidence.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderHistoryPage() {
  const rows = filterHistory(state.patient.history);
  return `
    <section class="panel">
      <div class="panel-body">
        <div class="panel-header">
          <div>
            <h3>History & Analytics</h3>
            <p>Search by date and filter by mental-health condition</p>
          </div>
        </div>
        <div class="filters">
          <input type="date" value="${state.historyFilters.date}" data-filter="date" />
          <select data-filter="status">
            <option value="">All statuses</option>
            <option value="normal" ${state.historyFilters.status === "normal" ? "selected" : ""}>Normal</option>
            <option value="mild" ${state.historyFilters.status === "mild" ? "selected" : ""}>Mild Stress / Anxiety</option>
            <option value="moderate" ${state.historyFilters.status === "moderate" ? "selected" : ""}>Moderate Anxiety</option>
            <option value="severe" ${state.historyFilters.status === "severe" ? "selected" : ""}>Severe Anxiety / Depression Risk</option>
          </select>
          <button class="ghost-button" data-action="reset-filters">Reset</button>
        </div>
        <div class="history-list" style="margin-top:16px;">
          ${rows.map(renderHistoryRow).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderDoctorPage() {
  const patientCards = state.doctor.patients
    .map(
      (patient) => `
        <div class="patient-item">
          <h4>${patient.name}</h4>
          <p>Latest condition: ${patient.latest.analysis.condition}</p>
          <p class="row-muted">Unread messages: ${patient.unreadCount}</p>
        </div>
      `
    )
    .join("");

  const chatCards = state.patient.messages
    .map(
      (message) => `
        <div class="chat-item">
          <p><strong>${message.senderRole === "doctor" ? state.patient.doctor.name : state.patient.patient.name}</strong></p>
          <p>${message.message}</p>
          <p class="row-muted">${formatDateTime(message.timestamp)}</p>
        </div>
      `
    )
    .join("");

  return `
    <div class="doctor-grid">
      <section class="panel">
        <div class="panel-body">
          <div class="panel-header">
            <div>
              <h3>Assigned Patients</h3>
              <p>Doctor can monitor live data and manage patient status</p>
            </div>
          </div>
          <div class="patient-list">${patientCards}</div>
          <div class="panel-header" style="margin-top:18px;">
            <div>
              <h3>Doctor Suggestions</h3>
              <p>Quick guidance shown on the patient dashboard</p>
            </div>
          </div>
          <div class="suggestion-list">${state.patient.suggestions.map(renderSuggestionCard).join("")}</div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-body">
          <div class="panel-header">
            <div>
              <h3>Chat with ${state.patient.patient.name}</h3>
              <p>Doctor can send recommendations or follow-ups</p>
            </div>
          </div>
          <div class="chat-list">${chatCards}</div>
          <div class="chat-compose" style="margin-top:16px;">
            <textarea id="doctor-message" placeholder="Type a message for the patient..."></textarea>
            <button class="button" data-action="send-message">Send Message</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderAdminPage() {
  const cards = [
    ["Patients", state.admin.totals.users],
    ["Doctors", state.admin.totals.doctors],
    ["Devices Online", state.admin.totals.devicesOnline],
    ["Critical Cases", state.admin.totals.criticalCases],
  ];

  const thresholdRows = Object.entries(state.admin.thresholds)
    .map(([key, value]) => {
      return `
        <div class="threshold-row">
          <h4>${prettifyThresholdKey(key)}</h4>
          <div class="split" style="margin-top:12px;">
            <label>
              <div class="row-muted">Normal Min</div>
              <input class="threshold-input" data-threshold="${key}" data-index="0" value="${value.normal[0]}" />
            </label>
            <label>
              <div class="row-muted">Normal Max</div>
              <input class="threshold-input" data-threshold="${key}" data-index="1" value="${value.normal[1]}" />
            </label>
            <label>
              <div class="row-muted">Moderate Min</div>
              <input class="threshold-input" data-threshold="${key}" data-band="moderate" data-index="0" value="${value.moderate[0]}" />
            </label>
            <label>
              <div class="row-muted">Moderate Max</div>
              <input class="threshold-input" data-threshold="${key}" data-band="moderate" data-index="1" value="${value.moderate[1]}" />
            </label>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="admin-grid">
      ${cards
        .map(
          ([label, value]) => `
            <section class="metric-card">
              <h3>${label}</h3>
              <div class="metric-value">${value}</div>
              <div class="status-pill status-normal">Live</div>
            </section>
          `
        )
        .join("")}
    </div>
    <section class="panel" style="margin-top:18px;">
      <div class="panel-body">
        <div class="panel-header">
          <div>
            <h3>Threshold / Criteria Page</h3>
            <p>Admin can adjust AI classification ranges from this hidden control page</p>
          </div>
          <button class="button" data-action="save-thresholds">Save Thresholds</button>
        </div>
        <div class="threshold-list">${thresholdRows}</div>
      </div>
    </section>
  `;
}

function renderApiPage() {
  return `
    <section class="panel">
      <div class="panel-body">
        <div class="panel-header">
          <div>
            <h3>ESP32 / Hardware Integration</h3>
            <p>Use these REST endpoints to connect your DAMI wristband hardware.</p>
          </div>
        </div>
        <div class="suggestion-list">
          <div class="suggestion-item">
            <h4>POST /api/sensor-data</h4>
            <p>Send live readings from ESP32, MAX30102, LM35, GSR sensor, and MPU6050.</p>
            <pre>{
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
}</pre>
          </div>
          <div class="suggestion-item">
            <h4>Other endpoints</h4>
            <p><code>GET /api/user/latest</code> for dashboard data</p>
            <p><code>GET /api/user/history</code> for history graphs and tables</p>
            <p><code>POST /api/doctor/message</code> for doctor-patient chat</p>
            <p><code>PUT /api/admin/thresholds</code> for admin AI criteria updates</p>
          </div>
          <div class="suggestion-item">
            <h4>Backend storage</h4>
            <p>This prototype stores data in a local JSON database. The API shape is ready to swap to Firebase, MongoDB, or MySQL later.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSuggestionCard(suggestion) {
  return `
    <div class="suggestion-item">
      <h4>${suggestion.title}</h4>
      <p>${suggestion.body}</p>
    </div>
  `;
}

function renderAlertItem(alert) {
  return `
    <div class="alert-item">
      <div class="status-pill status-${alert.level}">${capitalize(alert.level)}</div>
      <h4>${alert.title}</h4>
      <p>${alert.detail}</p>
      <p class="alert-meta">${formatDateTime(alert.timestamp)}</p>
    </div>
  `;
}

function renderHistoryRow(item) {
  return `
    <div class="record-row">
      <div class="panel-header">
        <div>
          <h3>${formatDateTime(item.timestamp)}</h3>
          <p>${item.analysis.condition}</p>
        </div>
        <div class="status-pill ${statusClass(item.analysis.statuses.stressScore)}">${capitalize(item.analysis.statuses.stressScore)}</div>
      </div>
      <div class="split">
        <p>Heart Rate: ${item.heartRate} BPM</p>
        <p>Stress Score: ${item.stressScore}</p>
        <p>Sleep: ${item.sleepDuration}</p>
        <p>SpO₂: ${item.spo2}%</p>
        <p>Temperature: ${item.temperature}°C</p>
        <p>Skin Conductance: ${item.skinConductance}</p>
      </div>
    </div>
  `;
}

function renderLineChart(values, color) {
  const width = 640;
  const height = 220;
  const padding = 24;
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const points = values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / Math.max(max - min, 1)) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.24" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      ${[0.25, 0.5, 0.75].map((t) => `<line x1="${padding}" y1="${padding + t * 150}" x2="${width - padding}" y2="${padding + t * 150}" stroke="#dfe8fb" />`).join("")}
      <polyline fill="none" stroke="${color}" stroke-width="4" points="${points}" stroke-linecap="round" stroke-linejoin="round" />
      ${values
        .filter((_, index) => index % Math.ceil(values.length / 6) === 0 || index === values.length - 1)
        .map((value, index, array) => {
          const originalIndex = values.findIndex((item, i) => item === value && !array.slice(0, index).includes(item));
          const x = padding + (originalIndex / Math.max(values.length - 1, 1)) * (width - padding * 2);
          const y = height - padding - ((value - min) / Math.max(max - min, 1)) * (height - padding * 2);
          return `<circle cx="${x}" cy="${y}" r="5" fill="${color}" />`;
        })
        .join("")}
    </svg>
  `;
}

function renderBarChart(values) {
  const width = 640;
  const height = 220;
  const padding = 24;
  const barWidth = (width - padding * 2) / values.length - 5;
  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}">
      ${[0.25, 0.5, 0.75].map((t) => `<line x1="${padding}" y1="${padding + t * 150}" x2="${width - padding}" y2="${padding + t * 150}" stroke="#dfe8fb" />`).join("")}
      ${values
        .map((value, index) => {
          const x = padding + index * (barWidth + 5);
          const barHeight = (value / 100) * 140;
          const y = height - padding - barHeight;
          const color = value > 60 ? "#ef5f7b" : value > 40 ? "#f0b34a" : "#40b681";
          return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="8" fill="${color}" opacity="0.9" />`;
        })
        .join("")}
    </svg>
  `;
}

function filterHistory(rows) {
  return rows.filter((item) => {
    const matchesDate = !state.historyFilters.date || item.timestamp.startsWith(state.historyFilters.date);
    const matchesStatus =
      !state.historyFilters.status ||
      item.analysis.condition.toLowerCase().includes(state.historyFilters.status.toLowerCase());
    return matchesDate && matchesStatus;
  });
}

function bindEvents() {
  document.querySelectorAll("[data-role]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRole = button.dataset.role;
      if (state.selectedRole === "doctor" && state.currentPage === "admin") {
        state.currentPage = "doctor";
      }
      if (state.selectedRole === "admin" && state.currentPage === "doctor") {
        state.currentPage = "admin";
      }
      render();
    });
  });

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentPage = button.dataset.page;
      render();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((input) => {
    input.addEventListener("input", () => {
      state.historyFilters[input.dataset.filter] = input.value;
      render();
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "simulate") {
        await api("/api/demo/simulate", { method: "POST" });
        await loadData();
      }
      if (action === "send-message") {
        const textarea = document.getElementById("doctor-message");
        if (!textarea || !textarea.value.trim()) {
          return;
        }
        await api("/api/doctor/message", {
          method: "POST",
          body: JSON.stringify({
            patientId: state.patient.patient.id,
            doctorId: state.patient.doctor.id,
            senderRole: "doctor",
            message: textarea.value.trim(),
          }),
        });
        textarea.value = "";
        await loadData();
      }
      if (action === "save-thresholds") {
        const payload = collectThresholdPayload();
        await api("/api/admin/thresholds", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        await loadData();
      }
      if (action === "download-report") {
        window.open(`/api/report/export?user_id=${state.patient.patient.id}`, "_blank");
      }
      if (action === "reset-filters") {
        state.historyFilters = { date: "", status: "" };
        render();
      }
    });
  });
}

function collectThresholdPayload() {
  const payload = structuredClone(state.admin.thresholds);
  document.querySelectorAll(".threshold-input").forEach((input) => {
    const metric = input.dataset.threshold;
    const band = input.dataset.band || "normal";
    const index = Number(input.dataset.index);
    payload[metric][band][index] = Number(input.value);
  });
  return payload;
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function statusClass(status) {
  const normalized = String(status).toLowerCase();
  if (normalized.includes("severe") || normalized.includes("high")) {
    return "status-high";
  }
  if (normalized.includes("moderate") || normalized.includes("mild") || normalized.includes("yellow")) {
    return "status-moderate";
  }
  if (normalized.includes("red")) {
    return "status-red";
  }
  if (normalized.includes("green")) {
    return "status-green";
  }
  if (normalized.includes("yellow")) {
    return "status-yellow";
  }
  return "status-normal";
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function prettifyThresholdKey(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function formatSleep(hours) {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `${whole}h ${String(minutes).padStart(2, "0")}m`;
}

loadData();
setInterval(loadData, 15000);
