from typing import Any, Optional
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection

client: Optional[MongoClient] = None
db: Any = None
patients_col: Collection[dict[str, Any]] = None  # type: ignore
users_col: Collection[dict[str, Any]] = None  # type: ignore
pending_reg_col: Collection[dict[str, Any]] = None  # type: ignore
medical_history_col: Collection[dict[str, Any]] = None  # type: ignore
verification_codes_col: Collection[dict[str, Any]] = None  # type: ignore
refresh_tokens_col: Collection[dict[str, Any]] = None  # type: ignore
sessions_col: Collection[dict[str, Any]] = None  # type: ignore
audit_logs_col: Collection[dict[str, Any]] = None  # type: ignore
approval_requests_col: Collection[dict[str, Any]] = None  # type: ignore
rbac_settings_col: Collection[dict[str, Any]] = None  # type: ignore


def init_db(mongo_uri: str) -> None:
    global client, db
    global patients_col, users_col, pending_reg_col, medical_history_col
    global verification_codes_col, refresh_tokens_col, sessions_col
    global audit_logs_col, approval_requests_col, rbac_settings_col

    if mongo_uri.startswith("mongodb+srv://"):
        try:
            import dns.resolver
            default_resolver = dns.resolver.get_default_resolver()
            for ns in ["8.8.8.8", "1.1.1.1", "8.8.4.4"]:
                if ns not in default_resolver.nameservers:
                    default_resolver.nameservers.append(ns)  # type: ignore
        except Exception:
            pass

    client = MongoClient(mongo_uri)
    db = client["vadr_db"]

    patients_col = db["patients"]
    users_col = db["users"]
    pending_reg_col = db["registration_pending"]
    medical_history_col = db["medical_history"]
    verification_codes_col = db["verification_codes"]
    refresh_tokens_col = db["refresh_tokens"]
    sessions_col = db["sessions"]
    audit_logs_col = db["audit_logs"]
    approval_requests_col = db["approval_requests"]
    rbac_settings_col = db["rbac_settings"]

    _ensure_indexes()


def _ensure_indexes() -> None:
    refresh_tokens_col.create_index([("token_hash", ASCENDING)])
    refresh_tokens_col.create_index([("user_id", ASCENDING), ("revoked", ASCENDING)])
    sessions_col.create_index([("user_id", ASCENDING), ("revoked", ASCENDING)])
    audit_logs_col.create_index([("timestamp", ASCENDING)])
    audit_logs_col.create_index([("user_id", ASCENDING), ("event_type", ASCENDING)])
    approval_requests_col.create_index([("user_id", ASCENDING)])
    verification_codes_col.create_index([("email", ASCENDING), ("type", ASCENDING), ("used", ASCENDING)])
