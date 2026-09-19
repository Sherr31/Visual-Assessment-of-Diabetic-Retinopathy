import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Mail,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import RoleSidebar from "../components/layout/RoleSidebar";
import DoctorSignOffModal from "../components/reports/DoctorSignOffModal";
import { reportAPI, getStoredUser } from "../api";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [predictionFilter, setPredictionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReports, setTotalReports] = useState(0);

  // Sign-Off Modal state
  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Email sending per row state
  const [emailSendingId, setEmailSendingId] = useState(null);

  const currentUser = getStoredUser() || {};
  const isDoctor = currentUser.role === "doctor" || currentUser.role === "admin";

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 15 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (predictionFilter) params.prediction = predictionFilter;

      const res = await reportAPI.getReports(params);
      setReports(res.reports || []);
      setTotalPages(res.total_pages || 1);
      setTotalReports(res.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load clinical reports");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, predictionFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDownload = async (reportId) => {
    try {
      await reportAPI.downloadPdf(reportId);
    } catch (err) {
      setError(err.message || "Failed to download PDF report");
    }
  };

  const handleSendEmail = async (reportId) => {
    setEmailSendingId(reportId);
    setError("");
    try {
      await reportAPI.sendEmail(reportId);
      setSuccessMsg(`Report ${reportId} queued for email delivery to patient.`);
      fetchReports();
    } catch (err) {
      setError(err.message || "Failed to send email");
    } finally {
      setEmailSendingId(null);
    }
  };

  const openSignModal = (report) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  const getSeverityBadge = (prediction) => {
    const p = (prediction || "").toLowerCase();
    if (p.includes("no dr")) {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#15803d", border: "rgba(34, 197, 94, 0.3)" };
    }
    if (p.includes("mild")) {
      return { bg: "rgba(234, 179, 8, 0.12)", color: "#a16207", border: "rgba(234, 179, 8, 0.3)" };
    }
    if (p.includes("moderate")) {
      return { bg: "rgba(249, 115, 22, 0.12)", color: "#c2410c", border: "rgba(249, 115, 22, 0.3)" };
    }
    if (p.includes("severe") || p.includes("proliferative")) {
      return { bg: "rgba(239, 68, 68, 0.12)", color: "#b91c1c", border: "rgba(239, 68, 68, 0.3)" };
    }
    return { bg: "rgba(100, 116, 139, 0.12)", color: "#475569", border: "rgba(100, 116, 139, 0.3)" };
  };

  const getStatusBadge = (status, signoff) => {
    if (signoff?.signed || status === "signed" || status === "ready" || status === "email_sent") {
      return {
        label: status === "email_sent" ? "Sent & Signed" : "Signed",
        bg: "rgba(16, 185, 129, 0.12)",
        color: "#047857",
        icon: <ShieldCheck size={13} />,
      };
    }
    if (status === "email_queued") {
      return {
        label: "Email Queued",
        bg: "rgba(59, 130, 246, 0.12)",
        color: "#1d4ed8",
        icon: <Clock size={13} />,
      };
    }
    return {
      label: "Draft",
      bg: "rgba(245, 158, 11, 0.12)",
      color: "#b45309",
      icon: <Clock size={13} />,
    };
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-main, #f8fafc)" }}>
      <RoleSidebar />

      <main style={{ flex: 1, padding: "2rem", maxWidth: "1400px", margin: "0 auto", overflowX: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "rgba(37, 99, 235, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2563eb"
              }}>
                <FileText size={20} />
              </div>
              <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-main, #0f172a)", margin: 0 }}>
                Clinical Diagnostic Reports
              </h1>
            </div>
            <p style={{ color: "var(--text-muted, #64748b)", margin: 0, fontSize: "0.9rem" }}>
              Review, certify, search, and securely distribute finalized diabetic retinopathy assessment reports.
            </p>
          </div>

          <button
            onClick={fetchReports}
            className="vadr-btn vadr-btn-outline"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            <RefreshCw size={15} className={loading ? "vadr-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.875rem 1rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            color: "#991b1b",
            fontSize: "0.875rem",
            marginBottom: "1.25rem"
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.875rem 1rem",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            color: "#166534",
            fontSize: "0.875rem",
            marginBottom: "1.25rem"
          }}>
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="vadr-card" style={{
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          borderRadius: "12px",
          backgroundColor: "var(--bg-card, #ffffff)",
          border: "1px solid var(--border-color, #e2e8f0)",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          {/* Search Input */}
          <div style={{
            position: "relative",
            flex: "1 1 280px",
            maxWidth: "400px"
          }}>
            <Search
              size={17}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted, #94a3b8)"
              }}
            />
            <input
              type="text"
              placeholder="Search by patient name, patient ID, or report ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem 0.6rem 2.4rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color, #cbd5e1)",
                backgroundColor: "var(--bg-subtle, #f8fafc)",
                fontSize: "0.875rem",
                color: "var(--text-main, #0f172a)",
                outline: "none"
              }}
            />
          </div>

          {/* Filter Selects */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Filter size={15} style={{ color: "var(--text-muted, #64748b)" }} />
              <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted, #64748b)" }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  fontSize: "0.85rem",
                  color: "var(--text-main, #0f172a)",
                  outline: "none"
                }}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft (Pending Sign-off)</option>
                <option value="signed">Signed & Finalized</option>
                <option value="email_sent">Email Sent</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted, #64748b)" }}>Classification:</span>
              <select
                value={predictionFilter}
                onChange={(e) => {
                  setPredictionFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  fontSize: "0.85rem",
                  color: "var(--text-main, #0f172a)",
                  outline: "none"
                }}
              >
                <option value="">All Classifications</option>
                <option value="No DR">No DR</option>
                <option value="Mild">Mild</option>
                <option value="Moderate">Moderate</option>
                <option value="Severe">Severe</option>
                <option value="Proliferative DR">Proliferative DR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reports Table Card */}
        <div className="vadr-card" style={{
          borderRadius: "12px",
          backgroundColor: "var(--bg-card, #ffffff)",
          border: "1px solid var(--border-color, #e2e8f0)",
          overflow: "hidden"
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  borderBottom: "1px solid var(--border-color, #e2e8f0)",
                  color: "var(--text-muted, #64748b)",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                  <th style={{ padding: "0.875rem 1.25rem" }}>Report ID</th>
                  <th style={{ padding: "0.875rem 1rem" }}>Patient</th>
                  <th style={{ padding: "0.875rem 1rem" }}>AI Classification</th>
                  <th style={{ padding: "0.875rem 1rem" }}>Confidence</th>
                  <th style={{ padding: "0.875rem 1rem" }}>Attending Clinician</th>
                  <th style={{ padding: "0.875rem 1rem" }}>Date</th>
                  <th style={{ padding: "0.875rem 1rem" }}>Status</th>
                  <th style={{ padding: "0.875rem 1.25rem", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted, #64748b)" }}>
                      <Loader2 size={24} className="vadr-spin" style={{ margin: "0 auto 0.5rem" }} />
                      <div>Loading report archive...</div>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted, #64748b)" }}>
                      <FileText size={32} style={{ margin: "0 auto 0.5rem", opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>No reports found</div>
                      <div style={{ fontSize: "0.825rem", marginTop: "4px" }}>
                        Generate a report from a fundus assessment or adjust your search filters.
                      </div>
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => {
                    const sev = getSeverityBadge(r.assessment?.prediction);
                    const stat = getStatusBadge(r.status, r.signoff);
                    const isSigned = r.signoff?.signed || r.status === "signed" || r.status === "ready";
                    const patientName = r.patient?.name || "Patient";
                    const patientId = r.patient?.patientId || r.patient_id || "—";
                    const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString() : "—";
                    const doctorName = r.signoff?.signed_by_name || r.doctor?.name || "Attending Physician";

                    return (
                      <tr
                        key={r.report_id}
                        style={{
                          borderBottom: "1px solid var(--border-color, #e2e8f0)",
                          transition: "background-color 0.15s ease"
                        }}
                      >
                        <td style={{ padding: "1rem 1.25rem", fontWeight: 700, color: "#2563eb" }}>
                          {r.report_id}
                        </td>
                        <td style={{ padding: "1rem 1rem" }}>
                          <div style={{ fontWeight: 600, color: "var(--text-main, #0f172a)" }}>{patientName}</div>
                          <div style={{ fontSize: "0.775rem", color: "var(--text-muted, #64748b)" }}>ID: {patientId}</div>
                        </td>
                        <td style={{ padding: "1rem 1rem" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "0.775rem",
                            fontWeight: 700,
                            backgroundColor: sev.bg,
                            color: sev.color,
                            border: `1px solid ${sev.border}`
                          }}>
                            {r.assessment?.prediction || "Unknown"}
                          </span>
                        </td>
                        <td style={{ padding: "1rem 1rem", fontWeight: 600, color: "var(--text-main, #0f172a)" }}>
                          {r.assessment?.confidence != null ? `${Number(r.assessment.confidence).toFixed(1)}%` : "—"}
                        </td>
                        <td style={{ padding: "1rem 1rem", color: "var(--text-main, #0f172a)" }}>
                          {doctorName}
                        </td>
                        <td style={{ padding: "1rem 1rem", color: "var(--text-muted, #64748b)", fontSize: "0.825rem" }}>
                          {dateStr}
                        </td>
                        <td style={{ padding: "1rem 1rem" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "0.775rem",
                            fontWeight: 600,
                            backgroundColor: stat.bg,
                            color: stat.color
                          }}>
                            {stat.icon}
                            {stat.label}
                          </span>
                        </td>
                        <td style={{ padding: "1rem 1.25rem", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
                            {/* View / Sign Modal */}
                            <button
                              type="button"
                              onClick={() => openSignModal(r)}
                              title={isSigned ? "View Report & Sign-Off Details" : "Doctor Review & Electronic Sign-Off"}
                              className="vadr-btn vadr-btn-outline"
                              style={{
                                padding: "5px 9px",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                color: isSigned ? "var(--text-main, #0f172a)" : "#2563eb",
                                borderColor: isSigned ? "var(--border-color, #cbd5e1)" : "#93c5fd"
                              }}
                            >
                              {isSigned ? <Eye size={14} /> : <UserCheck size={14} />}
                              {isSigned ? "Review" : "Sign Off"}
                            </button>

                            {/* Download PDF */}
                            <button
                              type="button"
                              onClick={() => handleDownload(r.report_id)}
                              title="Download Finalized PDF"
                              className="vadr-btn vadr-btn-outline"
                              style={{
                                padding: "5px 8px",
                                borderRadius: "6px",
                                color: "#2563eb",
                                borderColor: "#cbd5e1"
                              }}
                            >
                              <Download size={14} />
                            </button>

                            {/* Email Report (Doctor/Admin only, when signed) */}
                            {isDoctor && isSigned && (
                              <button
                                type="button"
                                onClick={() => handleSendEmail(r.report_id)}
                                disabled={emailSendingId === r.report_id || r.email?.status === "queued"}
                                title="Email Signed PDF to Patient"
                                className="vadr-btn vadr-btn-outline"
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: "6px",
                                  color: r.email?.status === "sent" ? "#16a34a" : "#475569",
                                  borderColor: "#cbd5e1"
                                }}
                              >
                                {emailSendingId === r.report_id ? (
                                  <Loader2 size={14} className="vadr-spin" />
                                ) : (
                                  <Mail size={14} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.875rem 1.25rem",
            backgroundColor: "var(--bg-subtle, #f8fafc)",
            borderTop: "1px solid var(--border-color, #e2e8f0)",
            fontSize: "0.825rem",
            color: "var(--text-muted, #64748b)"
          }}>
            <div>
              Showing {reports.length} of {totalReports} total reports
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="vadr-btn vadr-btn-outline"
                style={{ padding: "4px 8px", borderRadius: "6px", opacity: page <= 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="vadr-btn vadr-btn-outline"
                style={{ padding: "4px 8px", borderRadius: "6px", opacity: page >= totalPages ? 0.5 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Doctor Sign-Off Modal */}
      <DoctorSignOffModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedReport(null);
        }}
        report={selectedReport}
        onReportUpdated={(updated) => {
          fetchReports();
        }}
      />
    </div>
  );
}
