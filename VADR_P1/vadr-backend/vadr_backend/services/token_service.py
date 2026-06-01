"""JWT access token issuance and verification."""

from datetime import datetime, timedelta, timezone

import jwt

from ..config import settings


def _utcnow():
    return datetime.now(timezone.utc)


def issue_access_token(user_doc: dict, session_id: str | None = None) -> tuple[str, int]:
    """Return (token, expires_in_seconds)."""
    now = _utcnow()
    expires = now + timedelta(minutes=settings.access_token_expires_min)
    payload = {
        "user_id": user_doc["id"],
        "role": user_doc.get("role", ""),
        "email": user_doc.get("email", ""),
        "status": user_doc.get("status", "active"),
        "type": "access",
        "iat": now,
        "exp": expires,
    }
    if session_id:
        payload["session_id"] = session_id
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
    return token, settings.access_token_expires_min * 60


def verify_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"], options={"require": ["exp", "iat", "user_id"]})
