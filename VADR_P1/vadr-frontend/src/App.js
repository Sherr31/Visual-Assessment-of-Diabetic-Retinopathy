import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import LoginPage from "./modules/p1-mid/auth/pages/LoginPage";
import RegisterPage from "./modules/p1-mid/auth/pages/RegisterPage";
import ForgotPasswordPage from "./modules/p1-mid/auth/pages/ForgotPasswordPage";
import PatientUserManagementPage from "./modules/p1-mid/patient-user-management/pages/PatientUserManagementPage";
import MedicalHistoryManagementPage from "./modules/p1-mid/medical-history-management/pages/MedicalHistoryManagementPage";
import FundusImagePage from "./modules/p1-mid/fundus-image/pages/FundusImagePage";
import PendingApprovalPage from "./pages/PendingApprovalPage";

// ─── Four Dedicated Role Dashboards ───
import AdminDashboard from "./dashboards/admin/AdminDashboard";
import DoctorDashboard from "./dashboards/doctor/DoctorDashboard";
import ScreenerDashboard from "./dashboards/screener/ScreenerDashboard";
import PatientDashboard from "./dashboards/patient/PatientDashboard";
import ReportsPage from "./pages/ReportsPage";

// ─── Guards & Utilities ───
import RoleRoute from "./components/guards/RoleRoute";
import { getToken } from "./api";
import { getHomeRoute } from "./lib/session";

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function LegacyHomeRedirect() {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={getHomeRoute()} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ─── Public Authentication ─── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/pending-approval"
          element={
            <RequireAuth>
              <PendingApprovalPage />
            </RequireAuth>
          }
        />

        {/* ─── 1. Admin Dedicated Portal ─── */}
        <Route
          path="/admin/dashboard"
          element={
            <RoleRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/patients"
          element={
            <RoleRoute allowedRoles={["admin"]}>
              <PatientUserManagementPage defaultTab="patients" />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleRoute allowedRoles={["admin"]}>
              <PatientUserManagementPage defaultTab="users" />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/approvals"
          element={
            <RoleRoute allowedRoles={["admin"]}>
              <PatientUserManagementPage defaultTab="approvals" />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <RoleRoute allowedRoles={["admin"]}>
              <PatientUserManagementPage defaultTab="audit-logs" />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/backups"
          element={
            <RoleRoute allowedRoles={["admin"]}>
              <PatientUserManagementPage defaultTab="backups" />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/rbac"
          element={
            <RoleRoute allowedRoles={["admin"]}>
              <PatientUserManagementPage defaultTab="rbac" />
            </RoleRoute>
          }
        />

        {/* ─── 2. Doctor Dedicated Portal ─── */}
        <Route
          path="/doctor/dashboard"
          element={
            <RoleRoute allowedRoles={["doctor", "admin"]}>
              <DoctorDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/doctor/patients"
          element={
            <RoleRoute allowedRoles={["doctor", "admin"]}>
              <PatientUserManagementPage defaultTab="patients" />
            </RoleRoute>
          }
        />

        {/* ─── 3. Screener Dedicated Portal ─── */}
        <Route
          path="/screener/dashboard"
          element={
            <RoleRoute allowedRoles={["screener", "admin"]}>
              <ScreenerDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/screener/patients"
          element={
            <RoleRoute allowedRoles={["screener", "admin"]}>
              <PatientUserManagementPage defaultTab="patients" />
            </RoleRoute>
          }
        />

        {/* ─── 4. Patient Dedicated Portal ─── */}
        <Route
          path="/patient/dashboard"
          element={
            <RoleRoute allowedRoles={["patient"]}>
              <PatientDashboard />
            </RoleRoute>
          }
        />

        {/* ─── Clinical Workstation Tools ─── */}
        <Route
          path="/fundus-analysis"
          element={
            <RoleRoute allowedRoles={["admin", "doctor", "screener", "patient"]}>
              <FundusImagePage />
            </RoleRoute>
          }
        />
        <Route
          path="/medical-history/:patientId"
          element={
            <RoleRoute allowedRoles={["admin", "doctor", "screener", "patient"]}>
              <MedicalHistoryManagementPage />
            </RoleRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <RoleRoute allowedRoles={["admin", "doctor", "screener"]}>
              <ReportsPage />
            </RoleRoute>
          }
        />

        {/* ─── Legacy Compatibility & Root Redirection ─── */}
        <Route path="/dashboard" element={<LegacyHomeRedirect />} />
        <Route path="/doctor" element={<LegacyHomeRedirect />} />
        <Route path="/my-records" element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="/" element={<LegacyHomeRedirect />} />

        {/* ─── Catch-All ─── */}
        <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
