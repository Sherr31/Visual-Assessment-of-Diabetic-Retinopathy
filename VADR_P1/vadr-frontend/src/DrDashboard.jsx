import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  Eye, Search, User, AlertTriangle, CheckCircle2,
  XCircle, Info, Upload, Check, PlusCircle, RefreshCw,
  Clock, ShieldAlert, ArrowUpRight, X, FileText,
  LogOut, Layers, ShieldCheck
} from "lucide-react";
import "./vadr-dashboard.css";
import "./vadr-theme.css";
import ThemeToggle from "./components/ThemeToggle";
import { dashboardAPI, authAPI, getStoredUser, clearSession } from "./api";

/* ═══════════════════════════════════════════
   CLINICAL SEVERITY CONFIGURATION & PALETTES
═══════════════════════════════════════════ */
const SEVERITY_CONFIG = {
  "No DR": {
    label: "No DR",
    fullLabel: "No Diabetic Retinopathy",
    risk: "Low Risk",
    badgeBg: "rgba(16, 185, 129, 0.1)",
    badgeBorder: "rgba(16, 185, 129, 0.25)",
    badgeText: "#059669",
    color: "#10b981",
    barColor: "#10b981",
    icon: CheckCircle2,
  },
  "Mild": {
    label: "Mild",
    fullLabel: "Mild NPDR",
    risk: "Early Stage",
    badgeBg: "rgba(14, 165, 233, 0.1)",
    badgeBorder: "rgba(14, 165, 233, 0.25)",
    badgeText: "#0284c7",
    color: "#0ea5e9",
    barColor: "#0ea5e9",
    icon: Info,
  },
  "Moderate": {
    label: "Moderate",
    fullLabel: "Moderate NPDR",
    risk: "Moderate Risk",
    badgeBg: "rgba(245, 158, 11, 0.1)",
    badgeBorder: "rgba(245, 158, 11, 0.25)",
    badgeText: "#d97706",
    color: "#f59e0b",
    barColor: "#f59e0b",
    icon: AlertTriangle,
  },
  "Severe": {
    label: "Severe",
    fullLabel: "Severe NPDR",
    risk: "High Vision Risk",
    badgeBg: "rgba(239, 68, 68, 0.1)",
    badgeBorder: "rgba(239, 68, 68, 0.28)",
    badgeText: "#dc2626",
    color: "#ef4444",
    barColor: "#ef4444",
    icon: ShieldAlert,
  },
  "Proliferative": {
    label: "Proliferative DR",
    fullLabel: "Proliferative DR",
    risk: "Critical Vision Risk",
    badgeBg: "rgba(168, 85, 247, 0.1)",
    badgeBorder: "rgba(168, 85, 247, 0.28)",
    badgeText: "#9333ea",
    color: "#a855f7",
    barColor: "#a855f7",
    icon: XCircle,
  },
  "Proliferative DR": {
    label: "Proliferative DR",
    fullLabel: "Proliferative DR",
    risk: "Critical Vision Risk",
    badgeBg: "rgba(168, 85, 247, 0.1)",
    badgeBorder: "rgba(168, 85, 247, 0.28)",
    badgeText: "#9333ea",
    color: "#a855f7",
    barColor: "#a855f7",
    icon: XCircle,
  },
};

const HIGH_SEVERITY_SET = new Set(["Severe", "Proliferative DR", "Proliferative"]);

function getSeverityDetails(name) {
  return SEVERITY_CONFIG[name] || SEVERITY_CONFIG["No DR"];
}

/* ═══════════════════════════════════════════
   MAIN SYSTEM DASHBOARD
═══════════════════════════════════════════ */
export default function DrDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Instant high-severity modal state
  const [instantModalScan, setInstantModalScan] = useState(null);
  
  // Track seen scan IDs in current session to prevent modal spam
  const seenScanIds = useRef(new Set());
  const isInitialLoad = useRef(true);

  const user = getStoredUser();

  // ─── Fetch real summary data from MongoDB API ───
  const fetchSummary = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      setError(null);
      const res = await dashboardAPI.getSummary();
      const data = res?.data || res;
      setSummary(data);

      const scans = data?.recentScans || [];

      // Check for newly detected high-severity scans during polling
      if (!isInitialLoad.current && scans.length > 0) {
        const newlyArrivedSevere = scans.find(
          s => HIGH_SEVERITY_SET.has(s.prediction) && !seenScanIds.current.has(s.id) && !s.reviewed
        );
        if (newlyArrivedSevere) {
          setInstantModalScan(newlyArrivedSevere);
        }
      }

      // Record incoming scan IDs into session set
      scans.forEach(s => seenScanIds.current.add(s.id));
      isInitialLoad.current = false;
    } catch (err) {
      console.error("Dashboard API error:", err);
      if (!isPolling) {
        setError(err.message || "Failed to synchronize with clinical backend.");
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, []);

  // Mount + 15 second auto-refresh
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

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    clearSession();
    navigate("/login");
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
      (statusFilter === "reviewed" && s.reviewed);

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
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--vadr-bg)",
        color: "var(--vadr-text)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ═══════════════════════════════════════════
          LEFT NAVIGATION SIDEBAR (MEDICAL SAAS)
      ═══════════════════════════════════════════ */}
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: "var(--vadr-surface)",
          borderRight: "1px solid var(--vadr-border)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 100,
        }}
      >
        {/* Top Branding */}
        <div>
          <div
            style={{
              padding: "20px 20px 18px",
              borderBottom: "1px solid var(--vadr-border)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "linear-gradient(135deg, #1a56db 0%, #0891b2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: "0 2px 6px rgba(26, 86, 219, 0.25)",
                flexShrink: 0,
              }}
            >
              <Eye size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "var(--vadr-text)",
                  lineHeight: 1.1,
                }}
              >
                VADR Clinical
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--vadr-text-muted)",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                Ophthalmic SaaS
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <div style={{ padding: "14px 10px" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--vadr-text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "6px 10px 4px",
              }}
            >
              Clinical Operations
            </div>

            <nav style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              <Link
                to="/dashboard"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  background: "var(--vadr-primary-soft)",
                  color: "var(--vadr-primary)",
                  border: "1px solid var(--vadr-primary-border)",
                }}
              >
                <Layers size={16} />
                <span>Overview</span>
              </Link>

              <Link
                to="/fundus-analysis"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: "var(--vadr-text-secondary)",
                  transition: "background 0.15s ease",
                }}
              >
                <Eye size={16} />
                <span>Screenings</span>
              </Link>

              <Link
                to="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: "var(--vadr-text-secondary)",
                  transition: "background 0.15s ease",
                }}
              >
                <User size={16} />
                <span>Patients</span>
              </Link>
            </nav>

            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--vadr-text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "16px 10px 4px",
              }}
            >
              Administration
            </div>

            <nav style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              <Link
                to="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: "var(--vadr-text-secondary)",
                }}
              >
                <ShieldCheck size={16} />
                <span>User &amp; Access Control</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer — User & Logout */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid var(--vadr-border)",
            background: "var(--vadr-surface-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--vadr-primary-soft)",
                  border: "1px solid var(--vadr-primary-border)",
                  color: "var(--vadr-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {user?.name ? user.name[0].toUpperCase() : "D"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--vadr-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user?.name || "Staff Member"}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--vadr-text-muted)",
                    textTransform: "capitalize",
                  }}
                >
                  {user?.role || "Doctor"}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Log out"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--vadr-text-muted)",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          RIGHT MAIN WORKSPACE
      ═══════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        
        {/* Top Header Bar */}
        <header
          style={{
            height: 60,
            background: "var(--vadr-surface)",
            borderBottom: "1px solid var(--vadr-border)",
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 90,
          }}
        >
          {/* Header Left: Title */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--vadr-text)", letterSpacing: "-0.01em" }}>
              Clinical Overview
            </div>
            <div style={{ fontSize: 11.5, color: "var(--vadr-text-muted)", marginTop: 1 }}>
              Monitor retinal screenings and review high-risk cases
            </div>
          </div>

          {/* Header Right: Controls & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Live Sync Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                fontWeight: 600,
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

            {/* Manual Sync Button */}
            <button
              onClick={() => fetchSummary(false)}
              disabled={loading}
              title="Synchronize real-time data"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--vadr-surface-muted)",
                border: "1px solid var(--vadr-border)",
                borderRadius: 8,
                padding: "6px 11px",
                color: "var(--vadr-text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={13} className={loading ? "spin-animation" : ""} />
              <span>Sync</span>
            </button>

            {/* Quick Action: Register Case */}
            <Link
              to="/"
              id="quick-action-register-case"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 13px",
                borderRadius: 8,
                background: "var(--vadr-surface-muted)",
                border: "1px solid var(--vadr-border)",
                color: "var(--vadr-text)",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <PlusCircle size={14} color="var(--vadr-primary)" />
              <span>Register Case</span>
            </Link>

            {/* Quick Action: Run Upload */}
            <Link
              to="/fundus-analysis"
              id="quick-action-run-upload"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 13px",
                borderRadius: 8,
                background: "var(--vadr-primary)",
                border: "1px solid var(--vadr-primary)",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(26, 86, 219, 0.2)",
              }}
            >
              <Upload size={14} />
              <span>Run Upload</span>
            </Link>

            <ThemeToggle />
          </div>
        </header>

        {/* ── Scrollable Dashboard Canvas ── */}
        <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
          
          {/* Error Banner */}
          {error && (
            <div
              style={{
                background: "var(--vadr-error-bg)",
                border: "1px solid var(--vadr-error-border)",
                borderRadius: 10,
                padding: "12px 16px",
                color: "var(--vadr-error-text)",
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
              <button
                onClick={() => fetchSummary(false)}
                style={{
                  background: "var(--vadr-error-text)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* ────────── SECTION 1 — KPI SUMMARY CARDS ────────── */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
            
            {/* Card 1: Today's Uploads */}
            <div
              style={{
                background: "var(--vadr-surface)",
                border: "1px solid var(--vadr-border)",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Today's Uploads
                </span>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "var(--vadr-info-bg)",
                    color: "var(--vadr-info-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Upload size={15} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--vadr-text)", lineHeight: 1.1 }}>
                  {loading ? "…" : dailyUploads}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--vadr-text-muted)", marginTop: 4 }}>
                  Screenings received today
                </div>
              </div>
            </div>

            {/* Card 2: Pending Reviews */}
            <div
              style={{
                background: "var(--vadr-surface)",
                border: `1px solid ${pendingReviews > 0 ? "var(--vadr-warning-border)" : "var(--vadr-border)"}`,
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Pending Reviews
                </span>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "var(--vadr-warning-bg)",
                    color: "var(--vadr-warning-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Clock size={15} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: pendingReviews > 0 ? "var(--vadr-warning-text)" : "var(--vadr-text)",
                    lineHeight: 1.1,
                  }}
                >
                  {loading ? "…" : pendingReviews}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--vadr-text-muted)", marginTop: 4 }}>
                  {pendingReviews === 0 ? "All verified" : "Awaiting clinical sign-off"}
                </div>
              </div>
            </div>

            {/* Card 3: High-Severity Cases */}
            <div
              style={{
                background: "var(--vadr-surface)",
                border: `1px solid ${highSeverityCount > 0 ? "var(--vadr-error-border)" : "var(--vadr-border)"}`,
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  High-Severity Cases
                </span>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "var(--vadr-error-bg)",
                    color: "var(--vadr-error-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldAlert size={15} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: highSeverityCount > 0 ? "var(--vadr-error-text)" : "var(--vadr-text)",
                    lineHeight: 1.1,
                  }}
                >
                  {loading ? "…" : highSeverityCount}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--vadr-text-muted)", marginTop: 4 }}>
                  Severe &amp; Proliferative DR
                </div>
              </div>
            </div>

            {/* Card 4: Total Patients */}
            <div
              style={{
                background: "var(--vadr-surface)",
                border: "1px solid var(--vadr-border)",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Total Patients
                </span>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "var(--vadr-primary-soft)",
                    color: "var(--vadr-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User size={15} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--vadr-text)", lineHeight: 1.1 }}>
                  {loading ? "…" : totalPatients}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--vadr-text-muted)", marginTop: 4 }}>
                  Active registered cohort
                </div>
              </div>
            </div>

          </section>

          {/* ────────── SECTION 2 — REQUIRES CLINICAL ATTENTION (IF APPLICABLE) ────────── */}
          {highSevAlert && (
            <section
              style={{
                background: "var(--vadr-surface)",
                border: "1px solid var(--vadr-error-border)",
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "var(--vadr-error-bg)",
                    color: "var(--vadr-error-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--vadr-error-text)" }}>
                      Requires Clinical Attention: {highSevAlert.prediction}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: 10,
                        background: "var(--vadr-error-text)",
                        color: "#fff",
                      }}
                    >
                      PRIORITY
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--vadr-text-secondary)", marginTop: 2 }}>
                    Patient: <b>{highSevAlert.patientName || "Unlinked Patient"}</b> ({highSevAlert.patientId || "No ID"}) • Confidence:{" "}
                    <b>{highSevAlert.confidence ? `${highSevAlert.confidence.toFixed(1)}%` : "N/A"}</b> • Time:{" "}
                    {highSevAlert.createdAt ? new Date(highSevAlert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {highSevAlert.patientId && (
                  <Link
                    to={`/medical-history/${highSevAlert.patientId}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      borderRadius: 7,
                      border: "1px solid var(--vadr-border)",
                      background: "var(--vadr-surface-muted)",
                      color: "var(--vadr-text)",
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    <FileText size={13} />
                    <span>View History</span>
                  </Link>
                )}
                <button
                  onClick={(e) => handleReview(highSevAlert.id, e)}
                  disabled={reviewingId === highSevAlert.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 14px",
                    borderRadius: 7,
                    background: "var(--vadr-error-text)",
                    border: "none",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Check size={13} />
                  <span>{reviewingId === highSevAlert.id ? "Saving…" : "Mark Reviewed"}</span>
                </button>
              </div>
            </section>
          )}

          {/* ────────── SECTION 3 — ANALYTICS (2 COLUMNS) ────────── */}
          <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 20 }}>
            
            {/* Left: Screening Activity 7-day Area Chart */}
            <div
              style={{
                background: "var(--vadr-surface)",
                border: "1px solid var(--vadr-border)",
                borderRadius: 12,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--vadr-text)" }}>
                    Screening Activity
                  </div>
                  <div style={{ fontSize: 12, color: "var(--vadr-text-muted)" }}>
                    Daily retinal screenings over the last 7 days
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "var(--vadr-surface-muted)",
                    color: "var(--vadr-text-secondary)",
                    border: "1px solid var(--vadr-border)",
                  }}
                >
                  Past 7 Days
                </span>
              </div>

              <div style={{ width: "100%", height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CHART_TREND_DATA} margin={{ top: 8, right: 10, bottom: 0, left: -22 }}>
                    <defs>
                      <linearGradient id="vadrAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1a56db" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#1a56db" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--vadr-border)" vertical={false} />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: "var(--vadr-text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--vadr-text-muted)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--vadr-surface)",
                        border: "1px solid var(--vadr-border)",
                        borderRadius: 8,
                        fontSize: 12,
                        boxShadow: "0 4px 12px var(--vadr-shadow)",
                      }}
                      labelStyle={{ color: "var(--vadr-text)", fontWeight: 700 }}
                      formatter={(val) => [`${val} Screenings`, "Uploads"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="uploads"
                      stroke="#1a56db"
                      strokeWidth={2}
                      fill="url(#vadrAreaGrad)"
                      dot={{ fill: "#1a56db", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: DR Severity Distribution (Clean Horizontal Breakdown) */}
            <div
              style={{
                background: "var(--vadr-surface)",
                border: "1px solid var(--vadr-border)",
                borderRadius: 12,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--vadr-text)" }}>
                    DR Severity Distribution
                  </div>
                  <div style={{ fontSize: 12, color: "var(--vadr-text-muted)" }}>
                    Clinical classification breakdown
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "var(--vadr-surface-muted)",
                    color: "var(--vadr-text-secondary)",
                    border: "1px solid var(--vadr-border)",
                  }}
                >
                  {recentScans.length} Total
                </span>
              </div>

              {/* Clean Horizontal Distribution List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {DIST_DATA.map((item) => (
                  <div key={item.name} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: "var(--vadr-text)" }}>{item.fullLabel}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, color: item.color }}>{item.count}</span>
                        <span style={{ color: "var(--vadr-text-muted)", fontSize: 11 }}>({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Progress Track */}
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: "var(--vadr-surface-muted)",
                        border: "1px solid var(--vadr-border)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(parseFloat(item.percentage), item.count > 0 ? 3 : 0)}%`,
                          background: item.color,
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </section>

          {/* ────────── SECTION 4 — RECENT SCREENINGS FEED TABLE ────────── */}
          <section
            style={{
              background: "var(--vadr-surface)",
              border: "1px solid var(--vadr-border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Table Controls Header */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--vadr-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--vadr-text)" }}>
                  Recent Screenings
                </div>
                <div style={{ fontSize: 12, color: "var(--vadr-text-muted)" }}>
                  Latest retinal assessments
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative" }}>
                  <Search
                    size={13}
                    color="var(--vadr-text-muted)"
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="text"
                    placeholder="Search patient, ID, result…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: "1px solid var(--vadr-border)",
                      borderRadius: 7,
                      padding: "6px 10px 6px 30px",
                      fontSize: 12,
                      color: "var(--vadr-text)",
                      background: "var(--vadr-input-bg)",
                      outline: "none",
                      width: 200,
                    }}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    border: "1px solid var(--vadr-border)",
                    borderRadius: 7,
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "var(--vadr-text)",
                    background: "var(--vadr-input-bg)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Review</option>
                  <option value="reviewed">Verified</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "var(--vadr-surface-muted)", borderBottom: "1px solid var(--vadr-border)" }}>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Screening ID</th>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Patient</th>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Result</th>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Confidence</th>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Reviewer</th>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Time</th>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "10px 18px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--vadr-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && recentScans.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 36, textAlign: "center", color: "var(--vadr-text-muted)" }}>
                        <RefreshCw size={18} className="spin-animation" style={{ margin: "0 auto 8px" }} />
                        <div>Loading clinical screenings from database…</div>
                      </td>
                    </tr>
                  ) : filteredScans.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 36, textAlign: "center", color: "var(--vadr-text-muted)" }}>
                        {searchQuery || statusFilter !== "all" ? (
                          <div>No screenings match your search filters.</div>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--vadr-text)", marginBottom: 2 }}>No screenings recorded yet</div>
                            <div style={{ fontSize: 12 }}>Upload a fundus image in the Fundus Analysis module to view live results.</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredScans.map((s) => {
                      const cfg = getSeverityDetails(s.prediction);
                      const dateFormatted = s.createdAt
                        ? new Date(s.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                        : "—";

                      return (
                        <tr
                          key={s.id}
                          style={{
                            borderBottom: "1px solid var(--vadr-border)",
                            transition: "background 0.1s ease",
                          }}
                        >
                          {/* Screening ID */}
                          <td style={{ padding: "12px 18px", fontFamily: "monospace", fontSize: 12, color: "var(--vadr-primary)", fontWeight: 700 }}>
                            {s.id ? s.id.slice(0, 8) : "—"}…
                          </td>

                          {/* Patient */}
                          <td style={{ padding: "12px 18px" }}>
                            {s.patientId ? (
                              <Link
                                to={`/medical-history/${s.patientId}`}
                                style={{
                                  color: "var(--vadr-text)",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                title="View patient medical history"
                              >
                                <span>{s.patientName || s.patientId}</span>
                                <ArrowUpRight size={11} color="var(--vadr-primary)" />
                              </Link>
                            ) : (
                              <span style={{ color: "var(--vadr-text-muted)", fontStyle: "italic", fontSize: 12 }}>
                                Unlinked
                              </span>
                            )}
                            {s.patientId && s.patientName && (
                              <div style={{ fontSize: 10.5, color: "var(--vadr-text-muted)", fontFamily: "monospace" }}>
                                {s.patientId}
                              </div>
                            )}
                          </td>

                          {/* Result / Severity Badge */}
                          <td style={{ padding: "12px 18px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                background: cfg.badgeBg,
                                border: `1px solid ${cfg.badgeBorder}`,
                                color: cfg.badgeText,
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: 11.5,
                                fontWeight: 700,
                              }}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.badgeText }} />
                              {s.prediction || "No DR"}
                            </span>
                          </td>

                          {/* Confidence */}
                          <td style={{ padding: "12px 18px", fontWeight: 600, color: "var(--vadr-text)" }}>
                            {typeof s.confidence === "number" ? `${s.confidence.toFixed(1)}%` : "—"}
                          </td>

                          {/* Reviewer / Doctor */}
                          <td style={{ padding: "12px 18px", color: "var(--vadr-text-secondary)", fontSize: 12 }}>
                            {s.doctor || "Dr. Staff"}
                          </td>

                          {/* Time */}
                          <td style={{ padding: "12px 18px", color: "var(--vadr-text-muted)", fontSize: 12 }}>
                            {dateFormatted}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "12px 18px" }}>
                            {s.reviewed ? (
                              <span style={{ fontSize: 11.5, color: "var(--vadr-success-text)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <CheckCircle2 size={13} /> Verified
                              </span>
                            ) : (
                              <span style={{ fontSize: 11.5, color: "var(--vadr-warning-text)", fontWeight: 600 }}>
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td style={{ padding: "12px 18px", textAlign: "right" }}>
                            {s.reviewed ? (
                              <span style={{ fontSize: 11, color: "var(--vadr-text-muted)" }}>Completed</span>
                            ) : (
                              <button
                                onClick={(e) => handleReview(s.id, e)}
                                disabled={reviewingId === s.id}
                                style={{
                                  fontSize: 11.5,
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  background: "var(--vadr-primary-soft)",
                                  border: "1px solid var(--vadr-primary-border)",
                                  color: "var(--vadr-primary)",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                {reviewingId === s.id ? "Saving…" : "Mark Reviewed"}
                              </button>
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

          <div style={{ height: 20 }} />
        </main>
      </div>

      {/* ═══════════════════════════════════════════
          HIGH PRIORITY REVIEW MODAL (CLINICAL SAAS)
      ═══════════════════════════════════════════ */}
      {instantModalScan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinical-alert-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--vadr-modal-backdrop)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--vadr-surface)",
              border: "1px solid var(--vadr-error-border)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 40px var(--vadr-shadow-lg)",
              color: "var(--vadr-text)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "var(--vadr-error-bg)",
                    color: "var(--vadr-error-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <div id="clinical-alert-title" style={{ fontSize: 15, fontWeight: 800, color: "var(--vadr-error-text)" }}>
                    HIGH PRIORITY REVIEW
                  </div>
                  <div style={{ fontSize: 12, color: "var(--vadr-text-muted)" }}>
                    Severe / Proliferative DR Detected
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInstantModalScan(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--vadr-text-muted)",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                background: "var(--vadr-surface-muted)",
                border: "1px solid var(--vadr-border)",
                borderRadius: 8,
                padding: "14px 16px",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vadr-text)", marginBottom: 8 }}>
                A newly processed screening has been classified as <b>{instantModalScan.prediction}</b>.
              </div>
              <div style={{ fontSize: 12, color: "var(--vadr-text-secondary)", display: "flex", flexDirection: "column", gap: 3 }}>
                <div>Patient / Case: <b>{instantModalScan.patientName || "Unlinked Patient"}</b> ({instantModalScan.patientId || "No ID"})</div>
                <div>Screening ID: <code style={{ fontFamily: "monospace", color: "var(--vadr-primary)" }}>{instantModalScan.id}</code></div>
                <div>Confidence Score: <b>{instantModalScan.confidence ? `${instantModalScan.confidence.toFixed(1)}%` : "N/A"}</b></div>
                <div>Time Detected: {instantModalScan.createdAt ? new Date(instantModalScan.createdAt).toLocaleTimeString() : "Just now"}</div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setInstantModalScan(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  background: "transparent",
                  border: "1px solid var(--vadr-border)",
                  color: "var(--vadr-text)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>

              {instantModalScan.patientId && (
                <Link
                  to={`/medical-history/${instantModalScan.patientId}`}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 7,
                    background: "var(--vadr-primary-soft)",
                    border: "1px solid var(--vadr-primary-border)",
                    color: "var(--vadr-primary)",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  View Patient History
                </Link>
              )}

              <button
                onClick={(e) => handleReview(instantModalScan.id, e)}
                disabled={reviewingId === instantModalScan.id}
                style={{
                  padding: "8px 16px",
                  borderRadius: 7,
                  background: "var(--vadr-error-text)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {reviewingId === instantModalScan.id ? "Saving…" : "Verify & Mark Reviewed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation style */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
