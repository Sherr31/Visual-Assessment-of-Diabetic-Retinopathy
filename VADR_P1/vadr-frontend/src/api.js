/**
 * Unified VADR API client — Bearer auth, refresh cookies, { data, error, message } unwrap.
 */

export const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export class ApiError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function getToken() {
  return localStorage.getItem("vadr_token");
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("vadr_user") || "null");
  } catch {
    return null;
  }
}

export function setSession({ accessToken, user }) {
  if (accessToken) localStorage.setItem("vadr_token", accessToken);
  if (user) localStorage.setItem("vadr_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("vadr_token");
  localStorage.removeItem("vadr_user");
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function request(method, endpoint, body = null, { auth = true, credentials = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const tok = getToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
  }

  const options = { method, headers, credentials: credentials ? "include" : "same-origin" };
  if (body != null) options.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, options);
  } catch (err) {
    throw new ApiError(err.message || "Failed to fetch", { status: 0, code: "NETWORK_ERROR" });
  }
  const json = await parseJson(res);

  if (res.status === 401 && auth) {
    clearSession();
    throw new ApiError(json.message || json.error || "Session expired", {
      status: 401,
      code: json.code || "UNAUTHORIZED",
      body: json,
    });
  }

  if (!res.ok) {
    throw new ApiError(json.message || json.error || "Request failed", {
      status: res.status,
      code: json.code,
      body: json,
    });
  }

  return json.data !== undefined ? json.data : json;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authAPI = {
  login: async (email, password) => {
    const data = await request(
      "POST",
      "/auth/login",
      { email: email.trim().toLowerCase(), password },
      { auth: false, credentials: true }
    );
    setSession({ accessToken: data.access_token || data.token, user: data.user });
    return data;
  },

  register: (payload) =>
    request("POST", "/auth/register", payload, { auth: false, credentials: true }),

  verifyRegistration: async (email, code) => {
    const data = await request(
      "POST",
      "/auth/verify-registration",
      { email: email.trim().toLowerCase(), code },
      { auth: false, credentials: true }
    );
    setSession({ accessToken: data.access_token || data.token, user: data.user });
    return data;
  },

  resendCode: (email) =>
    request("POST", "/auth/resend-registration-code", { email: email.trim().toLowerCase() }, { auth: false }),

  refresh: async () => {
    const data = await request("POST", "/auth/refresh", null, { auth: false, credentials: true });
    if (data.access_token || data.token) {
      localStorage.setItem("vadr_token", data.access_token || data.token);
    }
    return data;
  },

  logout: async () => {
    try {
      await request("POST", "/auth/logout", null, { auth: false, credentials: true });
    } finally {
      clearSession();
    }
  },

  me: () => request("GET", "/auth/me"),
};

// ─── Patients ────────────────────────────────────────────────────────────────

export const patientAPI = {
  getAll: () => request("GET", "/patients/"),
  getOne: (patientId) => request("GET", `/patients/${patientId}`),
  register: (data) => request("POST", "/patients/", data),
  update: (patientId, data) => request("PUT", `/patients/${patientId}`, data),
  toggleStatus: (patientId) => request("PATCH", `/patients/${patientId}/status`),
  sendCredentials: (patientId) => request("PATCH", `/patients/${patientId}/send-credentials`),
  delete: (patientId) => request("DELETE", `/patients/${patientId}`),
};

export const medicalHistoryAPI = {
  get: (patientId) => request("GET", `/patients/${patientId}/medical-history`),
  update: (patientId, data) => request("PUT", `/patients/${patientId}/medical-history`, data),
  export: (patientId) => request("GET", `/patients/${patientId}/medical-history/export`),
};

// ─── Users / staff ───────────────────────────────────────────────────────────

export const userAPI = {
  getAll: () => request("GET", "/users/"),
  getDoctors: () => request("GET", "/users/doctors"),
  getOne: (userId) => request("GET", `/users/${userId}`),
  create: (data) => request("POST", "/users/", data),
  update: (userId, data) => request("PUT", `/users/${userId}`, data),
  toggleStatus: (userId) => request("PATCH", `/users/${userId}/status`),
  delete: (userId) => request("DELETE", `/users/${userId}`),
};

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminAPI = {
  pendingDoctors: () => request("GET", "/admin/pending-doctors"),
  approveDoctor: (userId) => request("PATCH", `/admin/users/${userId}/approve`, {}),
  rejectDoctor: (userId, reason = "") =>
    request("PATCH", `/admin/users/${userId}/reject`, { reason }),
  auditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/admin/audit-logs${q ? `?${q}` : ""}`);
  },
  revokeUserSessions: (userId) => request("DELETE", `/admin/users/${userId}/sessions`),
  getPermissions: () => request("GET", "/admin/permissions"),
  updatePermissions: (matrix) => request("PUT", "/admin/permissions", { matrix }),
  resetPermissions: () => request("POST", "/admin/permissions/reset", {}),
};

export const checkHealth = () => request("GET", "/health", null, { auth: false });
