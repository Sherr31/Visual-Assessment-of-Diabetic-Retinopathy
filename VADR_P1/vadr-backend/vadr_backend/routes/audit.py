from flask import Blueprint, jsonify, request

from ..services.audit_service import query_audit_logs
from ..utils.auth_decorators import require_permission

audit_bp = Blueprint("audit", __name__)


@audit_bp.route("/", methods=["GET"])
@require_permission("can_view_logs")
def list_audit_logs():
    search = (request.args.get("search") or "").strip()
    action = (request.args.get("action") or "").strip()
    resource_type = (request.args.get("resource_type") or "").strip()
    actor_id = (request.args.get("actor_id") or "").strip()
    try:
        limit = int(request.args.get("limit", 100))
        skip = int(request.args.get("skip", 0))
    except ValueError:
        return jsonify({"error": "limit and skip must be integers"}), 400

    total, logs = query_audit_logs(
        search=search,
        action=action,
        resource_type=resource_type,
        actor_id=actor_id,
        limit=limit,
        skip=skip,
    )
    return jsonify({"total": total, "logs": logs}), 200
