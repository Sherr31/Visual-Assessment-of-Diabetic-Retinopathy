from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, g

from vadr_backend import db
from vadr_backend.decorators import require_auth
from vadr_backend.responses import api_success, api_error
from vadr_backend.utils.common import utcnow_naive, serialize
from vadr_backend.services.audit_service import log_event

dashboard_bp = Blueprint("dashboard", __name__)

HIGH_SEVERITY = {"Severe", "Proliferative DR", "Proliferative"}
SEVERITY_CLASSES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"]
PKT_TIMEZONE = timezone(timedelta(hours=5))


@dashboard_bp.route("/dashboard/summary", methods=["GET"])
@require_auth(roles=["admin", "doctor", "screener"])
def summary():
    now_utc = datetime.now(timezone.utc)
    now_pkt = now_utc.astimezone(PKT_TIMEZONE)
    start_of_today_pkt = now_pkt.replace(hour=0, minute=0, second=0, microsecond=0)
    # Convert PKT midnight boundary back to naive UTC for MongoDB querying
    start_of_today_utc_naive = start_of_today_pkt.astimezone(timezone.utc).replace(tzinfo=None)

    # 1. KPI Counts from real MongoDB collections
    daily_uploads = db.screenings_col.count_documents({"created_at": {"$gte": start_of_today_utc_naive}})
    pending_reviews = db.screenings_col.count_documents({"reviewed": False})
    high_severity_count = db.screenings_col.count_documents({"prediction": {"$in": list(HIGH_SEVERITY)}})
    total_patients = db.patients_col.count_documents({})
    total_screenings = db.screenings_col.count_documents({})

    # 2. 7-Day Daily Upload Trend (PKT-bucketed local day boundaries converted to naive UTC)
    daily_trend = []
    for i in range(6, -1, -1):
        day_start_pkt = start_of_today_pkt - timedelta(days=i)
        day_end_pkt = day_start_pkt + timedelta(days=1)
        day_start_utc = day_start_pkt.astimezone(timezone.utc).replace(tzinfo=None)
        day_end_utc = day_end_pkt.astimezone(timezone.utc).replace(tzinfo=None)
        count = db.screenings_col.count_documents({
            "created_at": {"$gte": day_start_utc, "$lt": day_end_utc}
        })
        daily_trend.append({
            "date": day_start_pkt.strftime("%Y-%m-%d"),
            "day": day_start_pkt.strftime("%a"),
            "displayDate": day_start_pkt.strftime("%b %d"),
            "uploads": count,
        })

    # 3. Severity Distribution
    pipeline = [{"$group": {"_id": "$prediction", "count": {"$sum": 1}}}]
    dist_raw = {row["_id"]: row["count"] for row in db.screenings_col.aggregate(pipeline) if row["_id"] is not None}
    
    # Normalize distribution into structured dictionary & list
    severity_distribution = {}
    for sc in SEVERITY_CLASSES:
        if sc == "Proliferative DR":
            severity_distribution[sc] = dist_raw.get("Proliferative DR", 0) + dist_raw.get("Proliferative", 0)
        else:
            severity_distribution[sc] = dist_raw.get(sc, 0)

    # 4. Recent Screenings Feed (Latest 15)
    recent_docs = list(
        db.screenings_col.find({}).sort("created_at", -1).limit(15)
    )
    recent_scans = []
    for doc in recent_docs:
        patient_name = None
        pid = doc.get("patient_id")
        if pid:
            patient = db.patients_col.find_one({"$or": [{"patientId": pid}, {"id": pid}, {"patient_id": pid}]})
            if patient:
                patient_name = patient.get("name")
        recent_scans.append({
            "id": doc.get("id"),
            "patientId": doc.get("patient_id"),
            "patientName": patient_name,
            "prediction": doc.get("prediction"),
            "confidence": doc.get("confidence"),
            "reviewed": doc.get("reviewed", False),
            "imagePath": doc.get("image_path"),
            "gradcamPath": doc.get("gradcam_path"),
            "doctor": doc.get("doctor_username") or doc.get("doctor_id"),
            "createdAt": doc["created_at"].isoformat() if doc.get("created_at") else None,
        })

    # 5. Latest Unreviewed High Severity Alert
    high_severity_doc = db.screenings_col.find_one(
        {"prediction": {"$in": list(HIGH_SEVERITY)}, "reviewed": False},
        sort=[("created_at", -1)],
    )
    high_severity_alert = None
    if high_severity_doc:
        patient_name = None
        pid = high_severity_doc.get("patient_id")
        if pid:
            patient = db.patients_col.find_one({"$or": [{"patientId": pid}, {"id": pid}, {"patient_id": pid}]})
            if patient:
                patient_name = patient.get("name")
        high_severity_alert = {
            "id": high_severity_doc.get("id"),
            "patientId": high_severity_doc.get("patient_id"),
            "patientName": patient_name,
            "prediction": high_severity_doc.get("prediction"),
            "confidence": high_severity_doc.get("confidence"),
            "createdAt": high_severity_doc["created_at"].isoformat() if high_severity_doc.get("created_at") else None,
        }

    return api_success({
        "kpis": {
            "dailyUploads": daily_uploads,
            "pendingReviews": pending_reviews,
            "highSeverityCount": high_severity_count,
            "totalPatients": total_patients,
            "totalScreenings": total_screenings,
        },
        "dailyUploads": daily_uploads,
        "pendingReviews": pending_reviews,
        "dailyUploadsTrend": daily_trend,
        "severityDistribution": severity_distribution,
        "recentScans": recent_scans,
        "highSeverityAlert": high_severity_alert,
        "lastUpdated": now_utc.isoformat(),
    })


@dashboard_bp.route("/dashboard/screenings/<screening_id>/review", methods=["PATCH"])
@require_auth(roles=["admin", "doctor"])
def mark_reviewed(screening_id):
    result = db.screenings_col.update_one(
        {"id": screening_id}, {"$set": {"reviewed": True}}
    )
    if result.matched_count == 0:
        return api_error("Not found", "Screening not found", "NOT_FOUND", 404)
    
    # Audit log entry
    current_user = getattr(g, "current_user", {}) or {}
    log_event(
        "screening_reviewed",
        user_id=current_user.get("id"),
        role=current_user.get("role"),
        metadata={"screening_id": screening_id}
    )
    
    return api_success(message="Marked as reviewed")
