import { getStoredUser } from "../api";

export const STAFF_ROLES = ["admin", "doctor", "screener"];

export function getHomeRoute(user = getStoredUser()) {
  if (!user) return "/login";
  if (user.role === "doctor" && user.status === "pending_approval") return "/pending-approval";
  
  switch (user.role) {
    case "admin":
      return "/admin/dashboard";
    case "doctor":
      return "/doctor/dashboard";
    case "screener":
      return "/screener/dashboard";
    case "patient":
      return "/patient/dashboard";
    default:
      return "/login";
  }
}

export function canAccessStaffPortal(user = getStoredUser()) {
  return user && STAFF_ROLES.includes(user.role) && user.status !== "pending_approval";
}

export function isAdmin(user = getStoredUser()) {
  return user?.role === "admin";
}

export function isDoctor(user = getStoredUser()) {
  return user?.role === "doctor";
}

export function isScreener(user = getStoredUser()) {
  return user?.role === "screener";
}

export function isPatient(user = getStoredUser()) {
  return user?.role === "patient";
}

