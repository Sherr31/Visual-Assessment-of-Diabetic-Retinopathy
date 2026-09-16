import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI, ApiError, setSession } from "./api";
import { getHomeRoute } from "./lib/session";
import "./vadr-auth.css";
import ThemeToggle from "./components/ThemeToggle";

const ROLES = [
  { value: "doctor", label: "Doctor" },
  { value: "screener", label: "Screener" },
  { value: "patient", label: "Patient" },
];

export default function RegisterPage() {
  const [phase, setPhase] = useState("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("doctor");
  const [department, setDepartment] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();

  const submitDetails = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      const data = await authAPI.register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        department: department.trim(),
      });

      if (data.verificationRequired) {
        setInfo(
          data.message ||
            (data.emailSent === false
              ? "Code could not be emailed — check server logs or use Resend code."
              : "Check your inbox for a 6-digit code.")
        );
        setPhase("verify");
        setCode("");
        return;
      }

      const token = data.access_token || data.token;
      if (data.user && token) {
        setSession({ accessToken: token, user: data.user });
        navigate(getHomeRoute(data.user), { replace: true });
        return;
      }

      setErr("Unexpected registration response. Please try again or sign in.");
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await authAPI.verifyRegistration(email, code);
      navigate(getHomeRoute(data.user), { replace: true });
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setErr("");
    setResendLoading(true);
    try {
      await authAPI.resendCode(email);
      setInfo("A new code has been sent.");
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Could not resend");
    } finally {
      setResendLoading(false);
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

      <div className="vadr-auth-card">
        <div className="vadr-auth-brand">
          <h1 className="vadr-auth-title" style={{ fontSize: 22 }}>
            {phase === "details" ? "Create account" : "Verify email"}
          </h1>
          <p className="vadr-auth-tagline">
            {phase === "details"
              ? "Register for VADR"
              : `Enter the 6-digit code sent to ${email.trim()}`}
          </p>
        </div>

        {info && <div className="vadr-auth-info">{info}</div>}
        {err && <div className="vadr-auth-error">{err}</div>}

        {phase === "details" && (
          <form onSubmit={submitDetails}>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="reg-name">Full name</label>
              <input id="reg-name" className="vadr-auth-input vadr-auth-input--no-toggle" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="reg-email">Email</label>
              <input id="reg-email" type="email" className="vadr-auth-input vadr-auth-input--no-toggle" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="reg-password">Password</label>
              <input id="reg-password" type="password" className="vadr-auth-input vadr-auth-input--no-toggle" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="reg-role">Role</label>
              <select id="reg-role" className="vadr-auth-input vadr-auth-input--no-toggle" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="reg-dept">Department (optional)</label>
              <input id="reg-dept" className="vadr-auth-input vadr-auth-input--no-toggle" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <button type="submit" className="vadr-auth-submit" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        {phase === "verify" && (
          <form onSubmit={submitVerify}>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="reg-code">6-digit code</label>
              <input
                id="reg-code"
                className="vadr-auth-input vadr-auth-input--no-toggle"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                placeholder="000000"
                style={{ letterSpacing: "0.25em", fontSize: 18, textAlign: "center", fontWeight: 700 }}
              />
            </div>
            <button type="submit" className="vadr-auth-submit" disabled={loading || code.length !== 6}>
              {loading ? "Verifying…" : "Verify and create account"}
            </button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <button type="button" onClick={resend} disabled={resendLoading} style={{ fontSize: 13, fontWeight: 600, color: "var(--vadr-primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
                {resendLoading ? "Sending…" : "Resend code"}
              </button>
              <button type="button" onClick={() => { setPhase("details"); setErr(""); setInfo(""); setCode(""); }} style={{ fontSize: 13, color: "var(--vadr-text-muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                ← Edit details
              </button>
            </div>
          </form>
        )}

        <p className="vadr-auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
