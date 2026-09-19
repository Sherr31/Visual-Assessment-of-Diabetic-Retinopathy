import React from "react";
import { Navigate } from "react-router-dom";
import { getToken, getStoredUser } from "../../api";
import { getHomeRoute } from "../../lib/session";

/**
 * Route guard that enforces both authentication and role-based access control.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Target component to render if authorized
 * @param {string[]} [props.allowedRoles] - Roles permitted to access this route
 */
export default function RoleRoute({ children, allowedRoles }) {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Doctor pending approval redirect
  if (user.role === "doctor" && user.status === "pending_approval") {
    return <Navigate to="/pending-approval" replace />;
  }

  // Check if current user role matches allowed roles
  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      // Send the user to their own role-specific home route
      return <Navigate to={getHomeRoute(user)} replace />;
    }
  }

  return children;
}
