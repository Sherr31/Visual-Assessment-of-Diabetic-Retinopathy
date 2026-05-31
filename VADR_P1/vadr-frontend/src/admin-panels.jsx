import { useState, useEffect, useCallback } from "react";

const inputStyle = {
  border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, color: "#111827", outline: "none", background: "#fff",
  fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};
const thStyle = {
  padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase",
  borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", background: "#f9fafb",
};
const tdStyle = { padding: "12px 16px", borderBottom: "1px solid #f3f4f6" };

export function AuditLogsTab({ auditAPI, showToast, Icon, I, Btn }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (actionFilter) q.set("action", actionFilter);
    auditAPI.list(q.toString())
      .then(data => { setLogs(data.logs || []); setTotal(data.total || 0); })
      .catch(err => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [search, actionFilter, auditAPI, showToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>Audit Logs & Monitoring</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
        Timestamped record of logins, database writes, and critical actions ({total} entries).
      </p>
      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actor, resource, table..." style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ ...inputStyle, width: 140 }}>
          <option value="">All actions</option>
          {["CREATE", "UPDATE", "DELETE", "LOGIN"].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <Btn variant="secondary" onClick={load}>Refresh</Btn>
      </div>
      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>{["Time", "Actor", "Action", "Table", "Resource", "IP", ""].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Loading...</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>No audit entries</td></tr>}
            {!loading && logs.map(log => (
              <tr key={log.id}>
                <td style={tdStyle}>{log.timestamp}</td>
                <td style={tdStyle}><div style={{ fontWeight: 600 }}>{log.actor_email || log.actor_id}</div></td>
                <td style={tdStyle}><span style={{ fontWeight: 700, color: log.action === "DELETE" ? "#dc2626" : log.action === "CREATE" ? "#059669" : "#1a56db" }}>{log.action}</span></td>
                <td style={tdStyle}>{log.table_name}</td>
                <td style={tdStyle}>{log.resource_id}</td>
                <td style={tdStyle}>{log.ip_address}</td>
                <td style={tdStyle}>
                  <Btn size="sm" variant="ghost" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                    {expanded === log.id ? "Hide" : "Details"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expanded && logs.find(l => l.id === expanded) && (
          <div style={{ padding: 16, background: "#f8fafc", borderTop: "1px solid #e5e7eb", fontSize: 11, fontFamily: "monospace", overflow: "auto", maxHeight: 240 }}>
            <div><b>Old:</b> {JSON.stringify(logs.find(l => l.id === expanded).old_value, null, 2) || "—"}</div>
            <div style={{ marginTop: 8 }}><b>New:</b> {JSON.stringify(logs.find(l => l.id === expanded).new_value, null, 2) || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ModelVersionsTab({ modelsAPI, showToast, Icon, I, Btn, Modal, Input }) {
  const [versions, setVersions] = useState([]);
  const [production, setProduction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ version_tag: "", name: "RetinaNet", weights_path: "", notes: "", metrics: { accuracy: "", auc: "", f1: "" } });
  const [compareIds, setCompareIds] = useState({ a: "", b: "" });
  const [compareResult, setCompareResult] = useState(null);

  const load = () => {
    modelsAPI.getAll()
      .then(data => { setVersions(data.versions || []); setProduction(data.production); })
      .catch(err => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    try {
      const metrics = {};
      Object.entries(form.metrics).forEach(([k, v]) => { if (v !== "") metrics[k] = parseFloat(v); });
      await modelsAPI.create({ ...form, metrics });
      showToast("Model version registered");
      setModal(false);
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  const promote = async (id) => {
    try {
      await modelsAPI.promote(id);
      showToast("Promoted to production");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  const rollback = async (id) => {
    if (!window.confirm("Rollback will set this checkpoint as production. Continue?")) return;
    try {
      await modelsAPI.rollback(id);
      showToast("Rolled back to selected version");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  const runCompare = async () => {
    if (!compareIds.a || !compareIds.b) return showToast("Select two versions", "error");
    try {
      const data = await modelsAPI.compare(compareIds.a, compareIds.b);
      setCompareResult(data);
    } catch (err) { showToast(err.message, "error"); }
  };

  const statusColor = { production: "#059669", candidate: "#d97706", archived: "#9ca3af" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>AI Model Version Control</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            Production: <b>{production ? `${production.name} ${production.version_tag}` : "—"}</b>
          </p>
        </div>
        <Btn icon="plus" onClick={() => setModal(true)}>Register Checkpoint</Btn>
      </div>

      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Compare versions</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={compareIds.a} onChange={e => setCompareIds(c => ({ ...c, a: e.target.value }))} style={{ ...inputStyle, width: 180 }}>
            <option value="">Version A</option>
            {versions.map(v => <option key={v.id} value={v.id}>{v.version_tag}</option>)}
          </select>
          <select value={compareIds.b} onChange={e => setCompareIds(c => ({ ...c, b: e.target.value }))} style={{ ...inputStyle, width: 180 }}>
            <option value="">Version B</option>
            {versions.map(v => <option key={v.id} value={v.id}>{v.version_tag}</option>)}
          </select>
          <Btn variant="secondary" onClick={runCompare}>Compare metrics</Btn>
        </div>
        {compareResult && (
          <table style={{ width: "100%", marginTop: 12, fontSize: 12, borderCollapse: "collapse" }}>
            <thead><tr><th style={thStyle}>Metric</th><th style={thStyle}>A</th><th style={thStyle}>B</th><th style={thStyle}>Δ</th></tr></thead>
            <tbody>
              {compareResult.metric_diff.map(row => (
                <tr key={row.metric}>
                  <td style={tdStyle}>{row.metric}</td>
                  <td style={tdStyle}>{row.a ?? "—"}</td>
                  <td style={tdStyle}>{row.b ?? "—"}</td>
                  <td style={tdStyle}>{row.delta != null ? row.delta.toFixed(4) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Tag", "Name", "Status", "Metrics", "Weights", "Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading...</td></tr>}
            {!loading && versions.map(v => (
              <tr key={v.id}>
                <td style={tdStyle}><b>{v.version_tag}</b></td>
                <td style={tdStyle}>{v.name}</td>
                <td style={tdStyle}><span style={{ color: statusColor[v.status] || "#666", fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>{v.status}</span></td>
                <td style={{ ...tdStyle, fontSize: 11 }}>{Object.entries(v.metrics || {}).map(([k, val]) => `${k}: ${val}`).join(" · ") || "—"}</td>
                <td style={{ ...tdStyle, fontSize: 11, color: "#6b7280" }}>{v.weights_path || "—"}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {v.status !== "production" && <Btn size="sm" variant="success" onClick={() => promote(v.id)}>Promote</Btn>}
                    {v.status !== "production" && <Btn size="sm" variant="warning" onClick={() => rollback(v.id)}>Rollback</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Register Model Checkpoint" onClose={() => setModal(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <Input label="Version tag" value={form.version_tag} onChange={v => setForm(f => ({ ...f, version_tag: v }))} required />
            <Input label="Model name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
            <Input label="Weights path" value={form.weights_path} onChange={v => setForm(f => ({ ...f, weights_path: v }))} placeholder="models/retinanet_v5.h5" />
            <Input label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
            {["accuracy", "auc", "f1"].map(m => (
              <Input key={m} label={m} value={form.metrics[m]} onChange={v => setForm(f => ({ ...f, metrics: { ...f.metrics, [m]: v } }))} type="number" />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={handleRegister}>Register</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function BackupsTab({ backupsAPI, showToast, Btn }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = () => {
    backupsAPI.getAll()
      .then(setBackups)
      .catch(err => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const runBackup = async () => {
    setRunning(true);
    try {
      await backupsAPI.create({ include_audit: true });
      showToast("Backup completed");
      load();
    } catch (err) { showToast(err.message, "error"); }
    finally { setRunning(false); }
  };

  const restore = async (id) => {
    if (!window.confirm("Restore will overwrite current database collections. Continue?")) return;
    try {
      await backupsAPI.restore(id);
      showToast("Restore completed — refresh the app");
    } catch (err) { showToast(err.message, "error"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this backup file?")) return;
    try {
      await backupsAPI.delete(id);
      showToast("Backup removed");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>System Backup Management</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>On-demand gzip archives of MongoDB collections with one-click restore.</p>
        </div>
        <Btn icon="plus" loading={running} onClick={runBackup}>Run Backup Now</Btn>
      </div>
      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["ID", "Created", "Size", "Status", "Collections", "Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading...</td></tr>}
            {!loading && backups.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>No backups yet</td></tr>}
            {!loading && backups.map(b => (
              <tr key={b.id}>
                <td style={tdStyle}><code style={{ fontSize: 11 }}>{b.id}</code></td>
                <td style={tdStyle}>{b.created_at}</td>
                <td style={tdStyle}>{b.size_human || b.size_bytes}</td>
                <td style={tdStyle}><span style={{ color: b.status === "success" ? "#059669" : "#dc2626", fontWeight: 700 }}>{b.status}</span></td>
                <td style={{ ...tdStyle, fontSize: 11 }}>{(b.collections || []).join(", ")}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Btn size="sm" variant="warning" onClick={() => restore(b.id)}>Restore</Btn>
                    <Btn size="sm" variant="danger" onClick={() => remove(b.id)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RBACEditorTab({ rbacAPI, showToast, Icon, I, Btn, ROLE_PERMISSIONS }) {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [activeRole, setActiveRole] = useState("admin");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([rbacAPI.getRoles(), rbacAPI.getCatalog()])
      .then(([r, c]) => { setRoles(r); setCatalog(c.permissions || []); })
      .catch(err => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [rbacAPI, showToast]);

  const active = roles.find(r => r.id === activeRole);
  const togglePerm = (key) => {
    if (activeRole === "admin") return showToast("Admin permissions are fixed", "error");
    setRoles(prev => prev.map(r => {
      if (r.id !== activeRole) return r;
      return { ...r, permissions: { ...r.permissions, [key]: !r.permissions[key] } };
    }));
  };

  const save = async () => {
    const role = roles.find(r => r.id === activeRole);
    if (!role) return;
    setSaving(true);
    try {
      await rbacAPI.updateRole(activeRole, { permissions: role.permissions, label: role.label });
      showToast("Permissions saved");
    } catch (err) { showToast(err.message, "error"); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, color: "#9ca3af" }}>Loading RBAC...</div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>Roles & Permissions (RBAC)</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Toggle granular permissions per role — changes apply immediately for new requests.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {roles.map(role => {
            const conf = ROLE_PERMISSIONS[role.id] || { color: "#6b7280", bg: "#f3f4f6", label: role.label };
            return (
              <button key={role.id} type="button" onClick={() => setActiveRole(role.id)}
                style={{ background: activeRole === role.id ? conf.bg : "#fff", border: activeRole === role.id ? `2px solid ${conf.color}` : "1.5px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: conf.color }}>{role.label || conf.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{role.id}</div>
              </button>
            );
          })}
        </div>
        <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontWeight: 700 }}>{active?.label} permissions</span>
            <Btn loading={saving} disabled={activeRole === "admin"} onClick={save}>Save changes</Btn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {catalog.map(p => (
              <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6", cursor: activeRole === "admin" ? "not-allowed" : "pointer" }}>
                <input type="checkbox" checked={!!active?.permissions?.[p.key]} disabled={activeRole === "admin"} onChange={() => togglePerm(p.key)} />
                <span style={{ fontSize: 13 }}>{p.label}</span>
                <code style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>{p.key}</code>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
