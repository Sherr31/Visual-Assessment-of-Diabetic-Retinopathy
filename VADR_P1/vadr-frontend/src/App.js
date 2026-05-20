import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import DrDashboard from "./DrDashboard";
import LoginPage from "./modules/p1-mid/auth/pages/LoginPage";
import RegisterPage from "./modules/p1-mid/auth/pages/RegisterPage";
import PatientUserManagementPage from "./modules/p1-mid/patient-user-management/pages/PatientUserManagementPage";
import MedicalHistoryManagementPage from "./modules/p1-mid/medical-history-management/pages/MedicalHistoryManagementPage";

function Protected({ children }) {
  const token = localStorage.getItem("vadr_token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/doctor"
          element={
            <Protected>
              <DrDashboard />
            </Protected>
          }
        />
        <Route
          path="/"
          element={
            <Protected>
              <PatientUserManagementPage />
            </Protected>
          }
        />
        <Route
          path="/medical-history/:patientId"
          element={
            <Protected>
              <MedicalHistoryManagementPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
