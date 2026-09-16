import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI, ApiError } from "./api";
import "./vadr-auth.css";
import ThemeToggle from "./components/ThemeToggle";

export default function ForgotPasswordPage() {
  const [phase, setPhase] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "VADR — Reset password";
    return () => { document.title = "VADR"; };
  }, []);

  const submitEmail = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      const data = await authAPI.forgotPassword(email);
      setInfo(
        data.message ||
          (data.emailSent === false
            ? "If an account exists, a code was requested — check server logs if email did not arrive."
            : "If an account exists for that email, we sent a 6-digit reset code.")
      );
      setPhase("reset");
      setCode("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Could not start password reset");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setErr("");
    if (password !== confirmPassword) {
      setErr("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword(email, code, password);
      navigate("/login", {
        replace: true,
        state: { message: "Password updated. Sign in with your new password." },
      });
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setErr("");
    setResendLoading(true);
    try {
      await authAPI.resendPasswordResetCode(email);
      setInfo("A new code has been sent.");
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Could not resend code");
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
            {phase === "email" ? "Forgot password" : "Set new password"}
          </h1>
          <p className="vadr-auth-tagline">
            {phase === "email"
              ? "Enter your account email and we will send a reset code."
              : `Enter the 6-digit code sent to ${email.trim()}`}
          </p>
        </div>

        {info && <div className="vadr-auth-info">{info}</div>}
        {err && <div className="vadr-auth-error">{err}</div>}

        {phase === "email" && (
          <form onSubmit={submitEmail}>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                className="vadr-auth-input vadr-auth-input--no-toggle"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.pk"
                required
                autoComplete="username"
              />
            </div>
            <button type="submit" className="vadr-auth-submit" disabled={loading}>
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>
        )}

        {phase === "reset" && (
          <form onSubmit={submitReset}>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="forgot-code">6-digit code</label>
              <input
                id="forgot-code"
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
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="forgot-password">New password</label>
              <input
                id="forgot-password"
                type="password"
                className="vadr-auth-input vadr-auth-input--no-toggle"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="vadr-auth-field">
              <label className="vadr-auth-label" htmlFor="forgot-confirm">Confirm password</label>
              <input
                id="forgot-confirm"
                type="password"
                className="vadr-auth-input vadr-auth-input--no-toggle"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="vadr-auth-submit"
              disabled={loading || code.length !== 6 || password.length < 6}
            >
              {loading ? "Updating…" : "Update password"}
            </button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <button
                type="button"
                onClick={resend}
                disabled={resendLoading}
                style={{ fontSize: 13, fontWeight: 600, color: "var(--vadr-primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
              >
                {resendLoading ? "Sending…" : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => { setPhase("email"); setErr(""); setInfo(""); setCode(""); }}
                style={{ fontSize: 13, color: "var(--vadr-text-muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                ← Change email
              </button>
            </div>
          </form>
        )}

        <p className="vadr-auth-footer">
          Remember your password? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
