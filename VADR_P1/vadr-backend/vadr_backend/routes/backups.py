from flask import Blueprint, jsonify, request

from ..services.audit_service import log_audit_from_request
from ..services.backup_service import create_backup, delete_backup_record, list_backups, restore_backup
from ..utils.auth_decorators import require_permission
from ..utils.common import serialize

backups_bp = Blueprint("backups", __name__)


@backups_bp.route("/", methods=["GET"])
@require_permission("can_manage_backups")
def get_backups():
    records = [serialize(b) for b in list_backups()]
    return jsonify(records), 200


@backups_bp.route("/", methods=["POST"])
@require_permission("can_manage_backups")
def run_backup():
    data = request.get_json() or {}
    include_audit = data.get("include_audit", True)
    try:
        record = create_backup(include_audit=bool(include_audit))
    except OSError as exc:
        return jsonify({"error": f"Backup failed: {exc}"}), 500

    log_audit_from_request(
        request.vadr_user,
        action="CREATE",
        resource_type="backups",
        resource_id=record["id"],
        table_name="backups",
        new_value=record,
    )
    return jsonify(serialize(record)), 201


@backups_bp.route("/<backup_id>/restore", methods=["POST"])
@require_permission("can_manage_backups")
def restore(backup_id):
    try:
        result = restore_backup(backup_id)
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": f"Restore failed: {exc}"}), 500

    log_audit_from_request(
        request.vadr_user,
        action="UPDATE",
        resource_type="backups",
        resource_id=backup_id,
        table_name="backups",
        metadata={"operation": "restore", "restored": result.get("restored_collections")},
    )
    return jsonify(result), 200


@backups_bp.route("/<backup_id>", methods=["DELETE"])
@require_permission("can_manage_backups")
def delete_backup(backup_id):
    if not delete_backup_record(backup_id):
        return jsonify({"error": "Backup not found"}), 404
    log_audit_from_request(
        request.vadr_user,
        action="DELETE",
        resource_type="backups",
        resource_id=backup_id,
        table_name="backups",
    )
    return jsonify({"message": "Backup deleted"}), 200
