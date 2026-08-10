import { Link } from "react-router-dom";
import { authAPI } from "../api";
import { getStoredUser } from "../api";
import "../vadr-auth.css";
import ThemeToggle from "../components/ThemeToggle";

export default function PendingApprovalPage() {
  const user = getStoredUser();

  const logout = async () => {
    await authAPI.logout();
    window.location.href = "/login";
  };

  return (
    <div className="vadr-auth-page">
      <div className="vadr-auth-theme-wrap">
        <ThemeToggle iconOnly />
      </div>
      <div className="vadr-auth-card" style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <h1 className="vadr-auth-title" style={{ fontSize: 22 }}>Account pending approval</h1>
        <p className="vadr-auth-tagline">
          Hi {user?.name || "Doctor"}, your VADR doctor account is waiting for admin approval.
          You will receive an email once approved.
        </p>
        <p className="vadr-text-faint" style={{ fontSize: 12, marginTop: 16 }}>{user?.email}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          <button type="button" onClick={logout} className="vadr-theme-toggle">
            Sign out
          </button>
          <Link to="/login" className="vadr-auth-submit" style={{ width: "auto", padding: "10px 18px", textDecoration: "none" }}>
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
