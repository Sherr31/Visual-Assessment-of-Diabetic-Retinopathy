from flask import Blueprint, jsonify, request

from .. import db
from ..services.audit_service import log_audit_from_request
from ..services.rbac_service import ALL_PERMISSIONS, list_roles_with_permissions
from ..utils.auth_decorators import require_auth, require_permission
from ..utils.common import serialize

rbac_bp = Blueprint("rbac", __name__)


@rbac_bp.route("/permissions", methods=["GET"])
@require_permission("can_manage_rbac")
def get_permission_catalog():
    return jsonify({"permissions": ALL_PERMISSIONS}), 200


@rbac_bp.route("/roles", methods=["GET"])
@require_permission("can_manage_rbac")
def get_roles():
    return jsonify(list_roles_with_permissions()), 200


@rbac_bp.route("/roles/<role_id>", methods=["PUT"])
@require_permission("can_manage_rbac")
def update_role_permissions(role_id):
    if role_id == "admin":
        return jsonify({"error": "Cannot modify admin role permissions"}), 403

    data = request.get_json() or {}
    permissions = data.get("permissions")
    if not isinstance(permissions, dict):
        return jsonify({"error": "permissions object is required"}), 400

    old = db.roles_col.find_one({"id": role_id})
    if not old:
        return jsonify({"error": "Role not found"}), 404

    label = data.get("label") or old.get("label")
    db.roles_col.update_one(
        {"id": role_id},
        {"$set": {"permissions": permissions, "label": label}},
    )
    updated = db.roles_col.find_one({"id": role_id})
    log_audit_from_request(
        request.vadr_user,
        action="UPDATE",
        resource_type="roles",
        resource_id=role_id,
        table_name="roles",
        old_value={"permissions": old.get("permissions")},
        new_value={"permissions": permissions},
    )
    return jsonify(serialize(updated)), 200


@rbac_bp.route("/me/permissions", methods=["GET"])
@require_auth
def my_permissions():
    from ..services.rbac_service import get_role_permissions

    user = request.vadr_user
    role = user.get("role", "")
    return jsonify(
        {
            "role": role,
            "permissions": get_role_permissions(role),
        }
    ), 200
