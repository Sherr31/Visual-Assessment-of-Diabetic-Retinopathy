from flask import Blueprint, request, jsonify, send_file, abort
from werkzeug.utils import secure_filename

import os
import uuid

from vadr_backend.services.ai.predictor import predict_retinopathy

predict_bp = Blueprint("predict", __name__)

# Absolute path to the project root (vadr-backend/) — two levels up from
# this file (routes/predict.py → vadr_backend/ → vadr-backend/).
_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

UPLOAD_FOLDER = os.path.join(_PROJECT_ROOT, "uploads")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@predict_bp.route("/predict", methods=["POST"])
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

    return jsonify(result)


@predict_bp.route("/gradcam-image", methods=["GET"])
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
