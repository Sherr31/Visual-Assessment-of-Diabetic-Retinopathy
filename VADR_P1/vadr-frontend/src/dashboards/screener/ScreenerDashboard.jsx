import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  Upload, Search,
  RefreshCw,
  Clock,
  AlertTriangle, ArrowRight, UserPlus, FileText, Activity
} from "lucide-react";
import RoleSidebar from "../../components/layout/RoleSidebar";
import ThemeToggle from "../../components/ThemeToggle";
import { dashboardAPI } from "../../api";
import "../../vadr-dashboard.css";
import "../../vadr-theme.css";

const SEVERITY_CONFIG = {
  "No DR": {
    label: "No DR",
    fullLabel: "No Diabetic Retinopathy",
    badgeClass: "vadr-badge--no-dr",
    color: "#10b981",
  },
  "Mild": {
    label: "Mild",
    fullLabel: "Mild NPDR",
    badgeClass: "vadr-badge--mild",
    color: "#0ea5e9",
  },
  "Moderate": {
    label: "Moderate",
    fullLabel: "Moderate NPDR",
    badgeClass: "vadr-badge--moderate",
    color: "#f59e0b",
  },
  "Severe": {
    label: "Severe",
    fullLabel: "Severe NPDR",
    badgeClass: "vadr-badge--severe",
    color: "#ef4444",
  },
  "Proliferative": {
    label: "Proliferative DR",
    fullLabel: "Proliferative DR",
    badgeClass: "vadr-badge--proliferative",
    color: "#a855f7",
  },
  "Proliferative DR": {
    label: "Proliferative DR",
    fullLabel: "Proliferative DR",
    badgeClass: "vadr-badge--proliferative",
    color: "#a855f7",
  },
};

function getSeverityDetails(name) {
  return SEVERITY_CONFIG[name] || SEVERITY_CONFIG["No DR"];
}

export default function ScreenerDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSummary = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      setError(null);
      const res = await dashboardAPI.getSummary();
      const data = res?.data !== undefined ? res.data : res;
      setSummary(data);
    } catch (err) {
      console.error("Screener dashboard sync error:", err);
      if (!isPolling) {
        setError(err.message || "Failed to synchronize screening intake feed.");
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

  const kpis = summary?.kpis || {};
  const dailyUploads = kpis.dailyUploads ?? summary?.dailyUploads ?? 0;
  const pendingReviews = kpis.pendingReviews ?? summary?.pendingReviews ?? 0;
  const totalScreenings = kpis.totalScreenings ?? 0;
  const totalPatients = kpis.totalPatients ?? 0;
  const recentScans = summary?.recentScans || [];
  const dailyUploadsTrend = summary?.dailyUploadsTrend || [];

  const filteredScans = recentScans.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.id?.toLowerCase().includes(q) ||
      s.patientId?.toLowerCase().includes(q) ||
      s.patientName?.toLowerCase().includes(q) ||
      s.prediction?.toLowerCase().includes(q)
    );
  });

  const CHART_TREND_DATA = dailyUploadsTrend.length > 0 ? dailyUploadsTrend : [
    { day: "Mon", displayDate: "Mon", uploads: 0 },
    { day: "Tue", displayDate: "Tue", uploads: 0 },
    { day: "Wed", displayDate: "Wed", uploads: 0 },
    { day: "Thu", displayDate: "Thu", uploads: 0 },
    { day: "Fri", displayDate: "Fri", uploads: 0 },
    { day: "Sat", displayDate: "Sat", uploads: 0 },
    { day: "Today", displayDate: "Today", uploads: dailyUploads },
  ];

  return (
    <div className="vadr-dash-container">
      <RoleSidebar activeTab="dashboard" />

      {/* Main Workspace */}
      <div className="vadr-dash-main">
        {/* Top Header Bar */}
        <header className="vadr-dash-header">
          <div>
            <h1 className="vadr-header-title">Retinal Intake &amp; Screening Workstation</h1>
            <div className="vadr-header-subtitle">
              Capture fundus photographs, run AI classification, and queue scans for ophthalmology review
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
              <span>Intake Ready</span>
            </div>

            <button
              onClick={() => fetchSummary(false)}
              disabled={loading}
              title="Synchronize intake queue"
              className="vadr-btn vadr-btn-secondary"
              style={{ padding: "6px 11px", fontSize: 12 }}
            >
              <RefreshCw size={13} className={loading ? "spin-animation" : ""} />
              <span>Sync</span>
            </button>

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

          {/* 1. Fast Clinical Intake Hero Action Bar */}
          <section
            style={{
              background: "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)",
              borderRadius: 14,
              padding: "24px 28px",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
              boxShadow: "0 4px 14px rgba(30, 58, 138, 0.2)",
            }}
          >
            <div style={{ maxWidth: 640 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85, marginBottom: 4 }}>
                Active Screening Shift
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
                Fundus Photographic Acquisition &amp; Neural Inference
              </div>
              <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
                Acquire Macula/Optic-Disc centered fundus images and obtain real-time diabetic retinopathy classification with Grad-CAM activation heatmaps.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Link
                to="/screener/patients"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "#ffffff",
                  padding: "10px 18px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <UserPlus size={16} />
                <span>Register Patient</span>
              </Link>

              <Link
                to="/fundus-analysis"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#ffffff",
                  color: "#1e3a8a",
                  padding: "10px 20px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                  transition: "all 0.15s ease",
                }}
              >
                <Upload size={16} />
                <span>New Fundus Screening</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>

          {/* 2. Intake Metric Cards */}
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
                <span>Fundus uploads recorded today</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Queued for Review</span>
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
                <span>Awaiting physician verification</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Total Patients</span>
                <div className="vadr-kpi-icon-wrap">
                  <UserPlus size={16} color="var(--dr-no-dr-text)" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : totalPatients}</div>
              <div className="vadr-kpi-sub">
                <span>Registered patient cohort</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Cumulative Scans</span>
                <div className="vadr-kpi-icon-wrap">
                  <FileText size={16} color="var(--vadr-text-muted)" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : totalScreenings}</div>
              <div className="vadr-kpi-sub">
                <span>Processed across system</span>
              </div>
            </div>
          </section>

          {/* 3. 7-Day Intake Activity Trend */}
          <section className="vadr-card">
            <div className="vadr-card-header">
              <div>
                <h2 className="vadr-card-title">
                  <Activity size={15} color="var(--vadr-primary)" />
                  <span>Weekly Screening Volume Trend</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Daily intake submissions over the preceding 7 days
                </div>
              </div>
            </div>

            <div className="vadr-card-body">
              <div style={{ width: "100%", height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CHART_TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="screenerAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0891b2" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0891b2" stopOpacity={0.0} />
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
                      name="Submissions"
                      stroke="#0891b2"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#screenerAreaGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* 4. Recent Upload Submissions Table */}
          <section className="vadr-card">
            <div className="vadr-card-header" style={{ flexWrap: "wrap", gap: 14 }}>
              <div>
                <h2 className="vadr-card-title">
                  <FileText size={15} color="var(--vadr-primary)" />
                  <span>Recent Intake Submissions</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Showing {filteredScans.length} recent fundus acquisitions submitted to neural network
                </div>
              </div>

              <div style={{ position: "relative" }}>
                <Search
                  size={14}
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--vadr-text-muted)" }}
                />
                <input
                  type="text"
                  placeholder="Search patient, ID, grade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="vadr-search-input"
                />
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
                    <th>Submission Timestamp</th>
                    <th>Review State</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScans.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 36, textAlign: "center", color: "var(--vadr-text-muted)" }}>
                        No screening records matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredScans.map((scan) => {
                      const cfg = getSeverityDetails(scan.prediction);

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
                              <span>{cfg.fullLabel}</span>
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                              {typeof scan.confidence === "number" ? `${scan.confidence.toFixed(1)}%` : "—"}
                            </span>
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
                                <span>Verified by Doctor</span>
                              </span>
                            ) : (
                              <span className="vadr-badge vadr-badge--pending">
                                <span>In Doctor Queue</span>
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
        </main>
      </div>
    </div>
  );
}
