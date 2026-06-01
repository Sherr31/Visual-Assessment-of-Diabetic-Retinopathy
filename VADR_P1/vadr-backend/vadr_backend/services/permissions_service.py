"""Role permission matrix — stored in MongoDB, editable by admin only."""

from copy import deepcopy

from .. import db
from ..utils.common import utcnow_naive

ROLES = ("admin", "doctor", "screener", "patient")
SETTINGS_ID = "permission_matrix"

# Admin cannot disable these for the admin role (safety guardrails).
ADMIN_LOCKED_PERMISSIONS = frozenset({"System Administration", "Manage Users"})

DEFAULT_PERMISSION_MATRIX = {
    "View Dashboard": {"admin": True, "doctor": True, "screener": True, "patient": False},
    "Manage Patients": {"admin": True, "doctor": True, "screener": False, "patient": False},
    "Upload Fundus Images": {"admin": True, "doctor": True, "screener": True, "patient": False},
    "Run AI Prediction": {"admin": True, "doctor": True, "screener": False, "patient": False},
    "Review AI Results": {"admin": True, "doctor": True, "screener": False, "patient": False},
    "Generate Reports": {"admin": True, "doctor": True, "screener": False, "patient": False},
    "View Own Reports": {"admin": True, "doctor": True, "screener": True, "patient": True},
    "Manage Users": {"admin": True, "doctor": False, "screener": False, "patient": False},
    "System Administration": {"admin": True, "doctor": False, "screener": False, "patient": False},
    "View Analytics": {"admin": True, "doctor": True, "screener": False, "patient": False},
    "Export Data": {"admin": True, "doctor": True, "screener": False, "patient": False},
    "Patient Self-Service": {"admin": False, "doctor": False, "screener": False, "patient": True},
}


def _normalize_matrix(raw: dict | None) -> dict:
    """Merge stored matrix with defaults so new permissions appear automatically."""
    base = deepcopy(DEFAULT_PERMISSION_MATRIX)
    if not raw or not isinstance(raw, dict):
        return base
    for perm, roles in raw.items():
        if perm not in base or not isinstance(roles, dict):
            continue
        for role in ROLES:
            if role in roles:
                base[perm][role] = bool(roles[role])
    return base


def get_permission_matrix() -> dict:
    doc = db.rbac_settings_col.find_one({"_id": SETTINGS_ID})
    stored = doc.get("matrix") if doc else None
    matrix = _normalize_matrix(stored)
    meta = {
        "updated_at": doc.get("updated_at") if doc else None,
        "updated_by": doc.get("updated_by") if doc else None,
    }
    return {"matrix": matrix, "roles": list(ROLES), "meta": meta}


def validate_matrix(matrix: dict) -> str | None:
    if not isinstance(matrix, dict):
        return "Matrix must be an object"
    if set(matrix.keys()) != set(DEFAULT_PERMISSION_MATRIX.keys()):
        return "Permission set does not match the system definition"
    for perm, roles in matrix.items():
        if not isinstance(roles, dict):
            return f"Invalid roles for {perm}"
        if set(roles.keys()) != set(ROLES):
            return f"Invalid role keys for {perm}"
        for role in ROLES:
            if not isinstance(roles[role], bool):
                return f"Permission {perm}.{role} must be true or false"
    for locked in ADMIN_LOCKED_PERMISSIONS:
        if not matrix.get(locked, {}).get("admin"):
            return f'Admin must retain "{locked}"'
    return None


def update_permission_matrix(matrix: dict, *, updated_by: str) -> dict:
    err = validate_matrix(matrix)
    if err:
        raise ValueError(err)
    now = utcnow_naive()
    db.rbac_settings_col.update_one(
        {"_id": SETTINGS_ID},
        {
            "$set": {
                "matrix": matrix,
                "updated_at": now,
                "updated_by": updated_by,
            }
        },
        upsert=True,
    )
    return get_permission_matrix()


def reset_permission_matrix(*, updated_by: str) -> dict:
    return update_permission_matrix(deepcopy(DEFAULT_PERMISSION_MATRIX), updated_by=updated_by)


def role_has_permission(matrix: dict, role: str, permission: str) -> bool:
    """Check a permission for a role (used by route guards)."""
    if role == "admin":
        return True
    perm_roles = matrix.get(permission) or DEFAULT_PERMISSION_MATRIX.get(permission, {})
    return bool(perm_roles.get(role, False))
