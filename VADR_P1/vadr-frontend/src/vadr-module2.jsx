import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./vadr-dashboard.css";
import ThemeToggle from "./components/ThemeToggle";
import {
  adminAPI,
  authAPI,
  checkHealth,
  patientAPI,
  userAPI,
} from "./api";
import { getStoredUser, setSession } from "./api";
import { isAdmin } from "./lib/session";

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
const ROLES = ["admin", "doctor", "screener"];
const ROLE_PERMISSIONS = {
  admin:      { label: "Admin",      color: "#1a56db", bg: "#ebf5ff", desc: "Full system access"     },
  doctor:     { label: "Doctor",     color: "#0694a2", bg: "#e0f7fa", desc: "Review & diagnose"       },
  screener:   { label: "Screener",   color: "#7e3af2", bg: "#f3e8ff", desc: "Upload fundus images"    },
  patient:    { label: "Patient",    color: "#057a55", bg: "#def7ec", desc: "View own records"         },
};

const DEFAULT_PERMISSION_MATRIX = {
  "View Dashboard":        { admin: true,  doctor: true,  screener: true,  patient: false },
  "Manage Patients":       { admin: true,  doctor: true,  screener: false, patient: false },
  "Upload Fundus Images":  { admin: true,  doctor: true,  screener: true,  patient: false },
  "Run AI Prediction":     { admin: true,  doctor: true,  screener: false, patient: false },
  "Review AI Results":     { admin: true,  doctor: true,  screener: false, patient: false },
  "Generate Reports":      { admin: true,  doctor: true,  screener: false, patient: false },
  "View Own Reports":      { admin: true,  doctor: true,  screener: true,  patient: true  },
  "Manage Users":          { admin: true,  doctor: false, screener: false, patient: false },
  "System Administration": { admin: true,  doctor: false, screener: false, patient: false },
  "View Analytics":        { admin: true,  doctor: true,  screener: false, patient: false },
  "Export Data":           { admin: true,  doctor: true,  screener: false, patient: false },
  "Patient Self-Service":  { admin: false, doctor: false, screener: false, patient: true  },
};

const ADMIN_LOCKED_PERMS = ["System Administration", "Manage Users"];

const PORTAL_SUBTITLES = {
  admin: "Administration Portal",
  doctor: "Clinical Portal",
  screener: "Screening Portal",
};

const TAB_HEADINGS = {
  patients: "Patient Registry",
  users: "Staff Management",
  approvals: "Doctor Approvals",
  rbac: "Access Control",
};

function useAnimatedNumber(target, duration = 600, decimals = 0) {
  const [display, setDisplay] = useState(typeof target === "number" ? 0 : target);
  useEffect(() => {
    if (typeof target !== "number" || Number.isNaN(target)) {
      setDisplay(target);
      return;
    }
    const from = 0;
    const to = target;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      const current = from + (to - from) * eased;
      setDisplay(decimals ? parseFloat(current.toFixed(decimals)) : Math.round(current));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, decimals]);
  return display;
}

function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div className="vadr-empty">
      <div className="vadr-empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <Btn icon="plus" onClick={onAction}>{actionLabel}</Btn>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const initials  = (n = "") => n.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const exportCSV = (data, filename) => {
  if (!data.length) return;
  const h    = Object.keys(data[0]);
  const rows = data.map(r => h.map(k => `"${(r[k] ?? "").toString().replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[h.join(","), ...rows].join("\n")], { type: "text/csv" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
};

// ══════════════════════════════════════════════════════════════════════════════
// BASE STYLES
// ══════════════════════════════════════════════════════════════════════════════
const inputStyle = {
  border: "1.5px solid var(--vadr-border)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, color: "var(--vadr-text)", outline: "none", background: "var(--vadr-input-bg)",
  fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};
const thStyle = {
  padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "var(--vadr-text-muted)", letterSpacing: 0.5, textTransform: "uppercase",
  borderBottom: "1px solid var(--vadr-border)", whiteSpace: "nowrap", background: "var(--vadr-surface-muted)",
};
const tdStyle = { padding: "12px 16px", borderBottom: "1px solid var(--vadr-border)", color: "var(--vadr-text)" };

// ══════════════════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
const Icon = ({ d, size = 16, color = "currentColor", style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={d} />
  </svg>
);

const I = {
  users:   "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  patient: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  edit:    "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:   "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  plus:    "M12 5v14M5 12h14",
  search:  "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  export:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  close:   "M18 6L6 18M6 6l12 12",
  check:   "M20 6L9 17l-5-5",
  info:    "M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
  history: "M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3",
  mail:    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  key:     "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  copy:    "M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.09 19.105 22 18 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z",
  warning: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  referral:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7",
  spinner: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
};

const Badge = ({ role }) => {
  const r = ROLE_PERMISSIONS[role] || { label: role, color: "#666", bg: "#eee" };
  return (
    <span style={{ background: r.bg, color: r.color, border: `1px solid ${r.color}22`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
      {r.label}
    </span>
  );
};

const StatusDot = ({ status }) => {
  const m = {
    active:            ["#057a55", "#10b981", "Active"],
    inactive:          ["#9ca3af", "#d1d5db", "Inactive"],
    suspended:         ["#b45309", "#f59e0b", "Suspended"],
    pending_approval:  ["#1d4ed8", "#3b82f6", "Pending approval"],
  };
  const [c, d, l] = m[status] || m.inactive;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: c, fontWeight: 600 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: d, display: "inline-block" }} />{l}
    </span>
  );
};

const Avatar = ({ name, size = 36, color = "#1a56db" }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: `${color}18`, border: `2px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color, flexShrink: 0 }}>
    {initials(name)}
  </div>
);

const Input = ({ label, value, onChange, type = "text", options, required, placeholder, style = {}, hint }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
      {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
    </label>
    {hint && <div style={{ fontSize: 11, color: "#9ca3af" }}>{hint}</div>}
    {options
      ? <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value="">Select...</option>
          {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    }
  </div>
);

const Btn = ({ children, onClick, variant = "primary", size = "md", icon, disabled, loading, style = {} }) => {
  const sz = { sm: { padding: "5px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 }, lg: { padding: "10px 22px", fontSize: 14 } };
  const vr = {
    primary:   { background: "var(--vadr-primary)", color: "#fff",    border: "none" },
    secondary: { background: "var(--vadr-btn-secondary-bg)", color: "var(--vadr-text-secondary)", border: "none" },
    danger:       { background: "var(--vadr-error-bg)", color: "var(--vadr-error-text)", border: "1.5px solid var(--vadr-error-border)" },
    dangerSolid:  { background: "var(--vadr-error-text)", color: "#fff", border: "none" },
    ghost:     { background: "transparent", color: "var(--vadr-text-muted)", border: "none" },
    success:   { background: "var(--vadr-success-bg)", color: "var(--vadr-success-text)", border: "1.5px solid var(--vadr-success-border)" },
    warning:   { background: "var(--vadr-warning-bg)", color: "var(--vadr-warning-text)", border: "1.5px solid var(--vadr-warning-border)" },
    teal:      { background: "var(--vadr-primary-soft)", color: "#0694a2", border: "1.5px solid var(--vadr-primary-border)" },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, fontWeight: 600, cursor: (disabled || loading) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (disabled || loading) ? 0.6 : 1, transition: "all 0.15s", ...sz[size], ...vr[variant], ...style }}>
      {loading
        ? <span style={{ width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
        : icon && <Icon d={I[icon]} size={13} />
      }
      {children}
    </button>
  );
};

const Modal = ({ title, onClose, children, width = 540 }) => (
  <div className="vadr-modal-backdrop" onClick={onClose}>
    <div className="vadr-modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid var(--vadr-border)" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--vadr-text)" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--vadr-text-muted)", padding: 4 }}>
          <Icon d={I.close} size={18} />
        </button>
      </div>
      <div style={{ padding: "20px 24px 24px" }}>{children}</div>
    </div>
  </div>
);

const Toast = ({ msg, type }) => {
  const bg = { success: "#059669", error: "#dc2626", warning: "#d97706", info: "#1a56db" };
  const ic = { success: I.check, error: I.close, warning: I.warning, info: I.info };
  return (
    <div className="vadr-toast" style={{ background: bg[type] || bg.info }}>
      <Icon d={ic[type] || ic.info} size={15} color="#fff" />{msg}
    </div>
  );
};

const StatCard = ({ label, value, icon, color = "#1a56db", sub, loading, suffix = "", decimals = 0 }) => {
  const isNum = typeof value === "number" && !Number.isNaN(value);
  const animated = useAnimatedNumber(isNum ? value : 0, loading ? 0 : 600, decimals);
  const shown = loading ? "…" : isNum ? `${animated}${suffix}` : value;
  return (
    <div className="vadr-stat-card">
      <div className="vadr-stat-icon" style={{ background: `${color}14` }}>
        <Icon d={I[icon]} size={22} color={color} />
      </div>
      <div>
        <div className="vadr-stat-value">{shown}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
};

// Loading skeleton row
const SkeletonRow = ({ cols }) => (
  <tr>
    {Array(cols).fill(0).map((_, i) => (
      <td key={i} style={tdStyle}>
        <div style={{ height: 14, background: "#f3f4f6", borderRadius: 6, width: i === 0 ? "60%" : "80%", animation: "pulse 1.5s ease-in-out infinite" }} />
      </td>
    ))}
  </tr>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, padding: "4px 0 8px", borderBottom: "1px solid #f3f4f6", marginBottom: 14 }}>
    {children}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState("patients");
  const [toast, setToast]     = useState(null);
  const [backendOk, setBackendOk] = useState(null);
  const [sessionUser, setSessionUser] = useState(() => getStoredUser());
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    checkHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const close = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileOpen]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const user = await authAPI.me();
      setSession({ user });
      setSessionUser(user);
      showToast("Profile updated");
    } catch (err) {
      showToast(err.message || "Could not load profile", "error");
    }
  }, [showToast]);

  const role = sessionUser?.role;
  const allTabs = [
    { id: "patients", label: "Patients",           icon: "patient", roles: ["admin", "doctor", "screener"] },
    { id: "users",    label: "User Accounts",       icon: "users",   roles: ["admin"] },
    { id: "approvals", label: "Doctor Approvals",   icon: "shield",  roles: ["admin"] },
    { id: "rbac",     label: "Roles & Permissions", icon: "shield",  roles: ["admin"] },
  ];
  const tabs = allTabs.filter((t) => t.roles.includes(role));

  useEffect(() => {
    if (tabs.length && !tabs.find((t) => t.id === tab)) setTab(tabs[0].id);
  }, [tab, tabs]);

  const handleLogout = async () => {
    await authAPI.logout();
    setSessionUser(null);
    navigate("/login", { replace: true });
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

      {backendOk === false && (
        <div className="vadr-status-bar vadr-status-bar--err">
          <Icon d={I.warning} size={14} color="#dc2626" />
          Backend not reachable — make sure Flask is running on port 5000 (python app.py)
        </div>
      )}
      {backendOk === true && (
        <div className="vadr-status-bar vadr-status-bar--ok">
          <span className="vadr-status-dot" />
          Connected to VADR Backend — MongoDB live
        </div>
      )}

      <header className="vadr-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 32 }}>
          <div className="vadr-brand-mark">
            <Icon d={I.eye} size={18} color="#fff" />
          </div>
          <div className="vadr-brand-title">VADR</div>
          <span className="vadr-brand-sub">{PORTAL_SUBTITLES[role] || "Staff Portal"}</span>
        </div>
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`vadr-tab${tab === t.id ? " vadr-tab--active" : ""}`}>
            <Icon d={I[t.icon]} size={15} color={tab === t.id ? "#1a56db" : "#94a3b8"} />{t.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle iconOnly />
          {(sessionUser?.role === "doctor" || sessionUser?.role === "admin") && (
            <Link to="/doctor" className="vadr-link-btn">DR Dashboard</Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="vadr-theme-toggle"
            style={{ fontFamily: "inherit" }}
          >
            Log out
          </button>
          <div style={{ position: "relative" }} ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className={`vadr-profile-btn${profileOpen ? " vadr-profile-btn--open" : ""}`}
            >
              <Avatar name={sessionUser?.name || "User"} size={34} color="#1a56db" />
              <div style={{ fontSize: 12, textAlign: "left" }}>
                <div style={{ fontWeight: 700 }}>{sessionUser?.name || "Staff"}</div>
                <div style={{ color: "var(--vadr-text-faint)", fontSize: 11 }}>
                  {(sessionUser?.role && ROLE_PERMISSIONS[sessionUser.role]?.label) || sessionUser?.role || "—"}
                </div>
              </div>
            </button>
            {profileOpen && (
              <div className="vadr-profile-menu">
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{sessionUser?.name}</div>
                <div style={{ fontSize: 12, color: "var(--vadr-text-muted)", marginBottom: 12 }}>{sessionUser?.email}</div>
                <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: "var(--vadr-text-faint)" }}>Role:</span> {ROLE_PERMISSIONS[sessionUser?.role]?.label || sessionUser?.role}</div>
                  <div><span style={{ color: "var(--vadr-text-faint)" }}>Status:</span> {sessionUser?.status || "—"}</div>
                  <div><span style={{ color: "var(--vadr-text-faint)" }}>Department:</span> {sessionUser?.department || "—"}</div>
                  <div><span style={{ color: "var(--vadr-text-faint)" }}>Last login:</span> {sessionUser?.lastLogin || "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <Btn size="sm" variant="secondary" onClick={refreshProfile}>Refresh</Btn>
                  <Btn size="sm" onClick={() => setProfileOpen(false)}>Close</Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="vadr-main">
        <div key={tab} className="vadr-panel">
          {tab === "patients" && <PatientsTab showToast={showToast} sessionUser={sessionUser} />}
          {tab === "users"    && <UsersTab    showToast={showToast} />}
          {tab === "approvals" && <ApprovalsTab showToast={showToast} />}
          {tab === "rbac"     && <RBACTab showToast={showToast} />}
        </div>
      </main>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PATIENTS TAB
// ══════════════════════════════════════════════════════════════════════════════
function PatientsTab({ showToast, sessionUser }) {
  const [patients, setPatients]         = useState([]);
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [modal, setModal]               = useState(null);
  const [selected, setSelected]         = useState(null);
  const [form, setForm]                 = useState({});
  const [step, setStep]                 = useState(1);
  const [copied, setCopied]             = useState("");
  const [deletingId, setDeletingId]     = useState(null);
  const canDelete = isAdmin(sessionUser);
  const canEditPatients = ["admin", "doctor"].includes(sessionUser?.role);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pts = await patientAPI.getAll();
      setPatients(Array.isArray(pts) ? pts : []);
      try {
        const usrs = isAdmin(sessionUser) ? await userAPI.getAll() : await userAPI.getDoctors();
        setUsers(Array.isArray(usrs) ? usrs : []);
      } catch {
        setUsers([]);
      }
    } catch (err) {
      showToast(err.message || "Could not load data — is Flask running?", "error");
    } finally {
      setLoading(false);
    }
  }, [sessionUser?.id, sessionUser?.role, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const doctors    = users.filter(u => u.role === "doctor" && u.status === "active");
  const doctorName = val => {
    if (!val) return "Unassigned";
    const byId = users.find(u => u.id === val);
    if (byId) return byId.name;
    return val;
  };

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.phone?.includes(q) || p.patientId?.includes(q))
      && (!filterStatus || p.status === filterStatus)
      && (!filterGender || p.gender === filterGender)
      && (!filterDoctor || p.assignedDoctor === filterDoctor || doctorName(p.assignedDoctor) === filterDoctor);
  });

  // ── Open modals ──
  const openAdd = () => {
    const defaultDoctor = sessionUser?.role === "doctor" ? sessionUser.name : "";
    setForm({ name: "", age: "", gender: "Male", email: "", phone: "", diabetesType: "Type 2", hba1c: "", diagnosedYear: "", address: "", assignedDoctor: defaultDoctor, status: "active", referral: "Self" });
    setStep(1);
    setModal("add");
  };
  const openEdit     = p => { setForm({ ...p }); setSelected(p); setModal("edit"); };
  const openView     = p => { setSelected(p); setModal("view"); };
  const openHistory  = p => { setSelected(p); setModal("history"); };
  const openCreds    = p => { setSelected(p); setCopied(""); setModal("credentials"); };

  // ── Register new patient → calls POST /api/patients ──
  const handleRegister = async () => {
    if (!form.name || !form.email || !form.phone || !form.assignedDoctor)
      return showToast("Fill all required fields", "error");
    setSaving(true);
    try {
      const newPatient = await patientAPI.register(form);   // ← API call to Flask
      setPatients(prev => [...prev, newPatient]);            // ← update UI with real data
      setSelected(newPatient);
      setModal("credentials");
      showToast(`${newPatient.name} registered successfully`);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit patient → calls PUT /api/patients/:id ──
  const handleEdit = async () => {
    if (!form.name || !form.email || !form.phone) return showToast("Fill required fields", "error");
    setSaving(true);
    try {
      const updated = await patientAPI.update(selected.patientId, form);  // ← API call
      setPatients(prev => prev.map(p => p.patientId === selected.patientId ? updated : p));
      showToast("Patient updated");
      setModal(null);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle status → calls PATCH /api/patients/:id/status ──
  const toggleStatus = async (patientId) => {
    try {
      const result = await patientAPI.toggleStatus(patientId);  // ← API call
      setPatients(prev => prev.map(p => p.patientId === patientId ? { ...p, status: result.status } : p));
      showToast("Status updated");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // ── Delete patient → calls DELETE /api/patients/:patientId ──
  const deletePatient = async (p) => {
    if (!window.confirm(`Permanently delete ${p.name} (${p.patientId})? This cannot be undone.`)) return;
    setDeletingId(p.patientId);
    try {
      await patientAPI.delete(p.patientId);
      // If patientId got duplicated (can happen with legacy IDs), deleting one should only remove one row.
      setPatients(prev =>
        prev.filter(x => (p._id ? x._id !== p._id : x.patientId !== p.patientId))
      );
      if (selected?.patientId === p.patientId) {
        setSelected(null);
        setModal(null);
      }
      showToast("Patient deleted");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Send credentials → calls PATCH /api/patients/:id/send-credentials ──
  const handleSendCredentials = async (patientId) => {
    try {
      await patientAPI.sendCredentials(patientId);  // ← API call
      setPatients(prev => prev.map(p => p.patientId === patientId ? { ...p, credentialsSent: true } : p));
      if (selected?.patientId === patientId) setSelected(s => ({ ...s, credentialsSent: true }));
      showToast("Credentials marked as sent");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const activeCount    = patients.filter(p => p.status === "active").length;
  const pendingCredits = patients.filter(p => !p.credentialsSent).length;
  const avgHba1c       = patients.length
    ? patients.reduce((s, p) => s + parseFloat(p.hba1c || 0), 0) / patients.length
    : 0;
  const totalScans     = patients.reduce((s, p) => s + (p.scans || 0), 0);
  const firstName      = sessionUser?.name?.split(" ")[0] || "there";
  const hour           = new Date().getHours();
  const greeting       = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <div className="vadr-welcome">
        <div>
          <h2>{greeting}, {firstName}</h2>
          <p>
            {TAB_HEADINGS.patients}
            {!loading && ` · ${patients.length} patient${patients.length === 1 ? "" : "s"} in registry`}
          </p>
        </div>
        <Btn icon="plus" onClick={openAdd} style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff" }}>
          Register Patient
        </Btn>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Total Patients" value={patients.length} loading={loading} icon="patient" color="#1a56db" sub={loading ? "" : `${activeCount} active`} />
        <StatCard label="Total Scans" value={totalScans} loading={loading} icon="eye" color="#0694a2" />
        <StatCard label="Avg HbA1c" value={parseFloat(avgHba1c.toFixed(1))} loading={loading} suffix="%" decimals={1} icon="info" color="#7e3af2" />
        <StatCard label="Credentials Pending" value={pendingCredits} loading={loading} icon="mail" color="#d97706" sub={pendingCredits > 0 ? "Need to send" : "All sent ✓"} />
      </div>

      {/* Pending credentials banner */}
      {!loading && pendingCredits > 0 && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "13px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <Icon d={I.warning} size={18} color="#d97706" />
          <span style={{ fontSize: 13, color: "#92400e" }}>
            <b>{pendingCredits} patient{pendingCredits > 1 ? "s have" : " has"}</b> not received login credentials yet.
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="vadr-surface vadr-surface-pad">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Icon d={I.search} size={14} color="#9ca3af" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, Patient ID..." style={{ ...inputStyle, paddingLeft: 34 }} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ ...inputStyle, width: 120 }}>
            <option value="">All Gender</option><option value="Male">Male</option><option value="Female">Female</option>
          </select>
          <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} style={{ ...inputStyle, width: 170 }}>
            <option value="">All Doctors</option>
            {doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <Btn icon="export" variant="secondary" onClick={() => exportCSV(filtered.map(p => ({ ...p, assignedDoctor: doctorName(p.assignedDoctor) })), "patients.csv")}>Export CSV</Btn>
          <Btn icon="plus" onClick={openAdd}>Register Patient</Btn>
        </div>
      </div>

      {/* Table */}
      <div className="vadr-surface vadr-surface-panel">
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--vadr-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--vadr-text)" }}>Patient Records</span>
          <span style={{ fontSize: 12, color: "var(--vadr-text-faint)" }}>{filtered.length} of {patients.length}</span>
        </div>
        <div style={{ overflowX: "auto" }} className="vadr-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["Patient ID", "Patient", "Age/Gender", "Contact", "Diabetes", "Doctor", "Scans", "Credentials", "Status", "Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading && [1, 2, 3, 4].map(i => <SkeletonRow key={i} cols={10} />)}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 0, border: "none" }}>
                    <EmptyState
                      icon="👁"
                      title={patients.length === 0 ? "No patients yet" : "No matches found"}
                      description={
                        patients.length === 0
                          ? "Register your first patient to start tracking diabetic retinopathy assessments."
                          : "Try adjusting your search or filters to find what you're looking for."
                      }
                      actionLabel={patients.length === 0 ? "Register Patient" : undefined}
                      onAction={patients.length === 0 ? openAdd : undefined}
                    />
                  </td>
                </tr>
              )}
              {!loading && filtered.map(p => (
                <tr key={p._id || p.patientId}>
                  <td style={tdStyle}>
                    <span style={{ background: "#eff6ff", color: "#1a56db", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>{p.patientId}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={p.name} size={34} color="#1a56db" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>{p.age}y · {p.gender}</td>
                  <td style={tdStyle}><div style={{ fontSize: 12 }}>{p.phone}</div></td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 12 }}>{p.diabetesType}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>HbA1c: {p.hba1c}%</div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{doctorName(p.assignedDoctor)}</td>
                  <td style={tdStyle}>
                    <span style={{ background: "#eff6ff", color: "#1a56db", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 700 }}>{p.scans || 0}</span>
                  </td>
                  <td style={tdStyle}>
                    {p.credentialsSent
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#059669", fontWeight: 600 }}><Icon d={I.check} size={12} color="#059669" />Sent</span>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#d97706", fontWeight: 600 }}><Icon d={I.warning} size={12} color="#d97706" />Pending</span>
                    }
                  </td>
                  <td style={tdStyle}><StatusDot status={p.status} /></td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <Btn size="sm" variant="ghost" icon="eye"     onClick={() => openView(p)} />
                      {canEditPatients && <Btn size="sm" variant="ghost" icon="edit"    onClick={() => openEdit(p)} />}
                      <Btn size="sm" variant="ghost" icon="history" onClick={() => openHistory(p)} />
                      {sessionUser?.role !== "screener" && (
                      <Link
                        to={`/medical-history/${p.patientId}`}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#1a56db",
                          textDecoration: "none",
                          border: "1px solid #bfdbfe",
                          background: "#eff6ff",
                          borderRadius: 8,
                          padding: "4px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        Medical History
                      </Link>
                      )}
                      {canEditPatients && <Btn size="sm" variant="teal"  icon="key"     onClick={() => openCreds(p)}>Creds</Btn>}
                      {canEditPatients && (
                      <Btn size="sm" variant={p.status === "active" ? "danger" : "success"} onClick={() => toggleStatus(p.patientId)} disabled={deletingId === p.patientId}>
                        {p.status === "active" ? "Deactivate" : "Activate"}
                      </Btn>
                      )}
                      {canDelete && (
                      <Btn
                        size="sm"
                        variant="dangerSolid"
                        icon="trash"
                        loading={deletingId === p.patientId}
                        disabled={deletingId !== null}
                        onClick={() => deletePatient(p)}
                      >
                        Delete
                      </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Registration Wizard ── */}
      {modal === "add" && (
        <Modal title="Register New Patient" onClose={() => setModal(null)} width={640}>
          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
            {[["1", "Personal Info"], ["2", "Medical Info"], ["3", "Assignment"]].map(([n, l], i) => (
              <div key={n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: step >= i + 1 ? "#1a56db" : "#e5e7eb", color: step >= i + 1 ? "#fff" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {step > i + 1 ? <Icon d={I.check} size={13} color="#fff" /> : n}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: step === i + 1 ? 700 : 500, color: step === i + 1 ? "#111827" : "#9ca3af", whiteSpace: "nowrap" }}>{l}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: step > i + 1 ? "#1a56db" : "#e5e7eb", margin: "0 8px" }} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <>
              <SectionLabel>Personal Information</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Input label="Full Name"     value={form.name    || ""} onChange={v => setForm(f => ({ ...f, name: v }))}    required style={{ gridColumn: "1/-1" }} />
                <Input label="Age"           value={form.age     || ""} onChange={v => setForm(f => ({ ...f, age: v }))}     type="number" required />
                <Input label="Gender"        value={form.gender  || ""} onChange={v => setForm(f => ({ ...f, gender: v }))}  options={["Male", "Female"]} />
                <Input label="Email Address" value={form.email   || ""} onChange={v => setForm(f => ({ ...f, email: v }))}   type="email" required hint="Patient receives login credentials here" />
                <Input label="Phone Number"  value={form.phone   || ""} onChange={v => setForm(f => ({ ...f, phone: v }))}   required />
                <Input label="Address"       value={form.address || ""} onChange={v => setForm(f => ({ ...f, address: v }))} style={{ gridColumn: "1/-1" }} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <SectionLabel>Medical Information</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Input label="Diabetes Type"   value={form.diabetesType   || ""} onChange={v => setForm(f => ({ ...f, diabetesType: v }))}   options={["Type 1", "Type 2", "Gestational"]} />
                <Input label="HbA1c (%)"       value={form.hba1c          || ""} onChange={v => setForm(f => ({ ...f, hba1c: v }))}           type="number" placeholder="e.g. 8.2" hint="3-month average blood sugar level" />
                <Input label="Year Diagnosed"  value={form.diagnosedYear  || ""} onChange={v => setForm(f => ({ ...f, diagnosedYear: v }))}   type="number" placeholder="e.g. 2018" />
                <Input label="Referral Source" value={form.referral       || ""} onChange={v => setForm(f => ({ ...f, referral: v }))}        options={["Self", "Referred", "Doctor", "Hospital"]} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <SectionLabel>Doctor Assignment</SectionLabel>
              <div style={{ display: "grid", gap: 14 }}>
                <Input label="Assign Doctor" value={form.assignedDoctor || ""} onChange={v => setForm(f => ({ ...f, assignedDoctor: v }))} options={doctors.map(d => ({ value: d.name, label: `${d.name} — ${d.department || "Ophthalmology"}` }))} required hint="Doctor name stored for backend access control" />
                <Input label="Patient Status" value={form.status || "active"} onChange={v => setForm(f => ({ ...f, status: v }))} options={["active", "inactive"]} />
              </div>
              <div style={{ marginTop: 16, padding: "14px 16px", background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon d={I.key} size={14} color="#0284c7" />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0c4a6e" }}>Auto-Generated Credentials</span>
                </div>
                <div style={{ fontSize: 12, color: "#0369a1" }}>
                  The system will automatically create a <b>Patient ID</b> and <b>temporary password</b> stored in MongoDB. Share them with the patient so they can log into the Self-Service Portal.
                </div>
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <Btn variant="secondary" onClick={() => step > 1 ? setStep(step - 1) : setModal(null)}>{step > 1 ? "← Back" : "Cancel"}</Btn>
            {step < 3
              ? <Btn onClick={() => setStep(step + 1)}>Next →</Btn>
              : <Btn icon="check" loading={saving} onClick={handleRegister}>Register & Generate Credentials</Btn>
            }
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {modal === "edit" && selected && (
        <Modal title="Edit Patient Profile" onClose={() => setModal(null)} width={620}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Input label="Full Name"      value={form.name          || ""} onChange={v => setForm(f => ({ ...f, name: v }))}          required style={{ gridColumn: "1/-1" }} />
            <Input label="Age"            value={form.age           || ""} onChange={v => setForm(f => ({ ...f, age: v }))}            type="number" />
            <Input label="Gender"         value={form.gender        || ""} onChange={v => setForm(f => ({ ...f, gender: v }))}         options={["Male", "Female"]} />
            <Input label="Email"          value={form.email         || ""} onChange={v => setForm(f => ({ ...f, email: v }))}          type="email" required />
            <Input label="Phone"          value={form.phone         || ""} onChange={v => setForm(f => ({ ...f, phone: v }))}          required />
            <Input label="Diabetes Type"  value={form.diabetesType  || ""} onChange={v => setForm(f => ({ ...f, diabetesType: v }))}   options={["Type 1", "Type 2", "Gestational"]} />
            <Input label="HbA1c (%)"      value={form.hba1c         || ""} onChange={v => setForm(f => ({ ...f, hba1c: v }))}          type="number" />
            <Input label="Diagnosed Year" value={form.diagnosedYear || ""} onChange={v => setForm(f => ({ ...f, diagnosedYear: v }))}  type="number" />
            <Input label="Referral"       value={form.referral      || ""} onChange={v => setForm(f => ({ ...f, referral: v }))}       options={["Self", "Referred", "Doctor", "Hospital"]} />
            <Input label="Assign Doctor"  value={form.assignedDoctor|| ""} onChange={v => setForm(f => ({ ...f, assignedDoctor: v }))} options={doctors.map(d => ({ value: d.name, label: d.name }))} />
            <Input label="Status"         value={form.status        || ""} onChange={v => setForm(f => ({ ...f, status: v }))}         options={["active", "inactive"]} />
            <Input label="Address"        value={form.address       || ""} onChange={v => setForm(f => ({ ...f, address: v }))}        style={{ gridColumn: "1/-1" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn icon="check" loading={saving} onClick={handleEdit}>Save Changes</Btn>
          </div>
        </Modal>
      )}

      {/* ── View Modal ── */}
      {modal === "view" && selected && (
        <Modal title="Patient Profile" onClose={() => setModal(null)} width={580}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: 16, background: "#f8fafc", borderRadius: 10 }}>
            <Avatar name={selected.name} size={54} color="#1a56db" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, background: "#eff6ff", color: "#1a56db", padding: "2px 8px", borderRadius: 5, fontWeight: 700 }}>{selected.patientId}</span>
                <StatusDot status={selected.status} />
                {selected.credentialsSent
                  ? <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>✓ Credentials Sent</span>
                  : <span style={{ fontSize: 11, color: "#d97706", fontWeight: 600 }}>⚠ Credentials Pending</span>
                }
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Age", selected.age + " years"], ["Gender", selected.gender], ["Email", selected.email], ["Phone", selected.phone], ["Diabetes Type", selected.diabetesType], ["HbA1c", selected.hba1c + "%"], ["Diagnosed", selected.diagnosedYear], ["Referral", selected.referral], ["Doctor", doctorName(selected.assignedDoctor)], ["Total Scans", selected.scans || 0], ["Last Scan", selected.lastScan], ["Joined", selected.joined]].map(([k, v]) => (
              <div key={k} style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{v || "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            {!selected.credentialsSent && <Btn variant="warning" icon="mail" onClick={() => { handleSendCredentials(selected.patientId); }}>Mark Credentials Sent</Btn>}
            <Btn variant="teal" icon="key" onClick={() => { setModal(null); openCreds(selected); }}>View Credentials</Btn>
            <Btn variant="secondary" icon="edit" onClick={() => { setModal(null); openEdit(selected); }}>Edit</Btn>
            <Btn onClick={() => setModal(null)}>Close</Btn>
          </div>
        </Modal>
      )}

      {/* ── Credentials Modal ── */}
      {modal === "credentials" && selected && (
        <Modal title="Patient Login Credentials" onClose={() => setModal(null)} width={480}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div className="vadr-cred-hero-icon">
              <Icon d={I.key} size={24} color="currentColor" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--vadr-text)" }}>Credentials Ready</div>
            <div style={{ fontSize: 13, color: "var(--vadr-text-muted)", marginTop: 4 }}>
              Share with <b>{selected.name}</b> to access the Patient Portal
            </div>
          </div>

          {[
            { label: "Patient ID",         value: selected.patientId,   key: "pid",  icon: "patient", mono: true },
            { label: "Email (Username)",    value: selected.email,       key: "email",icon: "mail",    mono: false },
            { label: "Temporary Password", value: selected.tempPassword, key: "pass", icon: "key",     mono: true },
          ].map(c => (
            <div key={c.key} className="vadr-cred-row">
              <div className="vadr-cred-row-icon">
                <Icon d={I[c.icon]} size={16} color="currentColor" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="vadr-cred-row-label">{c.label}</div>
                <div className={`vadr-cred-row-value${c.mono ? " vadr-cred-row-value--mono" : ""}`}>
                  {c.value || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyText(c.value, c.key)}
                className={`vadr-cred-copy-btn${copied === c.key ? " vadr-cred-copy-btn--copied" : ""}`}
                disabled={!c.value}
              >
                <Icon d={copied === c.key ? I.check : I.copy} size={12} color="currentColor" />
                {copied === c.key ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}

          <div className="vadr-cred-notice">
            <b>Important:</b> Ask patient to change their temporary password after first login.
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 12, color: selected.credentialsSent ? "var(--vadr-success-text)" : "var(--vadr-warning-text)", fontWeight: 600 }}>
              {selected.credentialsSent ? "✓ Email marked as sent" : "⚠ Not yet sent to patient"}
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              {!selected.credentialsSent && <Btn variant="warning" icon="mail" onClick={() => handleSendCredentials(selected.patientId)}>Mark as Sent</Btn>}
              <Btn onClick={() => setModal(null)}>Done</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Scan History Modal ── */}
      {modal === "history" && selected && (
        <Modal title={`Scan History — ${selected.name}`} onClose={() => setModal(null)} width={500}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
            <span style={{ fontFamily: "monospace", background: "#eff6ff", color: "#1a56db", padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>{selected.patientId}</span>
            {" · "}{selected.scans || 0} total scans
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!selected.scans || selected.scans === 0
              ? <div style={{ textAlign: "center", color: "#9ca3af", padding: "30px 0" }}>No scans yet. Fundus images appear here after upload in Module 4.</div>
              : Array.from({ length: Math.min(selected.scans, 6) }).map((_, i) => {
                  const grades = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"];
                  const colors = ["#059669", "#0694a2", "#f59e0b", "#ef4444", "#7e3af2"];
                  const grade  = grades[i % grades.length];
                  const ci     = grades.indexOf(grade);
                  const d      = new Date(); d.setMonth(d.getMonth() - i);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#f9fafb", borderRadius: 10, border: "1.5px solid #e5e7eb" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${colors[ci]}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon d={I.eye} size={16} color={colors[ci]} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Scan #{(selected.scans || 0) - i}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{d.toDateString()} · {doctorName(selected.assignedDoctor)}</div>
                      </div>
                      <span style={{ background: `${colors[ci]}15`, color: colors[ci], border: `1px solid ${colors[ci]}30`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{grade}</span>
                    </div>
                  );
                })
            }
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <Btn onClick={() => setModal(null)}>Close</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// USERS TAB
// ══════════════════════════════════════════════════════════════════════════════
function UsersTab({ showToast }) {
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState("");
  const [filterRole, setFilterRole]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modal, setModal]               = useState(null);
  const [selected, setSelected]         = useState(null);
  const [form, setForm]                 = useState({});

  // ── Fetch users from backend ──
  useEffect(() => {
    userAPI.getAll()
      .then(data => setUsers(data))
      .catch(() => showToast("Could not load users", "error"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const statusMatch = !filterStatus
      || u.status === filterStatus
      || (filterStatus === "inactive" && u.status === "suspended");
    return (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q))
      && (!filterRole   || u.role   === filterRole)
      && statusMatch;
  });

  const openAdd  = () => { setForm({ name: "", email: "", phone: "", role: "doctor", department: "", status: "active" }); setModal("add"); };
  const openEdit = u  => { setForm({ ...u }); setSelected(u); setModal("edit"); };
  const openView = u  => { setSelected(u); setModal("view"); };

  // ── Create user → calls POST /api/users ──
  const handleSave = async () => {
    if (!form.name || !form.email || !form.role) return showToast("Fill required fields", "error");
    setSaving(true);
    try {
      if (modal === "add") {
        const newUser = await userAPI.create(form);   // ← API call
        setUsers(prev => [...prev, newUser]);
        showToast("User account created");
      } else {
        const updated = await userAPI.update(selected.id, form);  // ← API call
        setUsers(prev => prev.map(u => u.id === selected.id ? updated : u));
        showToast("User updated");
      }
      setModal(null);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle status → calls PATCH /api/users/:id/status ──
  const toggleStatus = async (userId) => {
    if (userId === "u1") return showToast("Cannot deactivate main admin", "error");
    try {
      const result = await userAPI.toggleStatus(userId);  // ← API call
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: result.status } : u));
      showToast("Status updated");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // ── Delete user → calls DELETE /api/users/:id ──
  const handleDelete = async (userId) => {
    if (userId === "u1") return showToast("Cannot delete main admin", "error");
    try {
      await userAPI.delete(userId);  // ← API call
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast("User removed");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const roleCounts = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {});

  return (
    <div>
      {/* Role cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {ROLES.map(role => {
          const conf = ROLE_PERMISSIONS[role];
          return (
            <div key={role} onClick={() => setFilterRole(filterRole === role ? "" : role)}
              style={{ background: filterRole === role ? conf.bg : "#fff", border: `1.5px solid ${filterRole === role ? conf.color : "#e5e7eb"}`, borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 140, cursor: "pointer" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: filterRole === role ? `${conf.color}20` : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon d={I.users} size={18} color={filterRole === role ? conf.color : "#9ca3af"} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{loading ? "..." : roleCounts[role] || 0}</div>
                <div style={{ fontSize: 11, color: conf.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{conf.label}s</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="vadr-surface vadr-surface-pad">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Icon d={I.search} size={14} color="#9ca3af" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, department..." style={{ ...inputStyle, paddingLeft: 34 }} />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_PERMISSIONS[r]?.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="">All Status</option><option value="active">Active</option><option value="inactive">Suspended</option>
          </select>
          <Btn icon="export" variant="secondary" onClick={() => exportCSV(filtered, "users.csv")}>Export CSV</Btn>
          <Btn icon="plus" onClick={openAdd}>Add User</Btn>
        </div>
      </div>

      {/* Table */}
      <div className="vadr-surface vadr-surface-panel">
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Staff & User Accounts</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{filtered.length} of {users.length}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["User", "Role", "Department", "Contact", "Joined", "Last Login", "Status", "Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading && [1, 2, 3].map(i => <SkeletonRow key={i} cols={8} />)}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af" }}>No users found</td></tr>}
              {!loading && filtered.map(u => (
                <tr key={u._id || u.id}>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={u.name} size={34} color={ROLE_PERMISSIONS[u.role]?.color || "#6b7280"} />
                      <div><div style={{ fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{u.email}</div></div>
                    </div>
                  </td>
                  <td style={tdStyle}><Badge role={u.role} /></td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{u.department}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{u.phone}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "#6b7280" }}>{u.joined}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "#6b7280" }}>{u.lastLogin}</td>
                  <td style={tdStyle}><StatusDot status={u.status} /></td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn size="sm" variant="ghost" icon="eye"   onClick={() => openView(u)} />
                      <Btn size="sm" variant="ghost" icon="edit"  onClick={() => openEdit(u)} />
                      <Btn size="sm" variant={u.status === "active" ? "danger" : "success"} onClick={() => toggleStatus(u.id)}>
                        {u.status === "active" ? "Suspend" : "Activate"}
                      </Btn>
                      <Btn size="sm" variant="danger" icon="trash" onClick={() => handleDelete(u.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Create User Account" : "Edit User"} onClose={() => setModal(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Input label="Full Name"  value={form.name       || ""} onChange={v => setForm(f => ({ ...f, name: v }))}       required style={{ gridColumn: "1/-1" }} />
            <Input label="Email"      value={form.email      || ""} onChange={v => setForm(f => ({ ...f, email: v }))}      type="email" required />
            <Input label="Phone"      value={form.phone      || ""} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            <Input label="Role"       value={form.role       || ""} onChange={v => setForm(f => ({ ...f, role: v }))}       options={ROLES.map(r => ({ value: r, label: ROLE_PERMISSIONS[r]?.label || r }))} required />
            <Input label="Department" value={form.department || ""} onChange={v => setForm(f => ({ ...f, department: v }))} options={["Ophthalmology", "Imaging", "Administration", "Primary Care", "Research"]} />
            <Input label="Status"     value={form.status     || "active"} onChange={v => setForm(f => ({ ...f, status: v }))}     options={["active", "suspended", "pending_approval"]} />
          </div>
          {form.role && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: ROLE_PERMISSIONS[form.role]?.bg || "#f9fafb", borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: ROLE_PERMISSIONS[form.role]?.color }}>
                {ROLE_PERMISSIONS[form.role]?.desc} — permissions applied per the RBAC matrix.
              </span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn icon="check" loading={saving} onClick={handleSave}>{modal === "add" ? "Create Account" : "Save Changes"}</Btn>
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {modal === "view" && selected && (
        <Modal title="User Profile" onClose={() => setModal(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: 16, background: "#f8fafc", borderRadius: 10 }}>
            <Avatar name={selected.name} size={52} color={ROLE_PERMISSIONS[selected.role]?.color || "#6b7280"} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{selected.name}</div>
              <div style={{ marginTop: 4 }}><Badge role={selected.role} /></div>
              <div style={{ marginTop: 6 }}><StatusDot status={selected.status} /></div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["User ID", selected.id], ["Email", selected.email], ["Phone", selected.phone], ["Department", selected.department], ["Joined", selected.joined], ["Last Login", selected.lastLogin]].map(([k, v]) => (
              <div key={k} style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{v || "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn variant="secondary" icon="edit" onClick={() => { setModal(null); openEdit(selected); }}>Edit</Btn>
            <Btn onClick={() => setModal(null)}>Close</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN APPROVALS TAB
// ══════════════════════════════════════════════════════════════════════════════
function ApprovalsTab({ showToast }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminAPI
      .pendingDoctors()
      .then((data) => setPending(Array.isArray(data) ? data : []))
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const approve = async (userId) => {
    setBusyId(userId);
    try {
      await adminAPI.approveDoctor(userId);
      showToast("Doctor approved");
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (userId) => {
    const reason = window.prompt("Rejection reason (optional):") || "";
    setBusyId(userId);
    try {
      await adminAPI.rejectDoctor(userId, reason);
      showToast("Doctor rejected");
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="vadr-surface vadr-surface-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Pending doctor approvals</h2>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>Review and approve doctor registrations before they can access patient data.</p>
      </div>
      <div className="vadr-surface vadr-surface-panel">
        {loading && <div style={{ padding: 24 }}>Loading…</div>}
        {!loading && pending.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No pending doctor accounts</div>
        )}
        {!loading && pending.map((doc) => (
          <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
            <Avatar name={doc.name} color="#0694a2" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{doc.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{doc.email} · {doc.department || "Ophthalmology"}</div>
            </div>
            <StatusDot status={doc.status} />
            <Btn loading={busyId === doc.id} variant="success" onClick={() => approve(doc.id)}>Approve</Btn>
            <Btn loading={busyId === doc.id} variant="danger" onClick={() => reject(doc.id)}>Reject</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RBAC TAB — admin-only editable permission matrix
// ══════════════════════════════════════════════════════════════════════════════
function cloneMatrix(m) {
  return Object.fromEntries(
    Object.entries(m).map(([perm, roles]) => [perm, { ...roles }])
  );
}

function isPermissionLocked(perm, role) {
  return role === "admin" && ADMIN_LOCKED_PERMS.includes(perm);
}

function PermissionToggle({ on, onChange, disabled, label }) {
  return (
    <button
      type="button"
      className={`vadr-rbac-toggle ${on ? "vadr-rbac-toggle--on" : "vadr-rbac-toggle--off"}`}
      onClick={() => onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      title={disabled ? "Required for Admin" : on ? "Revoke" : "Grant"}
    >
      <span className="vadr-rbac-toggle-knob" />
    </button>
  );
}

function RBACTab({ showToast }) {
  const allRoles = ["admin", "doctor", "screener", "patient"];
  const [activeRole, setActiveRole] = useState("admin");
  const [matrix, setMatrix] = useState(() => cloneMatrix(DEFAULT_PERMISSION_MATRIX));
  const [savedMatrix, setSavedMatrix] = useState(() => cloneMatrix(DEFAULT_PERMISSION_MATRIX));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getPermissions();
      const m = cloneMatrix(data.matrix || DEFAULT_PERMISSION_MATRIX);
      setMatrix(m);
      setSavedMatrix(cloneMatrix(m));
      setMeta(data.meta || null);
    } catch (err) {
      showToast(err.message || "Could not load permissions", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const isDirty = JSON.stringify(matrix) !== JSON.stringify(savedMatrix);

  const toggle = (perm, role) => {
    if (isPermissionLocked(perm, role)) return;
    setMatrix((prev) => ({
      ...prev,
      [perm]: { ...prev[perm], [role]: !prev[perm][role] },
    }));
  };

  const setAllForRole = (role, value) => {
    setMatrix((prev) => {
      const next = cloneMatrix(prev);
      Object.keys(next).forEach((perm) => {
        if (!isPermissionLocked(perm, role)) next[perm][role] = value;
      });
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await adminAPI.updatePermissions(matrix);
      const m = cloneMatrix(data.matrix || matrix);
      setMatrix(m);
      setSavedMatrix(cloneMatrix(m));
      setMeta(data.meta || null);
      showToast("Permissions saved");
    } catch (err) {
      showToast(err.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setMatrix(cloneMatrix(savedMatrix));
    showToast("Changes discarded", "info");
  };

  const resetDefaults = async () => {
    if (!window.confirm("Reset all roles to factory defaults? This cannot be undone.")) return;
    setSaving(true);
    try {
      const data = await adminAPI.resetPermissions();
      const m = cloneMatrix(data.matrix || DEFAULT_PERMISSION_MATRIX);
      setMatrix(m);
      setSavedMatrix(cloneMatrix(m));
      setMeta(data.meta || null);
      showToast("Permissions reset to defaults");
    } catch (err) {
      showToast(err.message || "Reset failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const perms = Object.keys(matrix).filter(
    (p) => !filter.trim() || p.toLowerCase().includes(filter.toLowerCase())
  );
  const activeConf = ROLE_PERMISSIONS[activeRole];
  const grantedCount = Object.values(matrix).filter((r) => r[activeRole]).length;

  return (
    <div className="vadr-panel">
      <div className="vadr-rbac-header">
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--vadr-text)" }}>Roles & Permissions</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--vadr-text-muted)" }}>
            Configure what each role can do. Only administrators can edit this matrix.
          </p>
          {meta?.updated_at && (
            <p className="vadr-rbac-meta">
              Last saved: {new Date(meta.updated_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="vadr-rbac-actions">
          <Btn variant="secondary" icon="close" onClick={discard} disabled={!isDirty || saving || loading}>
            Discard
          </Btn>
          <Btn variant="warning" onClick={resetDefaults} disabled={saving || loading}>
            Reset defaults
          </Btn>
          <Btn icon="check" onClick={save} loading={saving} disabled={!isDirty || loading}>
            Save changes
          </Btn>
        </div>
      </div>

      {isDirty && (
        <div className="vadr-rbac-unsaved">
          <Icon d={I.warning} size={14} color="#d97706" />
          You have unsaved permission changes
        </div>
      )}

      <div className="vadr-rbac-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allRoles.map((role) => {
            const conf = ROLE_PERMISSIONS[role];
            const count = Object.values(matrix).filter((r) => r[role]).length;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
                className={`vadr-rbac-role-btn${activeRole === role ? " vadr-rbac-role-btn--active" : ""}`}
                style={
                  activeRole === role
                    ? { background: conf.bg, borderColor: conf.color }
                    : undefined
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: activeRole === role ? `${conf.color}22` : "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon d={I.shield} size={16} color={activeRole === role ? conf.color : "#94a3b8"} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: activeRole === role ? conf.color : "#111827" }}>
                      {conf.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{conf.desc}</div>
                    <div style={{ fontSize: 10, color: conf.color, fontWeight: 700, marginTop: 4 }}>
                      {count} / {Object.keys(matrix).length} permissions
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="vadr-rbac-panel">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: activeConf?.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon d={I.shield} size={18} color={activeConf?.color} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Permission matrix</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Toggle switches to grant or revoke access — column highlight: {activeConf?.label}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn size="sm" variant="success" onClick={() => setAllForRole(activeRole, true)} disabled={loading}>
                Grant all ({activeConf?.label})
              </Btn>
              <Btn size="sm" variant="danger" onClick={() => setAllForRole(activeRole, false)} disabled={loading || activeRole === "admin"}>
                Revoke all ({activeConf?.label})
              </Btn>
            </div>
          </div>

          <div style={{ padding: "12px 20px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ position: "relative", maxWidth: 320 }}>
              <Icon d={I.search} size={14} color="#94a3b8" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter permissions…"
                style={{ ...inputStyle, paddingLeft: 34 }}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }} className="vadr-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ ...thStyle, minWidth: 200 }}>Permission</th>
                  {allRoles.map((r) => (
                    <th
                      key={r}
                      style={{
                        ...thStyle,
                        textAlign: "center",
                        minWidth: 100,
                        color: r === activeRole ? ROLE_PERMISSIONS[r].color : "#6b7280",
                        background: r === activeRole ? `${ROLE_PERMISSIONS[r].color}10` : "#f9fafb",
                      }}
                    >
                      {ROLE_PERMISSIONS[r].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} cols={5} />)}
                {!loading && perms.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
                      No permissions match your filter
                    </td>
                  </tr>
                )}
                {!loading && perms.map((perm) => (
                  <tr key={perm} className="vadr-rbac-row">
                    <td style={{ ...tdStyle, fontWeight: 500, color: "#334155" }}>
                      {perm}
                      {ADMIN_LOCKED_PERMS.includes(perm) && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>· admin locked</span>
                      )}
                    </td>
                    {allRoles.map((r) => {
                      const on = matrix[perm]?.[r];
                      const locked = isPermissionLocked(perm, r);
                      return (
                        <td
                          key={r}
                          style={{
                            ...tdStyle,
                            textAlign: "center",
                            background: r === activeRole ? `${ROLE_PERMISSIONS[r].color}06` : "transparent",
                          }}
                        >
                          <PermissionToggle
                            on={on}
                            onChange={() => toggle(perm, r)}
                            disabled={locked || loading || saving}
                            label={`${perm} for ${r}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "14px 20px", background: `${activeConf?.color}08`, borderTop: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              <b style={{ color: activeConf?.color }}>{activeConf?.label}</b> has{" "}
              <b>{grantedCount}</b> of {Object.keys(matrix).length} permissions enabled.
              {activeRole === "admin" && " Core admin permissions cannot be revoked."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
