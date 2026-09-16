import { getStoredUser } from "../api";

export const STAFF_ROLES = ["admin", "doctor", "screener"];

export function getHomeRoute(user = getStoredUser()) {
  if (!user) return "/login";
  if (user.role === "patient") return "/my-records";
  if (user.role === "doctor" && user.status === "pending_approval") return "/pending-approval";
  if (STAFF_ROLES.includes(user.role)) return "/";
  return "/login";
}

export function canAccessStaffPortal(user = getStoredUser()) {
  return user && STAFF_ROLES.includes(user.role) && user.status !== "pending_approval";
}

export function isAdmin(user = getStoredUser()) {
  return user?.role === "admin";
}
