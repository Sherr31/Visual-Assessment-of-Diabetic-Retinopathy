"""Audit log persistence for auth, admin, and CRUD events."""

import json
from typing import Any

from flask import request

from .. import db
from ..utils.common import gen_audit_id, serialize, utcnow_naive


def log_event(
    event_type: str,
    *,
    user_id: str | None = None,
    role: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """Write an auth/admin audit log entry and return the serialized document."""
    doc = {
        "user_id": user_id,
        "role": role,
        "event_type": event_type,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "timestamp": utcnow_naive(),
        "metadata": metadata or {},
    }
    result = db.audit_logs_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return serialize(doc)


def query_logs(
    *,
    user_id: str | None = None,
    event_type: str | None = None,
    start_date=None,
    end_date=None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict], int]:
    query = {}
    if user_id:
        query["user_id"] = user_id
    if event_type:
        query["event_type"] = event_type
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            query["timestamp"]["$gte"] = start_date
        if end_date:
            query["timestamp"]["$lte"] = end_date

    total = db.audit_logs_col.count_documents(query)
    skip = max(page - 1, 0) * per_page
    logs = list(
        db.audit_logs_col.find(query).sort("timestamp", -1).skip(skip).limit(per_page)
    )
    return [serialize(log) for log in logs], total


def _client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or ""


def _safe_jsonable(value: Any, max_len: int = 8000) -> Any:
    if value is None:
        return None
    try:
        text = json.dumps(value, default=str)
        if len(text) > max_len:
            return {"_truncated": True, "preview": text[:max_len]}
        return value
    except (TypeError, ValueError):
        return str(value)[:max_len]


def log_audit(
    *,
    actor_id: str = "",
    actor_email: str = "",
    action: str,
    resource_type: str,
    resource_id: str = "",
    table_name: str = "",
    old_value: Any = None,
    new_value: Any = None,
    metadata: dict | None = None,
):
    entry = {
        "id": gen_audit_id(),
        "timestamp": utcnow_naive().isoformat(timespec="seconds"),
        "actor_id": actor_id,
        "actor_email": actor_email,
        "action": action.upper(),
        "resource_type": resource_type,
        "resource_id": resource_id,
        "table_name": table_name or resource_type,
        "old_value": _safe_jsonable(old_value),
        "new_value": _safe_jsonable(new_value),
        "ip_address": _client_ip(),
        "metadata": metadata or {},
    }
    db.audit_logs_col.insert_one(entry)
    return entry


def log_audit_from_request(
    user: dict | None,
    action: str,
    resource_type: str,
    resource_id: str = "",
    table_name: str = "",
    old_value: Any = None,
    new_value: Any = None,
    metadata: dict | None = None,
):
    actor_id = (user or {}).get("id", "system")
    actor_email = (user or {}).get("email", "")
    return log_audit(
        actor_id=actor_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        table_name=table_name,
        old_value=old_value,
        new_value=new_value,
        metadata=metadata,
    )


def query_audit_logs(
    *,
    search: str = "",
    action: str = "",
    resource_type: str = "",
    actor_id: str = "",
    limit: int = 200,
    skip: int = 0,
):
    query: dict = {}
    if action:
        query["action"] = action.upper()
    if resource_type:
        query["resource_type"] = resource_type
    if actor_id:
        query["actor_id"] = actor_id
    if search:
        query["$or"] = [
            {"actor_email": {"$regex": search, "$options": "i"}},
            {"resource_id": {"$regex": search, "$options": "i"}},
            {"table_name": {"$regex": search, "$options": "i"}},
        ]

    total = db.audit_logs_col.count_documents(query)
    cursor = (
        db.audit_logs_col.find(query)
        .sort("timestamp", -1)
        .skip(skip)
        .limit(min(limit, 500))
    )
    return total, [serialize(d) for d in cursor]
