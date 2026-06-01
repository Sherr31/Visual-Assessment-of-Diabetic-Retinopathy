from flask import Blueprint

from .. import db
from ..config import settings
from ..responses import api_success
from ..utils.common import hash_password, utcnow_naive

system_bp = Blueprint("system", __name__)


@system_bp.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return api_success({"status": "VADR Backend Running", "db": "connected"}, message="OK")


@system_bp.route("/seed", methods=["GET", "POST"])
def seed():
    """Seed demo users if the database is empty."""
    if db.users_col.count_documents({}) > 0:
        return api_success(message="Already seeded")

    ph = hash_password(settings.demo_password)
    now = utcnow_naive()
    seed_users = [
        {
            "id": "u1",
            "role": "admin",
            "name": "Dr. Admin Khan",
            "email": "admin@vadr.pk",
            "password_hash": ph,
            "phone": "0300-1234567",
            "status": "active",
            "email_verified": True,
            "joined": "2025-01-10",
            "created_at": now,
            "updated_at": now,
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
            "email_verified": True,
            "joined": "2025-03-15",
            "created_at": now,
            "updated_at": now,
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
            "status": "pending_approval",
            "email_verified": True,
            "joined": "2025-06-01",
            "created_at": now,
            "updated_at": now,
            "department": "Ophthalmology",
            "lastLogin": "2026-03-10",
        },
        {
            "id": "u4",
            "role": "screener",
            "name": "Sara Malik",
            "email": "sara@vadr.pk",
            "password_hash": ph,
            "phone": "0333-1122334",
            "status": "active",
            "email_verified": True,
            "joined": "2025-07-20",
            "created_at": now,
            "updated_at": now,
            "department": "Imaging",
            "lastLogin": "2026-04-24",
        },
    ]
    db.users_col.insert_many(seed_users)
    db.approval_requests_col.insert_one(
        {
            "user_id": "u3",
            "email": "bilal@vadr.pk",
            "name": "Dr. Bilal Raza",
            "status": "pending",
            "requested_at": now,
            "reviewed_by": None,
            "reviewed_at": None,
            "reason": None,
        }
    )
    return api_success({"demo_password": settings.demo_password}, message="Seeded successfully", status=201)
