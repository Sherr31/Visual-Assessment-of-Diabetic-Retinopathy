"""Audit log persistence for auth and admin events."""

from .. import db
from ..utils.common import serialize, utcnow_naive


def log_event(
    event_type: str,
    *,
    user_id: str | None = None,
    role: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """Write an audit log entry and return the serialized document."""
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
