from flask import Blueprint, jsonify, request

from ..services.audit_service import log_audit_from_request
from ..services.model_version_service import (
    archive_version,
    compare_versions,
    list_model_versions,
    promote_version,
    register_version,
    rollback_to_version,
)
from ..utils.auth_decorators import require_permission
from ..utils.common import serialize

models_bp = Blueprint("models", __name__)


@models_bp.route("/", methods=["GET"])
@require_permission("can_edit_models")
def get_models():
    versions = [serialize(v) for v in list_model_versions()]
    production = next((v for v in versions if v.get("status") == "production"), None)
    return jsonify({"versions": versions, "production": production}), 200


@models_bp.route("/", methods=["POST"])
@require_permission("can_edit_models")
def create_model_version():
    data = request.get_json() or {}
    required = ["version_tag", "name"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    try:
        doc = register_version(
            version_tag=data["version_tag"].strip(),
            name=data["name"].strip(),
            weights_path=(data.get("weights_path") or "").strip(),
            metrics=data.get("metrics") or {},
            notes=(data.get("notes") or "").strip(),
            created_by=request.vadr_user.get("email", ""),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 409

    log_audit_from_request(
        request.vadr_user,
        action="CREATE",
        resource_type="model_versions",
        resource_id=doc["id"],
        table_name="model_versions",
        new_value=serialize(doc),
    )
    return jsonify(serialize(doc)), 201


@models_bp.route("/<version_id>/promote", methods=["POST"])
@require_permission("can_edit_models")
def promote_model(version_id):
    try:
        updated = promote_version(version_id)
    except LookupError:
        return jsonify({"error": "Model version not found"}), 404

    log_audit_from_request(
        request.vadr_user,
        action="UPDATE",
        resource_type="model_versions",
        resource_id=version_id,
        table_name="model_versions",
        new_value={"status": "production", "version_tag": updated.get("version_tag")},
        metadata={"operation": "promote"},
    )
    return jsonify(serialize(updated)), 200


@models_bp.route("/<version_id>/rollback", methods=["POST"])
@require_permission("can_edit_models")
def rollback_model(version_id):
    try:
        updated = rollback_to_version(version_id)
    except LookupError:
        return jsonify({"error": "Model version not found"}), 404

    log_audit_from_request(
        request.vadr_user,
        action="UPDATE",
        resource_type="model_versions",
        resource_id=version_id,
        table_name="model_versions",
        new_value={"status": "production", "version_tag": updated.get("version_tag")},
        metadata={"operation": "rollback"},
    )
    return jsonify(serialize(updated)), 200


@models_bp.route("/<version_id>/archive", methods=["POST"])
@require_permission("can_edit_models")
def archive_model(version_id):
    try:
        updated = archive_version(version_id)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(serialize(updated)), 200


@models_bp.route("/compare", methods=["GET"])
@require_permission("can_edit_models")
def compare_model_versions():
    a = request.args.get("a")
    b = request.args.get("b")
    if not a or not b:
        return jsonify({"error": "query params a and b (version ids) are required"}), 400
    try:
        result = compare_versions(a, b)
    except LookupError:
        return jsonify({"error": "One or both versions not found"}), 404
    return jsonify(
        {
            "version_a": serialize(result["version_a"]),
            "version_b": serialize(result["version_b"]),
            "metric_diff": result["metric_diff"],
        }
    ), 200
