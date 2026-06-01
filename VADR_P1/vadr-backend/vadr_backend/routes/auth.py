"""Authentication routes: register, verify, login, refresh, logout, sessions."""

from datetime import timedelta

from flask import Blueprint, g, request

auth_bp = Blueprint("auth", __name__)

from .. import db
from ..config import PUBLIC_REGISTRATION_ROLES, settings
from ..decorators import require_auth
from ..responses import api_error, api_success
from ..services.audit_service import log_event
from ..services.auth_service import (
    clear_refresh_cookie,
    create_refresh_token,
    create_session,
    list_user_sessions,
    revoke_refresh_token,
    revoke_session,
    set_refresh_cookie,
    touch_session,
    validate_refresh_token,
)
from ..services.mail_service import send_registration_verification_email
from ..services.token_service import issue_access_token
from ..utils.common import gen_registration_code, gen_user_id, hash_password, serialize, today, utcnow_naive, verify_password
from ..utils.request_context import client_ip, device_fingerprint, user_agent


def _registration_status_for_role(role: str) -> str:
    if role == "doctor":
        return "pending_approval"
    return "active"


def _auth_payload(user: dict, access_token: str, expires_in: int) -> dict:
    serialized = serialize(user)
    return {
        "access_token": access_token,
        "token": access_token,
        "expires_in": expires_in,
        "role": user.get("role"),
        "status": user.get("status"),
        "user": serialized,
    }


def _finalize_registration(email: str, pl: dict):
    """Create user account and issue auth tokens (used after OTP verify or when verification is skipped)."""
    role = pl["role"]
    status = _registration_status_for_role(role)
    now = utcnow_naive()

    new_user = {
        "id": gen_user_id(),
        "name": pl["name"],
        "email": email,
        "password_hash": pl["password_hash"],
        "phone": pl.get("phone", ""),
        "role": role,
        "department": pl.get("department", ""),
        "status": status,
        "email_verified": True,
        "joined": today(),
        "created_at": now,
        "updated_at": now,
        "lastLogin": "Never",
        "approval": {},
    }

    db.users_col.insert_one(new_user)
    db.verification_codes_col.delete_many({"email": email, "type": "registration"})
    db.pending_reg_col.delete_many({"email": email})

    if role == "doctor":
        db.approval_requests_col.insert_one(
            {
                "user_id": new_user["id"],
                "email": email,
                "name": new_user["name"],
                "status": "pending",
                "requested_at": now,
                "reviewed_by": None,
                "reviewed_at": None,
                "reason": None,
            }
        )

    user = db.users_col.find_one({"id": new_user["id"]})
    session = create_session(user["id"], client_ip(), device_fingerprint())
    access_token, expires_in = issue_access_token(user, session["session_id"])
    raw_refresh, refresh_exp = create_refresh_token(user["id"], session["session_id"], device_fingerprint())

    log_event(
        "register",
        user_id=user["id"],
        role=user.get("role"),
        ip_address=client_ip(),
        user_agent=user_agent(),
        metadata={"verified": True},
    )

    response, status = api_success(
        _auth_payload(user, access_token, expires_in),
        message="Registration completed successfully",
        status=201,
    )
    set_refresh_cookie(response, raw_refresh, refresh_exp)
    return response, status

SKIP_EMAIL_VERIFICATION = False


@auth_bp.route("/register", methods=["POST"])
def auth_register():
    """Start registration: validate input, store pending record, email 6-digit OTP."""
    data = request.get_json() or {}
    required = ["name", "email", "password", "role"]
    for field in required:
        if not data.get(field):
            return api_error(f"{field} is required", status=400)

    email = data["email"].strip().lower()
    role = data["role"]
    if role not in PUBLIC_REGISTRATION_ROLES:
        return api_error(
            "Invalid role for self-registration",
            "Role must be doctor, screener, or patient",
            status=400,
        )

    existing = db.users_col.find_one({"email": email})
    if existing:
        if existing.get("status") == "suspended":
            return api_error("Registration blocked", "This email cannot register", status=403)
        rejected = db.approval_requests_col.find_one({"email": email, "status": "rejected"})
        if rejected and rejected.get("reapply_after") and rejected["reapply_after"] > utcnow_naive():
            return api_error(
                "Registration blocked",
                "You may re-apply after the rejection cooling period",
                status=403,
            )
        return api_error("A user with this email already exists", status=409)

    payload = {
        "name": (data.get("name") or "").strip(),
        "password_hash": hash_password(data["password"]),
        "role": role,
        "department": (data.get("department") or "").strip(),
        "phone": (data.get("phone") or "").strip(),
    }

    # --- TESTING: skip email OTP — remove this block and uncomment OTP section below to re-enable ---
    if SKIP_EMAIL_VERIFICATION:
        log_event(
            "register",
            ip_address=client_ip(),
            user_agent=user_agent(),
            metadata={"email": email, "role": role, "verification_skipped": True},
        )
        return _finalize_registration(email, payload)

    # --- PRODUCTION: email OTP verification (commented out for testing) ---
    db.verification_codes_col.delete_many({"email": email, "type": "registration", "used": False})
    db.pending_reg_col.delete_many({"email": email})

    code = gen_registration_code()
    code_hash = hash_password(code)
    expires_at = utcnow_naive() + timedelta(minutes=settings.reg_code_expires_min)
    now = utcnow_naive()

    db.verification_codes_col.insert_one(
        {
            "email": email,
            "user_id": None,
            "code_hash": code_hash,
            "type": "registration",
            "expires_at": expires_at,
            "used": False,
            "verify_failures": 0,
            "resend_timestamps": [now],
            "payload": payload,
            "created_at": now,
        }
    )

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
    log_event(
        "register",
        ip_address=client_ip(),
        user_agent=user_agent(),
        metadata={"email": email, "role": role, "email_sent": ok},
    )

    return api_success(
        {
            "verificationRequired": True,
            "email": email,
            "emailSent": ok,
            "expiresInMinutes": settings.reg_code_expires_min,
            **({"emailError": err} if err and not ok else {}),
        },
        message="We emailed a 6-digit verification code to your address."
        if ok
        else "Registration started. Check SMTP settings or server logs (VADR_LOG_EMAIL_CODE=1).",
    )


@auth_bp.route("/verify-registration", methods=["POST"])
def auth_verify_registration():
    """Complete registration with email + 6-digit OTP; returns tokens on success."""
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip().replace(" ", "")
    if not email or not code:
        return api_error("email and code are required", status=400)
    if not code.isdigit() or len(code) != 6:
        return api_error("code must be a 6-digit number", status=400)

    doc = db.verification_codes_col.find_one({"email": email, "type": "registration", "used": False})
    if not doc:
        return api_error("No pending registration for this email. Register again.", status=404)

    if doc["expires_at"] < utcnow_naive():
        db.verification_codes_col.delete_one({"_id": doc["_id"]})
        return api_error("Verification code expired. Register again.", status=410)

    fails = doc.get("verify_failures") or 0
    if fails >= settings.reg_max_verify_fails:
        db.verification_codes_col.delete_one({"_id": doc["_id"]})
        return api_error("Too many failed attempts. Please register again.", status=429)

    if not verify_password(doc["code_hash"], code):
        db.verification_codes_col.update_one({"_id": doc["_id"]}, {"$inc": {"verify_failures": 1}})
        return api_error("Invalid verification code", status=400)

    if db.users_col.find_one({"email": email}):
        db.verification_codes_col.delete_one({"_id": doc["_id"]})
        return api_error("A user with this email already exists", status=409)

    db.verification_codes_col.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    return _finalize_registration(email, doc["payload"])


@auth_bp.route("/resend-registration-code", methods=["POST"])
def auth_resend_registration_code():
    """Resend verification code if still within pending window (rate limited per email)."""
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return api_error("email is required", status=400)

    doc = db.verification_codes_col.find_one({"email": email, "type": "registration", "used": False})
    if not doc:
        return api_error("No pending registration for this email.", status=404)

    if doc["expires_at"] < utcnow_naive():
        db.verification_codes_col.delete_one({"_id": doc["_id"]})
        return api_error("Registration expired. Please register again.", status=410)

    code = gen_registration_code()
    code_hash = hash_password(code)
    expires_at = utcnow_naive() + timedelta(minutes=settings.reg_code_expires_min)
    now = utcnow_naive()
    sends = doc.get("resend_timestamps") or []
    sends.append(now)

    db.verification_codes_col.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "code_hash": code_hash,
                "expires_at": expires_at,
                "verify_failures": 0,
                "resend_timestamps": sends,
            }
        },
    )
    db.pending_reg_col.update_one(
        {"email": email},
        {"$set": {"code_hash": code_hash, "expires_at": expires_at, "last_sent_at": now, "verify_failures": 0}},
        upsert=True,
    )

    ok, err = send_registration_verification_email(email, code, doc["payload"].get("name", ""))
    return api_success(
        {"emailSent": ok, **({"emailError": err} if err and not ok else {})},
        message="A new code has been sent." if ok else "Could not send email.",
    )


@auth_bp.route("/login", methods=["POST"])
def auth_login():
    """Authenticate user; return access token in body and refresh token in httpOnly cookie."""
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return api_error("email and password are required", status=400)

    user = db.users_col.find_one({"email": email})
    if not user or not user.get("password_hash"):
        log_event("failed_login", ip_address=client_ip(), user_agent=user_agent(), metadata={"email": email})
        return api_error("Invalid email or password", code="UNAUTHORIZED", status=401)

    if not verify_password(user["password_hash"], password):
        log_event(
            "failed_login",
            user_id=user.get("id"),
            role=user.get("role"),
            ip_address=client_ip(),
            user_agent=user_agent(),
        )
        return api_error("Invalid email or password", code="UNAUTHORIZED", status=401)

    if user.get("status") == "unverified":
        return api_error("Email not verified", "Please complete email verification", code="FORBIDDEN", status=403)
    if user.get("status") == "suspended":
        return api_error("Account suspended", code="FORBIDDEN", status=403)

    db.users_col.update_one({"id": user["id"]}, {"$set": {"lastLogin": today(), "updated_at": utcnow_naive()}})
    user = db.users_col.find_one({"id": user["id"]})

    session = create_session(user["id"], client_ip(), device_fingerprint())
    request._current_session_id = session["session_id"]
    access_token, expires_in = issue_access_token(user, session["session_id"])
    raw_refresh, refresh_exp = create_refresh_token(user["id"], session["session_id"], device_fingerprint())

    log_event(
        "login",
        user_id=user["id"],
        role=user.get("role"),
        ip_address=client_ip(),
        user_agent=user_agent(),
        metadata={"session_id": session["session_id"]},
    )

    response, status = api_success(
        _auth_payload(user, access_token, expires_in),
        message="Login successful",
    )
    set_refresh_cookie(response, raw_refresh, refresh_exp)
    return response, status


@auth_bp.route("/refresh", methods=["POST"])
def auth_refresh():
    """Exchange a valid refresh token cookie for a new access token."""
    raw_refresh = request.cookies.get(settings.refresh_cookie_name)
    if not raw_refresh:
        return api_error("Refresh token missing", code="UNAUTHORIZED", status=401)

    doc = validate_refresh_token(raw_refresh)
    if not doc:
        response, status = api_error("Invalid or expired refresh token", code="UNAUTHORIZED", status=401)
        clear_refresh_cookie(response)
        return response, status

    user = db.users_col.find_one({"id": doc["user_id"]})
    if not user:
        revoke_refresh_token(raw_refresh)
        return api_error("User not found", code="UNAUTHORIZED", status=401)

    if user.get("status") == "suspended":
        revoke_refresh_token(raw_refresh)
        return api_error("Account suspended", code="FORBIDDEN", status=403)

    session_id = doc.get("session_id")
    if session_id:
        touch_session(session_id)

    access_token, expires_in = issue_access_token(user, session_id)
    response, status = api_success(
        {
            "access_token": access_token,
            "token": access_token,
            "expires_in": expires_in,
            "role": user.get("role"),
            "status": user.get("status"),
        },
        message="Token refreshed",
    )
    return response, status


@auth_bp.route("/logout", methods=["POST"])
def auth_logout():
    """Invalidate refresh token and clear cookie."""
    raw_refresh = request.cookies.get(settings.refresh_cookie_name)
    user_id = None
    if raw_refresh:
        doc = validate_refresh_token(raw_refresh)
        if doc:
            user_id = doc.get("user_id")
            if doc.get("session_id"):
                revoke_session(doc["session_id"], user_id)
        revoke_refresh_token(raw_refresh)

    log_event("logout", user_id=user_id, ip_address=client_ip(), user_agent=user_agent())
    response, status = api_success(message="Logged out successfully")
    clear_refresh_cookie(response)
    return response, status


@auth_bp.route("/me", methods=["GET"])
@require_auth(allow_pending=True)
def auth_me():
    """Return the current authenticated user's profile."""
    return api_success(serialize(g.current_user))


@auth_bp.route("/sessions", methods=["GET"])
@require_auth(allow_pending=True)
def auth_list_sessions():
    """List all active sessions for the current user."""
    sessions = list_user_sessions(g.current_user["id"])
    current_session_id = getattr(g, "token_payload", {}).get("session_id")
    data = []
    for session in sessions:
        data.append(
            {
                "session_id": session.get("session_id"),
                "ip": session.get("ip"),
                "device_fingerprint": session.get("device_fingerprint"),
                "created_at": session.get("created_at"),
                "last_seen": session.get("last_seen"),
                "current": session.get("session_id") == current_session_id,
            }
        )
    return api_success(data, message="Active sessions")


@auth_bp.route("/sessions/<session_id>", methods=["DELETE"])
@require_auth(allow_pending=True)
def auth_revoke_session(session_id):
    """Revoke a specific session belonging to the current user."""
    ok = revoke_session(session_id, g.current_user["id"])
    if not ok:
        return api_error("Session not found", status=404)
    log_event(
        "logout",
        user_id=g.current_user["id"],
        role=g.current_user.get("role"),
        ip_address=client_ip(),
        user_agent=user_agent(),
        metadata={"session_id": session_id, "self_revoke": True},
    )
    return api_success(message="Session revoked")
