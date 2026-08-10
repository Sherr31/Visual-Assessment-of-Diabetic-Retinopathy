"""Route protection decorators for RBAC."""

from functools import wraps

import jwt
from flask import g, request

from .config import settings
from . import db
from .responses import api_error
from .services.token_service import verify_access_token


def require_auth(roles=None, allow_pending=False, allow_unverified=False):
    """
    Validate JWT access token, enforce role and account status checks.

    Sets g.current_user and g.token_payload for downstream handlers.
    """

    allowed_roles = set(roles) if roles else None

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                return api_error("Unauthorized", "Missing or invalid Authorization header", "UNAUTHORIZED", 401)

            token = auth[7:].strip()
            try:
                payload = verify_access_token(token)
            except jwt.ExpiredSignatureError:
                return api_error("Token expired", "Access token has expired", "UNAUTHORIZED", 401)
            except jwt.InvalidTokenError:
                return api_error("Invalid token", "Access token is invalid", "UNAUTHORIZED", 401)

            user = db.users_col.find_one({"id": payload.get("user_id")})
            if not user:
                return api_error("User not found", "User account no longer exists", "UNAUTHORIZED", 401)

            status = user.get("status", "active")
            if status == "suspended":
                return api_error("Account suspended", "Your account has been suspended", "FORBIDDEN", 403)
            if status == "unverified" and not allow_unverified:
                return api_error("Email not verified", "Please verify your email before continuing", "FORBIDDEN", 403)
            if status == "pending_approval" and not allow_pending:
                return api_error(
                    "account pending approval",
                    "Your doctor account is pending admin approval",
                    "PENDING_APPROVAL",
                    403,
                )

            role = user.get("role")
            if allowed_roles is not None and role not in allowed_roles:
                return api_error("Forbidden", "You do not have permission for this action", "FORBIDDEN", 403)

            g.current_user = user
            g.token_payload = payload
            return fn(*args, **kwargs)

        return wrapper

    return decorator
