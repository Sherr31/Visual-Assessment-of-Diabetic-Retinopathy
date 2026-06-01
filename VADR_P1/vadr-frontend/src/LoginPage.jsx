import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI, ApiError } from "./api";
import { getHomeRoute } from "./lib/session";
import "./vadr-auth.css";
import ThemeToggle from "./components/ThemeToggle";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@vadr.pk", password: "admin123" },
];

const EyeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const EyeOnIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "VADR — Sign in";
    return () => { document.title = "VADR"; };
  }, []);

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setErr("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await authAPI.login(email, password);
      const user = data.user || JSON.parse(localStorage.getItem("vadr_user") || "null");
      navigate(getHomeRoute(user), { replace: true });
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vadr-auth-page">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>
      <div className="vadr-auth-theme-wrap">
        <ThemeToggle iconOnly />
      </div>

      <div className="vadr-auth-blob vadr-auth-blob--1" aria-hidden />
      <div className="vadr-auth-blob vadr-auth-blob--2" aria-hidden />
      <div className="vadr-auth-blob vadr-auth-blob--3" aria-hidden />

      <div className="vadr-auth-card">
        <div className="vadr-auth-brand">
          <div className="vadr-auth-logo">
            <EyeIcon />
          </div>
          <h1 className="vadr-auth-title">VADR</h1>
          <p className="vadr-auth-tagline">
            Visual Assessment of Diabetic Retinopathy
            <br />
            Sign in to your clinical portal
          </p>
        </div>

        <form onSubmit={submit}>
          {err && (
            <div className="vadr-auth-error" role="alert">
              <AlertIcon />
              <span>{err}</span>
            </div>
          )}

          <div className="vadr-auth-field">
            <label className="vadr-auth-label" htmlFor="login-email">Email</label>
            <div className="vadr-auth-input-wrap">
              <input
                id="login-email"
                type="email"
                className="vadr-auth-input vadr-auth-input--no-toggle"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.pk"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="vadr-auth-field">
            <label className="vadr-auth-label" htmlFor="login-password">Password</label>
            <div className="vadr-auth-input-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="vadr-auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="vadr-auth-toggle-pw"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeOnIcon />}
              </button>
            </div>
          </div>

          <button type="submit" className="vadr-auth-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="vadr-auth-spinner" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="vadr-auth-footer">
          No account? <Link to="/register">Create one</Link>
        </p>

        <div className="vadr-auth-demo">
          <div className="vadr-auth-demo-label">Quick demo (after seed)</div>
          <div className="vadr-auth-demo-chips">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.label}
                type="button"
                className="vadr-auth-demo-chip"
                onClick={() => fillDemo(acc)}
              >
                {acc.label}: {acc.email}
              </button>
            ))}
          </div>
        </div>

        <div className="vadr-auth-features">
          <span className="vadr-auth-feature">
            <span className="vadr-auth-feature-dot" />
            Secure JWT auth
          </span>
          <span className="vadr-auth-feature">Role-based access</span>
        </div>
      </div>
    </div>
  );
}
