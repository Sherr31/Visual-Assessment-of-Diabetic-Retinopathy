import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import DrDashboard from "./DrDashboard";
import LoginPage from "./modules/p1-mid/auth/pages/LoginPage";
import RegisterPage from "./modules/p1-mid/auth/pages/RegisterPage";
import ForgotPasswordPage from "./modules/p1-mid/auth/pages/ForgotPasswordPage";
import PatientUserManagementPage from "./modules/p1-mid/patient-user-management/pages/PatientUserManagementPage";
import MedicalHistoryManagementPage from "./modules/p1-mid/medical-history-management/pages/MedicalHistoryManagementPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import PatientRecordsPage from "./pages/PatientRecordsPage";
import { getToken, getStoredUser } from "./api";
import { canAccessStaffPortal, getHomeRoute } from "./lib/session";

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function RequireStaff({ children }) {
  const user = getStoredUser();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (user?.role === "doctor" && user?.status === "pending_approval") {
    return <Navigate to="/pending-approval" replace />;
  }
  if (user?.role === "patient") return <Navigate to="/my-records" replace />;
  if (!canAccessStaffPortal(user)) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
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
        <Route
          path="/my-records"
          element={
            <RequireAuth>
              <PatientRecordsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/doctor"
          element={
            <RequireStaff>
              <DrDashboard />
            </RequireStaff>
          }
        />
        <Route
          path="/"
          element={
            <RequireStaff>
              <PatientUserManagementPage />
            </RequireStaff>
          }
        />
        <Route
          path="/medical-history/:patientId"
          element={
            <RequireAuth>
              <MedicalHistoryManagementPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
