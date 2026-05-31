"""Database backup and restore — JSON dumps compressed with gzip."""

import gzip
import json
import os
from pathlib import Path

from .. import db
from ..config import settings
from ..utils.common import gen_backup_id, utcnow_naive


COLLECTION_KEYS = [
    ("patients", "patients_col"),
    ("users", "users_col"),
    ("medical_history", "medical_history_col"),
    ("roles", "roles_col"),
    ("model_versions", "model_versions_col"),
    ("audit_logs", "audit_logs_col"),
]


def _backup_dir() -> Path:
    path = Path(settings.backup_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _col_by_name(name: str):
    return getattr(db, f"{name}_col", None)


def create_backup(*, include_audit: bool = True) -> dict:
    backup_id = gen_backup_id()
    timestamp = utcnow_naive().isoformat(timespec="seconds")
    filename = f"{backup_id}.json.gz"
    filepath = _backup_dir() / filename

    payload = {"version": 1, "created_at": timestamp, "collections": {}}
    collections_to_dump = list(COLLECTION_KEYS)
    if not include_audit:
        collections_to_dump = [c for c in collections_to_dump if c[0] != "audit_logs"]

    for coll_name, attr in collections_to_dump:
        col = getattr(db, attr, None)
        if col is not None:
            docs = list(col.find())
            for d in docs:
                if "_id" in d:
                    d["_id"] = str(d["_id"])
            payload["collections"][coll_name] = docs

    raw = json.dumps(payload, default=str).encode("utf-8")
    with gzip.open(filepath, "wb") as f:
        f.write(raw)

    size_bytes = filepath.stat().st_size
    record = {
        "id": backup_id,
        "filename": filename,
        "created_at": timestamp,
        "size_bytes": size_bytes,
        "size_human": _human_size(size_bytes),
        "status": "success",
        "include_audit": include_audit,
        "collections": list(payload["collections"].keys()),
    }
    db.backups_col.insert_one(record)
    return record


def list_backups():
    return list(db.backups_col.find().sort("created_at", -1))


def restore_backup(backup_id: str) -> dict:
    doc = db.backups_col.find_one({"id": backup_id})
    if not doc:
        raise FileNotFoundError("Backup not found")

    filepath = _backup_dir() / doc["filename"]
    if not filepath.exists():
        raise FileNotFoundError("Backup file missing on disk")

    with gzip.open(filepath, "rb") as f:
        payload = json.loads(f.read().decode("utf-8"))

    restored = []
    for coll_name, docs in payload.get("collections", {}).items():
        col = _col_by_name(coll_name)
        if col is None:
            continue
        col.delete_many({})
        if docs:
            col.insert_many(docs)
        restored.append(coll_name)

    db.backups_col.update_one(
        {"id": backup_id},
        {"$set": {"last_restored_at": utcnow_naive().isoformat(timespec="seconds")}},
    )
    return {"restored_collections": restored, "backup_id": backup_id}


def delete_backup_record(backup_id: str) -> bool:
    doc = db.backups_col.find_one({"id": backup_id})
    if not doc:
        return False
    filepath = _backup_dir() / doc.get("filename", "")
    if filepath.exists():
        filepath.unlink()
    db.backups_col.delete_one({"id": backup_id})
    return True


def _human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} TB"
