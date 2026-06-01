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

    history = db.medical_history_col.find_one({"patientId": patient_id})
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
