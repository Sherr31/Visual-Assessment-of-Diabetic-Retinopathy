import React, { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Upload, Users, Eye,
  BarChart3, ClipboardList, Settings, LogOut,
  UserCheck, Camera, Stethoscope, User, Shield
} from "lucide-react";
import { AuthContext } from "../../App";

const NAV_DOCTOR = [
  { to: "/dash/overview",   icon: LayoutDashboard, label: "Dashboard" },
  { to: "/dash/upload",     icon: Upload,          label: "Upload Retina Scan" },
  { to: "/dash/patients",   icon: Users,           label: "Patient Records" },
  { to: "/dash/assessment", icon: Eye,             label: "Assessment Results" },
  { to: "/dash/analytics",  icon: BarChart3,       label: "AI Analytics" },
  { to: "/dash/reports",    icon: ClipboardList,   label: "Reports" },
];
const NAV_PATIENT    = [{ to: "/dash/patient-dashboard", icon: UserCheck, label: "My Health Portal" }];
const NAV_TECHNICIAN = [{ to: "/dash/tech-dashboard",    icon: Camera,    label: "Imaging Console"  }];
const NAV_ADMIN      = [
  { to: "/dash/admin",             icon: Shield,    label: "Admin Dashboard" },
  { to: "/dash/patient-dashboard", icon: UserCheck, label: "Patient Portal" },
  { to: "/dash/tech-dashboard",    icon: Camera,    label: "Technician Console" },
];

const ROLE_CONFIG = {
  doctor:     { label: "Doctor",     subtitle: "Ophthalmologist",        icon: Stethoscope, gradient: "linear-gradient(135deg,#0F4C81,#1a6bb5)", accent: "#60a5fa" },
  patient:    { label: "Patient",    subtitle: "Personal Health Portal", icon: User,        gradient: "linear-gradient(135deg,#10B981,#059669)", accent: "#34d399" },
  technician: { label: "Technician", subtitle: "Imaging Console",        icon: Camera,      gradient: "linear-gradient(135deg,#7C3AED,#6d28d9)", accent: "#a78bfa" },
  admin:      { label: "Admin",      subtitle: "Platform Management",    icon: Shield,      gradient: "linear-gradient(135deg,#EF4444,#dc2626)", accent: "#fca5a5" },
};

export default function Sidebar() {
  const navigate = useNavigate();
  const { user, handleLogout } = useContext(AuthContext);
  const role = user?.role || "doctor";
  const rc   = ROLE_CONFIG[role] || ROLE_CONFIG.doctor;
  const RoleIcon = rc.icon;

  const mainNav =
    role === "patient"    ? NAV_PATIENT :
    role === "technician" ? NAV_TECHNICIAN :
    role === "admin"      ? NAV_ADMIN :
    NAV_DOCTOR;

  return (
    <motion.aside
      initial={{ x: -280 }} animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed left-0 top-0 bottom-0 w-64 z-30 flex flex-col"
      style={{ background: "linear-gradient(165deg,#0F4C81 0%,#0a3560 60%,#071f3d 100%)" }}>

      {/* Logo */}
      <div className="px-6 pt-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-lg leading-none">VADR</p>
            <p className="text-blue-300 text-xs mt-0.5">DR Assessment Platform</p>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ margin: "14px 12px 0", padding: "10px 14px", background: "rgba(255,255,255,0.07)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: rc.gradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <RoleIcon size={16} style={{ color: "#fff" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{user?.username || rc.label}</p>
          <p style={{ fontSize: 10, color: rc.accent }}>{rc.subtitle}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        <p className="text-blue-400 text-[10px] font-semibold uppercase tracking-widest px-3 mb-3">Navigation</p>
        <ul className="space-y-1">
          {mainNav.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink to={to} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Settings for all roles */}
        <div className="pt-4 mt-4 border-t border-white/10">
          <ul>
            <li>
              <NavLink to="/dash/settings" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
                <Settings className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">Settings</span>
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => { handleLogout(); navigate("/dash/login"); }}
          className="w-full flex items-center gap-2 text-blue-300 hover:text-white text-sm px-3 py-2 rounded-xl hover:bg-white/10 transition-all">
          <LogOut className="w-4 h-4" /><span>Sign Out</span>
        </button>
      </div>
    </motion.aside>
  );
}
