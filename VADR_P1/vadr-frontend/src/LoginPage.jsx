import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Login failed");
        return;
      }
      localStorage.setItem("vadr_token", data.token);
      localStorage.setItem("vadr_user", JSON.stringify(data.user));
      navigate("/", { replace: true });
    } finally {
      setLoading(false);
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
          maxWidth: 400,
          background: "#fff",
          borderRadius: 16,
          padding: "36px 32px",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.12)",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg,#1a56db,#0694a2)",
              margin: "0 auto 14px",
            }}
          />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>VADR</h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>Sign in (flask-base–compatible hashing on the API)</p>
        </div>

        <form onSubmit={submit}>
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
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            style={{ ...input, marginBottom: 16 }}
          />
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ ...input, marginBottom: 22 }}
          />
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#6b7280" }}>
          No account?{" "}
          <Link to="/register" style={{ color: "#1a56db", fontWeight: 600 }}>
            Register
          </Link>
        </p>
        <p style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
          Demo (after seed): admin@vadr.pk / admin123
        </p>
      </div>
    </div>
  );
}
