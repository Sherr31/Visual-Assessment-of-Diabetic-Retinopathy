from flask import Blueprint, jsonify, request

from .. import db
from ..utils.common import gen_temp_password, serialize, today

patients_bp = Blueprint("patients", __name__)


def gen_patient_id() -> str:
    # Generate monotonic IDs even if patients are deleted.
    # Using count_documents() can reuse an old patientId after deletions.
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


@patients_bp.route("/", methods=["GET"])
def get_patients():
    patients = list(db.patients_col.find())
    return jsonify([serialize(p) for p in patients]), 200


@patients_bp.route("/<patient_id>", methods=["GET"])
def get_patient(patient_id):
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(serialize(patient)), 200


@patients_bp.route("/", methods=["POST"])
def register_patient():
    data = request.get_json() or {}
    required = ["name", "email", "phone", "assignedDoctor"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    if db.patients_col.find_one({"email": data["email"]}):
        return jsonify({"error": "A patient with this email already exists"}), 409

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
    return jsonify(new_patient), 201


@patients_bp.route("/<patient_id>", methods=["PUT"])
def update_patient(patient_id):
    data = request.get_json() or {}
    data.pop("_id", None)
    data.pop("patientId", None)

    result = db.patients_col.update_one({"patientId": patient_id}, {"$set": data})
    if result.matched_count == 0:
        return jsonify({"error": "Patient not found"}), 404

    updated = db.patients_col.find_one({"patientId": patient_id})
    return jsonify(serialize(updated)), 200


@patients_bp.route("/<patient_id>/status", methods=["PATCH"])
def toggle_patient_status(patient_id):
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    new_status = "inactive" if patient["status"] == "active" else "active"
    db.patients_col.update_one({"patientId": patient_id}, {"$set": {"status": new_status}})
    return jsonify({"status": new_status}), 200


@patients_bp.route("/<patient_id>/send-credentials", methods=["PATCH"])
def send_credentials(patient_id):
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    db.patients_col.update_one(
        {"patientId": patient_id},
        {"$set": {"credentialsSent": True, "credentialsSentOn": today()}},
    )
    return jsonify({"message": "Credentials marked as sent", "email": patient["email"]}), 200


@patients_bp.route("/<patient_id>", methods=["DELETE"])
def delete_patient(patient_id):
    result = db.patients_col.delete_one({"patientId": patient_id})
    if result.deleted_count == 0:
        return jsonify({"error": "Patient not found"}), 404
    db.medical_history_col.delete_one({"patientId": patient_id})
    return jsonify({"message": "Patient deleted", "patientId": patient_id}), 200


@patients_bp.route("/<patient_id>/medical-history", methods=["GET"])
def get_medical_history(patient_id):
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    history = db.medical_history_col.find_one({"patientId": patient_id})
    if not history:
        db.medical_history_col.insert_one(_empty_medical_history(patient_id))
        history = db.medical_history_col.find_one({"patientId": patient_id})

    return jsonify(serialize(history)), 200


@patients_bp.route("/<patient_id>/medical-history", methods=["PUT"])
def upsert_medical_history(patient_id):
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

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
    scan_count = len(scans)
    last_scan = "—"
    if scans:
        last_scan = sorted(scans, key=lambda s: s.get("scanDate", ""), reverse=True)[0].get("scanDate", "—")
    db.patients_col.update_one(
        {"patientId": patient_id},
        {"$set": {"scans": scan_count, "lastScan": last_scan}},
    )

    return jsonify(serialize(history)), 200


@patients_bp.route("/<patient_id>/medical-history/export", methods=["GET"])
def export_medical_history(patient_id):
    patient = db.patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

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

    return jsonify(
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
        }
    ), 200
