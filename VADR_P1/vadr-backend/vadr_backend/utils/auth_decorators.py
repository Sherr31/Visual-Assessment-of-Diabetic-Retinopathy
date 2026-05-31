from functools import wraps

import jwt
from flask import g, request

from .. import db
from ..responses import api_error
from ..services.token_service import verify_access_token


def _authenticate():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, api_error("Unauthorized", "Missing or invalid Authorization header", "UNAUTHORIZED", 401)

    token = auth[7:].strip()
    try:
        payload = verify_access_token(token)
    except jwt.ExpiredSignatureError:
        return None, api_error("Token expired", "Access token has expired", "UNAUTHORIZED", 401)
    except jwt.InvalidTokenError:
        return None, api_error("Invalid token", "Access token is invalid", "UNAUTHORIZED", 401)

    user = db.users_col.find_one({"id": payload.get("user_id")})
    if not user:
        return None, api_error("User not found", "User account no longer exists", "UNAUTHORIZED", 401)

    status = user.get("status", "active")
    if status == "suspended":
        return None, api_error("Account suspended", "Your account has been suspended", "FORBIDDEN", 403)
    if status == "inactive":
        return None, api_error("Account is inactive", "Your account is inactive", "FORBIDDEN", 403)

    g.current_user = user
    g.token_payload = payload
    request.vadr_user = user
    return user, None


def require_auth(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        _, err = _authenticate()
        if err:
            return err
        return f(*args, **kwargs)

    return wrapped


def require_permission(permission_key: str):
    def decorator(f):
        @wraps(f)
        @require_auth
        def wrapped(*args, **kwargs):
            from ..services.rbac_service import user_has_permission

            user = request.vadr_user
            if not user_has_permission(user, permission_key):
                return api_error("Forbidden", f"Missing permission: {permission_key}", "FORBIDDEN", 403)
            return f(*args, **kwargs)

        return wrapped

    return decorator


def require_any_permission(*permission_keys: str):
    def decorator(f):
        @wraps(f)
        @require_auth
        def wrapped(*args, **kwargs):
            from ..services.rbac_service import user_has_permission

            user = request.vadr_user
            if not any(user_has_permission(user, k) for k in permission_keys):
                return api_error("Forbidden", "Insufficient permissions", "FORBIDDEN", 403)
            return f(*args, **kwargs)

        return wrapped

    return decorator
