import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authAPI, patientAPI } from "../api";
import { getStoredUser } from "../api";

export default function PatientRecordsPage() {
  const user = getStoredUser();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    patientAPI
      .getAll()
      .then((list) => {
        const match = (list || []).find((p) => p.email?.toLowerCase() === user?.email?.toLowerCase());
        setPatient(match || null);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [user?.email]);

  const logout = async () => {
    await authAPI.logout();
    window.location.href = "/login";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" }}>
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <strong>VADR — My Records</strong>
        <button type="button" onClick={logout} style={{ cursor: "pointer" }}>
          Sign out
        </button>
      </header>
      <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
        {loading && <p>Loading…</p>}
        {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
        {!loading && !patient && !err && (
          <p>No patient record linked to {user?.email}. Contact your clinic.</p>
        )}
        {patient && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              border: "1px solid #e5e7eb",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{patient.name}</h2>
            <p style={{ color: "#6b7280" }}>ID: {patient.patientId}</p>
            <Link
              to={`/medical-history/${patient.patientId}`}
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 16px",
                background: "#1a56db",
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              View medical history & reports
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
