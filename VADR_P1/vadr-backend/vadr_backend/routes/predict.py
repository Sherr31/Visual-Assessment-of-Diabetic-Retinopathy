from flask import Blueprint, request, jsonify, send_file, abort, g
from werkzeug.utils import secure_filename

import os
import uuid
import uuid as uuid_lib

from vadr_backend import db
from vadr_backend.decorators import require_auth
from vadr_backend.services.ai.predictor import predict_retinopathy
from vadr_backend.utils.common import utcnow_naive

predict_bp = Blueprint("predict", __name__)

# Absolute path to the project root (vadr-backend/) — two levels up from
# this file (routes/predict.py → vadr_backend/ → vadr-backend/).
_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

UPLOAD_FOLDER = os.path.join(_PROJECT_ROOT, "uploads")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@predict_bp.route("/predict", methods=["POST"])
@require_auth(roles=["admin", "doctor", "screener", "patient"])
def predict():

    if "image" not in request.files:
        return jsonify({
            "error": "No image uploaded."
        }), 400

    file = request.files["image"]

    if not file.filename:
        return jsonify({
            "error": "Empty filename."
        }), 400

    filename = secure_filename(file.filename)

    extension = os.path.splitext(filename)[1]

    unique_filename = f"{uuid.uuid4().hex}{extension}"

    image_path = os.path.join(UPLOAD_FOLDER, unique_filename)

    file.save(image_path)

    result = predict_retinopathy(image_path)

    # Determine patient_id & doctor metadata
    patient_id = request.form.get("patientId")
    if not patient_id and g.current_user.get("role") == "patient":
        user_email = g.current_user.get("email", "").strip()
        patient_rec = db.patients_col.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}})
        if patient_rec:
            patient_id = patient_rec.get("patientId")

    is_patient = g.current_user.get("role") == "patient"
    eye_side = request.form.get("eye_side") or request.form.get("eyeSide") or "Fundus"

    screening_doc = {
        "id": uuid_lib.uuid4().hex,
        "patient_id": patient_id,
        "patientId": patient_id,
        "doctor_id": None if is_patient else g.current_user["id"],
        "doctor_name": "Self-Screening (Patient)" if is_patient else g.current_user.get("name"),
        "eye_side": eye_side,
        "eyeSide": eye_side,
        "class_id": result.get("class_id"),
        "prediction": result.get("prediction"),
        "confidence": result.get("confidence"),
        "probabilities": result.get("probabilities", {}),
        "image_path": f"uploads/{unique_filename}",
        "imagePath": f"uploads/{unique_filename}",
        "gradcam": result.get("gradcam"),
        "gradcam_path": result.get("gradcam"),
        "reviewed": False,
        "created_at": utcnow_naive(),
    }
    db.screenings_col.insert_one(screening_doc)
    result["screeningId"] = screening_doc["id"]
    result["image_path"] = f"uploads/{unique_filename}"

    return jsonify(result)


@predict_bp.route("/gradcam-image", methods=["GET"])
@require_auth(roles=["admin", "doctor", "screener", "patient"])
def serve_gradcam():
    """Serve a GradCAM PNG by its relative file path.

    The frontend passes the path returned in the prediction response as a
    query param, e.g. /api/gradcam-image?path=uploads/gradcam/abc123.png
    """
    rel_path = request.args.get("path", "")

    if not rel_path:
        return jsonify({"error": "Missing path parameter."}), 400

    # Normalise separators (handles mixed forward/back slashes on Windows)
    rel_path = rel_path.replace("\\", "/")
    safe_rel = os.path.normpath(rel_path)

    # Only allow paths inside uploads/ (prevent directory traversal)
    if not safe_rel.startswith("uploads"):
        abort(403)

    # Resolve to an absolute path under the project root
    abs_path = os.path.join(_PROJECT_ROOT, safe_rel)

    if not os.path.isfile(abs_path):
        abort(404)

    return send_file(abs_path, mimetype="image/png")
