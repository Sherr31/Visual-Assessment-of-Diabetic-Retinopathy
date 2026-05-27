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
import { medicalHistoryAPI, patientAPI } from "../../shared/api";

const inputStyle = {
  border: "1.5px solid #e5e7eb",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#111827",
  background: "#fff",
  width: "100%",
  fontFamily: "inherit",
  boxSizing: "border-box",
  minWidth: 0,
};

const cardStyle = {
  background: "#fff",
  border: "1.5px solid #e5e7eb",
  borderRadius: 14,
  padding: "16px 18px",
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

export default function MedicalHistoryManagementPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
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
    patientAPI.getAll().then((data) => {
      setPatients(data);
      if (!selectedPatientId && data.length) setSelectedPatientId(data[0].patientId);
    });
  }, [selectedPatientId]);

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
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Medical History Management</h2>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            Visit timeline, DR grade trends, medications/comorbidities, scan comparison, and PDF export.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate("/")} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
            Back
          </button>
          <button onClick={exportPdf} style={{ ...inputStyle, width: "auto", cursor: "pointer", borderColor: "#bfdbfe", color: "#1d4ed8" }}>
            Export History PDF
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Patient</div>
          <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} style={inputStyle}>
            <option value="">Select patient...</option>
            {patients.map((p) => (
              <option key={p.patientId} value={p.patientId}>
                {p.name} ({p.patientId})
              </option>
            ))}
          </select>
        </div>
        <div><div style={{ fontSize: 12, color: "#9ca3af" }}>Total Visits</div><div style={{ fontSize: 24, fontWeight: 800 }}>{history.visits.length}</div></div>
        <div><div style={{ fontSize: 12, color: "#9ca3af" }}>Medications</div><div style={{ fontSize: 24, fontWeight: 800 }}>{history.medications.length}</div></div>
        <div><div style={{ fontSize: 12, color: "#9ca3af" }}>Scan Records</div><div style={{ fontSize: 24, fontWeight: 800 }}>{history.scans.length}</div></div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>DR Grade Trend Chart</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={drTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis
                type="number"
                domain={[0, 4]}
                ticks={[0, 1, 2, 3, 4]}
                tickFormatter={(v) => drScoreToLabel[v]}
                width={110}
              />
              <Tooltip formatter={(value) => drScoreToLabel[value]} />
              <Line type="monotone" dataKey="score" stroke="#1a56db" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Visit Timeline</h3>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(150px, 1.2fr) minmax(80px, 0.8fr) minmax(120px, 2fr) auto", gap: 8, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Date</div>
              <input type="date" value={draftVisit.visitDate} onChange={(e) => setDraftVisit((s) => ({ ...s, visitDate: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>DR Grade</div>
              <select value={draftVisit.drGrade} onChange={(e) => setDraftVisit((s) => ({ ...s, drGrade: e.target.value }))} style={inputStyle}>
                {Object.keys(gradeToScore).map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>HbA1c</div>
              <input placeholder="HbA1c" value={draftVisit.hba1c} onChange={(e) => setDraftVisit((s) => ({ ...s, hba1c: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Notes</div>
              <input placeholder="Notes" value={draftVisit.notes} onChange={(e) => setDraftVisit((s) => ({ ...s, notes: e.target.value }))} style={inputStyle} />
            </div>
            <button onClick={addVisit} disabled={saving} style={{ ...inputStyle, width: "auto", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {[...(history.visits || [])]
              .sort((a, b) => (a.visitDate < b.visitDate ? 1 : -1))
              .map((v, idx) => (
                <div key={`${v.visitDate}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#f9fafb" }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{v.visitDate} - {v.drGrade}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>HbA1c: {v.hba1c || "-"} | {v.notes || "-"}</div>
                </div>
              ))}
            {!history.visits.length && !loading && <div style={{ color: "#9ca3af", fontSize: 13 }}>No visits recorded yet.</div>}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Medication Records</h3>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) auto", gap: 8, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Medication</div>
              <input placeholder="Medication" value={draftMedication.name} onChange={(e) => setDraftMedication((s) => ({ ...s, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Dosage</div>
              <input placeholder="Dosage" value={draftMedication.dosage} onChange={(e) => setDraftMedication((s) => ({ ...s, dosage: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Frequency</div>
              <input placeholder="Frequency" value={draftMedication.frequency} onChange={(e) => setDraftMedication((s) => ({ ...s, frequency: e.target.value }))} style={inputStyle} />
            </div>
            <button onClick={addMedication} disabled={saving} style={{ ...inputStyle, width: "auto", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
          </div>
          <div style={{ marginTop: 10 }}>
            {(history.medications || []).map((m, i) => <div key={`${m.name}-${i}`} style={{ fontSize: 13, marginBottom: 6 }}>{m.name} - {m.dosage} ({m.frequency})</div>)}
          </div>

          <h3 style={{ marginBottom: 8 }}>Comorbidity Records</h3>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(140px, 1fr) minmax(100px, 1fr) auto", gap: 8, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Condition</div>
              <input placeholder="Condition" value={draftComorbidity.condition} onChange={(e) => setDraftComorbidity((s) => ({ ...s, condition: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Diagnosed On</div>
              <input type="date" value={draftComorbidity.diagnosedOn} onChange={(e) => setDraftComorbidity((s) => ({ ...s, diagnosedOn: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Status</div>
              <select value={draftComorbidity.status} onChange={(e) => setDraftComorbidity((s) => ({ ...s, status: e.target.value }))} style={inputStyle}>
                <option value="active">Active</option>
                <option value="stable">Stable</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <button onClick={addComorbidity} disabled={saving} style={{ ...inputStyle, width: "auto", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
          </div>
          <div style={{ marginTop: 10 }}>
            {(history.comorbidities || []).map((c, i) => <div key={`${c.condition}-${i}`} style={{ fontSize: 13, marginBottom: 6 }}>{c.condition} - {c.status} ({c.diagnosedOn || "-"})</div>)}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Scan Comparison</h3>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(150px, 1.2fr) minmax(150px, 1.2fr) minmax(120px, 2fr) auto", gap: 8, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Date</div>
            <input type="date" value={draftScan.scanDate} onChange={(e) => setDraftScan((s) => ({ ...s, scanDate: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Left Eye DR</div>
            <select value={draftScan.leftEye} onChange={(e) => setDraftScan((s) => ({ ...s, leftEye: e.target.value }))} style={inputStyle}>
              {Object.keys(gradeToScore).map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Right Eye DR</div>
            <select value={draftScan.rightEye} onChange={(e) => setDraftScan((s) => ({ ...s, rightEye: e.target.value }))} style={inputStyle}>
              {Object.keys(gradeToScore).map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Comments</div>
            <input placeholder="Comments" value={draftScan.comments} onChange={(e) => setDraftScan((s) => ({ ...s, comments: e.target.value }))} style={inputStyle} />
          </div>
          <button onClick={addScan} disabled={saving} style={{ ...inputStyle, width: "auto", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
        </div>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Date", "Left Eye", "Right Eye", "Comments"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(history.scans || []).map((scan, i) => (
                <tr key={`${scan.scanDate}-${i}`}>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{scan.scanDate}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{scan.leftEye}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{scan.rightEye}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{scan.comments || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.scans.length && !loading && <div style={{ color: "#9ca3af", fontSize: 13 }}>No scan comparisons added yet.</div>}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link to="/" style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          Return to Patient/User Management
        </Link>
      </div>
    </div>
  );
}
