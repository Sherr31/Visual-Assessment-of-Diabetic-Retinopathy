import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import VadrModule2 from "./vadr-module2";
import DrDashboard from "./DrDashboard";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

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
              <VadrModule2 />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
