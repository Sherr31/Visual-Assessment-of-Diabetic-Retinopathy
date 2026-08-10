/**
 * App.js — VADR Merged Platform
 *
 * Primary auth: VADR JWT (email/password → localStorage vadr_token + vadr_user)
 * Dashboard auth: role-based session stored in sessionStorage (vadr_dash_user)
 *
 * VADR routes  (/login, /register, /forgot-password, /, /doctor, /my-records, /medical-history/*)
 * Dash routes  (/dash/login, /dash/overview, /dash/upload, /dash/patients,
 *               /dash/assessment, /dash/analytics, /dash/reports, /dash/settings,
 *               /dash/patient-dashboard, /dash/tech-dashboard, /dash/admin)
 */

import React, { useState, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

// ── VADR auth helpers ─────────────────────────────────────────────────────────
import { getToken, getStoredUser } from "./api";
import { canAccessStaffPortal, getHomeRoute } from "./lib/session";

// ── VADR pages ────────────────────────────────────────────────────────────────
import LoginPage            from "./modules/p1-mid/auth/pages/LoginPage";
import RegisterPage         from "./modules/p1-mid/auth/pages/RegisterPage";
import ForgotPasswordPage   from "./modules/p1-mid/auth/pages/ForgotPasswordPage";
import PendingApprovalPage  from "./pages/PendingApprovalPage";
import PatientRecordsPage   from "./pages/PatientRecordsPage";
import PatientUserManagementPage   from "./modules/p1-mid/patient-user-management/pages/PatientUserManagementPage";
import MedicalHistoryManagementPage from "./modules/p1-mid/medical-history-management/pages/MedicalHistoryManagementPage";
import DrDashboard from "./DrDashboard";

// ── Dashboard layout & pages (v8, with merged VADR functionality) ─────────────
import DashLayout          from "./components/Layout/Layout";
import DashLogin           from "./pages/dash/Login";
import Overview            from "./pages/dash/Overview";
import UploadScan          from "./pages/dash/UploadScan";
import PatientRecords      from "./pages/dash/PatientRecords";
import AssessmentResults   from "./pages/dash/AssessmentResults";
import AIAnalytics         from "./pages/dash/AIAnalytics";
import Reports             from "./pages/dash/Reports";
import Settings            from "./pages/dash/Settings";
import PatientDashboard    from "./pages/dash/PatientDashboard";
import TechnicianDashboard from "./pages/dash/TechnicianDashboard";
import AdminDashboard      from "./pages/dash/AdminDashboard";

// ════════════════════════════════════════════════════════════════════════════
// Dashboard AuthContext — role-based, session-scoped
// ════════════════════════════════════════════════════════════════════════════
export const AuthContext = createContext(null);

const ROLE_HOME = {
  doctor:     "/dash/overview",
  patient:    "/dash/patient-dashboard",
  technician: "/dash/tech-dashboard",
  admin:      "/dash/admin",
};

function DashRequireAuth({ children, allowedRoles }) {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/dash/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to={ROLE_HOME[user.role] || "/dash/login"} replace />;
  return children;
}

// ════════════════════════════════════════════════════════════════════════════
// VADR JWT Guards
// ════════════════════════════════════════════════════════════════════════════
function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function RequireStaff({ children }) {
  const user = getStoredUser();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (user?.role === "doctor" && user?.status === "pending_approval")
    return <Navigate to="/pending-approval" replace />;
  if (user?.role === "patient") return <Navigate to="/my-records" replace />;
  if (!canAccessStaffPortal(user)) return <Navigate to="/login" replace />;
  return children;
}

// ════════════════════════════════════════════════════════════════════════════
// App Root
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  // Dashboard session (role-based demo login)
  const [dashUser, setDashUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("vadr_dash_user")); } catch { return null; }
  });

  const handleDashLogin  = (u) => { setDashUser(u); sessionStorage.setItem("vadr_dash_user", JSON.stringify(u)); };
  const handleDashLogout = ()  => { setDashUser(null); sessionStorage.removeItem("vadr_dash_user"); };

  const dashHome = dashUser ? (ROLE_HOME[dashUser.role] || "/dash/overview") : "/dash/login";

  return (
    <AuthContext.Provider value={{ user: dashUser, handleLogout: handleDashLogout }}>
      <BrowserRouter>
        <Routes>

          {/* ── VADR JWT auth & management routes ──────────────────────── */}
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route path="/pending-approval" element={
            <RequireAuth><PendingApprovalPage /></RequireAuth>
          } />
          <Route path="/my-records" element={
            <RequireAuth><PatientRecordsPage /></RequireAuth>
          } />
          <Route path="/" element={
            <RequireStaff><PatientUserManagementPage /></RequireStaff>
          } />
          <Route path="/medical-history/:patientId" element={
            <RequireAuth><MedicalHistoryManagementPage /></RequireAuth>
          } />
          {/* Legacy /doctor route — retains original DrDashboard (scan viewer) */}
          <Route path="/doctor" element={
            <RequireStaff><DrDashboard /></RequireStaff>
          } />

          {/* ── Dashboard login ─────────────────────────────────────────── */}
          <Route path="/dash/login" element={
            dashUser ? <Navigate to={dashHome} replace /> : <DashLogin onLogin={handleDashLogin} />
          } />

          {/* ── Dashboard nested routes ─────────────────────────────────── */}
          <Route path="/dash" element={
            <DashRequireAuth><DashLayout /></DashRequireAuth>
          }>
            <Route index element={<Navigate to={dashHome} replace />} />

            {/* Doctor routes */}
            <Route path="overview"   element={<DashRequireAuth allowedRoles={["doctor"]}><Overview /></DashRequireAuth>} />
            <Route path="upload"     element={<DashRequireAuth allowedRoles={["doctor"]}><UploadScan /></DashRequireAuth>} />
            <Route path="patients"   element={<DashRequireAuth allowedRoles={["doctor"]}><PatientRecords /></DashRequireAuth>} />
            <Route path="assessment" element={<DashRequireAuth allowedRoles={["doctor"]}><AssessmentResults /></DashRequireAuth>} />
            <Route path="analytics"  element={<DashRequireAuth allowedRoles={["doctor"]}><AIAnalytics /></DashRequireAuth>} />
            <Route path="reports"    element={<DashRequireAuth allowedRoles={["doctor"]}><Reports /></DashRequireAuth>} />
            <Route path="settings"   element={<DashRequireAuth allowedRoles={["doctor","patient","technician","admin"]}><Settings /></DashRequireAuth>} />

            {/* Patient */}
            <Route path="patient-dashboard" element={<DashRequireAuth allowedRoles={["patient","doctor","admin"]}><PatientDashboard /></DashRequireAuth>} />

            {/* Technician */}
            <Route path="tech-dashboard" element={<DashRequireAuth allowedRoles={["technician","doctor","admin"]}><TechnicianDashboard /></DashRequireAuth>} />

            {/* Admin */}
            <Route path="admin" element={<DashRequireAuth allowedRoles={["admin"]}><AdminDashboard /></DashRequireAuth>} />
          </Route>

          {/* Catch-all → VADR home */}
          <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />

        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
