from flask import Blueprint, g, request

from .. import db
from ..decorators import require_auth
from ..responses import api_error, api_success
from ..utils.common import gen_temp_password, serialize, today

patients_bp = Blueprint("patients", __name__)


def gen_patient_id() -> str:
    max_num = 0
    for doc in db.patients_col.find({}, {"patientId": 1}):
        pid = doc.get("patientId")
        if isinstance(pid, str) and pid.startswith("VADR-"):
            try:
                num = int(pid.split("VADR-")[-1])
                max_num = max(max_num, num)
            except ValueError:
                pass
    return f"VADR-{max_num + 1:04d}"


def _empty_medical_history(patient_id: str) -> dict:
    return {
        "patientId": patient_id,
        "visits": [],
        "medications": [],
        "comorbidities": [],
        "scans": [],
        "updatedAt": today(),
    }


def _grade_score(grade: str) -> int:
    mapping = {
        "No DR": 0,
        "Mild DR": 1,
        "Moderate DR": 2,
        "Severe DR": 3,
        "Proliferative DR": 4,
    }
    return mapping.get(grade, 0)


def _doctor_filter(query: dict) -> dict:
    """Doctors only see patients assigned to them."""
    user = g.current_user
    if user.get("role") == "doctor":
        query["assignedDoctor"] = user.get("name")
    return query


@patients_bp.route("/", methods=["GET"])
@require_auth(roles=["admin", "doctor", "screener"])
def get_patients():
    """List patients visible to the current role."""
    query = _doctor_filter({})
    patients = list(db.patients_col.find(query))
    return api_success([serialize(p) for p in patients], message="Patients retrieved")


@patients_bp.route("/<patient_id>", methods=["GET"])
@require_auth(roles=["admin", "doctor", "screener", "patient"])
def get_patient(patient_id):
    """Get a patient record with role-based access checks."""
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return api_error("Patient not found", status=404)

    role = g.current_user.get("role")
    if role == "doctor" and patient.get("assignedDoctor") != g.current_user.get("name"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)
    if role == "patient" and patient.get("email") != g.current_user.get("email"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)

    return api_success(serialize(patient))


@patients_bp.route("/", methods=["POST"])
@require_auth(roles=["admin", "doctor", "screener"])
def register_patient():
    """Register a new patient."""
    data = request.get_json() or {}
    required = ["name", "email", "phone", "assignedDoctor"]
    for field in required:
        if not data.get(field):
            return api_error(f"{field} is required", status=400)

    if db.patients_col.find_one({"email": data["email"]}):
        return api_error("A patient with this email already exists", status=409)

    new_patient = {
        "patientId": gen_patient_id(),
        "name": data.get("name"),
        "age": data.get("age"),
        "gender": data.get("gender", "Male"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "diabetesType": data.get("diabetesType", "Type 2"),
        "hba1c": data.get("hba1c", ""),
        "diagnosedYear": data.get("diagnosedYear", ""),
        "address": data.get("address", ""),
        "assignedDoctor": data.get("assignedDoctor"),
        "referral": data.get("referral", "Self"),
        "status": data.get("status", "active"),
        "scans": 0,
        "lastScan": "—",
        "joined": today(),
        "credentialsSent": False,
        "tempPassword": gen_temp_password(),
    }
    result = db.patients_col.insert_one(new_patient)
    new_patient["_id"] = str(result.inserted_id)
    return api_success(new_patient, message="Patient registered", status=201)


@patients_bp.route("/<patient_id>", methods=["PUT"])
@require_auth(roles=["admin", "doctor"])
def update_patient(patient_id):
    """Update patient demographics and assignment."""
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return api_error("Patient not found", status=404)
    if g.current_user.get("role") == "doctor" and patient.get("assignedDoctor") != g.current_user.get("name"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)

    data = request.get_json() or {}
    data.pop("_id", None)
    data.pop("patientId", None)
    db.patients_col.update_one({"patientId": patient_id}, {"$set": data})
    updated = db.patients_col.find_one({"patientId": patient_id})
    return api_success(serialize(updated), message="Patient updated")


@patients_bp.route("/<patient_id>/status", methods=["PATCH"])
@require_auth(roles=["admin", "doctor"])
def toggle_patient_status(patient_id):
    """Toggle patient active/inactive status."""
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return api_error("Patient not found", status=404)
    if g.current_user.get("role") == "doctor" and patient.get("assignedDoctor") != g.current_user.get("name"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)

    new_status = "inactive" if patient["status"] == "active" else "active"
    db.patients_col.update_one({"patientId": patient_id}, {"$set": {"status": new_status}})
    return api_success({"status": new_status}, message="Patient status updated")


@patients_bp.route("/<patient_id>/send-credentials", methods=["PATCH"])
@require_auth(roles=["admin", "doctor"])
def send_credentials(patient_id):
    """Mark patient portal credentials as sent."""
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return api_error("Patient not found", status=404)

    db.patients_col.update_one(
        {"patientId": patient_id},
        {"$set": {"credentialsSent": True, "credentialsSentOn": today()}},
    )
    return api_success({"email": patient["email"]}, message="Credentials marked as sent")


@patients_bp.route("/<patient_id>", methods=["DELETE"])
@require_auth(roles=["admin"])
def delete_patient(patient_id):
    """Permanently delete a patient record."""
    result = db.patients_col.delete_one({"patientId": patient_id})
    if result.deleted_count == 0:
        return api_error("Patient not found", status=404)
    db.medical_history_col.delete_one({"patientId": patient_id})
    return api_success({"patientId": patient_id}, message="Patient deleted")


@patients_bp.route("/<patient_id>/medical-history", methods=["GET"])
@require_auth(roles=["admin", "doctor", "patient"])
def get_medical_history(patient_id):
    """Get medical history for a patient."""
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return api_error("Patient not found", status=404)
    if g.current_user.get("role") == "doctor" and patient.get("assignedDoctor") != g.current_user.get("name"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)
    if g.current_user.get("role") == "patient" and patient.get("email") != g.current_user.get("email"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)

    history = db.medical_history_col.find_one({"patientId": patient_id})
    if not history:
        db.medical_history_col.insert_one(_empty_medical_history(patient_id))
        history = db.medical_history_col.find_one({"patientId": patient_id})
    return api_success(serialize(history))


@patients_bp.route("/<patient_id>/medical-history", methods=["PUT"])
@require_auth(roles=["admin", "doctor"])
def upsert_medical_history(patient_id):
    """Update medical history for a patient."""
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return api_error("Patient not found", status=404)
    if g.current_user.get("role") == "doctor" and patient.get("assignedDoctor") != g.current_user.get("name"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)

    data = request.get_json() or {}
    payload = {
        "visits": data.get("visits", []),
        "medications": data.get("medications", []),
        "comorbidities": data.get("comorbidities", []),
        "scans": data.get("scans", []),
        "updatedAt": today(),
    }
    db.medical_history_col.update_one(
        {"patientId": patient_id},
        {"$set": payload, "$setOnInsert": {"patientId": patient_id}},
        upsert=True,
    )

    history = db.medical_history_col.find_one({"patientId": patient_id}) or {}
    scans = history.get("scans", [])
    last_scan = "—"
    if scans:
        last_scan = sorted(scans, key=lambda s: s.get("scanDate", ""), reverse=True)[0].get("scanDate", "—")
    db.patients_col.update_one(
        {"patientId": patient_id},
        {"$set": {"scans": len(scans), "lastScan": last_scan}},
    )
    return api_success(serialize(history), message="Medical history updated")


@patients_bp.route("/<patient_id>/medical-history/export", methods=["GET"])
@require_auth(roles=["admin", "doctor", "patient"])
def export_medical_history(patient_id):
    """Export patient medical history including DR trend."""
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return api_error("Patient not found", status=404)
    if g.current_user.get("role") == "doctor" and patient.get("assignedDoctor") != g.current_user.get("name"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)
    if g.current_user.get("role") == "patient" and patient.get("email") != g.current_user.get("email"):
        return api_error("Forbidden", code="FORBIDDEN", status=403)

    history = db.medical_history_col.find_one({"patientId": patient_id}) or _empty_medical_history(patient_id)
    visits = sorted(history.get("visits", []), key=lambda v: v.get("visitDate", ""))
    dr_trend = [
        {
            "visitDate": visit.get("visitDate"),
            "grade": visit.get("drGrade", "No DR"),
            "score": _grade_score(visit.get("drGrade", "No DR")),
            "hba1c": visit.get("hba1c", ""),
            "notes": visit.get("notes", ""),
        }
        for visit in visits
    ]
    return api_success(
        {
            "patient": serialize(patient),
            "history": {
                "visits": visits,
                "medications": history.get("medications", []),
                "comorbidities": history.get("comorbidities", []),
                "scans": history.get("scans", []),
                "drTrend": dr_trend,
                "updatedAt": history.get("updatedAt", today()),
            },
        },
        message="Medical history export",
    )


@patients_bp.route("/dashboard-summary", methods=["GET"])
@require_auth(roles=["patient"])
def patient_dashboard_summary():
    """Personalized self-service portal summary for the authenticated patient."""
    user_email = g.current_user.get("email", "").strip().lower()

    # Strictly query by authenticated patient's email
    patient = db.patients_col.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}})
    if not patient:
        return api_success({
            "patient": None,
            "message": "No patient record is currently linked to this email account. Please contact clinic staff.",
            "latestScreening": None,
            "screeningHistory": [],
            "severityTimeline": [],
            "reports": {"available": False, "items": []},
        })

    patient_id = patient.get("patientId")

    # 1. Fetch historical screenings from screenings_col
    screenings = list(
        db.screenings_col.find(
            {"$or": [{"patient_id": patient_id}, {"patientId": patient_id}]}
        ).sort("created_at", -1)
    )

    # 2. Fetch medical history scans & visits
    history = db.medical_history_col.find_one({"patientId": patient_id}) or {}
    scans_from_history = history.get("scans", [])

    # Format screenings list
    screening_history = []
    for s in screenings:
        screening_history.append({
            "id": s.get("id"),
            "prediction": s.get("prediction", "No DR"),
            "confidence": s.get("confidence"),
            "reviewed": s.get("reviewed", False),
            "doctor": s.get("doctor_name") or s.get("doctor_id") or patient.get("assignedDoctor", "Attending Ophthalmologist"),
            "createdAt": s["created_at"].isoformat() if s.get("created_at") else None,
            "gradcamPath": s.get("gradcam"),
        })

    # Fallback to history scans if screenings_col is empty
    if not screening_history and scans_from_history:
        for idx, scan in enumerate(scans_from_history):
            screening_history.append({
                "id": f"scan-{idx+1}",
                "prediction": scan.get("prediction") or scan.get("grade") or "No DR",
                "confidence": scan.get("confidence", 95.0),
                "reviewed": True,
                "doctor": scan.get("doctor") or patient.get("assignedDoctor", "Attending Ophthalmologist"),
                "createdAt": scan.get("scanDate") or scan.get("date"),
                "gradcamPath": scan.get("gradcamPath"),
            })

    latest_screening = screening_history[0] if screening_history else None

    # Severity timeline progression
    severity_timeline = []
    for s in reversed(screening_history):
        if s.get("createdAt"):
            severity_timeline.append({
                "date": s["createdAt"][:10] if len(s["createdAt"]) >= 10 else s["createdAt"],
                "prediction": s.get("prediction", "No DR"),
                "confidence": s.get("confidence"),
            })

    # Fetch signed reports for the patient
    reports_cursor = db.reports_col.find({
        "$or": [
            {"patient_id": patient_id},
            {"patient.patientId": patient_id},
            {"patient.email": {"$regex": f"^{user_email}$", "$options": "i"}}
        ],
        "status": {"$in": ["signed", "ready", "email_queued", "email_sent", "email_failed"]}
    }).sort("created_at", -1)

    signed_reports = []
    for r in reports_cursor:
        signed_reports.append({
            "reportId": r.get("report_id"),
            "report_id": r.get("report_id"),
            "screeningId": r.get("screening_id"),
            "prediction": (r.get("assessment") or {}).get("prediction", "No DR"),
            "confidence": (r.get("assessment") or {}).get("confidence"),
            "doctor": (r.get("doctor") or {}).get("name") or (r.get("signoff") or {}).get("signed_by_name", "Attending Doctor"),
            "signedAt": (r.get("signoff") or {}).get("signed_at"),
            "createdAt": r["created_at"].isoformat() if r.get("created_at") else None,
            "status": r.get("status"),
            "downloadUrl": f"/api/reports/{r.get('report_id')}/download"
        })

    return api_success({
        "patient": serialize(patient),
        "latestScreening": latest_screening,
        "screeningHistory": screening_history,
        "severityTimeline": severity_timeline,
        "assignedDoctor": patient.get("assignedDoctor", "Attending Physician"),
        "reports": {
            "available": len(signed_reports) > 0,
            "items": signed_reports,
            "notice": "Signed clinical reports will be made available here after physician sign-off." if not signed_reports else "Your signed clinical assessment reports are ready for download.",
        },
    })

