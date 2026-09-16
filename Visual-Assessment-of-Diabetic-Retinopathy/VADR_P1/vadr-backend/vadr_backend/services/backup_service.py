import gzip
import hashlib
import uuid
from pathlib import Path

from bson import json_util

from .. import db
from ..utils.common import serialize, utcnow_naive

BACKUP_DIR = Path(__file__).resolve().parent.parent.parent / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# Important application data
BACKUP_COLLECTIONS = [
    "users",
    "patients",
    "medical_history",
    "audit_logs",
    "approval_requests",
    "rbac_settings",
]

def create_backup(user_id: str) -> dict:
    """Create a backup of the specified collections."""
    backup_id = str(uuid.uuid4())
    now = utcnow_naive()
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp_str}_{backup_id[:8]}.json.gz"
    filepath = BACKUP_DIR / filename

    backup_data = {}
    for col_name in BACKUP_COLLECTIONS:
        collection = db.db[col_name]
        docs = list(collection.find())
        backup_data[col_name] = docs

    # Serialize with json_util to handle ObjectIds and datetimes properly
    json_data = json_util.dumps(backup_data)
    json_bytes = json_data.encode("utf-8")

    with gzip.open(filepath, "wb") as f:
        f.write(json_bytes)

    file_size = filepath.stat().st_size
    checksum = hashlib.sha256(json_bytes).hexdigest()

    metadata = {
        "backup_id": backup_id,
        "filename": filename,
        "created_by": user_id,
        "created_at": now,
        "type": "manual",
        "status": "completed",
        "size_bytes": file_size,
        "collections_included": BACKUP_COLLECTIONS,
        "checksum_sha256": checksum,
    }

    db.system_backups_col.insert_one(metadata)

    return serialize(metadata)


def get_backups() -> list[dict]:
    """Retrieve all completed backups."""
    docs = list(db.system_backups_col.find().sort("created_at", -1))
    return [serialize(doc) for doc in docs]


def restore_backup(backup_id: str) -> dict:
    """Restore database from a specific backup ID."""
    metadata = db.system_backups_col.find_one({"backup_id": backup_id})
    if not metadata:
        raise ValueError("Backup not found.")

    filename = metadata["filename"]
    # Path traversal protection: ensure it's just a filename and exists in BACKUP_DIR
    if ".." in filename or "/" in filename or "\\" in filename:
        raise ValueError("Invalid backup filename.")

    filepath = BACKUP_DIR / filename
    if not filepath.exists():
        raise ValueError("Backup file is missing from disk.")

    with gzip.open(filepath, "rb") as f:
        json_bytes = f.read()

    checksum = hashlib.sha256(json_bytes).hexdigest()
    if checksum != metadata["checksum_sha256"]:
        raise ValueError("Backup checksum mismatch. File may be corrupted.")

    # Deserialize
    backup_data = json_util.loads(json_bytes.decode("utf-8"))

    # Restore only allowed collections
    collections_to_restore = metadata.get("collections_included", [])

    for col_name in collections_to_restore:
        if col_name not in BACKUP_COLLECTIONS:
            continue
        if col_name in backup_data:
            docs = backup_data[col_name]
            collection = db.db[col_name]
            collection.delete_many({})  # Clear existing
            if docs:
                collection.insert_many(docs)

    return {"status": "success", "restored_collections": collections_to_restore}
