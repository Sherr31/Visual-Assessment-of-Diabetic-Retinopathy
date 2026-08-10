from flask import Blueprint, g, request

from .. import db
from ..decorators import require_auth
from ..responses import api_error, api_success
from ..utils.common import gen_user_id, hash_password, serialize, today, utcnow_naive

users_bp = Blueprint("users", __name__)


@users_bp.route("/doctors", methods=["GET"])
@require_auth(roles=["admin", "doctor", "screener"])
def list_doctors():
    """List active doctors for patient assignment dropdowns."""
    doctors = list(db.users_col.find({"role": "doctor", "status": "active"}))
    return api_success([serialize(d) for d in doctors], message="Doctors retrieved")


@users_bp.route("/", methods=["GET"])
@require_auth(roles=["admin"])
def get_users():
    """List all staff users (admin only)."""
    users = list(db.users_col.find())
    return api_success([serialize(u) for u in users], message="Users retrieved")


@users_bp.route("/<user_id>", methods=["GET"])
@require_auth(roles=["admin"])
def get_user(user_id):
    """Get a single user by id (admin only)."""
    user = db.users_col.find_one({"id": user_id})
    if not user:
        return api_error("User not found", status=404)
    return api_success(serialize(user))


@users_bp.route("/", methods=["POST"])
@require_auth(roles=["admin"])
def create_user():
    """Create a staff user (admin only)."""
    data = request.get_json() or {}
    required = ["name", "email", "role"]
    for field in required:
        if not data.get(field):
            return api_error(f"{field} is required", status=400)

    email = data["email"].strip().lower()
    if db.users_col.find_one({"email": email}):
        return api_error("A user with this email already exists", status=409)

    now = utcnow_naive()
    new_user = {
        "id": gen_user_id(),
        "name": data.get("name"),
        "email": email,
        "phone": data.get("phone", ""),
        "role": data.get("role"),
        "department": data.get("department", ""),
        "status": data.get("status", "active"),
        "email_verified": True,
        "joined": today(),
        "created_at": now,
        "updated_at": now,
        "lastLogin": "Never",
    }
    if data.get("password"):
        new_user["password_hash"] = hash_password(data["password"])

    result = db.users_col.insert_one(new_user)
    new_user["_id"] = str(result.inserted_id)
    return api_success(serialize(new_user), message="User created", status=201)


@users_bp.route("/<user_id>", methods=["PUT"])
@require_auth(roles=["admin"])
def update_user(user_id):
    """Update a staff user (admin only)."""
    data = request.get_json() or {}
    data.pop("_id", None)
    data.pop("id", None)
    if "password" in data and data["password"]:
        data["password_hash"] = hash_password(data.pop("password"))
    elif "password" in data:
        data.pop("password", None)
    data["updated_at"] = utcnow_naive()

    result = db.users_col.update_one({"id": user_id}, {"$set": data})
    if result.matched_count == 0:
        return api_error("User not found", status=404)

    updated = db.users_col.find_one({"id": user_id})
    return api_success(serialize(updated), message="User updated")


@users_bp.route("/<user_id>/status", methods=["PATCH"])
@require_auth(roles=["admin"])
def toggle_user_status(user_id):
    """Toggle user between active and suspended (admin only)."""
    if user_id == "u1":
        return api_error("Cannot deactivate main admin", status=403)

    user = db.users_col.find_one({"id": user_id})
    if not user:
        return api_error("User not found", status=404)

    new_status = "suspended" if user.get("status") == "active" else "active"
    db.users_col.update_one({"id": user_id}, {"$set": {"status": new_status, "updated_at": utcnow_naive()}})
    return api_success({"status": new_status}, message="User status updated")


@users_bp.route("/<user_id>", methods=["DELETE"])
@require_auth(roles=["admin"])
def delete_user(user_id):
    """Delete a staff user (admin only)."""
    if user_id == "u1":
        return api_error("Cannot delete main admin", status=403)

    result = db.users_col.delete_one({"id": user_id})
    if result.deleted_count == 0:
        return api_error("User not found", status=404)
    return api_success(message="User deleted")
