// ─── api.js ───────────────────────────────────────────────────────────────────
// All API calls from React frontend to Flask backend
// Place this file in: src/api.js

const BASE_URL = "http://localhost:5000/api";

// ─── Helper ───────────────────────────────────────────────────────────────────
const request = async (method, endpoint, body = null) => {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
};

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT APIs
// ══════════════════════════════════════════════════════════════════════════════
export const patientAPI = {
  // Get all patients
  getAll: () => request("GET", "/patients"),

  // Get single patient
  getOne: (patientId) => request("GET", `/patients/${patientId}`),

  // Register new patient
  register: (data) => request("POST", "/patients", data),

  // Update patient profile
  update: (patientId, data) => request("PUT", `/patients/${patientId}`, data),

  // Toggle active/inactive
  toggleStatus: (patientId) => request("PATCH", `/patients/${patientId}/status`),

  // Mark credentials as sent
  sendCredentials: (patientId) => request("PATCH", `/patients/${patientId}/send-credentials`),

  // Delete patient
  delete: (patientId) => request("DELETE", `/patients/${patientId}`),
};

export const medicalHistoryAPI = {
  get: (patientId) => request("GET", `/patients/${patientId}/medical-history`),
  update: (patientId, data) => request("PUT", `/patients/${patientId}/medical-history`, data),
  export: (patientId) => request("GET", `/patients/${patientId}/medical-history/export`),
};

// ══════════════════════════════════════════════════════════════════════════════
// USER / STAFF APIs
// ══════════════════════════════════════════════════════════════════════════════
export const userAPI = {
  // Get all users
  getAll: () => request("GET", "/users"),

  // Get single user
  getOne: (userId) => request("GET", `/users/${userId}`),

  // Create new staff user
  create: (data) => request("POST", "/users", data),

  // Update user profile
  update: (userId, data) => request("PUT", `/users/${userId}`, data),

  // Toggle active/inactive
  toggleStatus: (userId) => request("PATCH", `/users/${userId}/status`),

  // Delete user
  delete: (userId) => request("DELETE", `/users/${userId}`),
};

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════
export const checkHealth = () => request("GET", "/health");
