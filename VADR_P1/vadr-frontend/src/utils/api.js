/**
 * utils/api.js
 * Dashboard-specific API calls routed to /api/dashboard/*
 * Provides both named function exports (for simple pages) and
 * a default axios instance (used directly by PatientDashboard, TechnicianDashboard, AdminDashboard).
 */
import axios from "axios";

const DASHBOARD_BASE = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/dashboard`
  : "http://localhost:5000/api/dashboard";

// ── Default axios instance (used by pages that call api.get / api.post / api.delete) ──
const api = axios.create({
  baseURL: DASHBOARD_BASE,
  timeout: 30000,
});

export default api;

// ── Named fetch helpers (used by Overview, RecentTable, etc.) ────────────────
export const fetchOverview  = () => api.get("/overview").then(r => r.data);
export const fetchHistory   = () => api.get("/history").then(r => r.data);
export const fetchAnalytics = () => api.get("/analytics").then(r => r.data);
export const fetchPatient   = (id) => api.get(`/patient-detail/${id}`).then(r => r.data);

// ── Scan prediction ──────────────────────────────────────────────────────────
export const predictImage = (formData) =>
  api.post("/predict", formData, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);

// ── Patient Dashboard ────────────────────────────────────────────────────────
export const fetchPatientsList     = () => api.get("/patients-list").then(r => r.data);
export const fetchPatientDashboard = (id) => api.get(`/patient-dashboard/${id}`).then(r => r.data);
export const fetchPatientScans     = (id) => api.get(`/patient-scans/${id}`).then(r => r.data);

// ── Technician Dashboard ─────────────────────────────────────────────────────
export const fetchTechnicians   = () => api.get("/technicians").then(r => r.data);
export const fetchTechDashboard = (id) => api.get(`/technician-dashboard/${id}`).then(r => r.data);
export const fetchTechQueue     = (id) => api.get(`/technician-queue/${id}`).then(r => r.data);
export const updateQueueItem    = (techId, itemId, status) =>
  api.post(`/technician-queue/${techId}/update`, { item_id: itemId, status }).then(r => r.data);
export const processTechScan    = (formData) =>
  api.post("/technician-scan", formData, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);

// ── Appointments ──────────────────────────────────────────────────────────────
export const fetchAppointments = () => api.get("/appointments").then(r => r.data);
export const createAppointment = (data) => api.post("/appointments", data).then(r => r.data);

// ── DB Status ─────────────────────────────────────────────────────────────────
export const fetchDbStatus = () => api.get("/db-status").then(r => r.data);

// ── Image Normalization ───────────────────────────────────────────────────────
export const normalizeImage = (file) => {
  const formData = new FormData();
  formData.append("image", file);
  return api
    .post("/normalize", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    })
    .then(r => {
      if (!r.data.success) throw new Error(r.data.error || "Normalization failed.");
      return r.data;
    });
};

export const fetchNormalizationRecords = (limit = 20) =>
  api.get(`/normalize/records?limit=${limit}`).then(r => r.data);
