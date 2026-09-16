import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  Moon, Sun, Eye, Brain, History, Bell, Search,
  User, Calendar, AlertTriangle, CheckCircle2, XCircle,
  Info, Layers, Upload, BarChart2, FileText,
} from "lucide-react";

/* ═══════════════════════════════════════════
   THEME TOKENS
═══════════════════════════════════════════ */
const DARK = {
  bg:           "#06090f",
  surface:      "#0d1117",
  card:         "#111827",
  cardHover:    "#16202f",
  border:       "#1e2d40",
  text:         "#e2e8f0",
  muted:        "#64748b",
  dim:          "#273549",
  accent:       "#22d3ee",
  accentBg:     "rgba(34,211,238,0.07)",
  accentBorder: "rgba(34,211,238,0.25)",
  success:      "#10b981",
  successBg:    "rgba(16,185,129,0.1)",
  warning:      "#f59e0b",
  warningBg:    "rgba(245,158,11,0.1)",
  danger:       "#ef4444",
  dangerBg:     "rgba(239,68,68,0.1)",
  purple:       "#a78bfa",
  purpleBg:     "rgba(167,139,250,0.1)",
};

const LIGHT = {
  bg:           "#f0f4f8",
  surface:      "#ffffff",
  card:         "#ffffff",
  cardHover:    "#f8fafc",
  border:       "#e2e8f0",
  text:         "#0f172a",
  muted:        "#64748b",
  dim:          "#e2e8f0",
  accent:       "#0891b2",
  accentBg:     "rgba(8,145,178,0.07)",
  accentBorder: "rgba(8,145,178,0.3)",
  success:      "#059669",
  successBg:    "rgba(5,150,105,0.08)",
  warning:      "#d97706",
  warningBg:    "rgba(217,119,6,0.08)",
  danger:       "#dc2626",
  dangerBg:     "rgba(220,38,38,0.08)",
  purple:       "#7c3aed",
  purpleBg:     "rgba(124,58,237,0.08)",
};

/* ═══════════════════════════════════════════
   SEVERITY CONFIG
═══════════════════════════════════════════ */
const SEV = {
  "No DR":         { color: "#10b981", bg: "rgba(16,185,129,0.12)",  icon: CheckCircle2, label: "No Diabetic Retinopathy", risk: "Low"       },
  "Mild":          { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  icon: Info,          label: "Mild NPDR",              risk: "Low–Mod"    },
  "Moderate":      { color: "#fb923c", bg: "rgba(251,146,60,0.12)",  icon: AlertTriangle, label: "Moderate NPDR",          risk: "Moderate"   },
  "Severe":        { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   icon: XCircle,       label: "Severe NPDR",            risk: "High"       },
  "Proliferative": { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", icon: XCircle,       label: "Proliferative DR",       risk: "Very High"  },
};

/* ═══════════════════════════════════════════
   MOCK DATA
═══════════════════════════════════════════ */
const PATIENTS = [
  { id: "P-4821", name: "Muhammad Arham", age: 21, type: "Type 2", last: "Nov 15, 2025" },
  { id: "P-3317", name: "Taha Rehman",   age: 32, type: "Type 1", last: "Nov 10, 2024" },
  { id: "P-5502", name: "Shehryar Rasheed",  age: 50, type: "Type 2", last: "Oct 28, 2026" },
];

const SCANS = [
  { id: "SC-1084", date: "Nov 15, 2024", severity: "Mild",        confidence: 94.2, eye: "Right OD", grade: 1, doctor: "Dr. Chen",   note: "Microaneurysms detected" },
  { id: "SC-0991", date: "Aug 22, 2024", severity: "No DR",       confidence: 98.7, eye: "Left OS",  grade: 0, doctor: "Dr. Chen",   note: "No abnormalities found" },
  { id: "SC-0854", date: "May 10, 2024", severity: "Moderate",    confidence: 91.3, eye: "Right OD", grade: 2, doctor: "Dr. Patel",  note: "Exudates present, monitor" },
  { id: "SC-0720", date: "Feb 18, 2024", severity: "Mild",        confidence: 96.1, eye: "Left OS",  grade: 1, doctor: "Dr. Patel",  note: "Follow-up in 3 months" },
  { id: "SC-0588", date: "Nov 30, 2023", severity: "No DR",       confidence: 99.2, eye: "Right OD", grade: 0, doctor: "Dr. Chen",   note: "Stable, annual review" },
  { id: "SC-0421", date: "Aug 14, 2023", severity: "No DR",       confidence: 97.8, eye: "Left OS",  grade: 0, doctor: "Dr. Santos", note: "No abnormalities found" },
];

const TREND_DATA = [
  { month: "Aug '23", grade: 0, conf: 97.8 },
  { month: "Nov '23", grade: 0, conf: 99.2 },
  { month: "Feb '24", grade: 1, conf: 96.1 },
  { month: "May '24", grade: 2, conf: 91.3 },
  { month: "Aug '24", grade: 0, conf: 98.7 },
  { month: "Nov '24", grade: 1, conf: 94.2 },
];

const DIST_DATA = [
  { name: "No DR",   count: 3, color: "#10b981" },
  { name: "Mild",    count: 2, color: "#f59e0b" },
  { name: "Moderate",count: 1, color: "#fb923c" },
  { name: "Severe",  count: 0, color: "#ef4444" },
  { name: "Prolif.", count: 0, color: "#a78bfa" },
];

/* ═══════════════════════════════════════════
   RETINA SVG COMPONENT
═══════════════════════════════════════════ */
function RetinaSVG({ severity }) {
  const hasLesions = severity !== "No DR";
  const isMod      = ["Moderate", "Severe", "Proliferative"].includes(severity);
  const isAdv      = ["Severe", "Proliferative"].includes(severity);

  return (
    <svg
      viewBox="0 0 300 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <radialGradient id="rBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#7B1818" />
          <stop offset="45%"  stopColor="#5A0F0F" />
          <stop offset="75%"  stopColor="#3D0A0A" />
          <stop offset="100%" stopColor="#1E0505" />
        </radialGradient>
        <radialGradient id="rDisc" cx="40%" cy="40%" r="55%">
          <stop offset="0%"   stopColor="#FFFBF0" />
          <stop offset="55%"  stopColor="#FFE58C" />
          <stop offset="100%" stopColor="#E8B84B" />
        </radialGradient>
        <radialGradient id="rMac" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#100303" />
          <stop offset="100%" stopColor="#2A0707" />
        </radialGradient>
        <clipPath id="rClip">
          <circle cx="150" cy="150" r="144" />
        </clipPath>
      </defs>

      {/* ── Background ── */}
      <circle cx="150" cy="150" r="145" fill="url(#rBg)" />
      <circle cx="150" cy="150" r="95" fill="none" stroke="rgba(110,25,25,0.12)" strokeWidth="38" />

      <g clipPath="url(#rClip)">
        {/* ── Main arcade vessels ── */}
        <path d="M148 148 C170 128,202 103,247 63"  stroke="#9B0000" strokeWidth="2.8" fill="none" opacity="0.85" />
        <path d="M149 150 C173 130,205 106,249 66"  stroke="#C00000" strokeWidth="1.4" fill="none" opacity="0.6" />
        <path d="M200 103 C222 86,246 80,266 88"    stroke="#9B0000" strokeWidth="1.4" fill="none" opacity="0.65" />
        <path d="M220 88  C240 73,258 77,268 84"    stroke="#9B0000" strokeWidth="0.9" fill="none" opacity="0.55" />

        <path d="M148 152 C172 174,206 198,253 240" stroke="#9B0000" strokeWidth="2.8" fill="none" opacity="0.85" />
        <path d="M148 150 C174 172,208 196,255 237" stroke="#C00000" strokeWidth="1.4" fill="none" opacity="0.6" />
        <path d="M205 198 C228 214,252 213,270 205" stroke="#9B0000" strokeWidth="1.4" fill="none" opacity="0.65" />

        <path d="M148 148 C128 128,100 104,63 68"   stroke="#9B0000" strokeWidth="2.2" fill="none" opacity="0.75" />
        <path d="M100 104 C80 87,57 84,38 90"       stroke="#9B0000" strokeWidth="1.2" fill="none" opacity="0.55" />
        <path d="M148 152 C125 174,95 198,58 237"   stroke="#9B0000" strokeWidth="2.2" fill="none" opacity="0.75" />
        <path d="M95  198 C73 214,50 212,36 205"    stroke="#9B0000" strokeWidth="1.2" fill="none" opacity="0.55" />

        <path d="M148 150 C168 148,187 148,197 150" stroke="#9B0000" strokeWidth="1.6" fill="none" opacity="0.65" />

        {/* ── Fine tertiary vessels ── */}
        <path d="M175 117 C189 107,202 107,214 114" stroke="#7A0000" strokeWidth="0.8" fill="none" opacity="0.55" />
        <path d="M180 177 C193 187,207 184,220 177" stroke="#7A0000" strokeWidth="0.8" fill="none" opacity="0.55" />
        <path d="M115 117 C101 107,88 109,80 117"   stroke="#7A0000" strokeWidth="0.8" fill="none" opacity="0.48" />
        <path d="M110 180 C98 190,85 187,76 178"    stroke="#7A0000" strokeWidth="0.8" fill="none" opacity="0.48" />

        {/* ── Microaneurysms & exudates (Mild+) ── */}
        {hasLesions && (
          <>
            <circle cx="188" cy="133" r="2.5" fill="#CC0000" opacity="0.9" />
            <circle cx="172" cy="169" r="2"   fill="#CC0000" opacity="0.85" />
            <circle cx="223" cy="155" r="3"   fill="#990000" opacity="0.8" />
            <circle cx="163" cy="119" r="2"   fill="#CC0000" opacity="0.9" />
            <circle cx="239" cy="139" r="2.5" fill="#CC0000" opacity="0.85" />
            <circle cx="205" cy="177" r="2"   fill="#BB0000" opacity="0.8" />
            {/* Hard exudates */}
            <circle cx="199" cy="143" r="3.5" fill="#FFF8DC" opacity="0.62" />
            <circle cx="214" cy="161" r="2.5" fill="#FFFFF0" opacity="0.58" />
            <circle cx="184" cy="158" r="2"   fill="#FFF8DC" opacity="0.62" />
            <circle cx="229" cy="145" r="2"   fill="#FFFACD" opacity="0.58" />
          </>
        )}

        {/* ── Flame haems & cotton wool (Moderate+) ── */}
        {isMod && (
          <>
            <ellipse cx="170" cy="122" rx="7"  ry="4.5" fill="#7A0000" opacity="0.5" />
            <ellipse cx="229" cy="169" rx="6"  ry="4"   fill="#7A0000" opacity="0.46" />
            <ellipse cx="193" cy="181" rx="5"  ry="3.5" fill="#880000" opacity="0.46" />
            {/* Exudate ring around macula */}
            <circle cx="206" cy="148" r="2.5" fill="#FFFACD" opacity="0.68" />
            <circle cx="209" cy="156" r="2"   fill="#FFF8DC" opacity="0.64" />
            <circle cx="202" cy="157" r="2"   fill="#FFFFF0" opacity="0.64" />
            <circle cx="196" cy="153" r="2"   fill="#FFFACD" opacity="0.64" />
            {/* Cotton wool spots */}
            <ellipse cx="175" cy="132" rx="8"  ry="5.5" fill="rgba(238,238,218,0.38)" />
            <ellipse cx="219" cy="176" rx="7"  ry="4.5" fill="rgba(238,238,218,0.34)" />
          </>
        )}

        {/* ── NVD & pre-retinal haems (Severe / Proliferative) ── */}
        {isAdv && (
          <>
            <path d="M148 145 C137 124,124 114,114 107" stroke="#FF8080" strokeWidth="1.5" fill="none" opacity="0.7" />
            <path d="M114 107 C107 99,107 91,114 87"    stroke="#FF8080" strokeWidth="1"   fill="none" opacity="0.65" />
            <ellipse cx="185" cy="127" rx="14" ry="9"  fill="#660000" opacity="0.5" />
            <ellipse cx="236" cy="173" rx="11" ry="7"  fill="#660000" opacity="0.46" />
            <circle  cx="243" cy="120" r="5"   fill="#880000" opacity="0.62" />
            <circle  cx="178" cy="192" r="4"   fill="#880000" opacity="0.58" />
            <circle  cx="150" cy="150" r="144" fill="rgba(180,60,60,0.04)" />
          </>
        )}
      </g>

      {/* ── Optic disc ── */}
      <circle cx="150" cy="150" r="23" fill="url(#rDisc)" />
      <circle cx="150" cy="150" r="19" fill="#FFF5D6" opacity="0.82" />
      <circle cx="150" cy="150" r="12" fill="#FFFBF0" opacity="0.72" />
      <circle cx="148" cy="148" r="6"  fill="#FFFEF8" opacity="0.62" />
      <circle cx="150" cy="150" r="23" fill="none" stroke="#E8A030" strokeWidth="1.5" opacity="0.45" />

      {/* ── Macula / fovea ── */}
      <ellipse cx="216" cy="150" rx="19" ry="16" fill="url(#rMac)" opacity="0.62" />
      <circle  cx="216" cy="150" r="5"  fill="#0A0202" opacity="0.88" />
      <circle  cx="214" cy="148" r="1.5" fill="rgba(255,220,180,0.22)" />

      {/* ── Outer vignette ── */}
      <circle cx="150" cy="150" r="145" fill="none" stroke="rgba(0,0,0,0.55)"   strokeWidth="4" />
      <circle cx="150" cy="150" r="143" fill="none" stroke="rgba(80,20,20,0.18)" strokeWidth="6" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════ */
export default function DrDashboard() {
  const [isDark, setIsDark] = useState(true);
  const [scan, setScan]     = useState(SCANS[0]);
  const [patient]           = useState(PATIENTS[0]);
  const [nav, setNav]       = useState("dashboard");

  const t       = isDark ? DARK : LIGHT;
  const sev     = SEV[scan.severity];
  const SevIcon = sev.icon;

  /* Shared card style */
  const card = {
    background:   t.card,
    border:       `1px solid ${t.border}`,
    borderRadius: "16px",
    padding:      "18px 20px",
  };

  const NAV_ITEMS = [
    { id: "dashboard", icon: Layers,    label: "Dashboard"  },
    { id: "scan",      icon: Eye,       label: "AI Scan"    },
    { id: "history",   icon: History,   label: "History"    },
    { id: "analytics", icon: BarChart2, label: "Analytics"  },
    { id: "patients",  icon: User,      label: "Patients"   },
    { id: "reports",   icon: FileText,  label: "Reports"    },
  ];

  const STAT_CARDS = [
    { label: "Total Scans",    value: "6",     sub: "This patient",    Icon: Eye,          color: t.accent,  bg: t.accentBg  },
    { label: "Avg Confidence", value: "96.2%", sub: "+1.4% from last", Icon: Brain,         color: t.success, bg: t.successBg },
    { label: "Active Alerts",  value: "2",     sub: "Needs attention", Icon: AlertTriangle, color: t.warning, bg: t.warningBg },
    { label: "Next Review",    value: "14d",   sub: "Feb 15, 2025",   Icon: Calendar,      color: t.purple,  bg: t.purpleBg  },
  ];

  const FINDINGS = [
    { label: "Microaneurysms", score: 0.82, present: scan.grade >= 1 },
    { label: "Hard Exudates",  score: 0.74, present: scan.grade >= 2 },
    { label: "Hemorrhages",    score: 0.61, present: scan.grade >= 2 },
    { label: "NV Vessels",     score: 0.89, present: scan.grade >= 4 },
  ];

  const RECS = [
    { text: "Schedule follow-up in 3–6 months",     urgent: scan.grade >= 1 },
    { text: "Glycemic optimization & HbA1c review", urgent: scan.grade >= 1 },
    { text: "Blood pressure monitoring",             urgent: false           },
    { text: "Refer to vitreoretinal specialist",    urgent: scan.grade >= 3 },
    { text: "Patient education on DR progression",  urgent: false           },
  ];

  return (
    <div
      style={{
        background:  t.bg,
        minHeight:   "100vh",
        fontFamily:  "'Outfit', sans-serif",
        color:       t.text,
        transition:  "background 0.3s, color 0.3s",
      }}
    >
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

        {/* ══════════════════════════════
            SIDEBAR
        ══════════════════════════════ */}
        <aside
          style={{
            width:          "214px",
            flexShrink:     0,
            background:     t.surface,
            borderRight:    `1px solid ${t.border}`,
            display:        "flex",
            flexDirection:  "column",
            transition:     "background 0.3s",
          }}
        >
          {/* Logo */}
          <div style={{ padding: "20px 18px", borderBottom: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width:           "36px",
                  height:          "36px",
                  borderRadius:    "10px",
                  background:      `linear-gradient(135deg, ${t.accent} 0%, #6366f1 100%)`,
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                  flexShrink:      0,
                }}
              >
                <Eye size={17} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: t.text, letterSpacing: "-0.01em" }}>
                  VADR
                </div>
                <div style={{ fontSize: "9.5px", color: t.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  DR Assessment
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 18px 12px" }}>
            <Link
              to="/"
              style={{
                fontSize: 11,
                color: t.accent,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Admin portal
            </Link>
          </div>

          {/* Nav links */}
          <nav style={{ padding: "10px 8px", flex: 1 }}>
            {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
              const active = nav === id;
              return (
                <div
                  key={id}
                  className="nav-item"
                  onClick={() => setNav(id)}
                  style={{
                    display:        "flex",
                    alignItems:     "center",
                    gap:            "9px",
                    padding:        "9px 12px",
                    borderRadius:   "10px",
                    marginBottom:   "2px",
                    background:     active ? t.accentBg : "transparent",
                    color:          active ? t.accent   : t.muted,
                    fontSize:       "13px",
                    fontWeight:     active ? "600" : "400",
                    borderLeft:     `2.5px solid ${active ? t.accent : "transparent"}`,
                  }}
                >
                  <Icon size={15} />
                  {label}
                </div>
              );
            })}
          </nav>

          {/* Patient mini-card */}
          <div style={{ padding: "12px", borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: "9.5px", color: t.muted, marginBottom: "7px", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Active Patient
            </div>
            <div
              style={{
                background:   t.accentBg,
                border:       `1px solid ${t.accentBorder}`,
                borderRadius: "12px",
                padding:      "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "9px" }}>
                <div
                  style={{
                    width:           "32px",
                    height:          "32px",
                    borderRadius:    "50%",
                    background:      `linear-gradient(135deg, ${t.accent}, #6366f1)`,
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    fontSize:        "11px",
                    fontWeight:      "700",
                    color:           "#fff",
                    flexShrink:      0,
                  }}
                >
                  {patient.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: t.text, lineHeight: 1.2 }}>
                    {patient.name}
                  </div>
                  <div style={{ fontSize: "10px", color: t.muted }}>ID: {patient.id}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "10px", color: t.muted }}>Age {patient.age}</span>
                <span
                  style={{
                    fontSize:     "10px",
                    color:        t.accent,
                    background:   t.accentBg,
                    padding:      "1px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {patient.type}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ══════════════════════════════
            MAIN CONTENT
        ══════════════════════════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <header
            style={{
              padding:        "13px 22px",
              background:     t.surface,
              borderBottom:   `1px solid ${t.border}`,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              flexShrink:     0,
              transition:     "background 0.3s",
            }}
          >
            <div>
              <div style={{ fontSize: "17px", fontWeight: "700", color: t.text, letterSpacing: "-0.02em" }}>
                Visual Assessment — Diabetic Retinopathy
              </div>
              <div style={{ fontSize: "11.5px", color: t.muted, marginTop: "1px" }}>
                AI-Powered Fundoscopy Analysis &amp; Severity Grading System
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Search bar */}
              <div
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "7px",
                  background:   t.bg,
                  border:       `1px solid ${t.border}`,
                  borderRadius: "9px",
                  padding:      "7px 13px",
                }}
              >
                <Search size={13} color={t.muted} />
                <span style={{ fontSize: "12.5px", color: t.muted }}>Search patients…</span>
              </div>

              {/* Bell */}
              <div
                className="icon-btn"
                style={{
                  width:           "35px",
                  height:          "35px",
                  borderRadius:    "9px",
                  background:      t.bg,
                  border:          `1px solid ${t.border}`,
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                  position:        "relative",
                }}
              >
                <Bell size={14} color={t.muted} />
                <div
                  style={{
                    position:     "absolute",
                    top:          "7px",
                    right:        "7px",
                    width:        "6px",
                    height:       "6px",
                    borderRadius: "50%",
                    background:   t.danger,
                  }}
                />
              </div>

              {/* Theme toggle */}
              <div
                className="icon-btn"
                onClick={() => setIsDark(!isDark)}
                style={{
                  width:           "35px",
                  height:          "35px",
                  borderRadius:    "9px",
                  background:      t.bg,
                  border:          `1px solid ${t.border}`,
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                }}
              >
                {isDark ? <Sun size={14} color={t.muted} /> : <Moon size={14} color={t.muted} />}
              </div>
            </div>
          </header>

          {/* ── Scrollable content ── */}
          <div
            style={{
              flex:          1,
              overflowY:     "auto",
              padding:       "18px 22px",
              display:       "flex",
              flexDirection: "column",
              gap:           "16px",
            }}
          >

            {/* ────────── STAT CARDS ────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              {STAT_CARDS.map(({ label, value, sub, Icon, color, bg }, i) => (
                <div key={i} style={{ ...card, display: "flex", alignItems: "flex-start", gap: "13px" }}>
                  <div
                    style={{
                      width:           "40px",
                      height:          "40px",
                      borderRadius:    "11px",
                      background:      bg,
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      flexShrink:      0,
                    }}
                  >
                    <Icon size={18} color={color} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "11px", color: t.muted, marginBottom: "3px" }}>{label}</div>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: t.text, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: "10.5px", color: t.muted, marginTop: "3px" }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ────────── ANALYSIS SECTION ────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>

              {/* Retina Viewer */}
              <div style={{ ...card, display: "flex", flexDirection: "column", gap: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "20px", fontWeight: "600", color: t.text }}>Fundus Image</div>
                    <div style={{ fontSize: "15px", color: t.muted }}>Right Eye (OD) — Nov 15, 2024</div>
                  </div>
                  <div style={{ display: "flex", gap: "5px", fontSize: "13px" }}>
                    {["Original", "Enhanced"].map((m, i) => (
                      <span
                        key={m}
                        style={{
                          fontSize:   "9.5px",
                          padding:    "3px 8px",
                          borderRadius:"5px",
                          cursor:     "pointer",
                          background: i === 0 ? t.accentBg   : "transparent",
                          color:      i === 0 ? t.accent      : t.muted,
                          border:     `1px solid ${i === 0 ? t.accentBorder : t.border}`,
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Retinal image */}
                <div
                  style={{
                    borderRadius: "11px",
                    overflow:     "hidden",
                    background:   "#000",
                    aspectRatio:  "1 / 1",
                    position:     "relative",
                  }}
                >
                  <RetinaSVG severity={scan.severity} />
                  <div
                    style={{
                      position:   "absolute",
                      top:        "8px",
                      left:       "8px",
                      fontSize:   "9px",
                      color:      "rgba(255,255,255,0.72)",
                      background: "rgba(0,0,0,0.55)",
                      borderRadius:"4px",
                      padding:    "3px 7px",
                    }}
                  >
                    OD · 45° · 6.3MP
                  </div>
                  <div
                    style={{
                      position:        "absolute",
                      bottom:          "8px",
                      right:           "8px",
                      display:         "flex",
                      alignItems:      "center",
                      gap:             "5px",
                      background:      "rgba(0,0,0,0.55)",
                      borderRadius:    "5px",
                      padding:         "3px 7px",
                    }}
                  >
                    <div
                      className="animate-pulse-dot"
                      style={{
                        width:        "6px",
                        height:       "6px",
                        borderRadius: "50%",
                        background:   sev.color,
                      }}
                    />
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.8)" }}>AI Analyzed</span>
                  </div>
                </div>

                {/* Upload zone */}
                <div
                  style={{
                    border:          `1.5px dashed ${t.border}`,
                    borderRadius:    "9px",
                    padding:         "10px",
                    textAlign:       "center",
                    cursor:          "pointer",
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    gap:             "7px",
                  }}
                >
                  <Upload size={13} color={t.muted} />
                  <span style={{ fontSize: "11px", color: t.muted }}>Upload New Scan</span>
                </div>
              </div>

              {/* AI Assessment */}
              <div style={{ ...card, display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: t.text }}>AI Assessment</div>
                  <div style={{ fontSize: "13px", color: t.muted }}>Model: RetinaNet v4.2 · 1.2 s</div>
                </div>

                {/* Severity badge */}
                <div
                  style={{
                    background:   sev.bg,
                    border:       `1.5px solid ${sev.color}28`,
                    borderRadius: "13px",
                    padding:      "16px",
                    textAlign:    "center",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "7px" }}>
                    <SevIcon size={26} color={sev.color} />
                  </div>
                  <div style={{ fontSize: "17px", fontWeight: "700", color: sev.color }}>{scan.severity}</div>
                  <div style={{ fontSize: "11px", color: t.muted, marginTop: "2px" }}>{sev.label}</div>
                  <span
                    style={{
                      display:      "inline-block",
                      marginTop:    "8px",
                      fontSize:     "10px",
                      padding:      "3px 11px",
                      borderRadius: "20px",
                      background:   sev.color + "22",
                      color:        sev.color,
                      fontWeight:   "600",
                    }}
                  >
                    Risk: {sev.risk}
                  </span>
                </div>

                {/* Confidence arc gauge */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", color: t.muted, marginBottom: "8px" }}>Confidence Score</div>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <svg width="120" height="68" viewBox="0 0 120 68">
                      {/* Track */}
                      <path
                        d="M10 64 A50 50 0 0 1 110 64"
                        fill="none"
                        stroke={isDark ? "#1e2d40" : "#e2e8f0"}
                        strokeWidth="7"
                        strokeLinecap="round"
                      />
                      {/* Fill */}
                      <path
                        d="M10 64 A50 50 0 0 1 110 64"
                        fill="none"
                        stroke={sev.color}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${(scan.confidence / 100) * 157} 157`}
                      />
                    </svg>
                    <div
                      style={{
                        position:  "absolute",
                        bottom:    "2px",
                        left:      "50%",
                        transform: "translateX(-50%)",
                        fontSize:  "22px",
                        fontWeight:"700",
                        color:     t.text,
                        lineHeight:1,
                      }}
                    >
                      {scan.confidence.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Detected findings */}
                <div>
                  <div
                    style={{
                      fontSize:       "10px",
                      color:          t.muted,
                      marginBottom:   "9px",
                      fontWeight:     "600",
                      letterSpacing:  "0.06em",
                      textTransform:  "uppercase",
                    }}
                  >
                    Detected Findings
                  </div>
                  {FINDINGS.map(f => (
                    <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "9px" }}>
                      <div
                        style={{
                          width:        "7px",
                          height:       "7px",
                          borderRadius: "50%",
                          flexShrink:   0,
                          background:   f.present ? sev.color : t.dim,
                        }}
                      />
                      <span style={{ flex: 1, fontSize: "11.5px", color: f.present ? t.text : t.muted }}>
                        {f.label}
                      </span>
                      {f.present ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <div
                            style={{
                              width:        "50px",
                              height:       "4px",
                              borderRadius: "2px",
                              background:   t.dim,
                              overflow:     "hidden",
                            }}
                          >
                            <div
                              style={{
                                width:        `${f.score * 100}%`,
                                height:       "100%",
                                background:   sev.color,
                                borderRadius: "2px",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "10px", color: t.muted, minWidth: "26px" }}>
                            {Math.round(f.score * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: t.dim }}>—</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical Recommendations */}
              <div style={{ ...card, display: "flex", flexDirection: "column", gap: "13px" }}>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: t.text }}>Clinical Recommendation</div>
                  <div style={{ fontSize: "13px", color: t.muted }}>Based on AI grading result</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {RECS.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display:     "flex",
                        alignItems:  "flex-start",
                        gap:         "9px",
                        padding:     "9px 10px",
                        borderRadius:"9px",
                        background:  r.urgent ? t.warningBg : t.accentBg,
                        border:      `1px solid ${r.urgent ? t.warning + "28" : t.accentBorder}`,
                      }}
                    >
                      <div
                        style={{
                          width:           "15px",
                          height:          "15px",
                          borderRadius:    "50%",
                          flexShrink:      0,
                          marginTop:       "1px",
                          border:          `2px solid ${r.urgent ? t.warning : t.accent}`,
                          display:         "flex",
                          alignItems:      "center",
                          justifyContent:  "center",
                        }}
                      >
                        <div
                          style={{
                            width:        "5px",
                            height:       "5px",
                            borderRadius: "50%",
                            background:   r.urgent ? t.warning : t.accent,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "11.5px", color: t.text, lineHeight: 1.4 }}>{r.text}</span>
                    </div>
                  ))}
                </div>

                {/* Grading summary bar */}
                <div
                  style={{
                    marginTop:       "auto",
                    background:      t.bg,
                    borderRadius:    "11px",
                    padding:         "13px",
                    display:         "flex",
                    justifyContent:  "space-around",
                    alignItems:      "center",
                  }}
                >
                  {[
                    { label: "ETDRS Grade", value: scan.grade,          color: sev.color },
                    { label: "ICDR Scale",  value: `${scan.grade}/4`,   color: t.text    },
                    { label: "Laterality",  value: scan.eye.split(" ")[0], color: t.text },
                  ].map((g, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "9.5px", color: t.muted, marginBottom: "3px" }}>{g.label}</div>
                      <div style={{ fontSize: "21px", fontWeight: "700", color: g.color }}>{g.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ────────── CHARTS ────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "14px" }}>

              {/* Severity trend */}
              <div style={card}>
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: t.text }}>Severity Trend Over Time</div>
                  <div style={{ fontSize: "13px", color: t.muted }}>DR grade progression (0 = No DR · 4 = Proliferative)</div>
                </div>
                <ResponsiveContainer width="100%" height={155}>
                  <AreaChart data={TREND_DATA} margin={{ top: 5, right: 4, bottom: 0, left: -22 }}>
                    <defs>
                      <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={t.accent} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={t.accent} stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: t.muted }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, 4]}
                      ticks={[0, 1, 2, 3, 4]}
                      tick={{ fontSize: 10, fill: t.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background:   t.card,
                        border:       `1px solid ${t.border}`,
                        borderRadius: "9px",
                        fontSize:     "11px",
                      }}
                      labelStyle={{ color: t.text, fontWeight: 600 }}
                      itemStyle={{ color: t.accent }}
                      formatter={v => [`Grade ${v}`, "DR Severity"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="grade"
                      stroke={t.accent}
                      strokeWidth={2.5}
                      fill="url(#aGrad)"
                      dot={{ fill: t.accent, r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Scan distribution */}
              <div style={card}>
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: t.text }}>Scan Distribution</div>
                  <div style={{ fontSize: "13px", color: t.muted }}>Total scans by severity grade</div>
                </div>
                <ResponsiveContainer width="100%" height={155}>
                  <BarChart data={DIST_DATA} margin={{ top: 5, right: 4, bottom: 0, left: -22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: t.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: t.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background:   t.card,
                        border:       `1px solid ${t.border}`,
                        borderRadius: "9px",
                        fontSize:     "11px",
                      }}
                      labelStyle={{ color: t.text, fontWeight: 600 }}
                      formatter={v => [v, "Scans"]}
                    />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {DIST_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ────────── SCAN HISTORY TABLE ────────── */}
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: t.text }}>Past Scan History</div>
                  <div style={{ fontSize: "13px", color: t.muted }}>
                    All recorded assessments for {patient.name}
                  </div>
                </div>
                <div
                  style={{
                    fontSize:     "11px",
                    color:        t.accent,
                    background:   t.accentBg,
                    border:       `1px solid ${t.accentBorder}`,
                    borderRadius: "7px",
                    padding:      "5px 12px",
                    cursor:       "pointer",
                  }}
                >
                  Export PDF
                </div>
              </div>

              {/* Table header */}
              <div
                style={{
                  display:               "grid",
                  gridTemplateColumns:   "0.9fr 1.1fr 1fr 1fr 0.9fr 1fr 1.6fr",
                  padding:               "7px 12px",
                  fontSize:              "9.5px",
                  color:                 t.muted,
                  fontWeight:            "600",
                  letterSpacing:         "0.07em",
                  textTransform:         "uppercase",
                  borderBottom:          `1px solid ${t.border}`,
                }}
              >
                {["Scan ID", "Date", "Severity", "Confidence", "Eye", "Physician", "Clinical Note"].map(h => (
                  <span key={h}>{h}</span>
                ))}
              </div>

              {/* Table rows */}
              {SCANS.map((s, i) => {
                const cfg    = SEV[s.severity];
                const active = scan.id === s.id;
                return (
                  <div
                    key={s.id}
                    className="scan-row"
                    onClick={() => setScan(s)}
                    style={{
                      display:             "grid",
                      gridTemplateColumns: "0.9fr 1.1fr 1fr 1fr 0.9fr 1fr 1.6fr",
                      padding:             "11px 12px",
                      fontSize:            "11.5px",
                      borderBottom:        i < SCANS.length - 1 ? `1px solid ${t.border}` : "none",
                      background:          active ? t.accentBg : "transparent",
                      alignItems:          "center",
                    }}
                  >
                    <span
                      style={{
                        color:      t.accent,
                        fontWeight: "600",
                        fontFamily: "monospace",
                        fontSize:   "10.5px",
                      }}
                    >
                      {s.id}
                    </span>
                    <span style={{ color: t.muted }}>{s.date}</span>
                    <span>
                      <span
                        style={{
                          background:   cfg.bg,
                          color:        cfg.color,
                          padding:      "2px 9px",
                          borderRadius: "20px",
                          fontSize:     "10px",
                          fontWeight:   "600",
                        }}
                      >
                        {s.severity}
                      </span>
                    </span>
                    <span style={{ fontWeight: "600", color: cfg.color }}>
                      {s.confidence.toFixed(1)}%
                    </span>
                    <span style={{ color: t.muted }}>{s.eye}</span>
                    <span style={{ color: t.muted }}>{s.doctor}</span>
                    <span style={{ color: t.muted, fontSize: "11px" }}>{s.note}</span>
                  </div>
                );
              })}
            </div>

            {/* Bottom padding */}
            <div style={{ height: "6px" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
