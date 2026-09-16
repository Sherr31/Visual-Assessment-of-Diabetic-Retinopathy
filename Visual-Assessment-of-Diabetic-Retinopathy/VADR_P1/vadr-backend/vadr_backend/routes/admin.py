"""Admin routes: doctor approval, audit logs, session management."""

from datetime import timedelta

from flask import Blueprint, g, request

from .. import db
from ..config import settings
from ..decorators import require_auth
from ..responses import api_error, api_success
from ..services.audit_service import log_event, query_logs
from ..services.auth_service import revoke_all_user_tokens
from ..services.backup_service import create_backup, get_backups, restore_backup
from ..services.mail_service import send_doctor_approval_email, send_doctor_rejection_email
from ..services.permissions_service import (
    get_permission_matrix,
    reset_permission_matrix,
    update_permission_matrix,
)
from ..utils.common import serialize, utcnow_naive
from ..utils.request_context import client_ip, user_agent

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/pending-doctors", methods=["GET"])
@require_auth(roles=["admin"])
def pending_doctors():
    """List doctor accounts awaiting admin approval."""
    pending_users = list(db.users_col.find({"role": "doctor", "status": "pending_approval"}))
    requests = list(db.approval_requests_col.find({"status": "pending"}))
    request_map = {r["user_id"]: r for r in requests}
    data = []
    for user in pending_users:
        item = serialize(user)
        req = request_map.get(user["id"], {})
        item["approval_request"] = {
            "status": req.get("status", "pending"),
            "requested_at": req.get("requested_at"),
        }
        data.append(item)
    return api_success(data, message="Pending doctor accounts")


@admin_bp.route("/users/<user_id>/approve", methods=["PATCH"])
@require_auth(roles=["admin"])
def approve_doctor(user_id):
    """Approve a pending doctor account and notify them by email."""
    data = request.get_json() or {}
    user = db.users_col.find_one({"id": user_id})
    if not user:
        return api_error("User not found", status=404)
    if user.get("role") != "doctor":
        return api_error("Only doctor accounts require approval", status=400)
    if user.get("status") != "pending_approval":
        return api_error("User is not pending approval", status=400)

    now = utcnow_naive()
    db.users_col.update_one(
        {"id": user_id},
        {
            "$set": {
                "status": "active",
                "updated_at": now,
                "approval.approved_by": g.current_user["id"],
                "approval.approved_at": now,
            }
        },
    )
    db.approval_requests_col.update_one(
        {"user_id": user_id},
        {"$set": {"status": "approved", "reviewed_by": g.current_user["id"], "reviewed_at": now, "reason": None}},
        upsert=True,
    )

    ok, err = send_doctor_approval_email(user["email"], user.get("name", ""))
    log_event(
        "approve",
        user_id=g.current_user["id"],
        role="admin",
        ip_address=client_ip(),
        user_agent=user_agent(),
        metadata={"target_user_id": user_id, "email_sent": ok, **({"email_error": err} if err else {})},
    )

    updated = db.users_col.find_one({"id": user_id})
    return api_success(
        serialize(updated),
        message="Doctor approved successfully",
        emailSent=ok,
    )


@admin_bp.route("/users/<user_id>/reject", methods=["PATCH"])
@require_auth(roles=["admin"])
def reject_doctor(user_id):
    """Reject a pending doctor application with optional reason."""
    data = request.get_json() or {}
    reason = (data.get("reason") or "").strip()
    user = db.users_col.find_one({"id": user_id})
    if not user:
        return api_error("User not found", status=404)
    if user.get("role") != "doctor":
        return api_error("Only doctor accounts require approval", status=400)
    if user.get("status") != "pending_approval":
        return api_error("User is not pending approval", status=400)

    now = utcnow_naive()
    reapply_after = now + timedelta(days=settings.rejection_reapply_days)
    db.users_col.update_one(
        {"id": user_id},
        {
            "$set": {
                "status": "suspended",
                "updated_at": now,
                "approval.rejected_by": g.current_user["id"],
                "approval.rejected_at": now,
                "approval.rejection_reason": reason,
            }
        },
    )
    db.approval_requests_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "status": "rejected",
                "reviewed_by": g.current_user["id"],
                "reviewed_at": now,
                "reason": reason,
                "reapply_after": reapply_after,
                "email": user.get("email"),
            }
        },
        upsert=True,
    )

    revoke_all_user_tokens(user_id)
    ok, err = send_doctor_rejection_email(
        user["email"],
        user.get("name", ""),
        reason,
        settings.rejection_reapply_days,
    )
    log_event(
        "reject",
        user_id=g.current_user["id"],
        role="admin",
        ip_address=client_ip(),
        user_agent=user_agent(),
        metadata={"target_user_id": user_id, "reason": reason, "email_sent": ok},
    )

    return api_success(
        {"user_id": user_id, "reapply_after": reapply_after, "emailSent": ok},
        message="Doctor application rejected",
    )


@admin_bp.route("/audit-logs", methods=["GET"])
@require_auth(roles=["admin"])
def audit_logs():
    """Return paginated audit logs with optional filters."""
    user_id = request.args.get("user_id")
    event_type = request.args.get("event_type")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    try:
        page = max(int(request.args.get("page", 1)), 1)
    except (ValueError, TypeError):
        page = 1

    try:
        per_page = min(max(int(request.args.get("per_page", 50)), 1), 200)
    except (ValueError, TypeError):
        per_page = 50

    def _parse_date(value, param_name):
        if not value:
            return None, None
        from datetime import datetime

        try:
            return datetime.fromisoformat(value.replace("Z", "")), None
        except (ValueError, TypeError):
            return None, f"Invalid date format for '{param_name}'. Expected ISO 8601 format."

    parsed_start, start_err = _parse_date(start_date, "start_date")
    if start_err:
        return api_error(start_err, status=400)

    parsed_end, end_err = _parse_date(end_date, "end_date")
    if end_err:
        return api_error(end_err, status=400)

    logs, total = query_logs(
        user_id=user_id,
        event_type=event_type,
        start_date=parsed_start,
        end_date=parsed_end,
        page=page,
        per_page=per_page,
    )
    return api_success(
        {"items": logs, "page": page, "per_page": per_page, "total": total},
        message="Audit logs",
    )


@admin_bp.route("/users/<user_id>/sessions", methods=["DELETE"])
@require_auth(roles=["admin"])
def admin_revoke_user_sessions(user_id):
    """Force logout by revoking all sessions and refresh tokens for a user."""
    user = db.users_col.find_one({"id": user_id})
    if not user:
        return api_error("User not found", status=404)
    count = revoke_all_user_tokens(user_id)
    log_event(
        "logout",
        user_id=g.current_user["id"],
        role="admin",
        ip_address=client_ip(),
        user_agent=user_agent(),
        metadata={"target_user_id": user_id, "forced": True, "tokens_revoked": count},
    )
    return api_success({"revoked": count}, message="All user sessions revoked")


@admin_bp.route("/permissions", methods=["GET"])
@require_auth(roles=["admin"])
def get_permissions():
    """Return the role × permission matrix (admin only)."""
    return api_success(get_permission_matrix(), message="Permission matrix")


@admin_bp.route("/permissions", methods=["PUT"])
@require_auth(roles=["admin"])
def put_permissions():
    """Update the permission matrix (admin only)."""
    data = request.get_json() or {}
    matrix = data.get("matrix")
    if matrix is None:
        return api_error("matrix is required", status=400)
    try:
        result = update_permission_matrix(matrix, updated_by=g.current_user["id"])
    except ValueError as exc:
        return api_error(str(exc), status=400)
    log_event(
        "permission_matrix_update",
        user_id=g.current_user["id"],
        role="admin",
        ip_address=client_ip(),
        user_agent=user_agent(),
        metadata={"permissions": len(matrix)},
    )
    return api_success(result, message="Permissions saved")


@admin_bp.route("/permissions/reset", methods=["POST"])
@require_auth(roles=["admin"])
def reset_permissions():
    """Restore default permission matrix (admin only)."""
    result = reset_permission_matrix(updated_by=g.current_user["id"])
    log_event(
        "permission_matrix_reset",
        user_id=g.current_user["id"],
        role="admin",
        ip_address=client_ip(),
        user_agent=user_agent(),
    )
    return api_success(result, message="Permissions reset to defaults")


@admin_bp.route("/backups", methods=["GET"])
@require_auth(roles=["admin"])
def list_backups():
    """List system backups (admin only)."""
    backups = get_backups()
    return api_success(backups, message="System backups")


@admin_bp.route("/backups", methods=["POST"])
@require_auth(roles=["admin"])
def create_system_backup():
    """Create a new system backup (admin only)."""
    try:
        backup = create_backup(g.current_user["id"])
        log_event(
            "backup_created",
            user_id=g.current_user["id"],
            role="admin",
            ip_address=client_ip(),
            user_agent=user_agent(),
            metadata={"backup_id": backup["backup_id"], "size_bytes": backup["size_bytes"]},
        )
        return api_success(backup, message="Backup created successfully", status=201)
    except Exception as exc:
        return api_error(str(exc), status=500)


@admin_bp.route("/backups/<backup_id>/restore", methods=["POST"])
@require_auth(roles=["admin"])
def restore_system_backup(backup_id):
    """Restore the system from a specific backup ID (admin only)."""
    data = request.get_json() or {}
    confirmation = data.get("confirmation", "").strip()

    if confirmation != "RESTORE":
        log_event(
            "backup_restore_failed",
            user_id=g.current_user["id"],
            role="admin",
            ip_address=client_ip(),
            user_agent=user_agent(),
            metadata={"backup_id": backup_id, "error": "Invalid confirmation string"},
        )
        return api_error("Invalid confirmation. You must type exactly RESTORE.", status=400)

    try:
        result = restore_backup(backup_id)

        # Invalidate sessions/tokens for safety
        db.refresh_tokens_col.update_many({}, {"$set": {"revoked": True}})
        db.sessions_col.update_many({}, {"$set": {"revoked": True}})

        log_event(
            "backup_restored",
            user_id=g.current_user["id"],
            role="admin",
            ip_address=client_ip(),
            user_agent=user_agent(),
            metadata={"backup_id": backup_id, "restored_collections": result["restored_collections"]},
        )
        return api_success(result, message="Backup restored successfully")
    except ValueError as exc:
        log_event(
            "backup_restore_failed",
            user_id=g.current_user["id"],
            role="admin",
            ip_address=client_ip(),
            user_agent=user_agent(),
            metadata={"backup_id": backup_id, "error": str(exc)},
        )
        return api_error(str(exc), status=400)
    except Exception as exc:
        log_event(
            "backup_restore_failed",
            user_id=g.current_user["id"],
            role="admin",
            ip_address=client_ip(),
            user_agent=user_agent(),
            metadata={"backup_id": backup_id, "error": "Internal server error"},
        )
        return api_error("An error occurred during restore", status=500)
