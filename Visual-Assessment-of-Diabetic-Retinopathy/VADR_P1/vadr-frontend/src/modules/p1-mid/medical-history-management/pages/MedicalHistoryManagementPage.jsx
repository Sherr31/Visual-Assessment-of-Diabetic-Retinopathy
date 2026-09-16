import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getStoredUser, medicalHistoryAPI, patientAPI } from "../../shared/api";
import "../../../../vadr-dashboard.css";
import ThemeToggle from "../../../../components/ThemeToggle";

/* ══════════════════════════════════════════════════════════════
   THEME-AWARE INLINE STYLES (use CSS custom properties)
   ══════════════════════════════════════════════════════════════ */
const inputStyle = {
  border: "1.5px solid var(--vadr-border)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--vadr-text)",
  background: "var(--vadr-input-bg)",
  width: "100%",
  fontFamily: "inherit",
  boxSizing: "border-box",
  minWidth: 0,
  outline: "none",
};

const cardStyle = {
  background: "var(--vadr-surface)",
  border: "1.5px solid var(--vadr-border)",
  borderRadius: 14,
  padding: "16px 18px",
  color: "var(--vadr-text)",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--vadr-text-muted)",
  letterSpacing: 0.5,
  textTransform: "uppercase",
  borderBottom: "1px solid var(--vadr-border)",
  whiteSpace: "nowrap",
  background: "var(--vadr-surface-muted)",
};

const tdStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--vadr-border)",
  color: "var(--vadr-text)",
};

const labelStyle = {
  fontSize: 11,
  color: "var(--vadr-text-faint)",
  marginBottom: 4,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const statValueStyle = {
  fontSize: 26,
  fontWeight: 800,
  color: "var(--vadr-text)",
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
};

/* ══════════════════════════════════════════════════════════════
   ICON PATHS (same pattern as vadr-module2)
   ══════════════════════════════════════════════════════════════ */
const Icon = ({ d, size = 16, color = "currentColor", style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={d} />
  </svg>
);

const I = {
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  history: "M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3",
  export:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  back:    "M19 12H5M12 19l-7-7 7-7",
  plus:    "M12 5v14M5 12h14",
  pill:    "M10.5 1.5H8A6.5 6.5 0 0 0 8 14.5h2.5a6.5 6.5 0 0 0 0-13zM12 8h4M20 12H4",
  heart:   "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  scan:    "M2 7V2h5M17 2h5v5M22 17v5h-5M7 22H2v-5",
  calendar:"M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
};

const drScoreToLabel = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"];
const gradeToScore = {
  "No DR": 0,
  "Mild DR": 1,
  "Moderate DR": 2,
  "Severe DR": 3,
  "Proliferative DR": 4,
};

const emptyHistory = {
  visits: [],
  medications: [],
  comorbidities: [],
  scans: [],
};

/* ══════════════════════════════════════════════════════════════
   PRINT HTML (stays as-is — separate window)
   ══════════════════════════════════════════════════════════════ */
function toPrintWindowHtml(patient, history) {
  const esc = (value) =>
    String(value ?? "-")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const rows = (items, fields) =>
    items
      .map(
        (item) =>
          `<tr>${fields
            .map((f) => `<td>${esc(item[f])}</td>`)
            .join("")}</tr>`
      )
      .join("");

  return `
    <html>
      <head>
        <title>Medical History - ${patient?.name || ""}</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 28px;
            color: #0f172a;
            background: #f8fafc;
          }
          .sheet {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 24px;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .brand {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.3px;
            color: #1d4ed8;
          }
          .subtitle {
            margin-top: 4px;
            font-size: 12px;
            color: #64748b;
          }
          .patient-banner {
            background: linear-gradient(135deg, #eff6ff, #ecfeff);
            border: 1px solid #bfdbfe;
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 16px;
          }
          .patient-name {
            font-size: 20px;
            font-weight: 900;
            color: #0f172a;
          }
          .patient-meta {
            margin-top: 4px;
            font-size: 12px;
            color: #475569;
          }
          .section {
            margin-top: 16px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px;
          }
          .section h3 {
            margin: 0 0 10px;
            font-size: 14px;
            color: #1e293b;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #e2e8f0;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            font-size: 11px;
          }
          .footer {
            margin-top: 16px;
            font-size: 11px;
            color: #64748b;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <div class="brand">VADR Medical History Report</div>
              <div class="subtitle">Visual Assessment of Diabetic Retinopathy</div>
            </div>
            <div class="subtitle">Generated: ${esc(new Date().toLocaleString())}</div>
          </div>

          <div class="patient-banner">
            <div class="patient-name">${esc(patient?.name || "-")}</div>
            <div class="patient-meta">Patient ID: ${esc(patient?.patientId || "-")} | Gender: ${esc(patient?.gender || "-")} | Age: ${esc(patient?.age || "-")}</div>
          </div>

          <div class="section">
            <h3>Visit Timeline</h3>
            <table>
              <thead><tr><th>Date</th><th>DR Grade</th><th>HbA1c</th><th>Notes</th></tr></thead>
              <tbody>${rows(history.visits || [], ["visitDate", "drGrade", "hba1c", "notes"])}</tbody>
            </table>
          </div>

          <div class="section">
            <h3>Medication Records</h3>
            <table>
              <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th></tr></thead>
              <tbody>${rows(history.medications || [], ["name", "dosage", "frequency"])}</tbody>
            </table>
          </div>

          <div class="section">
            <h3>Comorbidity Records</h3>
            <table>
              <thead><tr><th>Condition</th><th>Diagnosed</th><th>Status</th></tr></thead>
              <tbody>${rows(history.comorbidities || [], ["condition", "diagnosedOn", "status"])}</tbody>
            </table>
          </div>

          <div class="section">
            <h3>Scan Comparison</h3>
            <table>
              <thead><tr><th>Date</th><th>Left Eye</th><th>Right Eye</th><th>Comments</th></tr></thead>
              <tbody>${rows(history.scans || [], ["scanDate", "leftEye", "rightEye", "comments"])}</tbody>
            </table>
          </div>

          <div class="footer">Confidential medical document - VADR System</div>
        </div>
      </body>
    </html>
  `;
}

/* ══════════════════════════════════════════════════════════════
   STAT CARD (matches admin portal style)
   ══════════════════════════════════════════════════════════════ */
function StatCard({ label, value, icon, color = "#1a56db" }) {
  return (
    <div className="vadr-stat-card">
      <div className="vadr-stat-icon" style={{ background: `${color}14` }}>
        <Icon d={I[icon]} size={22} color={color} />
      </div>
      <div>
        <div className="vadr-stat-value">{value}</div>
        <div style={{ fontSize: 12, color: "var(--vadr-text-muted)", marginTop: 4, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BTN (matches admin portal button)
   ══════════════════════════════════════════════════════════════ */
function Btn({ children, onClick, variant = "primary", disabled, icon, style = {} }) {
  const vr = {
    primary:   { background: "var(--vadr-primary)", color: "#fff", border: "none" },
    secondary: { background: "var(--vadr-btn-secondary-bg)", color: "var(--vadr-text-secondary)", border: "none" },
    ghost:     { background: "transparent", color: "var(--vadr-text-muted)", border: "none" },
    teal:      { background: "var(--vadr-primary-soft)", color: "var(--vadr-primary)", border: "1.5px solid var(--vadr-primary-border)" },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        borderRadius: 8, padding: "8px 16px", fontSize: 13,
        fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit", opacity: disabled ? 0.6 : 1,
        transition: "all 0.15s",
        ...vr[variant], ...style,
      }}>
      {icon && <Icon d={I[icon]} size={13} />}
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function MedicalHistoryManagementPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const sessionUser = getStoredUser();
  const isPatientUser = sessionUser?.role === "patient";
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientId || "");
  const [history, setHistory] = useState(emptyHistory);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftVisit, setDraftVisit] = useState({ visitDate: "", drGrade: "No DR", hba1c: "", notes: "" });
  const [draftMedication, setDraftMedication] = useState({ name: "", dosage: "", frequency: "" });
  const [draftComorbidity, setDraftComorbidity] = useState({ condition: "", diagnosedOn: "", status: "active" });
  const [draftScan, setDraftScan] = useState({ scanDate: "", leftEye: "No DR", rightEye: "No DR", comments: "" });

  const selectedPatient = useMemo(
    () => patients.find((p) => p.patientId === selectedPatientId),
    [patients, selectedPatientId]
  );

  useEffect(() => {
    if (isPatientUser && patientId) {
      patientAPI.getOne(patientId).then((p) => setPatients(p ? [p] : [])).catch(() => setPatients([]));
      return;
    }
    patientAPI.getAll().then((data) => {
      setPatients(Array.isArray(data) ? data : []);
      if (!selectedPatientId && data.length) setSelectedPatientId(data[0].patientId);
    }).catch(() => setPatients([]));
  }, [selectedPatientId, isPatientUser, patientId]);

  useEffect(() => {
    if (!selectedPatientId) return;
    setLoading(true);
    medicalHistoryAPI
      .get(selectedPatientId)
      .then((data) => setHistory({ ...emptyHistory, ...data }))
      .finally(() => setLoading(false));
  }, [selectedPatientId]);

  const drTrendData = useMemo(
    () =>
      [...(history.visits || [])]
        .sort((a, b) => (a.visitDate > b.visitDate ? 1 : -1))
        .map((visit) => ({
          date: visit.visitDate,
          score: gradeToScore[visit.drGrade] ?? 0,
          grade: visit.drGrade,
          hba1c: visit.hba1c,
        })),
    [history.visits]
  );

  const onSave = async (nextHistory) => {
    if (!selectedPatientId) return;
    setSaving(true);
    try {
      const saved = await medicalHistoryAPI.update(selectedPatientId, nextHistory);
      setHistory({ ...emptyHistory, ...saved });
    } finally {
      setSaving(false);
    }
  };

  const addVisit = () => {
    if (!draftVisit.visitDate) return;
    onSave({ ...history, visits: [...history.visits, draftVisit] });
    setDraftVisit({ visitDate: "", drGrade: "No DR", hba1c: "", notes: "" });
  };

  const addMedication = () => {
    if (!draftMedication.name) return;
    onSave({ ...history, medications: [...history.medications, draftMedication] });
    setDraftMedication({ name: "", dosage: "", frequency: "" });
  };

  const addComorbidity = () => {
    if (!draftComorbidity.condition) return;
    onSave({ ...history, comorbidities: [...history.comorbidities, draftComorbidity] });
    setDraftComorbidity({ condition: "", diagnosedOn: "", status: "active" });
  };

  const addScan = () => {
    if (!draftScan.scanDate) return;
    onSave({ ...history, scans: [...history.scans, draftScan] });
    setDraftScan({ scanDate: "", leftEye: "No DR", rightEye: "No DR", comments: "" });
  };

  const exportPdf = async () => {
    if (!selectedPatientId) return;
    const payload = await medicalHistoryAPI.export(selectedPatientId);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(toPrintWindowHtml(payload.patient, payload.history));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="vadr-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: var(--vadr-primary) !important; box-shadow: 0 0 0 3px var(--vadr-focus-ring) !important; outline: none; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--vadr-scrollbar); border-radius: 3px; }
        button:hover:not(:disabled) { opacity: 0.92; }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header className="vadr-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 32 }}>
          <div className="vadr-brand-mark">
            <Icon d={I.eye} size={18} color="#fff" />
          </div>
          <div className="vadr-brand-title">VADR</div>
          <span className="vadr-brand-sub">Medical History</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle iconOnly />
          <Btn variant="teal" icon="export" onClick={exportPdf}>Export PDF</Btn>
          <Link to="/" className="vadr-link-btn">← Back to Portal</Link>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="vadr-main">
        <div className="vadr-panel">

          {/* ── Welcome Banner ── */}
          <div className="vadr-welcome">
            <div>
              <h2>Medical History{selectedPatient ? ` — ${selectedPatient.name}` : ""}</h2>
              <p>Visit timeline, DR grade trends, medications/comorbidities, scan comparison, and PDF export.</p>
            </div>
          </div>

          {/* ── Stat Cards ── */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div className="vadr-stat-card" style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Patient</div>
                  <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                    <option value="">Select patient...</option>
                    {patients.map((p) => (
                      <option key={p.patientId} value={p.patientId}>
                        {p.name} ({p.patientId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <StatCard label="Total Visits" value={history.visits.length} icon="calendar" color="#1a56db" />
            <StatCard label="Medications" value={history.medications.length} icon="heart" color="#0694a2" />
            <StatCard label="Scan Records" value={history.scans.length} icon="scan" color="#7e3af2" />
          </div>

          {/* ── DR Grade Trend Chart ── */}
          <div className="vadr-surface vadr-surface-pad" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, color: "var(--vadr-text)", fontSize: 15, fontWeight: 700 }}>
              <Icon d={I.history} size={16} color="var(--vadr-primary)" style={{ marginRight: 8, verticalAlign: "middle" }} />
              DR Grade Trend Chart
            </h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={drTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--vadr-border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--vadr-text-muted)", fontSize: 11 }} stroke="var(--vadr-border)" />
                  <YAxis
                    type="number"
                    domain={[0, 4]}
                    ticks={[0, 1, 2, 3, 4]}
                    tickFormatter={(v) => drScoreToLabel[v]}
                    width={110}
                    tick={{ fill: "var(--vadr-text-muted)", fontSize: 11 }}
                    stroke="var(--vadr-border)"
                  />
                  <Tooltip
                    formatter={(value) => drScoreToLabel[value]}
                    contentStyle={{
                      background: "var(--vadr-surface)",
                      border: "1px solid var(--vadr-border)",
                      borderRadius: 10,
                      color: "var(--vadr-text)",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--vadr-text-muted)" }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--vadr-primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--vadr-primary)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Visit Timeline + Medications / Comorbidities ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Visit Timeline */}
            <div className="vadr-surface vadr-surface-pad">
              <h3 style={{ marginTop: 0, color: "var(--vadr-text)", fontSize: 15, fontWeight: 700 }}>
                <Icon d={I.calendar} size={16} color="#1a56db" style={{ marginRight: 8, verticalAlign: "middle" }} />
                Visit Timeline
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(150px, 1.2fr) minmax(80px, 0.8fr) minmax(120px, 2fr) auto", gap: 8, alignItems: "end" }}>
                <div>
                  <div style={labelStyle}>Date</div>
                  <input type="date" value={draftVisit.visitDate} onChange={(e) => setDraftVisit((s) => ({ ...s, visitDate: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>DR Grade</div>
                  <select value={draftVisit.drGrade} onChange={(e) => setDraftVisit((s) => ({ ...s, drGrade: e.target.value }))} style={inputStyle}>
                    {Object.keys(gradeToScore).map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>HbA1c</div>
                  <input placeholder="HbA1c" value={draftVisit.hba1c} onChange={(e) => setDraftVisit((s) => ({ ...s, hba1c: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Notes</div>
                  <input placeholder="Notes" value={draftVisit.notes} onChange={(e) => setDraftVisit((s) => ({ ...s, notes: e.target.value }))} style={inputStyle} />
                </div>
                <Btn onClick={addVisit} disabled={saving} icon="plus">Add</Btn>
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {[...(history.visits || [])]
                  .sort((a, b) => (a.visitDate < b.visitDate ? 1 : -1))
                  .map((v, idx) => (
                    <div key={`${v.visitDate}-${idx}`} style={{
                      border: "1px solid var(--vadr-border)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      background: "var(--vadr-surface-muted)",
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--vadr-text)" }}>{v.visitDate} — {v.drGrade}</div>
                      <div style={{ fontSize: 12, color: "var(--vadr-text-muted)", marginTop: 2 }}>HbA1c: {v.hba1c || "-"} | {v.notes || "-"}</div>
                    </div>
                  ))}
                {!history.visits.length && !loading && <div style={{ color: "var(--vadr-text-faint)", fontSize: 13 }}>No visits recorded yet.</div>}
              </div>
            </div>

            {/* Medications + Comorbidities */}
            <div className="vadr-surface vadr-surface-pad">
              <h3 style={{ marginTop: 0, color: "var(--vadr-text)", fontSize: 15, fontWeight: 700 }}>
                <Icon d={I.heart} size={16} color="#0694a2" style={{ marginRight: 8, verticalAlign: "middle" }} />
                Medication Records
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) auto", gap: 8, alignItems: "end" }}>
                <div>
                  <div style={labelStyle}>Medication</div>
                  <input placeholder="Medication" value={draftMedication.name} onChange={(e) => setDraftMedication((s) => ({ ...s, name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Dosage</div>
                  <input placeholder="Dosage" value={draftMedication.dosage} onChange={(e) => setDraftMedication((s) => ({ ...s, dosage: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Frequency</div>
                  <input placeholder="Frequency" value={draftMedication.frequency} onChange={(e) => setDraftMedication((s) => ({ ...s, frequency: e.target.value }))} style={inputStyle} />
                </div>
                <Btn onClick={addMedication} disabled={saving} icon="plus">Add</Btn>
              </div>
              <div style={{ marginTop: 10 }}>
                {(history.medications || []).map((m, i) => (
                  <div key={`${m.name}-${i}`} style={{
                    fontSize: 13, marginBottom: 8, color: "var(--vadr-text)",
                    padding: "8px 12px", borderRadius: 8,
                    background: "var(--vadr-surface-muted)",
                    border: "1px solid var(--vadr-border)",
                  }}>
                    <span style={{ fontWeight: 600 }}>{m.name}</span> — {m.dosage} <span style={{ color: "var(--vadr-text-muted)" }}>({m.frequency})</span>
                  </div>
                ))}
              </div>

              <h3 style={{ marginBottom: 8, marginTop: 20, color: "var(--vadr-text)", fontSize: 15, fontWeight: 700 }}>
                <Icon d={I.pill} size={16} color="#7e3af2" style={{ marginRight: 8, verticalAlign: "middle" }} />
                Comorbidity Records
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(140px, 1fr) minmax(100px, 1fr) auto", gap: 8, alignItems: "end" }}>
                <div>
                  <div style={labelStyle}>Condition</div>
                  <input placeholder="Condition" value={draftComorbidity.condition} onChange={(e) => setDraftComorbidity((s) => ({ ...s, condition: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Diagnosed On</div>
                  <input type="date" value={draftComorbidity.diagnosedOn} onChange={(e) => setDraftComorbidity((s) => ({ ...s, diagnosedOn: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Status</div>
                  <select value={draftComorbidity.status} onChange={(e) => setDraftComorbidity((s) => ({ ...s, status: e.target.value }))} style={inputStyle}>
                    <option value="active">Active</option>
                    <option value="stable">Stable</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <Btn onClick={addComorbidity} disabled={saving} icon="plus">Add</Btn>
              </div>
              <div style={{ marginTop: 10 }}>
                {(history.comorbidities || []).map((c, i) => (
                  <div key={`${c.condition}-${i}`} style={{
                    fontSize: 13, marginBottom: 8, color: "var(--vadr-text)",
                    padding: "8px 12px", borderRadius: 8,
                    background: "var(--vadr-surface-muted)",
                    border: "1px solid var(--vadr-border)",
                  }}>
                    <span style={{ fontWeight: 600 }}>{c.condition}</span> — {c.status} <span style={{ color: "var(--vadr-text-muted)" }}>({c.diagnosedOn || "-"})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Scan Comparison ── */}
          <div className="vadr-surface vadr-surface-panel">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--vadr-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--vadr-text)" }}>
                <Icon d={I.scan} size={15} color="var(--vadr-primary)" style={{ marginRight: 8, verticalAlign: "middle" }} />
                Scan Comparison
              </span>
              <span style={{ fontSize: 12, color: "var(--vadr-text-faint)" }}>{(history.scans || []).length} records</span>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(150px, 1.2fr) minmax(150px, 1.2fr) minmax(120px, 2fr) auto", gap: 8, alignItems: "end", marginBottom: 16 }}>
                <div>
                  <div style={labelStyle}>Date</div>
                  <input type="date" value={draftScan.scanDate} onChange={(e) => setDraftScan((s) => ({ ...s, scanDate: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Left Eye DR</div>
                  <select value={draftScan.leftEye} onChange={(e) => setDraftScan((s) => ({ ...s, leftEye: e.target.value }))} style={inputStyle}>
                    {Object.keys(gradeToScore).map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Right Eye DR</div>
                  <select value={draftScan.rightEye} onChange={(e) => setDraftScan((s) => ({ ...s, rightEye: e.target.value }))} style={inputStyle}>
                    {Object.keys(gradeToScore).map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Comments</div>
                  <input placeholder="Comments" value={draftScan.comments} onChange={(e) => setDraftScan((s) => ({ ...s, comments: e.target.value }))} style={inputStyle} />
                </div>
                <Btn onClick={addScan} disabled={saving} icon="plus">Add</Btn>
              </div>

              <div style={{ overflowX: "auto" }} className="vadr-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Date", "Left Eye", "Right Eye", "Comments"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(history.scans || []).map((scan, i) => (
                      <tr key={`${scan.scanDate}-${i}`}>
                        <td style={tdStyle}>{scan.scanDate}</td>
                        <td style={tdStyle}>{scan.leftEye}</td>
                        <td style={tdStyle}>{scan.rightEye}</td>
                        <td style={tdStyle}>{scan.comments || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!history.scans.length && !loading && <div style={{ color: "var(--vadr-text-faint)", fontSize: 13, padding: "20px 16px", textAlign: "center" }}>No scan comparisons added yet.</div>}
              </div>
            </div>
          </div>

          {/* ── Footer Link ── */}
          <div style={{ marginTop: 20 }}>
            <Link to="/" className="vadr-link-btn">
              ← Return to Patient/User Management
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
