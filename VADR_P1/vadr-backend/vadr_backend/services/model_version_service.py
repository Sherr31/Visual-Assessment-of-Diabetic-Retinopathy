"""AI model checkpoint registry — version tags, promote, rollback."""

from .. import db
from ..utils.common import gen_model_version_id, today, utcnow_naive


def list_model_versions():
    return list(db.model_versions_col.find().sort("created_at", -1))


def get_production_version():
    return db.model_versions_col.find_one({"status": "production"})


def register_version(
    *,
    version_tag: str,
    name: str,
    weights_path: str = "",
    metrics: dict | None = None,
    notes: str = "",
    created_by: str = "",
) -> dict:
    if db.model_versions_col.find_one({"version_tag": version_tag}):
        raise ValueError(f"Version tag '{version_tag}' already exists")

    doc = {
        "id": gen_model_version_id(),
        "version_tag": version_tag,
        "name": name,
        "weights_path": weights_path,
        "metrics": metrics or {},
        "notes": notes,
        "status": "candidate",
        "created_at": utcnow_naive().isoformat(timespec="seconds"),
        "created_by": created_by,
        "promoted_at": None,
    }
    db.model_versions_col.insert_one(doc)
    return doc


def promote_version(version_id: str) -> dict:
    target = db.model_versions_col.find_one({"id": version_id})
    if not target:
        raise LookupError("Model version not found")

    now = utcnow_naive().isoformat(timespec="seconds")
    db.model_versions_col.update_many(
        {"status": "production"},
        {"$set": {"status": "archived", "demoted_at": now}},
    )
    db.model_versions_col.update_one(
        {"id": version_id},
        {"$set": {"status": "production", "promoted_at": now}},
    )
    return db.model_versions_col.find_one({"id": version_id})


def rollback_to_version(version_id: str) -> dict:
    """Alias for promote — restores a prior checkpoint as production."""
    return promote_version(version_id)


def archive_version(version_id: str) -> dict:
    result = db.model_versions_col.update_one(
        {"id": version_id, "status": {"$ne": "production"}},
        {"$set": {"status": "archived"}},
    )
    if result.matched_count == 0:
        raise LookupError("Version not found or is current production")
    return db.model_versions_col.find_one({"id": version_id})


def compare_versions(version_id_a: str, version_id_b: str) -> dict:
    a = db.model_versions_col.find_one({"id": version_id_a})
    b = db.model_versions_col.find_one({"id": version_id_b})
    if not a or not b:
        raise LookupError("One or both versions not found")

    metrics_a = a.get("metrics") or {}
    metrics_b = b.get("metrics") or {}
    all_keys = sorted(set(metrics_a) | set(metrics_b))
    diff = []
    for key in all_keys:
        va, vb = metrics_a.get(key), metrics_b.get(key)
        diff.append({"metric": key, "a": va, "b": vb, "delta": _metric_delta(va, vb)})

    return {"version_a": a, "version_b": b, "metric_diff": diff}


def _metric_delta(a, b):
    try:
        if a is None or b is None:
            return None
        return float(b) - float(a)
    except (TypeError, ValueError):
        return None


def seed_demo_models():
    if db.model_versions_col.count_documents({}) > 0:
        return
    demos = [
        {
            "id": "mv1",
            "version_tag": "v4.0",
            "name": "RetinaNet",
            "weights_path": "models/retinanet_v4.0.h5",
            "metrics": {"accuracy": 0.91, "auc": 0.94, "f1": 0.88},
            "notes": "Baseline production model",
            "status": "archived",
            "created_at": "2025-11-01T10:00:00",
            "created_by": "system",
            "promoted_at": "2025-11-01T10:00:00",
        },
        {
            "id": "mv2",
            "version_tag": "v4.2",
            "name": "RetinaNet",
            "weights_path": "models/retinanet_v4.2.h5",
            "metrics": {"accuracy": 0.935, "auc": 0.962, "f1": 0.912},
            "notes": "Improved vessel segmentation",
            "status": "production",
            "created_at": "2026-03-15T14:30:00",
            "created_by": "system",
            "promoted_at": "2026-03-20T09:00:00",
        },
        {
            "id": "mv3",
            "version_tag": "v4.3-beta",
            "name": "RetinaNet",
            "weights_path": "models/retinanet_v4.3_beta.h5",
            "metrics": {"accuracy": 0.928, "auc": 0.955, "f1": 0.905},
            "notes": "Candidate — under evaluation",
            "status": "candidate",
            "created_at": "2026-04-28T11:00:00",
            "created_by": "system",
            "promoted_at": None,
        },
    ]
    db.model_versions_col.insert_many(demos)
