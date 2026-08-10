from pymongo import ASCENDING, MongoClient

client = None
db = None
patients_col = None
users_col = None
pending_reg_col = None
medical_history_col = None
verification_codes_col = None
refresh_tokens_col = None
sessions_col = None
audit_logs_col = None
approval_requests_col = None
rbac_settings_col = None


def init_db(mongo_uri: str) -> None:
    global client, db
    global patients_col, users_col, pending_reg_col, medical_history_col
    global verification_codes_col, refresh_tokens_col, sessions_col
    global audit_logs_col, approval_requests_col, rbac_settings_col

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
