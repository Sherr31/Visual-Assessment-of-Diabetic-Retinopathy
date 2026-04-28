from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from .. import db
from ..utils.common import gen_user_id, serialize, today

users_bp = Blueprint("users", __name__)


@users_bp.route("/", methods=["GET"])
def get_users():
    users = list(db.users_col.find())
    return jsonify([serialize(u) for u in users]), 200


@users_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    user = db.users_col.find_one({"id": user_id})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(serialize(user)), 200


@users_bp.route("/", methods=["POST"])
def create_user():
    data = request.get_json() or {}
    required = ["name", "email", "role"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    email = data["email"].strip().lower()
    if db.users_col.find_one({"email": email}):
        return jsonify({"error": "A user with this email already exists"}), 409

    new_user = {
        "id": gen_user_id(),
        "name": data.get("name"),
        "email": email,
        "phone": data.get("phone", ""),
        "role": data.get("role"),
        "department": data.get("department", ""),
        "status": data.get("status", "active"),
        "joined": today(),
        "lastLogin": "Never",
    }
    if data.get("password"):
        new_user["password_hash"] = generate_password_hash(data["password"])

    result = db.users_col.insert_one(new_user)
    new_user["_id"] = str(result.inserted_id)
    return jsonify(serialize(new_user)), 201


@users_bp.route("/<user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.get_json() or {}
    data.pop("_id", None)
    data.pop("id", None)
    if "password" in data and data["password"]:
        data["password_hash"] = generate_password_hash(data.pop("password"))
    elif "password" in data:
        data.pop("password", None)

    result = db.users_col.update_one({"id": user_id}, {"$set": data})
    if result.matched_count == 0:
        return jsonify({"error": "User not found"}), 404

    updated = db.users_col.find_one({"id": user_id})
    return jsonify(serialize(updated)), 200


@users_bp.route("/<user_id>/status", methods=["PATCH"])
def toggle_user_status(user_id):
    if user_id == "u1":
        return jsonify({"error": "Cannot deactivate main admin"}), 403

    user = db.users_col.find_one({"id": user_id})
    if not user:
        return jsonify({"error": "User not found"}), 404

    new_status = "inactive" if user["status"] == "active" else "active"
    db.users_col.update_one({"id": user_id}, {"$set": {"status": new_status}})
    return jsonify({"status": new_status}), 200


@users_bp.route("/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    if user_id == "u1":
        return jsonify({"error": "Cannot delete main admin"}), 403

    result = db.users_col.delete_one({"id": user_id})
    if result.deleted_count == 0:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"message": "User deleted"}), 200
