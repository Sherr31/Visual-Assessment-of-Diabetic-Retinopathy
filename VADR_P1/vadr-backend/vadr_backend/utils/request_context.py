import hashlib

from flask import request


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def user_agent() -> str:
    return request.headers.get("User-Agent", "")


def device_fingerprint() -> str:
    return hashlib.sha256(user_agent().encode("utf-8")).hexdigest()[:32]
