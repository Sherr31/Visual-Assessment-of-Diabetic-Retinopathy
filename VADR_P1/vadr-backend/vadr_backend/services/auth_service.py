"""Refresh tokens, sessions, and legacy demo password migration."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from werkzeug.security import generate_password_hash

from ..config import settings
from .. import db
from ..utils.common import gen_session_id, hash_password, utcnow_naive


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def migrate_demo_password_hashes() -> None:
    """Give legacy seeded demo accounts a login password (dev / first-run)."""
    ph = hash_password(settings.demo_password)
    for email in settings.demo_staff_emails:
        db.users_col.update_one(
            {"email": email, "password_hash": {"$exists": False}},
            {"$set": {"password_hash": ph, "status": "active", "email_verified": True}},
        )
    db.users_col.update_many(
        {"role": "technician"},
        {"$set": {"role": "screener"}},
    )
    db.users_col.update_many(
        {"status": "inactive"},
        {"$set": {"status": "suspended"}},
    )


def create_session(user_id: str, ip_address: str, device_fp: str) -> dict:
    """Create an active session record and return the session document."""
    now = utcnow_naive()
    session = {
        "session_id": gen_session_id(),
        "user_id": user_id,
        "device_fingerprint": device_fp,
        "ip": ip_address,
        "user_agent": None,
        "created_at": now,
        "last_seen": now,
        "revoked": False,
    }
    db.sessions_col.insert_one(session)
    return session


def create_refresh_token(user_id: str, session_id: str, device_fp: str) -> tuple[str, datetime]:
    """Persist hashed refresh token; return raw token and expiry."""
    raw = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw)
    expires_at = utcnow_naive() + timedelta(days=settings.refresh_token_expires_days)
    db.refresh_tokens_col.insert_one(
        {
            "token_hash": token_hash,
            "user_id": user_id,
            "session_id": session_id,
            "device_fingerprint": device_fp,
            "expires_at": expires_at,
            "revoked": False,
            "created_at": utcnow_naive(),
        }
    )
    return raw, expires_at


def validate_refresh_token(raw_token: str) -> dict | None:
    doc = db.refresh_tokens_col.find_one({"token_hash": _hash_token(raw_token), "revoked": False})
    if not doc:
        return None
    if doc["expires_at"] < utcnow_naive():
        revoke_refresh_token(raw_token)
        return None
    return doc


def revoke_refresh_token(raw_token: str) -> None:
    db.refresh_tokens_col.update_one(
        {"token_hash": _hash_token(raw_token)},
        {"$set": {"revoked": True, "revoked_at": utcnow_naive()}},
    )


def revoke_refresh_token_by_hash(token_hash: str) -> None:
    db.refresh_tokens_col.update_one(
        {"token_hash": token_hash},
        {"$set": {"revoked": True, "revoked_at": utcnow_naive()}},
    )


def revoke_all_user_tokens(user_id: str) -> int:
    result = db.refresh_tokens_col.update_many(
        {"user_id": user_id, "revoked": False},
        {"$set": {"revoked": True, "revoked_at": utcnow_naive()}},
    )
    db.sessions_col.update_many(
        {"user_id": user_id, "revoked": False},
        {"$set": {"revoked": True, "revoked_at": utcnow_naive()}},
    )
    return result.modified_count


def revoke_session(session_id: str, user_id: str | None = None) -> bool:
    query = {"session_id": session_id, "revoked": False}
    if user_id:
        query["user_id"] = user_id
    session = db.sessions_col.find_one(query)
    if not session:
        return False
    db.sessions_col.update_one({"session_id": session_id}, {"$set": {"revoked": True, "revoked_at": utcnow_naive()}})
    db.refresh_tokens_col.update_many(
        {"session_id": session_id, "revoked": False},
        {"$set": {"revoked": True, "revoked_at": utcnow_naive()}},
    )
    return True


def list_user_sessions(user_id: str) -> list[dict]:
    return list(
        db.sessions_col.find({"user_id": user_id, "revoked": False}).sort("last_seen", -1)
    )


def touch_session(session_id: str) -> None:
    db.sessions_col.update_one({"session_id": session_id}, {"$set": {"last_seen": utcnow_naive()}})


def set_refresh_cookie(response, raw_token: str, expires_at: datetime) -> None:
    response.set_cookie(
        settings.refresh_cookie_name,
        raw_token,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        expires=expires_at,
        path="/api/auth",
    )


def clear_refresh_cookie(response) -> None:
    response.delete_cookie(settings.refresh_cookie_name, path="/api/auth")
