import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Eye,
  Layers,
  Users,
  UserCheck,
  FileText,
  Database,
  ShieldCheck,
  User,
  Upload,
  LogOut,
  Activity,
  HeartPulse,
  BookOpen,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { authAPI, clearSession, getStoredUser } from "../../api";
import ThemeToggle from "../ThemeToggle";

export default function RoleSidebar({ activeTab = null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser() || {};
  const currentPath = location.pathname;

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {}
    clearSession();
    navigate("/login");
  };

  const role = user.role || "doctor";

  // Role subtitle & badge configuration
  const roleMeta = {
    admin: { subtitle: "System Operations", badge: "Admin", badgeBg: "#1e3a8a", badgeColor: "#bfdbfe" },
    doctor: { subtitle: "Clinical Screening", badge: "Physician", badgeBg: "#064e3b", badgeColor: "#a7f3d0" },
    screener: { subtitle: "Fundus Intake", badge: "Screener", badgeBg: "#164e63", badgeColor: "#a5f3fc" },
    patient: { subtitle: "Health Portal", badge: "Patient", badgeBg: "#78350f", badgeColor: "#fde68a" },
  }[role] || { subtitle: "Clinical Portal", badge: "Staff", badgeBg: "#1e3a8a", badgeColor: "#bfdbfe" };

  return (
    <>
      {/* Mobile Top Bar with Hamburger */}
      <div className="vadr-mobile-nav-bar" style={{ display: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "linear-gradient(135deg, #1a56db 0%, #0891b2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Eye size={15} strokeWidth={2.4} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--vadr-text)" }}>VADR</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              textTransform: "uppercase",
              background: roleMeta.badgeBg,
              color: roleMeta.badgeColor,
              padding: "1px 5px",
              borderRadius: 4,
            }}
          >
            {roleMeta.badge}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              background: "transparent",
              border: "1px solid var(--vadr-border)",
              borderRadius: 6,
              padding: "5px 8px",
              color: "var(--vadr-text)",
              cursor: "pointer",
            }}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Main Sidebar (Desktop fixed / Mobile modal drawer) */}
      <aside
        className={`vadr-sidebar ${mobileOpen ? "vadr-sidebar--open" : ""}`}
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
          transition: "transform 0.25s ease",
        }}
      >
        {/* Top Branding */}
        <div>
          <div
            style={{
              padding: "18px 18px 16px",
              borderBottom: "1px solid var(--vadr-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  boxShadow: "0 2px 8px rgba(26, 86, 219, 0.25)",
                  flexShrink: 0,
                }}
              >
                <Eye size={18} strokeWidth={2.4} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: "var(--vadr-text)",
                    lineHeight: 1.15,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>VADR</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      background: roleMeta.badgeBg,
                      color: roleMeta.badgeColor,
                      padding: "1px 5px",
                      borderRadius: 4,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {roleMeta.badge}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--vadr-text-muted)",
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {roleMeta.subtitle}
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
            {mobileOpen && (
              <button
                onClick={() => setMobileOpen(false)}
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
            )}
          </div>

          {/* ─── Role-Based Navigation Items ─── */}
          <div style={{ padding: "14px 10px", overflowY: "auto", maxHeight: "calc(100vh - 155px)" }}>
            
            {/* ────────── 1. ADMIN NAVIGATION ────────── */}
            {role === "admin" && (
              <>
                <div style={sectionLabelStyle}>Operations</div>
                <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  <SidebarLink
                    to="/admin/dashboard"
                    active={currentPath === "/admin/dashboard"}
                    icon={<Layers size={15} />}
                    label="System Overview"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/admin/patients"
                    active={currentPath === "/admin/patients" || (currentPath === "/" && activeTab === "patients")}
                    icon={<User size={15} />}
                    label="Patient Registry"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/reports"
                    active={currentPath === "/reports"}
                    icon={<FileText size={15} />}
                    label="Diagnostic Reports"
                    onClick={() => setMobileOpen(false)}
                  />
                </nav>

                <div style={{ ...sectionLabelStyle, marginTop: 16 }}>Administration</div>
                <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  <SidebarLink
                    to="/admin/users"
                    active={currentPath === "/admin/users" || (currentPath === "/" && activeTab === "users")}
                    icon={<Users size={15} />}
                    label="User Management"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/admin/approvals"
                    active={currentPath === "/admin/approvals" || (currentPath === "/" && activeTab === "approvals")}
                    icon={<UserCheck size={15} />}
                    label="Doctor Approvals"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/admin/audit-logs"
                    active={currentPath === "/admin/audit-logs" || (currentPath === "/" && activeTab === "audit")}
                    icon={<FileText size={15} />}
                    label="Audit Logs"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/admin/backups"
                    active={currentPath === "/admin/backups" || (currentPath === "/" && activeTab === "backups")}
                    icon={<Database size={15} />}
                    label="System Backups"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/admin/rbac"
                    active={currentPath === "/admin/rbac" || (currentPath === "/" && activeTab === "rbac")}
                    icon={<ShieldCheck size={15} />}
                    label="Permission Matrix"
                    onClick={() => setMobileOpen(false)}
                  />
                </nav>
              </>
            )}

            {/* ────────── 2. DOCTOR NAVIGATION ────────── */}
            {role === "doctor" && (
              <>
                <div style={sectionLabelStyle}>Clinical Workstation</div>
                <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  <SidebarLink
                    to="/doctor/dashboard"
                    active={currentPath === "/doctor/dashboard" || currentPath === "/dashboard" || currentPath === "/doctor"}
                    icon={<HeartPulse size={15} />}
                    label="Clinical Dashboard"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/fundus-analysis"
                    active={currentPath === "/fundus-analysis"}
                    icon={<Upload size={15} />}
                    label="Fundus Analysis & AI"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/doctor/patients"
                    active={currentPath === "/doctor/patients" || currentPath === "/"}
                    icon={<User size={15} />}
                    label="Patient Registry"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/reports"
                    active={currentPath === "/reports"}
                    icon={<FileText size={15} />}
                    label="Report Archive"
                    onClick={() => setMobileOpen(false)}
                  />
                </nav>
              </>
            )}

            {/* ────────── 3. SCREENER NAVIGATION ────────── */}
            {role === "screener" && (
              <>
                <div style={sectionLabelStyle}>Intake Workstation</div>
                <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  <SidebarLink
                    to="/screener/dashboard"
                    active={currentPath === "/screener/dashboard"}
                    icon={<Activity size={15} />}
                    label="Intake Overview"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/fundus-analysis"
                    active={currentPath === "/fundus-analysis"}
                    icon={<Upload size={15} />}
                    label="New Fundus Scan"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/screener/patients"
                    active={currentPath === "/screener/patients" || currentPath === "/"}
                    icon={<User size={15} />}
                    label="Register Patient"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/reports"
                    active={currentPath === "/reports"}
                    icon={<FileText size={15} />}
                    label="Report Archive"
                    onClick={() => setMobileOpen(false)}
                  />
                </nav>
              </>
            )}

            {/* ────────── 4. PATIENT NAVIGATION ────────── */}
            {role === "patient" && (
              <>
                <div style={sectionLabelStyle}>My Health Portal</div>
                <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  <SidebarLink
                    to="/patient/dashboard"
                    active={currentPath === "/patient/dashboard" || currentPath === "/my-records"}
                    icon={<HeartPulse size={15} />}
                    label="My DR Assessment"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/fundus-analysis"
                    active={currentPath === "/fundus-analysis"}
                    icon={<Upload size={15} />}
                    label="Upload Fundus Image"
                    onClick={() => setMobileOpen(false)}
                  />
                  <SidebarLink
                    to="/patient/dashboard#reports"
                    active={location.hash === "#reports"}
                    icon={<FileText size={15} />}
                    label="Diagnostic Reports"
                    onClick={() => {
                      setMobileOpen(false);
                      const el = document.getElementById("reports");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  />
                  <SidebarLink
                    to="/patient/dashboard#timeline"
                    active={location.hash === "#timeline"}
                    icon={<Clock size={15} />}
                    label="Screening History"
                    onClick={() => {
                      setMobileOpen(false);
                      const el = document.getElementById("timeline");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  />
                  <SidebarLink
                    to="/patient/dashboard#education"
                    active={location.hash === "#education"}
                    icon={<BookOpen size={15} />}
                    label="Diabetic Eye Care"
                    onClick={() => {
                      setMobileOpen(false);
                      const el = document.getElementById("education");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  />
                </nav>
              </>
            )}

          </div>
        </div>

        {/* Sidebar Footer — User Profile & Logout */}
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--vadr-border)",
            background: "var(--vadr-surface-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
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
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {user.name ? user.name.slice(0, 2).toUpperCase() : role[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--vadr-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.name || "Authorized User"}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--vadr-text-muted)",
                    textTransform: "capitalize",
                    fontWeight: 500,
                  }}
                >
                  {user.role || "Clinical Staff"}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign out of VADR"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--vadr-text-muted)",
                cursor: "pointer",
                padding: "6px 7px",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.15s ease",
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({ to, active, icon, label, onClick }) {
  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (to && to.includes("#")) {
      const hash = to.split("#")[1];
      const target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <Link
      to={to}
      onClick={handleClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        borderRadius: 7,
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        textDecoration: "none",
        background: active ? "var(--vadr-primary-soft)" : "transparent",
        color: active ? "var(--vadr-primary)" : "var(--vadr-text-secondary)",
        border: active ? "1px solid var(--vadr-primary-border)" : "1px solid transparent",
        transition: "all 0.15s ease",
      }}
    >
      <span style={{ display: "flex", color: active ? "var(--vadr-primary)" : "var(--vadr-text-muted)" }}>
        {icon}
      </span>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </Link>
  );
}

const sectionLabelStyle = {
  fontSize: 9.5,
  fontWeight: 750,
  color: "var(--vadr-text-muted)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "4px 8px 2px",
};

