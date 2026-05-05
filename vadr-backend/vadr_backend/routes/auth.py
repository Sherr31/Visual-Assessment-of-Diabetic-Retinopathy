from datetime import timedelta

from flask import Blueprint, jsonify, request
from itsdangerous import BadSignature, SignatureExpired
from werkzeug.security import check_password_hash, generate_password_hash

from .. import db
from ..config import settings
from ..services.auth_service import issue_token, verify_token
from ..services.mail_service import send_registration_verification_email
from ..utils.common import gen_user_id, gen_registration_code, serialize, today, utcnow_naive

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def auth_register():
    data = request.get_json() or {}
    required = ["name", "email", "password", "role"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    email = data["email"].strip().lower()
    role = data["role"]
    if role not in ("admin", "doctor", "technician"):
        return jsonify({"error": "role must be admin, doctor, or technician"}), 400

    if db.users_col.find_one({"email": email}):
        return jsonify({"error": "A user with this email already exists"}), 409

    db.pending_reg_col.delete_many({"email": email})
    db.pending_reg_col.delete_many({"expires_at": {"$lt": utcnow_naive()}})

    code = gen_registration_code()
    code_hash = generate_password_hash(code)
    expires_at = utcnow_naive() + timedelta(minutes=settings.reg_code_expires_min)
    now = utcnow_naive()

    payload = {
        "name": (data.get("name") or "").strip(),
        "password_hash": generate_password_hash(data["password"]),
        "role": role,
        "department": (data.get("department") or "").strip(),
        "phone": (data.get("phone") or "").strip(),
        "status": data.get("status", "active"),
    }

    db.pending_reg_col.insert_one(
        {
            "email": email,
            "code_hash": code_hash,
            "expires_at": expires_at,
            "last_sent_at": now,
            "verify_failures": 0,
            "payload": payload,
        }
    )

    ok, err = send_registration_verification_email(email, code, payload["name"])
    resp = {
        "verificationRequired": True,
        "email": email,
        "emailSent": ok,
        "expiresInMinutes": settings.reg_code_expires_min,
        "message": "We emailed a 6-digit verification code to your address."
        if ok
        else "We could not send email. Check SMTP settings or server logs (VADR_LOG_EMAIL_CODE=1 for dev).",
    }
    if err and not ok:
        resp["emailError"] = err
    return jsonify(resp), 200


@auth_bp.route("/verify-registration", methods=["POST"])
def auth_verify_registration():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip().replace(" ", "")
    if not email or not code:
        return jsonify({"error": "email and code are required"}), 400
    if not code.isdigit() or len(code) != 6:
        return jsonify({"error": "code must be a 6-digit number"}), 400

    doc = db.pending_reg_col.find_one({"email": email})
    if not doc:
        return jsonify({"error": "No pending registration for this email. Register again."}), 404

    if doc["expires_at"] < utcnow_naive():
        db.pending_reg_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "Verification code expired. Register again."}), 410

    fails = doc.get("verify_failures") or 0
    if fails >= settings.reg_max_verify_fails:
        db.pending_reg_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "Too many failed attempts. Please register again."}), 429

    if not check_password_hash(doc["code_hash"], code):
        db.pending_reg_col.update_one({"_id": doc["_id"]}, {"$inc": {"verify_failures": 1}})
        return jsonify({"error": "Invalid verification code"}), 400

    payload = doc["payload"]
    if db.users_col.find_one({"email": email}):
        db.pending_reg_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "A user with this email already exists"}), 409

    new_user = {
        "id": gen_user_id(),
        "name": payload["name"],
        "email": email,
        "password_hash": payload["password_hash"],
        "phone": payload.get("phone", ""),
        "role": payload["role"],
        "department": payload.get("department", ""),
        "status": payload.get("status", "active"),
        "joined": today(),
        "lastLogin": "Never",
        "email_verified": True,
    }
    result = db.users_col.insert_one(new_user)
    db.pending_reg_col.delete_one({"_id": doc["_id"]})
    new_user["_id"] = str(result.inserted_id)
    token = issue_token(new_user)
    return jsonify({"token": token, "user": serialize(new_user)}), 201


@auth_bp.route("/resend-registration-code", methods=["POST"])
def auth_resend_registration_code():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email is required"}), 400

    doc = db.pending_reg_col.find_one({"email": email})
    if not doc:
        return jsonify({"error": "No pending registration for this email."}), 404

    if doc["expires_at"] < utcnow_naive():
        db.pending_reg_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "Registration expired. Please register again."}), 410

    last = doc.get("last_sent_at") or utcnow_naive()
    if (utcnow_naive() - last).total_seconds() < settings.reg_resend_cooldown_sec:
        wait = int(settings.reg_resend_cooldown_sec - (utcnow_naive() - last).total_seconds())
        return jsonify({"error": f"Please wait {wait} seconds before resending."}), 429

    code = gen_registration_code()
    code_hash = generate_password_hash(code)
    expires_at = utcnow_naive() + timedelta(minutes=settings.reg_code_expires_min)
    db.pending_reg_col.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "code_hash": code_hash,
                "expires_at": expires_at,
                "last_sent_at": utcnow_naive(),
                "verify_failures": 0,
            }
        },
    )

    ok, err = send_registration_verification_email(email, code, doc["payload"].get("name", ""))
    return jsonify(
        {
            "emailSent": ok,
            "message": "A new code has been sent." if ok else "Could not send email.",
            **({"emailError": err} if err and not ok else {}),
        }
    ), 200


@auth_bp.route("/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = db.users_col.find_one({"email": email})
    if not user or not user.get("password_hash"):
        return jsonify({"error": "Invalid email or password"}), 401
    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401
    if user.get("status") == "inactive":
        return jsonify({"error": "Account is inactive"}), 403

    db.users_col.update_one({"id": user["id"]}, {"$set": {"lastLogin": today()}})
    user = db.users_col.find_one({"id": user["id"]})
    token = issue_token(user)
    return jsonify({"token": token, "user": serialize(user)}), 200


@auth_bp.route("/me", methods=["GET"])
def auth_me():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    raw = auth[7:].strip()
    try:
        payload = verify_token(raw)
    except SignatureExpired:
        return jsonify({"error": "Token expired"}), 401
    except BadSignature:
        return jsonify({"error": "Invalid token"}), 401

    user = db.users_col.find_one({"id": payload.get("id")})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(serialize(user)), 200
