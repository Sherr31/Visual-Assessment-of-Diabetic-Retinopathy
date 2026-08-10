"""Consistent JSON response helpers for all API endpoints."""

from flask import jsonify


def api_success(data=None, message=None, status=200, **extra):
    """Return a success payload: {data, error, message}."""
    body = {"data": data, "error": None, "message": message}
    body.update(extra)
    return jsonify(body), status


def api_error(error, message=None, code=None, status=400, **extra):
    """Return an error payload: {data, error, message, code?}."""
    body = {"data": None, "error": error, "message": message or error}
    if code:
        body["code"] = code
    body.update(extra)
    response = jsonify(body)
    if status == 429 and "retry_after" in extra:
        response.headers["Retry-After"] = str(extra["retry_after"])
    return response, status
