import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart
} from "recharts";
import {
  Search, CheckCircle2,
  XCircle, Info, Upload, Check, PlusCircle, RefreshCw,
  Clock, ShieldAlert, ArrowUpRight, X, FileText,
  AlertTriangle, HeartPulse
} from "lucide-react";
import RoleSidebar from "../../components/layout/RoleSidebar";
import ThemeToggle from "../../components/ThemeToggle";
import { dashboardAPI, reportAPI } from "../../api";
import DoctorSignOffModal from "../../components/reports/DoctorSignOffModal";
import "../../vadr-dashboard.css";
import "../../vadr-theme.css";

/* ═══════════════════════════════════════════
   CLINICAL SEVERITY CONFIGURATION & PALETTES
   ═══════════════════════════════════════════ */
const SEVERITY_CONFIG = {
  "No DR": {
    label: "No DR",
    fullLabel: "No Diabetic Retinopathy",
    risk: "Low Risk",
    badgeClass: "vadr-badge--no-dr",
    color: "#10b981",
    barColor: "#10b981",
    icon: CheckCircle2,
  },
  "Mild": {
    label: "Mild",
    fullLabel: "Mild NPDR",
    risk: "Early Stage",
    badgeClass: "vadr-badge--mild",
    color: "#0ea5e9",
    barColor: "#0ea5e9",
    icon: Info,
  },
  "Moderate": {
    label: "Moderate",
    fullLabel: "Moderate NPDR",
    risk: "Moderate Risk",
    badgeClass: "vadr-badge--moderate",
    color: "#f59e0b",
    barColor: "#f59e0b",
    icon: AlertTriangle,
  },
  "Severe": {
    label: "Severe",
    fullLabel: "Severe NPDR",
    risk: "High Vision Risk",
    badgeClass: "vadr-badge--severe",
    color: "#ef4444",
    barColor: "#ef4444",
    icon: ShieldAlert,
  },
  "Proliferative": {
    label: "Proliferative DR",
    fullLabel: "Proliferative DR",
    risk: "Critical Vision Risk",
    badgeClass: "vadr-badge--proliferative",
    color: "#a855f7",
    barColor: "#a855f7",
    icon: XCircle,
  },
  "Proliferative DR": {
    label: "Proliferative DR",
    fullLabel: "Proliferative DR",
    risk: "Critical Vision Risk",
    badgeClass: "vadr-badge--proliferative",
    color: "#a855f7",
    barColor: "#a855f7",
    icon: XCircle,
  },
};

const HIGH_SEVERITY_SET = new Set(["Severe", "Proliferative DR", "Proliferative"]);

function getSeverityDetails(name) {
  return SEVERITY_CONFIG[name] || SEVERITY_CONFIG["No DR"];
}

export default function DoctorDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Report Modal states
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedScan, setSelectedScan] = useState(null);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [generatingReportId, setGeneratingReportId] = useState(null);

  const handleOpenSignModal = async (scan) => {
    if (!scan?.id) return;
    setGeneratingReportId(scan.id);
    try {
      const rpt = await reportAPI.generateReport(scan.id);
      setSelectedReport(rpt);
      setSelectedScan(scan);
      setSignModalOpen(true);
    } catch (err) {
      alert(err.message || "Failed to generate report for screening");
    } finally {
      setGeneratingReportId(null);
    }
  };

  // Instant modal for severe scans arriving during live polling
  const [instantModalScan, setInstantModalScan] = useState(null);
  const seenScanIds = useRef(new Set());
  const isInitialLoad = useRef(true);

  // ─── Fetch real summary data from MongoDB API ───
  const fetchSummary = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      setError(null);
      const res = await dashboardAPI.getSummary();
      const data = res?.data !== undefined ? res.data : res;
      setSummary(data);

      const scans = data?.recentScans || [];

      // Modal trigger for severe cases arriving during polling
      if (!isInitialLoad.current && scans.length > 0) {
        const newlyArrivedSevere = scans.find(
          (s) => HIGH_SEVERITY_SET.has(s.prediction) && !seenScanIds.current.has(s.id) && !s.reviewed
        );
        if (newlyArrivedSevere) {
          setInstantModalScan(newlyArrivedSevere);
        }
      }

      scans.forEach((s) => seenScanIds.current.add(s.id));
      isInitialLoad.current = false;
    } catch (err) {
      console.error("Doctor dashboard API error:", err);
      if (!isPolling) {
        setError(err.message || "Failed to synchronize with clinical backend.");
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(false);
    const interval = setInterval(() => {
      fetchSummary(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  // Keyboard shortcut (Escape closes modal)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && instantModalScan) {
        setInstantModalScan(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [instantModalScan]);

  // ─── Mark Screening as Reviewed (PATCH) ───
  const handleReview = async (screeningId, e) => {
    if (e) e.stopPropagation();
    if (!screeningId || reviewingId) return;
    setReviewingId(screeningId);
    try {
      await dashboardAPI.markReviewed(screeningId);
      if (instantModalScan?.id === screeningId) {
        setInstantModalScan(null);
      }
      await fetchSummary(true);
    } catch (err) {
      console.error("Failed to mark screening as reviewed:", err);
    } finally {
      setReviewingId(null);
    }
  };

  // Extract real KPI data
  const kpis = summary?.kpis || {};
  const dailyUploads = kpis.dailyUploads ?? summary?.dailyUploads ?? 0;
  const pendingReviews = kpis.pendingReviews ?? summary?.pendingReviews ?? 0;
  const highSeverityCount = kpis.highSeverityCount ?? 0;
  const totalPatients = kpis.totalPatients ?? 0;
  const highSevAlert = summary?.highSeverityAlert || null;
  const recentScans = summary?.recentScans || [];
  const severityDist = summary?.severityDistribution || {};
  const dailyUploadsTrend = summary?.dailyUploadsTrend || [];

  // Filter scans
  const filteredScans = recentScans.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.patientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.prediction?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && !s.reviewed) ||
      (statusFilter === "reviewed" && s.reviewed) ||
      (statusFilter === "high_severity" && HIGH_SEVERITY_SET.has(s.prediction));

    return matchesSearch && matchesStatus;
  });

  // 7-day upload trend chart dataset
  const CHART_TREND_DATA = dailyUploadsTrend.length > 0 ? dailyUploadsTrend : [
    { day: "Mon", displayDate: "Mon", uploads: 0 },
    { day: "Tue", displayDate: "Tue", uploads: 0 },
    { day: "Wed", displayDate: "Wed", uploads: 0 },
    { day: "Thu", displayDate: "Thu", uploads: 0 },
    { day: "Fri", displayDate: "Fri", uploads: 0 },
    { day: "Sat", displayDate: "Sat", uploads: 0 },
    { day: "Today", displayDate: "Today", uploads: dailyUploads },
  ];

  // DR Severity distribution dataset
  const SEVERITY_CLASSES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"];
  const totalDistributionCount = Object.values(severityDist).reduce((a, b) => a + b, 0) || recentScans.length || 1;

  const DIST_DATA = SEVERITY_CLASSES.map((className) => {
    const count = className === "Proliferative DR"
      ? (severityDist["Proliferative DR"] || 0) + (severityDist["Proliferative"] || 0)
      : (severityDist[className] || 0);
    const cfg = getSeverityDetails(className);
    const percentage = totalDistributionCount > 0 ? ((count / totalDistributionCount) * 100).toFixed(1) : "0.0";
    return {
      name: className,
      count,
      percentage,
      color: cfg.barColor,
      label: cfg.label,
      fullLabel: cfg.fullLabel,
      risk: cfg.risk,
    };
  });

  return (
    <div className="vadr-dash-container">
      <RoleSidebar activeTab="dashboard" />

      {/* Main Workspace */}
      <div className="vadr-dash-main">
        {/* Top Header Bar */}
        <header className="vadr-dash-header">
          <div>
            <h1 className="vadr-header-title">Clinical Review &amp; Assessment Workstation</h1>
            <div className="vadr-header-subtitle">
              Verify AI classification grades, track diabetic retinopathy progression, and review high-risk scans
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--vadr-success-text)",
                background: "var(--vadr-success-bg)",
                border: "1px solid var(--vadr-success-border)",
                padding: "4px 10px",
                borderRadius: 20,
              }}
            >
              <span className="vadr-status-dot" style={{ width: 6, height: 6 }} />
              <span>Live Sync (15s)</span>
            </div>

            <button
              onClick={() => fetchSummary(false)}
              disabled={loading}
              title="Synchronize real-time data"
              className="vadr-btn vadr-btn-secondary"
              style={{ padding: "6px 11px", fontSize: 12 }}
            >
              <RefreshCw size={13} className={loading ? "spin-animation" : ""} />
              <span>Sync</span>
            </button>

            <Link
              to="/doctor/patients"
              className="vadr-btn vadr-btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              <PlusCircle size={14} color="var(--vadr-primary)" />
              <span>Register Patient</span>
            </Link>

            <Link
              to="/fundus-analysis"
              className="vadr-btn vadr-btn-primary"
              style={{ padding: "6px 13px", fontSize: 12 }}
            >
              <Upload size={14} />
              <span>Fundus Analysis</span>
            </Link>

            <ThemeToggle />
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
                onClick={() => fetchSummary(false)}
                className="vadr-btn vadr-btn-danger"
                style={{ padding: "4px 10px", fontSize: 11.5 }}
              >
                Retry
              </button>
            </div>
          )}

          {/* 1. High-Severity Attention Alert Ribbon */}
          {highSevAlert && highSevAlert.unreviewedCount > 0 && (
            <div className="vadr-alert-banner">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#fee2e2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#dc2626",
                    flexShrink: 0,
                  }}
                >
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#991b1b" }}>
                    {highSevAlert.unreviewedCount} High-Severity DR Case{highSevAlert.unreviewedCount > 1 ? "s" : ""} Require Clinical Verification
                  </div>
                  <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>
                    Severe NPDR or Proliferative DR detected by neural network. Urgent clinical validation is recommended.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStatusFilter("high_severity")}
                className="vadr-btn vadr-btn-danger"
                style={{ fontSize: 12, padding: "6px 12px" }}
              >
                <span>Filter Urgent Scans</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          )}

          {/* 2. Clinical KPI Cards */}
          <section className="vadr-kpi-grid">
            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Today's Intake</span>
                <div className="vadr-kpi-icon-wrap">
                  <Upload size={16} color="var(--vadr-primary)" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : dailyUploads}</div>
              <div className="vadr-kpi-sub">
                <span>Fundus scans uploaded today</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Awaiting Verification</span>
                <div className="vadr-kpi-icon-wrap">
                  <Clock size={16} color={pendingReviews > 0 ? "var(--dr-moderate-text)" : "var(--vadr-text-muted)"} />
                </div>
              </div>
              <div
                className="vadr-kpi-value"
                style={{ color: pendingReviews > 0 ? "var(--dr-moderate-text)" : "var(--vadr-text)" }}
              >
                {loading && !summary ? "—" : pendingReviews}
              </div>
              <div className="vadr-kpi-sub">
                <span>Requires physician sign-off</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">High-Severity Cases</span>
                <div className="vadr-kpi-icon-wrap">
                  <ShieldAlert size={16} color={highSeverityCount > 0 ? "var(--dr-severe-text)" : "var(--vadr-text-muted)"} />
                </div>
              </div>
              <div
                className="vadr-kpi-value"
                style={{ color: highSeverityCount > 0 ? "var(--dr-severe-text)" : "var(--vadr-text)" }}
              >
                {loading && !summary ? "—" : highSeverityCount}
              </div>
              <div className="vadr-kpi-sub">
                <span>Severe or Proliferative stage</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Assigned Cohort</span>
                <div className="vadr-kpi-icon-wrap">
                  <HeartPulse size={16} color="var(--dr-no-dr-text)" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : totalPatients}</div>
              <div className="vadr-kpi-sub">
                <span>Total registered patients</span>
              </div>
            </div>
          </section>

          {/* 3. Visual Analytics (7-Day Trend + DR Stage Breakdown) */}
          <section className="vadr-analytics-grid">
            {/* 7-Day Trend */}
            <div className="vadr-card">
              <div className="vadr-card-header">
                <div>
                  <h2 className="vadr-card-title">
                    <AreaChart size={15} color="var(--vadr-primary)" />
                    <span>7-Day Screening Activity Trend</span>
                  </h2>
                  <div className="vadr-card-subtitle">
                    Daily fundus scan volume captured across clinical workstations
                  </div>
                </div>
              </div>

              <div className="vadr-card-body">
                <div style={{ width: "100%", height: 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={CHART_TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="doctorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1a56db" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#1a56db" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--vadr-border)" vertical={false} />
                      <XAxis
                        dataKey="displayDate"
                        stroke="var(--vadr-text-muted)"
                        fontSize={11.5}
                        tickLine={false}
                        axisLine={{ stroke: "var(--vadr-border)" }}
                      />
                      <YAxis
                        stroke="var(--vadr-text-muted)"
                        fontSize={11.5}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--vadr-surface)",
                          border: "1px solid var(--vadr-border)",
                          borderRadius: 8,
                          boxShadow: "0 4px 12px var(--vadr-shadow)",
                          fontSize: 12,
                          color: "var(--vadr-text)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="uploads"
                        name="Scans"
                        stroke="#1a56db"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#doctorAreaGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Severity Distribution */}
            <div className="vadr-card">
              <div className="vadr-card-header">
                <div>
                  <h2 className="vadr-card-title">
                    <BarChart size={15} color="var(--vadr-primary)" />
                    <span>DR Severity Breakdown</span>
                  </h2>
                  <div className="vadr-card-subtitle">
                    Distribution of AI-classified retinopathy stages
                  </div>
                </div>
              </div>

              <div className="vadr-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {DIST_DATA.map((item) => {
                  const cfg = getSeverityDetails(item.name);
                  const Icon = cfg.icon;
                  return (
                    <div key={item.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon size={13} color={item.color} />
                          <span style={{ fontWeight: 650, color: "var(--vadr-text)" }}>{item.fullLabel}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ fontWeight: 750, color: "var(--vadr-text)" }}>{item.count}</span>
                          <span style={{ color: "var(--vadr-text-muted)", fontSize: 11 }}>({item.percentage}%)</span>
                        </div>
                      </div>
                      <div
                        style={{
                          height: 6,
                          width: "100%",
                          background: "var(--vadr-surface-muted)",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(Number(item.percentage), item.count > 0 ? 4 : 0)}%`,
                            background: item.color,
                            borderRadius: 3,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 4. Real-time Screening Feed & Verification */}
          <section className="vadr-card">
            <div className="vadr-card-header" style={{ flexWrap: "wrap", gap: 14 }}>
              <div>
                <h2 className="vadr-card-title">
                  <FileText size={15} color="var(--vadr-primary)" />
                  <span>Screening Verification Feed</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Showing {filteredScans.length} of {recentScans.length} total retinal scans in current queue
                </div>
              </div>

              {/* Filter controls & search */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <Search
                    size={14}
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--vadr-text-muted)" }}
                  />
                  <input
                    type="text"
                    placeholder="Search by ID, patient, grade..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="vadr-search-input"
                  />
                </div>

                <div className="vadr-filter-group">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`vadr-filter-btn ${statusFilter === "all" ? "vadr-filter-btn--active" : ""}`}
                  >
                    All ({recentScans.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("pending")}
                    className={`vadr-filter-btn ${statusFilter === "pending" ? "vadr-filter-btn--active" : ""}`}
                  >
                    Pending ({recentScans.filter((s) => !s.reviewed).length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("reviewed")}
                    className={`vadr-filter-btn ${statusFilter === "reviewed" ? "vadr-filter-btn--active" : ""}`}
                  >
                    Reviewed ({recentScans.filter((s) => s.reviewed).length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("high_severity")}
                    className={`vadr-filter-btn ${statusFilter === "high_severity" ? "vadr-filter-btn--active" : ""}`}
                    style={{ color: statusFilter === "high_severity" ? "#dc2626" : undefined }}
                  >
                    High Risk ({recentScans.filter((s) => HIGH_SEVERITY_SET.has(s.prediction)).length})
                  </button>
                </div>
              </div>
            </div>

            <div className="vadr-table-wrap">
              <table className="vadr-table">
                <thead>
                  <tr>
                    <th>Patient Identifier</th>
                    <th>Eye Side</th>
                    <th>AI Classification</th>
                    <th>Confidence</th>
                    <th>Screening Timestamp</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Clinical Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScans.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 36, textAlign: "center", color: "var(--vadr-text-muted)" }}>
                        No screenings match the specified filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredScans.map((scan) => {
                      const cfg = getSeverityDetails(scan.prediction);
                      const Icon = cfg.icon;
                      const isCurrentlyReviewing = reviewingId === scan.id;

                      return (
                        <tr key={scan.id}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 750, color: "var(--vadr-text)" }}>
                                {scan.patientName || scan.patientId || "Anonymous Patient"}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--vadr-text-muted)", fontFamily: "monospace" }}>
                                {scan.patientId || scan.id}
                              </span>
                            </div>
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
                              {scan.eyeSide || "Fundus"}
                            </span>
                          </td>
                          <td>
                            <span className={`vadr-badge ${cfg.badgeClass}`}>
                              <Icon size={12} />
                              <span>{cfg.fullLabel}</span>
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                {typeof scan.confidence === "number" ? `${scan.confidence.toFixed(1)}%` : "—"}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--vadr-text-muted)" }}>
                            {scan.timestamp
                              ? new Date(scan.timestamp).toLocaleString([], {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "—"}
                          </td>
                          <td>
                            {scan.reviewed ? (
                              <span className="vadr-badge vadr-badge--reviewed">
                                <Check size={11} />
                                <span>Reviewed</span>
                              </span>
                            ) : (
                              <span className="vadr-badge vadr-badge--pending">
                                <Clock size={11} />
                                <span>Pending Review</span>
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                              <button
                                onClick={() => handleOpenSignModal(scan)}
                                disabled={generatingReportId === scan.id}
                                className="vadr-btn vadr-btn-secondary"
                                style={{ padding: "4px 9px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}
                                title="Review & Sign Clinical Assessment Report"
                              >
                                <FileText size={12} />
                                <span>{generatingReportId === scan.id ? "..." : "Report"}</span>
                              </button>
                              {!scan.reviewed ? (
                                <button
                                  onClick={(e) => handleReview(scan.id, e)}
                                  disabled={isCurrentlyReviewing}
                                  className="vadr-btn vadr-btn-success"
                                  style={{ padding: "4px 10px", fontSize: 11.5 }}
                                >
                                  {isCurrentlyReviewing ? (
                                    <>
                                      <RefreshCw size={11} className="spin-animation" />
                                      <span>Verifying...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check size={12} />
                                      <span>Verify</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span style={{ fontSize: 11, color: "var(--vadr-text-muted)", fontWeight: 500 }}>
                                  Verified
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* ─── Newly Arrived Severe Case Modal (Polling alert) ─── */}
      {instantModalScan && (
        <div className="vadr-modal-backdrop" onClick={() => setInstantModalScan(null)}>
          <div
            className="vadr-modal"
            style={{ maxWidth: 480, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(220, 38, 38, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#dc2626",
                  }}
                >
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--vadr-text)" }}>
                    Critical Retinal Scan Alert
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--vadr-text-muted)" }}>
                    High-severity diabetic retinopathy flagged by AI classifier
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInstantModalScan(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--vadr-text-muted)",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                background: "var(--vadr-surface-muted)",
                border: "1px solid var(--vadr-border)",
                borderRadius: 8,
                padding: "14px 16px",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                <div>
                  <span style={{ color: "var(--vadr-text-muted)", fontSize: 11, textTransform: "uppercase" }}>Patient</span>
                  <div style={{ fontWeight: 700, color: "var(--vadr-text)" }}>
                    {instantModalScan.patientName || instantModalScan.patientId}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--vadr-text-muted)", fontSize: 11, textTransform: "uppercase" }}>Grade</span>
                  <div style={{ fontWeight: 800, color: "#dc2626" }}>
                    {instantModalScan.prediction}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--vadr-text-muted)", fontSize: 11, textTransform: "uppercase" }}>Confidence</span>
                  <div style={{ fontWeight: 700, color: "var(--vadr-text)" }}>
                    {instantModalScan.confidence ? `${instantModalScan.confidence.toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--vadr-text-muted)", fontSize: 11, textTransform: "uppercase" }}>Eye</span>
                  <div style={{ fontWeight: 700, color: "var(--vadr-text)" }}>
                    {instantModalScan.eyeSide || "Fundus"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setInstantModalScan(null)}
                className="vadr-btn vadr-btn-secondary"
              >
                Dismiss
              </button>
              <button
                onClick={() => handleReview(instantModalScan.id)}
                disabled={reviewingId === instantModalScan.id}
                className="vadr-btn vadr-btn-primary"
              >
                <Check size={14} />
                <span>Verify &amp; Mark Reviewed</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Sign-Off Modal */}
      <DoctorSignOffModal
        isOpen={signModalOpen}
        onClose={() => {
          setSignModalOpen(false);
          setSelectedReport(null);
          setSelectedScan(null);
        }}
        report={selectedReport}
        screening={selectedScan}
        onReportUpdated={(updated) => {
          setSelectedReport(updated);
          fetchSummary(true);
        }}
      />
    </div>
  );
}
