import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  HeartPulse,
  Clock,
  AlertTriangle,
  FileText,
  BookOpen,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Eye,
  Info,
  ShieldAlert,
  XCircle,
  Calendar,
  Download,
  Upload,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import RoleSidebar from "../../components/layout/RoleSidebar";
import ThemeToggle from "../../components/ThemeToggle";
import { patientAPI, predictAPI, reportAPI, BASE_URL, authAPI, clearSession, getStoredUser } from "../../api";
import "../../vadr-dashboard.css";
import "../../vadr-theme.css";

const SEVERITY_CONFIG = {
  "No DR": {
    label: "No Diabetic Retinopathy",
    shortLabel: "No DR",
    risk: "Low Risk — Routine Annual Screening",
    badgeClass: "vadr-badge--no-dr",
    color: "#10b981",
    recommendation: "Maintain stable glycemic control (HbA1c target) and schedule your next routine retinal evaluation in 12 months.",
    icon: CheckCircle2,
  },
  "Mild": {
    label: "Mild Non-Proliferative DR",
    shortLabel: "Mild NPDR",
    risk: "Early Retinopathy Stage",
    badgeClass: "vadr-badge--mild",
    color: "#0ea5e9",
    recommendation: "Early microvascular changes detected. Maintain strict blood glucose and blood pressure control. Follow-up recommended in 6–9 months.",
    icon: Info,
  },
  "Moderate": {
    label: "Moderate Non-Proliferative DR",
    shortLabel: "Moderate NPDR",
    risk: "Moderate Retinopathy Risk",
    badgeClass: "vadr-badge--moderate",
    color: "#f59e0b",
    recommendation: "Moderate retinal lesions identified. Consult your attending ophthalmologist for specialized dilated examination within 3–6 months.",
    icon: AlertTriangle,
  },
  "Severe": {
    label: "Severe Non-Proliferative DR",
    shortLabel: "Severe NPDR",
    risk: "High Vision Loss Risk",
    badgeClass: "vadr-badge--severe",
    color: "#ef4444",
    recommendation: "High-risk retinal changes detected. Please schedule an in-clinic consultation with your ophthalmologist immediately for treatment planning.",
    icon: ShieldAlert,
  },
  "Proliferative": {
    label: "Proliferative Diabetic Retinopathy",
    shortLabel: "Proliferative DR",
    risk: "Critical Vision Risk",
    badgeClass: "vadr-badge--proliferative",
    color: "#a855f7",
    recommendation: "Critical neovascularization detected. Urgent medical intervention (laser panretinal photocoagulation / anti-VEGF therapy) is recommended.",
    icon: XCircle,
  },
  "Proliferative DR": {
    label: "Proliferative Diabetic Retinopathy",
    shortLabel: "Proliferative DR",
    risk: "Critical Vision Risk",
    badgeClass: "vadr-badge--proliferative",
    color: "#a855f7",
    recommendation: "Critical neovascularization detected. Urgent medical intervention (laser panretinal photocoagulation / anti-VEGF therapy) is recommended.",
    icon: XCircle,
  },
};

function getSeverityConfig(pred) {
  return SEVERITY_CONFIG[pred] || SEVERITY_CONFIG["No DR"];
}

export default function PatientDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const user = getStoredUser() || {};
  const navigate = useNavigate();
  const location = useLocation();

  // Fundus Image Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [eyeSide, setEyeSide] = useState("OD (Right Eye)");
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [downloadingReportId, setDownloadingReportId] = useState(null);

  const handleDownloadReport = async (reportId) => {
    if (!reportId) return;
    setDownloadingReportId(reportId);
    try {
      await reportAPI.downloadPdf(reportId);
    } catch (err) {
      alert(err.message || "Failed to download PDF report");
    } finally {
      setDownloadingReportId(null);
    }
  };

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await patientAPI.getDashboard();
      const payload = res?.data !== undefined ? res.data : res;
      setData(payload);
    } catch (err) {
      console.error("Failed to load patient dashboard:", err);
      setError(err.message || "Failed to load your clinical records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, []);

  // Smooth scroll to anchor target when location.hash changes or content loads
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace("#", "");
      const timer = setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.hash, data, loading]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {}
    clearSession();
    navigate("/login");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid fundus image file (PNG, JPG, JPEG).");
      return;
    }
    setUploadError(null);
    setAnalysisResult(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleRunAnalysis = async () => {
    if (!selectedFile) {
      setUploadError("Please choose or drop a fundus photograph first.");
      return;
    }
    try {
      setAnalyzing(true);
      setUploadError(null);
      const patientId = patient?.patientId || patient?.patient_id;
      const res = await predictAPI.analyze(selectedFile, patientId);
      setAnalysisResult(res);
      // Refresh dashboard data so the new scan immediately appears in latest screening and history table
      await fetchPatientData();
    } catch (err) {
      console.error("AI Analysis failed:", err);
      setUploadError(err.message || "Failed to complete AI fundus analysis. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResetUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setUploadError(null);
  };

  const patient = data?.patient;
  const latest = data?.latestScreening;
  const history = data?.screeningHistory || [];
  const assignedDoctor = data?.assignedDoctor || patient?.assignedDoctor || "Dr. Ayesha Khan (Ophthalmologist)";
  const reportsRaw = data?.reports;
  const reports = Array.isArray(reportsRaw)
    ? reportsRaw
    : Array.isArray(reportsRaw?.items)
    ? reportsRaw.items
    : [];

  const latestCfg = getSeverityConfig(latest?.prediction);
  const LatestIcon = latestCfg.icon;

  return (
    <div className="vadr-dash-container">
      <RoleSidebar activeTab="dashboard" />

      {/* Main Workspace */}
      <div className="vadr-dash-main">
        {/* Top Header */}
        <header className="vadr-dash-header">
          <div>
            <h1 className="vadr-header-title">Personal Retinal Health Portal</h1>
            <div className="vadr-header-subtitle">
              Secure patient access to diabetic retinopathy screening history and clinical guidance
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={fetchPatientData}
              disabled={loading}
              title="Refresh your health records"
              className="vadr-btn vadr-btn-secondary"
              style={{ padding: "6px 11px", fontSize: 12 }}
            >
              <RefreshCw size={13} className={loading ? "spin-animation" : ""} />
              <span>Refresh</span>
            </button>

            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="vadr-btn vadr-btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Canvas Body */}
        <main className="vadr-dash-body">
          {error && (
            <div className="vadr-alert-banner">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{error}</span>
              </div>
              <button
                onClick={fetchPatientData}
                className="vadr-btn vadr-btn-danger"
                style={{ padding: "4px 10px", fontSize: 11.5 }}
              >
                Retry
              </button>
            </div>
          )}

          {/* 1. Patient Welcome Banner */}
          <section
            id="assessment"
            style={{
              background: "linear-gradient(135deg, #0f766e 0%, #0369a1 100%)",
              borderRadius: 14,
              padding: "24px 28px",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
              boxShadow: "0 4px 14px rgba(15, 118, 110, 0.2)",
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85, marginBottom: 4 }}>
                Welcome to VADR Health
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
                Hello, {patient?.name || user.name || "Valued Patient"}
              </div>
              <div style={{ fontSize: 13, opacity: 0.92, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <span>Patient ID: <strong style={{ fontFamily: "monospace" }}>{patient?.patient_id || "PAT-CURRENT"}</strong></span>
                <span>•</span>
                <span>Attending Clinician: <strong>{assignedDoctor}</strong></span>
              </div>
            </div>

            <div
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                borderRadius: 10,
                padding: "12px 18px",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", opacity: 0.85 }}>
                Total Retinal Evaluations
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>
                {history.length} Record{history.length !== 1 ? "s" : ""}
              </div>
            </div>
          </section>

          {/* Fundus Image Upload & AI Analysis Card */}
          <section id="upload" className="vadr-card" style={{ border: "1px solid var(--vadr-border)" }}>
            <div className="vadr-card-header">
              <div>
                <h2 className="vadr-card-title">
                  <Upload size={16} color="var(--vadr-primary)" />
                  <span>Fundus Image Upload & AI Screening</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Upload your retinal fundus photograph to initiate immediate diabetic retinopathy classification
                </div>
              </div>

              <Link
                to="/fundus-analysis"
                className="vadr-btn vadr-btn-secondary"
                style={{ fontSize: 12, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span>Full Workstation</span>
                <ExternalLink size={13} />
              </Link>
            </div>

            <div className="vadr-card-body">
              {uploadError && (
                <div className="vadr-alert-banner" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={16} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{uploadError}</span>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 24, alignItems: "start" }}>
                {/* Left: Upload Input & Controls */}
                <div>
                  <label
                    htmlFor="patient-fundus-input"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "24px 16px",
                      border: "2px dashed var(--vadr-border)",
                      borderRadius: 12,
                      background: "var(--vadr-surface-muted)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "border-color 0.2s, background 0.2s",
                      minHeight: 180,
                    }}
                  >
                    <input
                      id="patient-fundus-input"
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                    {previewUrl ? (
                      <div style={{ position: "relative", width: "100%", textAlign: "center" }}>
                        <img
                          src={previewUrl}
                          alt="Fundus Preview"
                          style={{
                            maxWidth: "100%",
                            maxHeight: 160,
                            borderRadius: 8,
                            objectFit: "contain",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                        />
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--vadr-primary)", marginTop: 8 }}>
                          {selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(1)} KB) — Click to change
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: "var(--vadr-primary-soft)",
                            color: "var(--vadr-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 10,
                          }}
                        >
                          <Upload size={20} />
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--vadr-text)" }}>
                          Click to browse or drop retinal fundus image
                        </div>
                        <div style={{ fontSize: 12, color: "var(--vadr-text-muted)", marginTop: 4 }}>
                          Supports JPEG, PNG (512×512 or higher recommended)
                        </div>
                      </>
                    )}
                  </label>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--vadr-text-muted)", display: "block", marginBottom: 4 }}>
                        Examined Eye
                      </label>
                      <select
                        value={eyeSide}
                        onChange={(e) => setEyeSide(e.target.value)}
                        className="vadr-input"
                        style={{ width: "100%", padding: "7px 10px", fontSize: 12.5 }}
                      >
                        <option value="OD (Right Eye)">Right Eye (OD - Oculus Dexter)</option>
                        <option value="OS (Left Eye)">Left Eye (OS - Oculus Sinister)</option>
                        <option value="Fundus (Bilateral)">Fundus (Bilateral)</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                      <button
                        onClick={handleRunAnalysis}
                        disabled={!selectedFile || analyzing}
                        className="vadr-btn vadr-btn-primary"
                        style={{ padding: "8px 18px", fontSize: 12.5 }}
                      >
                        <Sparkles size={14} className={analyzing ? "spin-animation" : ""} />
                        <span>{analyzing ? "Processing AI Scan…" : "Run AI Assessment"}</span>
                      </button>

                      {selectedFile && (
                        <button
                          onClick={handleResetUpload}
                          disabled={analyzing}
                          className="vadr-btn vadr-btn-secondary"
                          style={{ padding: "8px 12px", fontSize: 12.5 }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Instant Inference Results */}
                <div
                  style={{
                    border: "1px solid var(--vadr-border)",
                    borderRadius: 12,
                    padding: 16,
                    background: "var(--vadr-surface-muted)",
                    minHeight: 240,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  {analyzing ? (
                    <div style={{ textAlign: "center", padding: "30px 0" }}>
                      <RefreshCw size={28} className="spin-animation" style={{ margin: "0 auto 12px", color: "var(--vadr-primary)" }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--vadr-text)" }}>
                        Running Deep Neural Network Inference…
                      </div>
                      <div style={{ fontSize: 12, color: "var(--vadr-text-muted)", marginTop: 4 }}>
                        Analyzing retinal lesions, microaneurysms, and Grad-CAM visual heatmaps.
                      </div>
                    </div>
                  ) : analysisResult ? (
                    (() => {
                      const resCfg = getSeverityConfig(analysisResult.prediction);
                      const ResIcon = resCfg.icon;
                      const gradcamUrl = analysisResult.gradcam
                        ? `${BASE_URL}/gradcam-image?path=${encodeURIComponent(analysisResult.gradcam)}`
                        : null;

                      return (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className={`vadr-badge ${resCfg.badgeClass}`} style={{ fontSize: 13, padding: "4px 10px" }}>
                                <ResIcon size={14} />
                                <span>{analysisResult.prediction || "No DR"}</span>
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--vadr-text-secondary)" }}>
                                {analysisResult.confidence ? `${analysisResult.confidence.toFixed(1)}% Confidence` : ""}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vadr-primary)", background: "var(--vadr-primary-soft)", padding: "2px 8px", borderRadius: 4 }}>
                              Saved to Records
                            </span>
                          </div>

                          <div style={{ fontSize: 12.5, color: "var(--vadr-text)", lineHeight: 1.5, marginBottom: 12 }}>
                            {resCfg.recommendation}
                          </div>

                          {gradcamUrl && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--vadr-text-muted)", marginBottom: 6 }}>
                                Grad-CAM Attention Heatmap:
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <img
                                  src={gradcamUrl}
                                  alt="GradCAM Attention"
                                  style={{ width: 100, height: 100, borderRadius: 6, objectFit: "cover", border: "1px solid var(--vadr-border)" }}
                                />
                                <div style={{ fontSize: 11.5, color: "var(--vadr-text-secondary)", lineHeight: 1.4 }}>
                                  Areas highlighted in red/yellow indicate specific retinal microvascular features that influenced the AI prediction.
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--vadr-text-muted)" }}>
                      <Eye size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                      <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--vadr-text)" }}>
                        AI Evaluation Preview
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4, maxWidth: 300, margin: "4px auto 0" }}>
                        Select a fundus photo and click <strong>Run AI Assessment</strong> to view instant DR grading and heatmap.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Latest Retinal Assessment Hero Card */}
          <section className="vadr-card">
            <div className="vadr-card-header">
              <div>
                <h2 className="vadr-card-title">
                  <HeartPulse size={16} color="var(--vadr-primary)" />
                  <span>Latest Retinal Assessment</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Most recent AI-assisted fundus analysis and clinical evaluation
                </div>
              </div>

              {latest?.created_at && (
                <div style={{ fontSize: 12, color: "var(--vadr-text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Calendar size={13} />
                  <span>
                    Screened on {new Date(latest.created_at).toLocaleDateString([], { dateStyle: "long" })}
                  </span>
                </div>
              )}
            </div>

            <div className="vadr-card-body">
              {latest ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 2fr",
                    gap: 24,
                    alignItems: "center",
                  }}
                >
                  {/* Left: Classification Badge & Gauge */}
                  <div
                    style={{
                      background: "var(--vadr-surface-muted)",
                      border: "1px solid var(--vadr-border)",
                      borderRadius: 12,
                      padding: "24px 20px",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: `${latestCfg.color}18`,
                        border: `2px solid ${latestCfg.color}40`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: latestCfg.color,
                        marginBottom: 12,
                      }}
                    >
                      <LatestIcon size={28} />
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--vadr-text-muted)", marginBottom: 4 }}>
                      Retinopathy Classification
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: "var(--vadr-text)", marginBottom: 6 }}>
                      {latestCfg.label}
                    </div>

                    <span className={`vadr-badge ${latestCfg.badgeClass}`} style={{ fontSize: 12, padding: "4px 10px" }}>
                      <span>{latestCfg.risk}</span>
                    </span>

                    {typeof latest.confidence === "number" && (
                      <div style={{ fontSize: 11.5, color: "var(--vadr-text-muted)", marginTop: 12 }}>
                        Model Diagnostic Confidence: <strong>{latest.confidence.toFixed(1)}%</strong>
                      </div>
                    )}
                  </div>

                  {/* Right: Clinical Recommendation */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--vadr-text-muted)", marginBottom: 8 }}>
                      Clinical Care Recommendation
                    </div>
                    <div
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.6,
                        color: "var(--vadr-text)",
                        fontWeight: 500,
                        background: "var(--vadr-surface-muted)",
                        border: "1px solid var(--vadr-border)",
                        borderLeft: `4px solid ${latestCfg.color}`,
                        borderRadius: 10,
                        padding: "16px 18px",
                        marginBottom: 16,
                      }}
                    >
                      {latestCfg.recommendation}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12.5, color: "var(--vadr-text-muted)" }}>
                      <span>Eye Examined: <strong>{latest.eye_side || "Fundus"}</strong></span>
                      <span>•</span>
                      <span>Review Status: <strong style={{ color: latest.reviewed ? "var(--vadr-success-text)" : "#d97706" }}>
                        {latest.reviewed ? "Verified by Physician" : "Pending Physician Review"}
                      </strong></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 36, textAlign: "center", color: "var(--vadr-text-muted)" }}>
                  <Eye size={36} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "var(--vadr-text)" }}>
                    No Screening Records on File
                  </h3>
                  <p style={{ fontSize: 13, margin: 0, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                    Your clinical account is registered. Retinal imaging will appear here once your fundus evaluation has been performed.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 3. Screening History Timeline */}
          <section id="timeline" className="vadr-card">
            <div className="vadr-card-header">
              <div>
                <h2 className="vadr-card-title">
                  <Clock size={16} color="var(--vadr-primary)" />
                  <span>Screening History Timeline</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Historical progression of your retinal assessments over time
                </div>
              </div>
            </div>

            <div className="vadr-table-wrap">
              <table className="vadr-table">
                <thead>
                  <tr>
                    <th>Screening Date</th>
                    <th>Eye Side</th>
                    <th>Retinopathy Grade</th>
                    <th>Confidence</th>
                    <th>Physician Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--vadr-text-muted)" }}>
                        No historical evaluations recorded yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((scan, idx) => {
                      const cfg = getSeverityConfig(scan.prediction);
                      const Icon = cfg.icon;

                      return (
                        <tr key={scan._id || scan.id || idx}>
                          <td style={{ fontWeight: 650, color: "var(--vadr-text)" }}>
                            {scan.created_at
                              ? new Date(scan.created_at).toLocaleDateString([], {
                                  dateStyle: "medium",
                                })
                              : "—"}
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-flex",
                                padding: "2px 7px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                background: "var(--vadr-surface-muted)",
                                border: "1px solid var(--vadr-border)",
                              }}
                            >
                              {scan.eye_side || scan.eyeSide || "Fundus"}
                            </span>
                          </td>
                          <td>
                            <span className={`vadr-badge ${cfg.badgeClass}`}>
                              <Icon size={12} />
                              <span>{cfg.shortLabel}</span>
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                              {typeof scan.confidence === "number" ? `${scan.confidence.toFixed(1)}%` : "—"}
                            </span>
                          </td>
                          <td>
                            {scan.reviewed ? (
                              <span className="vadr-badge vadr-badge--reviewed">
                                <span>Verified</span>
                              </span>
                            ) : (
                              <span className="vadr-badge vadr-badge--pending">
                                <span>Pending Sign-off</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Diagnostic Reports Section */}
          <section id="reports" className="vadr-card">
            <div className="vadr-card-header">
              <div>
                <h2 className="vadr-card-title">
                  <FileText size={16} color="var(--vadr-primary)" />
                  <span>Clinical Diagnostic Reports</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Official ophthalmology evaluation summaries and signed documentation
                </div>
              </div>
            </div>

            <div className="vadr-card-body">
              {reports.length === 0 ? (
                <div
                  style={{
                    padding: "24px 20px",
                    background: "var(--vadr-surface-muted)",
                    borderRadius: 10,
                    border: "1px dashed var(--vadr-border)",
                    textAlign: "center",
                    color: "var(--vadr-text-muted)",
                  }}
                >
                  <FileText size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                  <div style={{ fontSize: 13, fontWeight: 650, color: "var(--vadr-text)" }}>
                    No Signed Reports Available Yet
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    Official PDF summaries will appear here once electronically reviewed and signed by your clinician.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reports.map((rpt, i) => {
                    const rptId = rpt.report_id || rpt.reportId || `RPT-${i + 1}`;
                    const pred = rpt.prediction || "Assessed";
                    const isDownloading = downloadingReportId === rptId;

                    return (
                      <div
                        key={rptId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 18px",
                          background: "var(--vadr-surface-muted)",
                          borderRadius: 10,
                          border: "1px solid var(--vadr-border)",
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            backgroundColor: "rgba(37, 99, 235, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#2563eb",
                            flexShrink: 0
                          }}>
                            <FileText size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--vadr-text)", display: "flex", alignItems: "center", gap: 8 }}>
                              <span>{rptId}</span>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 4,
                                backgroundColor: "rgba(16, 185, 129, 0.12)",
                                color: "#047857"
                              }}>
                                {pred}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--vadr-text-muted)", marginTop: 2 }}>
                              Signed by <strong>{rpt.doctor || "Attending Physician"}</strong>
                              {rpt.signedAt || rpt.createdAt ? ` • ${new Date(rpt.signedAt || rpt.createdAt).toLocaleDateString([], { dateStyle: "medium" })}` : ""}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadReport(rptId)}
                          disabled={isDownloading}
                          className="vadr-btn vadr-btn-secondary"
                          style={{
                            fontSize: 12.5,
                            padding: "6px 14px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontWeight: 600,
                            borderRadius: 6
                          }}
                        >
                          <Download size={14} />
                          <span>{isDownloading ? "Downloading..." : "Download PDF"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 5. Evidence-Based Diabetic Eye Care Education */}
          <section id="education" className="vadr-card">
            <div className="vadr-card-header">
              <div>
                <h2 className="vadr-card-title">
                  <BookOpen size={16} color="var(--vadr-primary)" />
                  <span>Diabetic Eye Care Educational Guide</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Evidence-based information to protect your vision and understand diabetic retinopathy
                </div>
              </div>
            </div>

            <div className="vadr-card-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    padding: "16px 18px",
                    background: "var(--vadr-surface-muted)",
                    border: "1px solid var(--vadr-border)",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 750, color: "var(--vadr-text)", marginBottom: 6 }}>
                    What is Diabetic Retinopathy?
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--vadr-text-secondary)", lineHeight: 1.55 }}>
                    Diabetic retinopathy occurs when elevated blood sugar damages the delicate blood vessels in the retina. Early detection via fundus screening allows effective treatment before irreversible vision loss occurs.
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px 18px",
                    background: "var(--vadr-surface-muted)",
                    border: "1px solid var(--vadr-border)",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 750, color: "var(--vadr-text)", marginBottom: 6 }}>
                    Key Prevention Guidelines
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--vadr-text-secondary)", lineHeight: 1.6 }}>
                    <li>Maintain blood sugar within your target HbA1c range.</li>
                    <li>Control blood pressure and lipid levels.</li>
                    <li>Schedule a dilated retinal exam at least once every 12 months.</li>
                  </ul>
                </div>

                <div
                  style={{
                    padding: "16px 18px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 750, color: "#991b1b", marginBottom: 6 }}>
                    Urgent Warning Signs
                  </div>
                  <div style={{ fontSize: 12.5, color: "#991b1b", lineHeight: 1.55 }}>
                    Contact your eye doctor immediately if you experience sudden blurry vision, new floaters, dark spots in your visual field, or flashes of light.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
