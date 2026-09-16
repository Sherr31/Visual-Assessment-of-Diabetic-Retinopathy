import FundusImageModule from "../FundusImageModule";
import "../../../../vadr-theme.css";
import "../../../../vadr-dashboard.css";
import { getToken, authAPI } from "../../../../api";
import { useNavigate, Link } from "react-router-dom";
import { Brain, LogOut, ChevronLeft } from "lucide-react";
import ThemeToggle from "../../../../components/ThemeToggle";

export default function FundusImagePage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    navigate("/login");
  };

  if (!getToken()) {
    navigate("/login");
    return null;
  }

  return (
    <div className="vadr-app">
      {/* Header */}
      <header className="vadr-header" style={{ gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="vadr-brand-mark">
            <Brain size={18} color="#fff" />
          </div>
          <div>
            <div className="vadr-brand-title">VADR</div>
          </div>
          <span className="vadr-brand-sub">Fundus Analysis</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <Link
            to="/"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 10,
              border: "1px solid var(--vadr-border)",
              background: "var(--vadr-surface-muted)",
              color: "var(--vadr-text-muted)",
              textDecoration: "none", fontSize: 12, fontWeight: 700,
              transition: "all 0.15s",
            }}
          >
            <ChevronLeft size={14} /> Back to Dashboard
          </Link>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 10,
              border: "1px solid var(--vadr-border)",
              background: "var(--vadr-btn-logout-bg)",
              color: "var(--vadr-text-muted)",
              cursor: "pointer", fontSize: 12, fontWeight: 700,
              fontFamily: "inherit", transition: "all 0.15s",
            }}
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="vadr-main">
        <FundusImageModule />
      </main>
    </div>
  );
}
