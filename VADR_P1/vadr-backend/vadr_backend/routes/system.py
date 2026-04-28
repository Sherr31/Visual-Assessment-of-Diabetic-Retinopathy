from flask import Blueprint, jsonify
from werkzeug.security import generate_password_hash

from .. import db
from ..config import settings

system_bp = Blueprint("system", __name__)


@system_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "VADR Backend Running", "db": "connected"}), 200


@system_bp.route("/seed", methods=["GET", "POST"])
def seed():
    if db.users_col.count_documents({}) > 0:
        return jsonify({"message": "Already seeded"}), 200

    ph = generate_password_hash(settings.demo_password)
    seed_users = [
        {
            "id": "u1",
            "role": "admin",
            "name": "Dr. Admin Khan",
            "email": "admin@vadr.pk",
            "password_hash": ph,
            "phone": "0300-1234567",
            "status": "active",
            "joined": "2025-01-10",
            "department": "Administration",
            "lastLogin": "2026-04-22",
        },
        {
            "id": "u2",
            "role": "doctor",
            "name": "Dr. Ayesha Noor",
            "email": "ayesha@vadr.pk",
            "password_hash": ph,
            "phone": "0301-9876543",
            "status": "active",
            "joined": "2025-03-15",
            "department": "Ophthalmology",
            "lastLogin": "2026-04-23",
        },
        {
            "id": "u3",
            "role": "doctor",
            "name": "Dr. Bilal Raza",
            "email": "bilal@vadr.pk",
            "password_hash": ph,
            "phone": "0312-5556677",
            "status": "inactive",
            "joined": "2025-06-01",
            "department": "Ophthalmology",
            "lastLogin": "2026-03-10",
        },
        {
            "id": "u4",
            "role": "technician",
            "name": "Sara Malik",
            "email": "sara@vadr.pk",
            "password_hash": ph,
            "phone": "0333-1122334",
            "status": "active",
            "joined": "2025-07-20",
            "department": "Imaging",
            "lastLogin": "2026-04-24",
        },
    ]
    db.users_col.insert_many(seed_users)
    return jsonify({"message": "Seeded successfully", "demo_password": settings.demo_password}), 201
