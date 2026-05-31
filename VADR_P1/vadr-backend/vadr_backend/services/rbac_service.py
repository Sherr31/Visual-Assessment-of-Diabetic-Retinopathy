"""Role-based access control — roles stored in MongoDB with granular permissions."""

from .. import db

# All permission keys used across the system
ALL_PERMISSIONS = [
    {"key": "can_view_dashboard", "label": "View Dashboard"},
    {"key": "can_manage_patients", "label": "Manage Patients"},
    {"key": "can_upload_images", "label": "Upload Fundus Images"},
    {"key": "can_run_ai", "label": "Run AI Prediction"},
    {"key": "can_review_ai", "label": "Review AI Results"},
    {"key": "can_generate_reports", "label": "Generate Reports"},
    {"key": "can_view_own_reports", "label": "View Own Reports"},
    {"key": "can_manage_users", "label": "Manage Users"},
    {"key": "can_system_admin", "label": "System Administration"},
    {"key": "can_view_analytics", "label": "View Analytics"},
    {"key": "can_export_data", "label": "Export Data"},
    {"key": "can_edit_models", "label": "Edit AI Models"},
    {"key": "can_view_logs", "label": "View Audit Logs"},
    {"key": "can_manage_backups", "label": "Manage Backups"},
    {"key": "can_manage_rbac", "label": "Manage Roles & Permissions"},
]

DEFAULT_ROLE_PERMISSIONS = {
    "admin": {p["key"]: True for p in ALL_PERMISSIONS},
    "manager": {
        "can_view_dashboard": True,
        "can_manage_patients": True,
        "can_upload_images": True,
        "can_run_ai": True,
        "can_review_ai": True,
        "can_generate_reports": True,
        "can_view_own_reports": True,
        "can_manage_users": True,
        "can_system_admin": False,
        "can_view_analytics": True,
        "can_export_data": True,
        "can_edit_models": True,
        "can_view_logs": True,
        "can_manage_backups": False,
        "can_manage_rbac": False,
    },
    "doctor": {
        "can_view_dashboard": True,
        "can_manage_patients": True,
        "can_upload_images": True,
        "can_run_ai": True,
        "can_review_ai": True,
        "can_generate_reports": True,
        "can_view_own_reports": True,
        "can_manage_users": False,
        "can_system_admin": False,
        "can_view_analytics": True,
        "can_export_data": True,
        "can_edit_models": False,
        "can_view_logs": False,
        "can_manage_backups": False,
        "can_manage_rbac": False,
    },
    "staff": {
        "can_view_dashboard": True,
        "can_manage_patients": False,
        "can_upload_images": True,
        "can_run_ai": False,
        "can_review_ai": False,
        "can_generate_reports": False,
        "can_view_own_reports": True,
        "can_manage_users": False,
        "can_system_admin": False,
        "can_view_analytics": False,
        "can_export_data": False,
        "can_edit_models": False,
        "can_view_logs": False,
        "can_manage_backups": False,
        "can_manage_rbac": False,
    },
    "screener": {
        "can_view_dashboard": True,
        "can_manage_patients": False,
        "can_upload_images": True,
        "can_run_ai": False,
        "can_review_ai": False,
        "can_generate_reports": False,
        "can_view_own_reports": True,
        "can_manage_users": False,
        "can_system_admin": False,
        "can_view_analytics": False,
        "can_export_data": False,
        "can_edit_models": False,
        "can_view_logs": False,
        "can_manage_backups": False,
        "can_manage_rbac": False,
    },
    "patient": {
        "can_view_dashboard": False,
        "can_manage_patients": False,
        "can_upload_images": False,
        "can_run_ai": False,
        "can_review_ai": False,
        "can_generate_reports": False,
        "can_view_own_reports": True,
        "can_manage_users": False,
        "can_system_admin": False,
        "can_view_analytics": False,
        "can_export_data": False,
        "can_edit_models": False,
        "can_view_logs": False,
        "can_manage_backups": False,
        "can_manage_rbac": False,
    },
    "technician": {
        "can_view_dashboard": True,
        "can_manage_patients": False,
        "can_upload_images": True,
        "can_run_ai": False,
        "can_review_ai": False,
        "can_generate_reports": False,
        "can_view_own_reports": True,
        "can_manage_users": False,
        "can_system_admin": False,
        "can_view_analytics": False,
        "can_export_data": False,
        "can_edit_models": False,
        "can_view_logs": False,
        "can_manage_backups": False,
        "can_manage_rbac": False,
    },
    "viewer": {
        "can_view_dashboard": True,
        "can_manage_patients": False,
        "can_upload_images": False,
        "can_run_ai": False,
        "can_review_ai": False,
        "can_generate_reports": False,
        "can_view_own_reports": True,
        "can_manage_users": False,
        "can_system_admin": False,
        "can_view_analytics": True,
        "can_export_data": False,
        "can_edit_models": False,
        "can_view_logs": False,
        "can_manage_backups": False,
        "can_manage_rbac": False,
    },
}

ROLE_LABELS = {
    "admin": "Admin",
    "manager": "Manager",
    "doctor": "Doctor",
    "screener": "Screener",
    "patient": "Patient",
    "staff": "Staff",
    "technician": "Technician",
    "viewer": "Viewer",
}


def _full_permissions_map(perms: dict) -> dict:
    keys = [p["key"] for p in ALL_PERMISSIONS]
    return {k: bool(perms.get(k, False)) for k in keys}


def seed_rbac_roles():
    """Ensure default roles exist in roles collection."""
    for role_id, perms in DEFAULT_ROLE_PERMISSIONS.items():
        existing = db.roles_col.find_one({"id": role_id})
        if not existing:
            db.roles_col.insert_one(
                {
                    "id": role_id,
                    "label": ROLE_LABELS.get(role_id, role_id.title()),
                    "permissions": _full_permissions_map(perms),
                }
            )


def get_role_permissions(role_id: str) -> dict:
    doc = db.roles_col.find_one({"id": role_id})
    if doc and doc.get("permissions"):
        return doc["permissions"]
    defaults = DEFAULT_ROLE_PERMISSIONS.get(role_id, {})
    return _full_permissions_map(defaults)


def user_has_permission(user: dict, permission_key: str) -> bool:
    if not user:
        return False
    role = user.get("role", "")
    perms = get_role_permissions(role)
    return bool(perms.get(permission_key))


def list_roles_with_permissions():
    seed_rbac_roles()
    roles = list(db.roles_col.find().sort("id", 1))
    out = []
    for r in roles:
        out.append(
            {
                "id": r["id"],
                "label": r.get("label") or ROLE_LABELS.get(r["id"], r["id"]),
                "permissions": r.get("permissions") or get_role_permissions(r["id"]),
            }
        )
    return out
