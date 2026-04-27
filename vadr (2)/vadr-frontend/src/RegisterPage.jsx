import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const ROLES = [
  { value: "doctor", label: "Doctor" },
  { value: "technician", label: "Technician" },
  { value: "admin", label: "Admin" },
];

export default function RegisterPage() {
  const [phase, setPhase] = useState("details"); // "details" | "verify"
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
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          department: department.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Registration failed");
        return;
      }
      let verifyMsg = data.emailSent
        ? data.message || "Check your inbox for a 6-digit code."
        : `${data.message || "Email could not be sent."} For local testing, set VADR_LOG_EMAIL_CODE=1 in .env and restart Flask, then check the terminal for the code.`;
      if (!data.emailSent && data.emailError) {
        verifyMsg += ` Server: ${data.emailError}`;
      }
      setInfo(verifyMsg);
      setPhase("verify");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/verify-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.replace(/\D/g, "").slice(0, 6) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Verification failed");
        return;
      }
      localStorage.setItem("vadr_token", data.token);
      localStorage.setItem("vadr_user", JSON.stringify(data.user));
      navigate("/", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setErr("");
    setResendLoading(true);
    try {
      const res = await fetch(`${API}/auth/resend-registration-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Could not resend");
        return;
      }
      setInfo(
        data.emailSent
          ? "A new code has been sent."
          : (data.message || "Email not sent — check SMTP or server logs (VADR_LOG_EMAIL_CODE=1).")
      );
    } finally {
      setResendLoading(false);
    }
  };

  const input = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1.5px solid #e5e7eb",
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #f0f4ff 0%, #f8fafc 45%, #ecfeff 100%)",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        padding: 24,
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');`}</style>
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 16,
          padding: "36px 32px",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.12)",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>
            {phase === "details" ? "Create account" : "Verify email"}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
            {phase === "details"
              ? "Staff registration for VADR"
              : `Enter the 6-digit code sent to ${email.trim()}`}
          </p>
        </div>

        {info && (
          <div
            style={{
              background: "#eff6ff",
              color: "#1e40af",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
              border: "1px solid #bfdbfe",
            }}
          >
            {info}
          </div>
        )}
        {err && (
          <div
            style={{
              background: "#fef2f2",
              color: "#b91c1c",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {err}
          </div>
        )}

        {phase === "details" && (
          <form onSubmit={submitDetails}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required style={{ ...input, marginBottom: 14 }} />
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ ...input, marginBottom: 14 }} />
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ ...input, marginBottom: 14 }} />
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...input, marginBottom: 14 }}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Department (optional)</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} style={{ ...input, marginBottom: 22 }} />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: loading ? "#93c5fd" : "#1a56db",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Sending code…" : "Send verification code"}
            </button>
          </form>
        )}

        {phase === "verify" && (
          <form onSubmit={submitVerify}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>6-digit code</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              placeholder="000000"
              style={{ ...input, marginBottom: 16, letterSpacing: "0.25em", fontSize: 18, textAlign: "center", fontWeight: 700 }}
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: loading || code.length !== 6 ? "#93c5fd" : "#1a56db",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: loading || code.length !== 6 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                marginBottom: 12,
              }}
            >
              {loading ? "Verifying…" : "Verify and create account"}
            </button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={resend}
                disabled={resendLoading}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1a56db",
                  background: "none",
                  border: "none",
                  cursor: resendLoading ? "wait" : "pointer",
                  textDecoration: "underline",
                  fontFamily: "inherit",
                }}
              >
                {resendLoading ? "Sending…" : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase("details");
                  setErr("");
                  setInfo("");
                  setCode("");
                }}
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ← Edit details
              </button>
            </div>
          </form>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#6b7280" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#1a56db", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
