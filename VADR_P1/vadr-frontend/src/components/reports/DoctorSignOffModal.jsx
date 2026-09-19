import React, { useState } from "react";
import { 
  FileText, 
  CheckCircle, 
  Download, 
  Mail, 
  X, 
  ShieldCheck, 
  AlertCircle,
  Loader2,
  UserCheck
} from 'lucide-react';
import { reportAPI, getStoredUser } from "../../api";

export default function DoctorSignOffModal({
  isOpen,
  onClose,
  report,
  screening,
  onReportUpdated,
}) {
  const [clinicalNotes, setClinicalNotes] = useState(report?.clinical_notes || "");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState(report?.email?.status || "not_sent");
  const [activeReport, setActiveReport] = useState(report);

  const currentUser = getStoredUser() || {};
  const isDoctor = currentUser.role === "doctor" || currentUser.role === "admin";

  if (!isOpen) return null;

  const currentReport = activeReport || report;
  const isSigned = currentReport?.signoff?.signed || currentReport?.status === "signed" || currentReport?.status === "ready";

  const handleSign = async (e) => {
    e.preventDefault();
    if (!confirmed && !isSigned) {
      setError("Please check the confirmation box to certify clinician review.");
      return;
    }
    if (!currentReport?.report_id) {
      setError("No report ID found to sign.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await reportAPI.signReport(currentReport.report_id, clinicalNotes);
      setActiveReport(res);
      setSuccessMsg("Assessment report successfully signed and finalized.");
      if (onReportUpdated) onReportUpdated(res);
    } catch (err) {
      setError(err.message || "Failed to electronically sign report.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!currentReport?.report_id) return;
    try {
      await reportAPI.downloadPdf(currentReport.report_id);
    } catch (err) {
      setError(err.message || "Failed to download PDF.");
    }
  };

  const handleSendEmail = async () => {
    if (!currentReport?.report_id) return;
    setEmailLoading(true);
    setError("");
    try {
      await reportAPI.sendEmail(currentReport.report_id);
      setEmailStatus("queued");
      setSuccessMsg("Finalized report has been queued for email delivery to the patient.");
    } catch (err) {
      setError(err.message || "Failed to dispatch report email.");
    } finally {
      setEmailLoading(false);
    }
  };

  const patient = currentReport?.patient || screening?.patient || {};
  const assessment = currentReport?.assessment || {
    prediction: screening?.prediction || "Unknown",
    confidence: screening?.confidence || 0,
    eye_side: screening?.eyeSide || screening?.eye_side || "Unspecified",
  };

  return (
    <div className="vadr-modal-overlay" style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1100,
      padding: "1.5rem"
    }}>
      <div className="vadr-card" style={{
        maxWidth: "750px",
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        borderRadius: "16px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        border: "1px solid var(--border-color, #e2e8f0)",
        backgroundColor: "var(--bg-card, #ffffff)",
        padding: 0
      }}>
        {/* Modal Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--border-color, #e2e8f0)",
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(59, 130, 246, 0.02))"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "rgba(37, 99, 235, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563eb"
            }}>
              <FileText size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main, #0f172a)" }}>
                {isSigned ? "Finalized Clinical Assessment Report" : "Doctor Electronic Sign-Off & Finalization"}
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                Report ID: <strong>{currentReport?.report_id || "Generating..."}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted, #64748b)",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Alerts */}
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
              fontSize: "0.875rem"
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
              fontSize: "0.875rem"
            }}>
              <CheckCircle size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Summary Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            backgroundColor: "var(--bg-subtle, #f8fafc)",
            padding: "1rem",
            borderRadius: "10px",
            border: "1px solid var(--border-color, #e2e8f0)"
          }}>
            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Patient
              </div>
              <div style={{ fontWeight: 600, color: "var(--text-main, #0f172a)", fontSize: "0.95rem" }}>
                {patient.name || "Patient Record"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                ID: {patient.patientId || patient.id || "—"} • {patient.gender || "—"} ({patient.age || "—"} yrs)
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                AI Assessment
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: assessment.prediction === "No DR" ? "#16a34a" : "#ea580c"
              }}>
                {assessment.prediction}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Confidence: <strong>{Number(assessment.confidence || 0).toFixed(1)}%</strong> • {assessment.eye_side}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Attending Doctor
              </div>
              <div style={{ fontWeight: 600, color: "var(--text-main, #0f172a)", fontSize: "0.95rem" }}>
                {isSigned
                  ? currentReport?.signoff?.signed_by_name || currentReport?.doctor?.name
                  : currentUser.name || "Attending Clinician"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {currentUser.department || "Ophthalmology"} • {currentUser.email}
              </div>
            </div>
          </div>

          {/* Signed Status Badge */}
          {isSigned ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem",
              backgroundColor: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              borderRadius: "10px",
              color: "#15803d"
            }}>
              <ShieldCheck size={24} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  Signed & Certified by {currentReport?.signoff?.signed_by_name || "Doctor"}
                </div>
                <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
                  Signed At: {currentReport?.signoff?.signed_at ? new Date(currentReport.signoff.signed_at).toLocaleString() : "Confirmed"}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              backgroundColor: "#fffbeb",
              border: "1px solid #fef3c7",
              borderRadius: "8px",
              color: "#b45309",
              fontSize: "0.825rem"
            }}>
              <AlertCircle size={18} />
              <span>
                This report is currently in <strong>Draft</strong> status. Doctor confirmation and clinical notes are required for official patient release.
              </span>
            </div>
          )}

          {/* Clinical Notes */}
          <div>
            <label style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-main, #0f172a)",
              marginBottom: "0.5rem"
            }}>
              Clinical Review Notes & Diagnostic Remarks
            </label>
            <textarea
              rows={4}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              disabled={isSigned || !isDoctor}
              placeholder="Enter clinician findings, recommended follow-up interval, referral decisions, or diagnostic observations..."
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color, #cbd5e1)",
                backgroundColor: isSigned ? "var(--bg-subtle, #f8fafc)" : "#ffffff",
                color: "var(--text-main, #0f172a)",
                fontSize: "0.875rem",
                resize: "vertical",
                fontFamily: "inherit"
              }}
            />
          </div>

          {/* Doctor Review Confirmation Checkbox (if not yet signed) */}
          {!isSigned && isDoctor && (
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.875rem",
              borderRadius: "8px",
              backgroundColor: "rgba(37, 99, 235, 0.04)",
              border: "1px solid rgba(37, 99, 235, 0.15)"
            }}>
              <input
                type="checkbox"
                id="sign-confirm"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ marginTop: "3px", width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="sign-confirm" style={{ fontSize: "0.825rem", color: "var(--text-main, #0f172a)", cursor: "pointer", lineHeight: 1.4 }}>
                <strong>Clinician Certification:</strong> I confirm that I have reviewed the fundus photograph, Grad-CAM attention heatmap, and AI classification for this patient. I authorize the generation of this official clinical assessment.
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border-color, #e2e8f0)"
          }}>
            <button
              type="button"
              onClick={onClose}
              className="vadr-btn vadr-btn-secondary"
              style={{
                padding: "0.6rem 1.25rem",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.875rem"
              }}
            >
              Close
            </button>

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {/* If signed or draft, allow PDF download */}
              {currentReport?.report_id && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="vadr-btn vadr-btn-outline"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.6rem 1.15rem",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#2563eb",
                    borderColor: "#93c5fd"
                  }}
                >
                  <Download size={16} />
                  Download PDF
                </button>
              )}

              {/* If signed, allow email delivery */}
              {isSigned && (
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={emailLoading || emailStatus === "queued"}
                  className="vadr-btn vadr-btn-outline"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.6rem 1.15rem",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: emailStatus === "queued" ? "#16a34a" : "#475569"
                  }}
                >
                  {emailLoading ? <Loader2 size={16} className="vadr-spin" /> : <Mail size={16} />}
                  {emailStatus === "queued" ? "Email Queued" : "Email to Patient"}
                </button>
              )}

              {/* Sign action button */}
              {!isSigned && isDoctor && (
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={loading || !confirmed}
                  className="vadr-btn vadr-btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.6rem 1.35rem",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    backgroundColor: "#2563eb",
                    color: "#ffffff"
                  }}
                >
                  {loading ? <Loader2 size={16} className="vadr-spin" /> : <UserCheck size={16} />}
                  Sign & Finalize Report
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
