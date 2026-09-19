import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserPlus,
  FileText,
  Database,
  ShieldCheck,
  Activity,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  HardDrive,
} from "lucide-react";
import RoleSidebar from "../../components/layout/RoleSidebar";
import ThemeToggle from "../../components/ThemeToggle";
import { adminAPI } from "../../api";
import "../../vadr-dashboard.css";
import "../../vadr-theme.css";

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAdminSummary = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      setError(null);
      const res = await adminAPI.getSummary();
      const data = res?.data !== undefined ? res.data : res;
      setSummary(data);
    } catch (err) {
      console.error("Failed to load admin telemetry:", err);
      if (!isPolling) {
        setError(err.message || "Failed to synchronize system telemetry.");
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminSummary(false);
    const interval = setInterval(() => {
      fetchAdminSummary(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAdminSummary]);

  const totalUsers = summary?.totalUsers ?? 0;
  const totalPatients = summary?.totalPatients ?? 0;
  const activeDoctors = summary?.activeDoctors ?? 0;
  const pendingApprovalsCount = summary?.pendingApprovalsCount ?? 0;
  const todayScreenings = summary?.todayScreenings ?? 0;
  const totalScreenings = summary?.totalScreenings ?? 0;
  const backupStatus = summary?.backupStatus || {};
  const recentLogs = summary?.recentAuditLogs || [];

  return (
    <div className="vadr-dash-container">
      <RoleSidebar activeTab="dashboard" />

      {/* Main Workspace */}
      <div className="vadr-dash-main">
        {/* Top Header Bar */}
        <header className="vadr-dash-header">
          <div>
            <h1 className="vadr-header-title">System Operations &amp; Telemetry</h1>
            <div className="vadr-header-subtitle">
              Operational health, identity management, and audit oversight
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--vadr-success-text)",
                background: "var(--vadr-success-bg)",
                border: "1px solid var(--vadr-success-border)",
                padding: "4px 10px",
                borderRadius: 20,
              }}
            >
              <span className="vadr-status-dot" style={{ width: 6, height: 6 }} />
              <span>Telemetry Active</span>
            </div>

            <button
              onClick={() => fetchAdminSummary(false)}
              disabled={loading}
              title="Refresh telemetry"
              className="vadr-btn vadr-btn-secondary"
              style={{ padding: "6px 11px", fontSize: 12 }}
            >
              <RefreshCw size={13} className={loading ? "spin-animation" : ""} />
              <span>Sync</span>
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Canvas Body */}
        <main className="vadr-dash-body">
          {error && (
            <div className="vadr-alert-banner">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{error}</span>
              </div>
              <button
                onClick={() => fetchAdminSummary(false)}
                className="vadr-btn vadr-btn-danger"
                style={{ padding: "4px 10px", fontSize: 11.5 }}
              >
                Retry
              </button>
            </div>
          )}

          {/* 1. Operational KPI Metric Cards */}
          <section className="vadr-kpi-grid">
            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Total Accounts</span>
                <div className="vadr-kpi-icon-wrap">
                  <Users size={16} color="var(--vadr-primary)" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : totalUsers}</div>
              <div className="vadr-kpi-sub">
                <span>Active platform credentials</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Registered Patients</span>
                <div className="vadr-kpi-icon-wrap">
                  <UserPlus size={16} color="#059669" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : totalPatients}</div>
              <div className="vadr-kpi-sub">
                <span>Clinical patient cohort</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Active Clinicians</span>
                <div className="vadr-kpi-icon-wrap">
                  <UserCheck size={16} color="#0891b2" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : activeDoctors}</div>
              <div className="vadr-kpi-sub">
                <span>Authorized ophthalmologists</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Doctor Approvals</span>
                <div
                  className="vadr-kpi-icon-wrap"
                  style={{
                    background: pendingApprovalsCount > 0 ? "var(--vadr-warning-bg)" : "var(--vadr-surface-muted)",
                    borderColor: pendingApprovalsCount > 0 ? "var(--vadr-warning-border)" : "var(--vadr-border)",
                  }}
                >
                  <ShieldCheck size={16} color={pendingApprovalsCount > 0 ? "#d97706" : "var(--vadr-text-muted)"} />
                </div>
              </div>
              <div
                className="vadr-kpi-value"
                style={{ color: pendingApprovalsCount > 0 ? "#d97706" : "var(--vadr-text)" }}
              >
                {loading && !summary ? "—" : pendingApprovalsCount}
              </div>
              <div className="vadr-kpi-sub">
                {pendingApprovalsCount > 0 ? (
                  <Link
                    to="/admin/approvals"
                    style={{ color: "#d97706", fontWeight: 700, textDecoration: "none" }}
                  >
                    Action required &rarr;
                  </Link>
                ) : (
                  <span>Queue clear</span>
                )}
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Today's Screenings</span>
                <div className="vadr-kpi-icon-wrap">
                  <Activity size={16} color="#2563eb" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : todayScreenings}</div>
              <div className="vadr-kpi-sub">
                <span>PKT timezone (UTC+5)</span>
              </div>
            </div>

            <div className="vadr-kpi">
              <div className="vadr-kpi-top">
                <span className="vadr-kpi-label">Lifetime Scans</span>
                <div className="vadr-kpi-icon-wrap">
                  <FileText size={16} color="var(--vadr-text-muted)" />
                </div>
              </div>
              <div className="vadr-kpi-value">{loading && !summary ? "—" : totalScreenings}</div>
              <div className="vadr-kpi-sub">
                <span>Cumulative inferences</span>
              </div>
            </div>
          </section>

          {/* 2. Infrastructure & Backup Status Banner */}
          <section className="vadr-card">
            <div className="vadr-card-header">
              <div>
                <h2 className="vadr-card-title">
                  <Server size={15} color="var(--vadr-primary)" />
                  <span>Infrastructure &amp; Backup Telemetry</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Cluster connectivity, MongoDB snapshot retention, and redundancy status
                </div>
              </div>

              <Link to="/admin/backups" className="vadr-btn vadr-btn-secondary" style={{ padding: "5px 11px", fontSize: 12 }}>
                <span>Manage Backups</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="vadr-card-body" style={{ padding: "16px 20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--vadr-surface-muted)",
                    borderRadius: 9,
                    border: "1px solid var(--vadr-border)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--vadr-success-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--vadr-success-text)",
                    }}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--vadr-text-muted)" }}>
                      Database Status
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vadr-success-text)", marginTop: 1 }}>
                      MongoDB Connected
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--vadr-surface-muted)",
                    borderRadius: 9,
                    border: "1px solid var(--vadr-border)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--vadr-primary-soft)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--vadr-primary)",
                    }}
                  >
                    <HardDrive size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--vadr-text-muted)" }}>
                      Total Snapshots
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vadr-text)", marginTop: 1 }}>
                      {backupStatus.total_backups ?? 0} Backups Available
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--vadr-surface-muted)",
                    borderRadius: 9,
                    border: "1px solid var(--vadr-border)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--vadr-surface)",
                      border: "1px solid var(--vadr-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--vadr-text-muted)",
                    }}
                  >
                    <Database size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--vadr-text-muted)" }}>
                      Latest Backup Created
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--vadr-text)", marginTop: 1 }}>
                      {backupStatus.last_backup
                        ? new Date(backupStatus.last_backup).toLocaleString([], {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "Ready on trigger"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. System Workspaces Quick Navigation */}
          <section>
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--vadr-text-muted)", margin: 0 }}>
                Administration Workspaces
              </h2>
            </div>

            <div className="vadr-admin-workspace-grid">
              <WorkspaceCard
                to="/admin/users"
                icon={<Users size={16} color="var(--vadr-primary)" />}
                title="User Management"
                desc="Create, inspect, and configure staff and patient accounts"
              />
              <WorkspaceCard
                to="/admin/approvals"
                icon={<UserCheck size={16} color="#059669" />}
                title="Doctor Approvals"
                desc="Review clinician credentials and grant medical access"
                badge={pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Pending` : null}
                badgeWarn={pendingApprovalsCount > 0}
              />
              <WorkspaceCard
                to="/admin/audit-logs"
                icon={<FileText size={16} color="#0891b2" />}
                title="Audit Logs"
                desc="Examine immutable security and data modification events"
              />
              <WorkspaceCard
                to="/admin/backups"
                icon={<Database size={16} color="#7c3aed" />}
                title="System Backups"
                desc="Execute database snapshots and initiate system restores"
              />
              <WorkspaceCard
                to="/admin/rbac"
                icon={<ShieldCheck size={16} color="#2563eb" />}
                title="Permission Matrix"
                desc="Configure granular RBAC permissions per clinical role"
              />
              <WorkspaceCard
                to="/admin/patients"
                icon={<UserPlus size={16} color="#10b981" />}
                title="Patient Cohort"
                desc="Inspect registered patient profiles and clinical assignments"
              />
            </div>
          </section>

          {/* 4. Live Audit Activity Stream */}
          <section className="vadr-card">
            <div className="vadr-card-header">
              <div>
                <h2 className="vadr-card-title">
                  <Activity size={15} color="var(--vadr-primary)" />
                  <span>Real-Time Audit Stream</span>
                </h2>
                <div className="vadr-card-subtitle">
                  Latest security, login, and modification events logged across VADR
                </div>
              </div>

              <Link to="/admin/audit-logs" className="vadr-btn vadr-btn-secondary" style={{ padding: "5px 11px", fontSize: 12 }}>
                <span>Full Audit Log</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="vadr-table-wrap">
              <table className="vadr-table">
                <thead>
                  <tr>
                    <th>Event Type</th>
                    <th>Initiated By</th>
                    <th>Role</th>
                    <th>IP Address</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--vadr-text-muted)" }}>
                        No audit events recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    recentLogs.map((log, idx) => (
                      <tr key={log.id || idx}>
                        <td style={{ fontWeight: 700, color: "var(--vadr-text)" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                              background: "var(--vadr-surface-muted)",
                              border: "1px solid var(--vadr-border)",
                            }}
                          >
                            {log.event_type || log.event || "action"}
                          </span>
                        </td>
                        <td style={{ color: "var(--vadr-text-secondary)", fontFamily: "monospace", fontSize: 12 }}>
                          {log.user_id || "System"}
                        </td>
                        <td style={{ textTransform: "capitalize", color: "var(--vadr-text-muted)" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "1px 6px",
                              borderRadius: 4,
                              fontSize: 10.5,
                              fontWeight: 700,
                              background: "var(--vadr-surface-muted)",
                              border: "1px solid var(--vadr-border)",
                            }}
                          >
                            {log.role || "admin"}
                          </span>
                        </td>
                        <td style={{ color: "var(--vadr-text-muted)", fontFamily: "monospace", fontSize: 11.5 }}>
                          {log.ip_address || log.ip || "127.0.0.1"}
                        </td>
                        <td style={{ color: "var(--vadr-text-muted)", fontSize: 12 }}>
                          {log.timestamp
                            ? new Date(log.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function WorkspaceCard({ to, icon, title, desc, badge, badgeWarn }) {
  return (
    <Link
      to={to}
      className="vadr-card vadr-card--interactive"
      style={{
        padding: "16px 16px 14px",
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--vadr-surface-muted)",
              border: "1px solid var(--vadr-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </div>
          {badge && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: 20,
                background: badgeWarn ? "var(--vadr-warning-bg)" : "var(--vadr-primary-soft)",
                color: badgeWarn ? "var(--vadr-warning-text)" : "var(--vadr-primary)",
                border: `1px solid ${badgeWarn ? "var(--vadr-warning-border)" : "var(--vadr-primary-border)"}`,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 750, color: "var(--vadr-text)", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--vadr-text-muted)", lineHeight: 1.4 }}>
          {desc}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11.5,
          fontWeight: 700,
          color: "var(--vadr-primary)",
          marginTop: 14,
        }}
      >
        <span>Open Module</span>
        <ArrowUpRight size={13} />
      </div>
    </Link>
  );
}
