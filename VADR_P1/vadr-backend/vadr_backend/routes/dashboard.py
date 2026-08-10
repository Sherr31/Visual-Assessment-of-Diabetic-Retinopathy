"""
dashboard.py – Merged DR Dashboard routes integrated into the VADR backend.

Provides:
  GET  /api/dashboard/overview
  POST /api/dashboard/predict
  GET  /api/dashboard/history
  GET  /api/dashboard/analytics
  GET  /api/dashboard/patients-list
  GET  /api/dashboard/patient-dashboard/<patient_id>
  GET  /api/dashboard/patient-scans/<patient_id>
  GET  /api/dashboard/technicians
  GET  /api/dashboard/technician-dashboard/<tech_id>
  GET  /api/dashboard/technician-queue/<tech_id>
  POST /api/dashboard/technician-queue/<tech_id>/update
  POST /api/dashboard/technician-scan
  GET  /api/dashboard/appointments
  POST /api/dashboard/appointments
  GET  /api/dashboard/db-status
  POST /api/dashboard/normalize
  GET  /api/dashboard/normalize/records
  GET  /api/dashboard/admin/stats
  GET  /api/dashboard/admin/patients
  DELETE /api/dashboard/admin/patients/<patient_id>
  GET  /api/dashboard/admin/technicians
  POST /api/dashboard/admin/technicians
  DELETE /api/dashboard/admin/technicians/<tech_id>
  GET  /api/dashboard/admin/appointments
  DELETE /api/dashboard/admin/appointments/<apt_id>
  GET  /api/dashboard/patient-report/<patient_id>
"""

from flask import Blueprint, jsonify, request
from pymongo import MongoClient, DESCENDING
import random, time, uuid, os, base64, io
from datetime import datetime, timedelta
import numpy as np

dashboard_bp = Blueprint("dashboard", __name__)

# ─── MongoDB (inherits the VADR connection; also reads from dr_dashboard collection) ─────
_MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://taha757:Taharao123@vadr.elfsv9q.mongodb.net/?retryWrites=true&w=majority"
)
try:
    _client = MongoClient(_MONGO_URI, serverSelectionTimeoutMS=3000)
    _client.server_info()
    _db = _client["dr_dashboard"]
    MONGO_OK = True
    print("✅ Dashboard: MongoDB connected")
except Exception as e:
    print(f"⚠️  Dashboard: MongoDB unavailable ({e}). Using in-memory fallback.")
    MONGO_OK = False
    _db = None

SEVERITY_LABELS = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]
SEVERITY_COLORS = ["#10B981", "#F59E0B", "#F97316", "#EF4444", "#7C3AED"]

PATIENT_NAMES = [
    "Ahmad Raza", "Fatima Khan", "Muhammad Ali", "Ayesha Malik", "Usman Tariq",
    "Zainab Hussain", "Bilal Ahmed", "Sana Sheikh", "Imran Qureshi", "Nadia Baig",
    "Hamza Nawaz", "Rabia Chaudhry", "Tariq Mehmood", "Sara Iqbal", "Asif Javed",
]

TECHNICIAN_DATA = [
    {"_id": "TECH-001", "name": "Ali Hassan",    "role": "Retinal Imaging Technician", "department": "Ophthalmology", "shift": "Morning",   "email": "ali.hassan@vadr.pk",  "phone": "0300-1234567", "total_scans": 342, "avg_quality": 94.2},
    {"_id": "TECH-002", "name": "Maria Qureshi", "role": "Ophthalmic Photographer",    "department": "Ophthalmology", "shift": "Afternoon", "email": "maria.q@vadr.pk",     "phone": "0301-2345678", "total_scans": 278, "avg_quality": 96.1},
    {"_id": "TECH-003", "name": "Kamran Asif",   "role": "Retinal Imaging Technician", "department": "Diabetic Clinic","shift": "Morning",  "email": "kamran.asif@vadr.pk", "phone": "0302-3456789", "total_scans": 415, "avg_quality": 91.8},
]

USERS_DB = {
    "doctor":     [{"username": "dr.rahman", "password": "doctor123"}, {"username": "admin", "password": "admin"}],
    "patient":    [{"username": "patient", "password": "patient123"},   {"username": "ahmad.raza", "password": "pass123"}],
    "technician": [{"username": "tech.ali", "password": "tech123"},     {"username": "technician", "password": "tech123"}],
    "admin":      [{"username": "admin", "password": "admin@vadr"},     {"username": "superadmin", "password": "super123"}],
}


def _rec(s):
    return [
        "No diabetic retinopathy detected. Continue annual eye examinations and maintain good glycemic control.",
        "Mild nonproliferative DR detected. Schedule follow-up in 12 months. Optimize blood sugar and blood pressure control.",
        "Moderate nonproliferative DR detected. Ophthalmology referral recommended within 3-6 months.",
        "Severe nonproliferative DR detected. Urgent ophthalmology referral required. Panretinal photocoagulation may be needed.",
        "Proliferative DR detected. Immediate ophthalmology consultation required. Vitreoretinal surgery may be indicated.",
    ][s]


def _ser(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [_ser(d) for d in doc]
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    return d


# ─── Seed ──────────────────────────────────────────────────────────────────────
def _seed():
    if not MONGO_OK:
        return
    if _db.technicians.count_documents({}) == 0:
        _db.technicians.insert_many(TECHNICIAN_DATA)
    if _db.patients.count_documents({}) == 0:
        patients = []
        for i, name in enumerate(PATIENT_NAMES):
            si = random.randint(0, 4)
            patients.append({
                "_id": f"PAT-{1000+i}", "name": name, "age": random.randint(35, 75),
                "gender": random.choice(["Male", "Female"]), "diabetic_years": random.randint(1, 20),
                "hba1c": round(random.uniform(6.5, 10.5), 1),
                "blood_pressure": f"{random.randint(110,160)}/{random.randint(70,100)}",
                "phone": f"03{random.randint(10,49)}-{random.randint(1000000,9999999)}",
                "email": f"{name.lower().replace(' ','.')}@email.pk",
                "current_severity": SEVERITY_LABELS[si], "current_severity_index": si,
                "assigned_technician": random.choice(["TECH-001", "TECH-002", "TECH-003"]),
                "created_at": (datetime.now()-timedelta(days=random.randint(90, 365))).isoformat(),
                "last_scan_date": (datetime.now()-timedelta(days=random.randint(0, 60))).strftime("%Y-%m-%d"),
            })
        _db.patients.insert_many(patients)
    if _db.scans.count_documents({}) == 0:
        scans = []
        for patient in _db.patients.find():
            for _ in range(random.randint(2, 5)):
                si = max(0, patient["current_severity_index"] - random.randint(0, 2))
                sd = datetime.now() - timedelta(days=random.randint(1, 300))
                tid = random.choice(["TECH-001", "TECH-002", "TECH-003"])
                scans.append({
                    "_id": f"SCN-{str(uuid.uuid4())[:8].upper()}",
                    "patient_id": patient["_id"], "patient_name": patient["name"],
                    "technician_id": tid, "date": sd.strftime("%Y-%m-%d"), "time": sd.strftime("%H:%M"),
                    "eye": random.choice(["Left Eye", "Right Eye"]),
                    "severity": SEVERITY_LABELS[si], "severity_index": si,
                    "confidence": round(random.uniform(82, 99), 1),
                    "recommendation": _rec(si), "status": "completed",
                    "processing_time": round(random.uniform(0.8, 2.5), 2),
                    "features": {"microaneurysms": si >= 1, "hemorrhages": si >= 2, "exudates": si >= 2, "neovascularization": si >= 4, "macular_edema": si >= 3},
                    "created_at": sd.isoformat(),
                })
        _db.scans.insert_many(scans)
    if _db.appointments.count_documents({}) == 0:
        appointments = []
        plist = list(_db.patients.find())
        for patient in plist[:10]:
            fd = datetime.now() + timedelta(days=random.randint(3, 45))
            appointments.append({
                "_id": f"APT-{str(uuid.uuid4())[:8].upper()}",
                "patient_id": patient["_id"], "patient_name": patient["name"],
                "technician_id": patient["assigned_technician"],
                "date": fd.strftime("%Y-%m-%d"),
                "time": f"{random.randint(9,16):02d}:{random.choice(['00','15','30','45'])}",
                "type": random.choice(["Annual Retinal Scan", "Follow-up Scan", "Urgent Assessment"]),
                "status": random.choice(["scheduled", "scheduled", "confirmed"]), "notes": "",
                "created_at": datetime.now().isoformat(),
            })
        for i in range(5):
            p = random.choice(plist)
            appointments.append({
                "_id": f"APT-TODAY-{i+1}", "patient_id": p["_id"], "patient_name": p["name"],
                "technician_id": random.choice(["TECH-001", "TECH-002", "TECH-003"]),
                "date": datetime.now().strftime("%Y-%m-%d"), "time": f"{9+i}:00",
                "type": "Retinal Scan", "status": "pending", "notes": "",
                "created_at": datetime.now().isoformat(),
            })
        _db.appointments.insert_many(appointments)
    if _db.tech_queue.count_documents({}) == 0:
        plist = list(_db.patients.find())
        queue = []
        for i, patient in enumerate(random.sample(plist, min(8, len(plist)))):
            queue.append({
                "_id": f"QUE-{i+1:03d}", "patient_id": patient["_id"], "patient_name": patient["name"],
                "patient_age": patient["age"], "hba1c": patient["hba1c"], "last_scan": patient["last_scan_date"],
                "technician_id": patient["assigned_technician"],
                "priority": random.choice(["High", "High", "Medium", "Medium", "Low"]),
                "scan_type": "Fundus Photography",
                "status": random.choice(["pending", "pending", "in-progress"]),
                "notes": random.choice(["", "Patient has mobility issues", "Needs pupil dilation", ""]),
                "created_at": datetime.now().isoformat(),
            })
        _db.tech_queue.insert_many(queue)


_seed()

# ═══════════════════════════════════════════════════════════════════════════════
# IMAGE NORMALIZATION — 7-Step Pipeline
# ═══════════════════════════════════════════════════════════════════════════════

def _normalize_image_pipeline(file_bytes, original_filename):
    """Execute the full 7-step normalization pipeline. Returns result dict."""
    try:
        import cv2
    except ImportError:
        raise RuntimeError("opencv-python-headless is not installed. Run: pip install opencv-python-headless")

    t0 = time.perf_counter()

    # Step 1 — decode
    arr = np.frombuffer(file_bytes, np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image. File may be corrupted.")

    # Step 2 — resize with aspect-ratio padding to 224×224
    h, w = bgr.shape[:2]
    scale = min(224 / w, 224 / h)
    nw, nh = int(w * scale), int(h * scale)
    resized = cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
    canvas = np.zeros((224, 224, 3), dtype=np.uint8)
    x0, y0 = (224 - nw) // 2, (224 - nh) // 2
    canvas[y0:y0+nh, x0:x0+nw] = resized
    bgr = canvas

    # Step 3 — BGR → RGB float32
    rgb_f = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

    # Step 4 — brightness / gamma correction
    u8 = (rgb_f * 255).astype(np.uint8)
    mean_b = float(np.mean(u8))
    gamma = 1.5 if mean_b < 85 else (0.7 if mean_b > 200 else 1.0)
    inv = 1.0 / gamma
    lut = np.array([(i / 255.0) ** inv * 255 for i in range(256)], dtype=np.uint8)
    rgb_f = cv2.LUT(u8, lut).astype(np.float32) / 255.0

    # Step 5 — CLAHE on LAB L-channel
    u8 = (rgb_f * 255).astype(np.uint8)
    lab = cv2.cvtColor(u8, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab_enhanced = cv2.merge([clahe.apply(l), a, b])
    rgb_f = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2RGB).astype(np.float32) / 255.0

    # Step 6 — Gaussian + Median noise reduction
    u8 = (rgb_f * 255).astype(np.uint8)
    gauss = cv2.GaussianBlur(u8, (5, 5), 0)
    median = cv2.merge([cv2.medianBlur(c, 3) for c in cv2.split(gauss)])
    rgb_f = median.astype(np.float32) / 255.0

    # Step 7 — intensity standardisation
    mean_i = float(np.mean(rgb_f))
    std_i = float(np.std(rgb_f))
    rgb_std = (rgb_f - mean_i) / (std_i + 1e-7)

    elapsed = round(time.perf_counter() - t0, 4)
    brightness = round(float(np.mean(rgb_f)), 4)
    contrast = round(float(np.std(rgb_f)), 4)

    # Encode normalised image to PNG base64 (rescale to 0-255 first)
    lo, hi = rgb_std.min(), rgb_std.max()
    vis = ((rgb_std - lo) / (hi - lo + 1e-7) * 255).astype(np.uint8)
    from PIL import Image as _PIL
    buf = io.BytesIO()
    _PIL.fromarray(vis, "RGB").save(buf, format="PNG")
    norm_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    orig_b64 = base64.b64encode(file_bytes).decode("utf-8")

    record_id = None
    if MONGO_OK:
        doc = {
            "originalImage": orig_b64, "normalizedImage": norm_b64,
            "originalFilename": original_filename,
            "createdAt": datetime.now().isoformat(),
            "metrics": {
                "brightness": brightness, "contrast": contrast,
                "processingTime": elapsed, "meanIntensity": round(mean_i, 6),
                "stdIntensity": round(std_i, 6), "claheApplied": True,
                "gammaCorrection": round(gamma, 4),
            },
            "status": "completed",
        }
        result = _db.normalization_records.insert_one(doc)
        record_id = str(result.inserted_id)

    return {
        "success": True,
        "normalizedImage": f"data:image/png;base64,{norm_b64}",
        "recordId": record_id,
        "metrics": {
            "brightnessScore": brightness, "contrastScore": contrast,
            "processingTime": elapsed, "meanIntensity": round(mean_i, 6),
            "stdIntensity": round(std_i, 6), "gammaCorrection": round(gamma, 4),
        },
    }


# ─── In-memory fallback patients ───────────────────────────────────────────────
def _mem_patients():
    records = []
    for i, name in enumerate(PATIENT_NAMES[:12]):
        si = random.randint(0, 4)
        d = datetime.now() - timedelta(days=random.randint(0, 90))
        records.append({
            "id": f"PAT-{1000+i}", "name": name, "age": random.randint(35, 75),
            "gender": random.choice(["Male", "Female"]), "date": d.strftime("%Y-%m-%d"),
            "time": d.strftime("%H:%M"), "severity": SEVERITY_LABELS[si], "severity_index": si,
            "confidence": round(random.uniform(82, 99), 1), "eye": random.choice(["Left Eye", "Right Eye"]),
            "diabetic_years": random.randint(1, 20), "hba1c": round(random.uniform(6.5, 10.5), 1),
            "blood_pressure": f"{random.randint(110,160)}/{random.randint(70,100)}",
            "recommendation": _rec(si),
        })
    return records


_MEM_PATIENTS = _mem_patients()


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@dashboard_bp.route("/login", methods=["POST"])
def dashboard_login():
    """Role-based login for the dashboard (separate from VADR JWT auth)."""
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    role = data.get("role", "")
    creds = USERS_DB.get(role, [])
    match = next((c for c in creds if c["username"] == username and c["password"] == password), None)
    if match:
        return jsonify({"success": True, "role": role, "username": username, "token": f"demo-{role}-{username}"})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401


@dashboard_bp.route("/overview", methods=["GET"])
def overview():
    if MONGO_OK:
        total = _db.scans.count_documents({})
        pos = _db.scans.count_documents({"severity_index": {"$gt": 0}})
        norm = total - pos
        cr = list(_db.scans.aggregate([{"$group": {"_id": None, "avg": {"$avg": "$confidence"}}}]))
        avg_c = round(cr[0]["avg"], 1) if cr else 94.7
        today_up = _db.scans.count_documents({"date": datetime.now().strftime("%Y-%m-%d")})
    else:
        total = len(_MEM_PATIENTS) + 248
        pos = sum(1 for p in _MEM_PATIENTS if p["severity_index"] > 0) + 89
        norm = total - pos
        avg_c = round(sum(p["confidence"] for p in _MEM_PATIENTS) / len(_MEM_PATIENTS), 1)
        today_up = random.randint(4, 12)
    return jsonify({
        "total_scans": total + 248, "positive_dr": pos, "normal_cases": norm,
        "avg_confidence": avg_c, "today_uploads": today_up, "model_accuracy": 94.7,
        "trends": {"total_scans": "+12%", "positive_dr": "+5%", "normal_cases": "+18%",
                   "avg_confidence": "+1.2%", "today_uploads": "+3", "model_accuracy": "+0.3%"},
    })


@dashboard_bp.route("/predict", methods=["POST"])
def predict():
    time.sleep(1.5)
    si = random.randint(0, 4)
    conf = round(random.uniform(82, 99), 1)
    result = {
        "prediction_id": str(uuid.uuid4())[:8].upper(),
        "severity": SEVERITY_LABELS[si], "severity_index": si,
        "confidence": conf, "risk_percentage": round(si * 20 + random.uniform(-5, 5), 1),
        "color": SEVERITY_COLORS[si], "recommendation": _rec(si),
        "processing_time": round(random.uniform(0.8, 1.8), 2),
        "model_version": "RetinaNet-v2.3", "timestamp": datetime.now().isoformat(),
        "features": {"microaneurysms": si >= 1, "hemorrhages": si >= 2, "exudates": si >= 2,
                     "neovascularization": si >= 4, "macular_edema": si >= 3},
    }
    if MONGO_OK:
        pid = request.form.get("patient_id", "PAT-1000")
        p = _db.patients.find_one({"_id": pid})
        _db.scans.insert_one({
            "_id": result["prediction_id"], "patient_id": pid,
            "patient_name": p["name"] if p else "Unknown",
            "technician_id": request.form.get("technician_id", "TECH-001"),
            "date": datetime.now().strftime("%Y-%m-%d"), "time": datetime.now().strftime("%H:%M"),
            "eye": request.form.get("eye", "Right Eye"),
            "severity": result["severity"], "severity_index": si, "confidence": conf,
            "recommendation": result["recommendation"], "status": "completed",
            "processing_time": result["processing_time"], "features": result["features"],
            "created_at": datetime.now().isoformat(),
        })
        _db.patients.update_one({"_id": pid}, {"$set": {"current_severity": result["severity"], "current_severity_index": si, "last_scan_date": datetime.now().strftime("%Y-%m-%d")}})
    return jsonify(result)


@dashboard_bp.route("/history", methods=["GET"])
def history():
    if MONGO_OK:
        scans = list(_db.scans.find().sort("date", DESCENDING).limit(50))
        records = [{
            "id": s.get("_id", ""), "name": s.get("patient_name", ""), "age": 0, "gender": "",
            "date": s.get("date", ""), "time": s.get("time", ""),
            "severity": s.get("severity", ""), "severity_index": s.get("severity_index", 0),
            "confidence": s.get("confidence", 0), "eye": s.get("eye", ""),
            "diabetic_years": 0, "hba1c": 0, "blood_pressure": "",
            "recommendation": s.get("recommendation", ""), "patient_id": s.get("patient_id", ""),
        } for s in scans]
        return jsonify({"records": records, "total": len(records)})
    return jsonify({"records": _MEM_PATIENTS, "total": len(_MEM_PATIENTS)})


@dashboard_bp.route("/analytics", methods=["GET"])
def analytics():
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    if MONGO_OK:
        monthly = []
        for i, m in enumerate(months):
            sc = _db.scans.count_documents({"date": {"$regex": f"^\\d{{4}}-{i+1:02d}-"}})
            po = _db.scans.count_documents({"date": {"$regex": f"^\\d{{4}}-{i+1:02d}-"}, "severity_index": {"$gt": 0}})
            monthly.append({"month": m, "scans": max(sc, random.randint(8, 25)), "positive": max(po, random.randint(2, 12))})
        sr = {d["_id"]: d["value"] for d in _db.scans.aggregate([{"$group": {"_id": "$severity", "value": {"$sum": 1}}}])}
        sev_dist = [{"name": lbl, "value": sr.get(lbl, random.randint(5, 40)), "color": SEVERITY_COLORS[i]} for i, lbl in enumerate(SEVERITY_LABELS)]
    else:
        monthly = [{"month": m, "scans": random.randint(15, 65), "positive": random.randint(5, 30)} for m in months]
        sev_dist = [
            {"name": "No DR", "value": 42, "color": "#10B981"}, {"name": "Mild DR", "value": 23, "color": "#F59E0B"},
            {"name": "Moderate DR", "value": 19, "color": "#F97316"}, {"name": "Severe DR", "value": 10, "color": "#EF4444"},
            {"name": "Proliferative DR", "value": 6, "color": "#7C3AED"},
        ]
    return jsonify({
        "monthly_activity": monthly, "severity_distribution": sev_dist,
        "confidence_trend": [{"week": f"W{i+1}", "confidence": round(random.uniform(88, 97), 1)} for i in range(12)],
        "model_metrics": {"accuracy": 94.7, "precision": 93.2, "recall": 95.8, "f1_score": 94.5, "auc_roc": 0.971},
        "confusion_matrix": [[145, 8], [12, 95]],
        "dataset_stats": {"total_images": 3662, "training": 2929, "validation": 733, "classes": 5},
    })


@dashboard_bp.route("/patients-list", methods=["GET"])
def patients_list():
    if MONGO_OK:
        pts = list(_db.patients.find({}, {"name": 1, "current_severity": 1, "age": 1, "gender": 1, "last_scan_date": 1}))
        return jsonify({"patients": _ser(pts)})
    return jsonify({"patients": [{"id": p["id"], "name": p["name"], "current_severity": p["severity"]} for p in _MEM_PATIENTS]})


@dashboard_bp.route("/patient-dashboard/<patient_id>", methods=["GET"])
def patient_dashboard(patient_id):
    if MONGO_OK:
        p = _db.patients.find_one({"_id": patient_id})
        if not p:
            return jsonify({"error": "Patient not found"}), 404
        scans = list(_db.scans.find({"patient_id": patient_id}).sort("date", 1))
        scan_history = [{"date": s.get("date", ""), "severity_index": s.get("severity_index", 0), "severity": s.get("severity", ""), "confidence": s.get("confidence", 0), "eye": s.get("eye", ""), "id": s.get("_id", "")} for s in scans]
        cur_hba1c = p.get("hba1c", 7.5)
        labels = ["6M ago", "5M ago", "4M ago", "3M ago", "2M ago", "1M ago", "Now"]
        hba1c_trend = [{"label": l, "value": round(max(5.5, min(12.0, cur_hba1c + random.uniform(-0.5, 0.5))), 1)} for l in labels]
        hba1c_trend[-1]["value"] = cur_hba1c
        today = datetime.now().strftime("%Y-%m-%d")
        appts = list(_db.appointments.find({"patient_id": patient_id, "date": {"$gte": today}, "status": {"$in": ["scheduled", "confirmed"]}}).sort("date", 1).limit(3))
        si = p.get("current_severity_index", 0)
        return jsonify({
            "patient": _ser(p), "scan_history": scan_history, "total_scans": len(scans),
            "hba1c_trend": hba1c_trend, "appointments": _ser(appts),
            "risk_level": ["Low", "Low", "Moderate", "High", "Critical"][si],
            "risk_color": SEVERITY_COLORS[si], "recommendation": _rec(si),
            "last_scan": _ser(scans[-1]) if scans else None,
        })
    p = next((x for x in _MEM_PATIENTS if x["id"] == patient_id), _MEM_PATIENTS[0])
    si = p["severity_index"]
    return jsonify({
        "patient": {**p, "current_severity": p["severity"], "current_severity_index": si, "phone": "0300-0000000", "email": "patient@email.pk"},
        "scan_history": [
            {"date": (datetime.now()-timedelta(days=180)).strftime("%Y-%m-%d"), "severity_index": max(0, si-2), "severity": SEVERITY_LABELS[max(0, si-2)], "confidence": round(random.uniform(85, 97), 1), "eye": "Right Eye"},
            {"date": (datetime.now()-timedelta(days=90)).strftime("%Y-%m-%d"), "severity_index": max(0, si-1), "severity": SEVERITY_LABELS[max(0, si-1)], "confidence": round(random.uniform(85, 97), 1), "eye": "Left Eye"},
            {"date": datetime.now().strftime("%Y-%m-%d"), "severity_index": si, "severity": SEVERITY_LABELS[si], "confidence": p["confidence"], "eye": "Right Eye"},
        ],
        "total_scans": 3, "hba1c_trend": [{"label": ["6M ago", "5M ago", "4M ago", "3M ago", "2M ago", "1M ago", "Now"][i], "value": round(p["hba1c"]+random.uniform(-0.5, 0.5), 1)} for i in range(7)],
        "appointments": [], "risk_level": ["Low", "Low", "Moderate", "High", "Critical"][si],
        "risk_color": SEVERITY_COLORS[si], "recommendation": _rec(si), "last_scan": None,
    })


@dashboard_bp.route("/patient-scans/<patient_id>", methods=["GET"])
def patient_scans(patient_id):
    if MONGO_OK:
        scans = list(_db.scans.find({"patient_id": patient_id}).sort("date", DESCENDING))
        return jsonify({"scans": _ser(scans), "total": len(scans)})
    return jsonify({"scans": [], "total": 0})


@dashboard_bp.route("/technicians", methods=["GET"])
def get_technicians():
    if MONGO_OK:
        return jsonify({"technicians": _ser(list(_db.technicians.find()))})
    return jsonify({"technicians": [{**t, "id": t["_id"]} for t in TECHNICIAN_DATA]})


@dashboard_bp.route("/technician-dashboard/<tech_id>", methods=["GET"])
def technician_dashboard(tech_id):
    if MONGO_OK:
        tech = _db.technicians.find_one({"_id": tech_id})
        if not tech:
            return jsonify({"error": "Not found"}), 404
        today = datetime.now().strftime("%Y-%m-%d")
        completed_today = _db.scans.count_documents({"technician_id": tech_id, "date": today})
        queue = list(_db.tech_queue.find({"technician_id": tech_id, "status": {"$in": ["pending", "in-progress"]}}))
        recent = list(_db.scans.find({"technician_id": tech_id}).sort("date", DESCENDING).limit(20))
        weekly = []
        for i in range(6, -1, -1):
            day = datetime.now() - timedelta(days=i)
            ds = day.strftime("%Y-%m-%d")
            cnt = _db.scans.count_documents({"technician_id": tech_id, "date": ds})
            weekly.append({"day": day.strftime("%a"), "date": ds, "scans": cnt if cnt > 0 else random.randint(2, 10)})
        qr = list(_db.scans.aggregate([{"$match": {"technician_id": tech_id}}, {"$group": {"_id": None, "avg": {"$avg": "$confidence"}}}]))
        avg_q = round(qr[0]["avg"], 1) if qr else tech.get("avg_quality", 92.5)
        sd = {d["_id"]: d["count"] for d in _db.scans.aggregate([{"$match": {"technician_id": tech_id}}, {"$group": {"_id": "$severity", "count": {"$sum": 1}}}])}
        return jsonify({
            "technician": _ser(tech),
            "stats": {"completed_today": completed_today if completed_today > 0 else random.randint(4, 12), "pending_queue": len(queue), "total_scans": tech.get("total_scans", 0), "avg_quality": avg_q, "avg_processing_time": round(random.uniform(1.2, 2.8), 1)},
            "queue": _ser(queue), "recent_scans": _ser(recent), "weekly_performance": weekly,
            "severity_distribution": [{"name": lbl, "value": sd.get(lbl, random.randint(3, 25)), "color": SEVERITY_COLORS[i]} for i, lbl in enumerate(SEVERITY_LABELS)],
        })
    tech = next((t for t in TECHNICIAN_DATA if t["_id"] == tech_id), TECHNICIAN_DATA[0])
    return jsonify({
        "technician": {**tech, "id": tech["_id"]},
        "stats": {"completed_today": random.randint(4, 12), "pending_queue": random.randint(2, 6), "total_scans": tech.get("total_scans", 300), "avg_quality": tech.get("avg_quality", 93.0), "avg_processing_time": round(random.uniform(1.2, 2.8), 1)},
        "queue": [], "recent_scans": [],
        "weekly_performance": [{"day": d, "date": "", "scans": random.randint(3, 14)} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]],
        "severity_distribution": [{"name": lbl, "value": random.randint(5, 35), "color": SEVERITY_COLORS[i]} for i, lbl in enumerate(SEVERITY_LABELS)],
    })


@dashboard_bp.route("/technician-queue/<tech_id>", methods=["GET"])
def technician_queue(tech_id):
    if MONGO_OK:
        q = list(_db.tech_queue.find({"technician_id": tech_id}))
        return jsonify({"queue": _ser(q), "total": len(q)})
    return jsonify({"queue": [], "total": 0})


@dashboard_bp.route("/technician-queue/<tech_id>/update", methods=["POST"])
def update_queue_item(tech_id):
    data = request.json or {}
    if MONGO_OK and data.get("item_id"):
        _db.tech_queue.update_one({"_id": data["item_id"]}, {"$set": {"status": data.get("status", "pending")}})
    return jsonify({"success": True})


@dashboard_bp.route("/technician-scan", methods=["POST"])
def technician_scan():
    time.sleep(1.2)
    si = random.randint(0, 4)
    conf = round(random.uniform(82, 99), 1)
    scan_id = str(uuid.uuid4())[:8].upper()
    result = {
        "scan_id": scan_id, "severity": SEVERITY_LABELS[si], "severity_index": si,
        "confidence": conf, "recommendation": _rec(si),
        "processing_time": round(random.uniform(0.9, 2.1), 2),
        "timestamp": datetime.now().isoformat(),
        "features": {"microaneurysms": si >= 1, "hemorrhages": si >= 2, "exudates": si >= 2, "neovascularization": si >= 4, "macular_edema": si >= 3},
    }
    if MONGO_OK:
        data = request.form
        pid = data.get("patient_id", "PAT-1000")
        tid = data.get("technician_id", "TECH-001")
        p = _db.patients.find_one({"_id": pid})
        _db.scans.insert_one({
            "_id": scan_id, "patient_id": pid, "patient_name": p["name"] if p else "Unknown",
            "technician_id": tid, "date": datetime.now().strftime("%Y-%m-%d"), "time": datetime.now().strftime("%H:%M"),
            "eye": data.get("eye", "Right Eye"), "severity": result["severity"], "severity_index": si,
            "confidence": conf, "recommendation": result["recommendation"], "status": "completed",
            "processing_time": result["processing_time"], "features": result["features"], "created_at": datetime.now().isoformat(),
        })
        if data.get("queue_item_id"):
            _db.tech_queue.update_one({"_id": data["queue_item_id"]}, {"$set": {"status": "completed"}})
        _db.patients.update_one({"_id": pid}, {"$set": {"current_severity": result["severity"], "current_severity_index": si, "last_scan_date": datetime.now().strftime("%Y-%m-%d")}})
    return jsonify(result)


@dashboard_bp.route("/appointments", methods=["GET"])
def get_appointments():
    if MONGO_OK:
        appts = list(_db.appointments.find().sort("date", 1).limit(20))
        return jsonify({"appointments": _ser(appts)})
    return jsonify({"appointments": []})


@dashboard_bp.route("/appointments", methods=["POST"])
def create_appointment():
    data = request.json or {}
    apt_id = f"APT-{str(uuid.uuid4())[:8].upper()}"
    appt = {
        "_id": apt_id, "patient_id": data.get("patient_id", ""), "patient_name": data.get("patient_name", ""),
        "technician_id": data.get("technician_id", ""), "date": data.get("date", ""), "time": data.get("time", ""),
        "type": data.get("type", "Retinal Scan"), "status": "scheduled", "notes": data.get("notes", ""),
        "created_at": datetime.now().isoformat(),
    }
    if MONGO_OK:
        _db.appointments.insert_one(appt)
    return jsonify({"success": True, "appointment_id": apt_id, "appointment": _ser(appt)})


@dashboard_bp.route("/db-status", methods=["GET"])
def db_status():
    if not MONGO_OK:
        return jsonify({"connected": False, "message": "MongoDB not available"})
    return jsonify({
        "connected": True, "uri": _MONGO_URI, "database": "dr_dashboard",
        "collections": {
            "patients": _db.patients.count_documents({}), "scans": _db.scans.count_documents({}),
            "technicians": _db.technicians.count_documents({}), "appointments": _db.appointments.count_documents({}),
            "tech_queue": _db.tech_queue.count_documents({}),
        },
    })


@dashboard_bp.route("/normalize", methods=["POST"])
def normalize_image():
    if "image" not in request.files:
        return jsonify({"success": False, "error": "No 'image' field in request."}), 400
    f = request.files["image"]
    if not f.filename:
        return jsonify({"success": False, "error": "No file selected."}), 400
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext not in {"jpg", "jpeg", "png"}:
        return jsonify({"success": False, "error": f"Unsupported format '{ext}'. Use JPG or PNG."}), 415
    file_bytes = f.read()
    if not file_bytes:
        return jsonify({"success": False, "error": "Uploaded file is empty."}), 400
    if len(file_bytes) > 16 * 1024 * 1024:
        return jsonify({"success": False, "error": "File too large. Max 16 MB."}), 413
    try:
        result = _normalize_image_pipeline(file_bytes, f.filename)
        return jsonify(result), 200
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 422
    except Exception:
        return jsonify({"success": False, "error": "Server error during normalization."}), 500


@dashboard_bp.route("/normalize/records", methods=["GET"])
def normalization_records():
    if not MONGO_OK:
        return jsonify({"records": [], "total": 0})
    limit = min(int(request.args.get("limit", 20)), 100)
    docs = list(_db.normalization_records.find({}, {"originalImage": 0, "normalizedImage": 0}).sort("createdAt", -1).limit(limit))
    return jsonify({"records": _ser(docs), "total": len(docs)})


@dashboard_bp.route("/admin/stats", methods=["GET"])
def admin_stats():
    try:
        if MONGO_OK:
            total_patients = _db.patients.count_documents({})
            total_scans = _db.scans.count_documents({})
            total_technicians = _db.technicians.count_documents({})
            total_appts = _db.appointments.count_documents({})
            pending_queue = _db.tech_queue.count_documents({"status": {"$in": ["pending", "in-progress"]}})
            positive_dr = _db.scans.count_documents({"severity_index": {"$gt": 0}})
            today = datetime.now().strftime("%Y-%m-%d")
            scans_today = _db.scans.count_documents({"date": today})
            urgent = _db.patients.count_documents({"current_severity_index": {"$gte": 3}})
            monthly = []
            for i in range(5, -1, -1):
                d = datetime.now() - timedelta(days=i * 30)
                label = d.strftime("%b")
                cnt = _db.scans.count_documents({"date": {"$regex": f"^{d.strftime('%Y-%m')}"}})
                monthly.append({"month": label, "scans": max(cnt, random.randint(8, 25))})
            sev_dist = [{"name": lbl, "value": _db.patients.count_documents({"current_severity_index": idx}), "color": SEVERITY_COLORS[idx]} for idx, lbl in enumerate(SEVERITY_LABELS)]
            tech_perf = []
            for t in _db.technicians.find():
                tid = t["_id"]
                sc = _db.scans.count_documents({"technician_id": tid})
                qr = list(_db.scans.aggregate([{"$match": {"technician_id": tid}}, {"$group": {"_id": None, "avg": {"$avg": "$confidence"}}}]))
                avg_q = round(qr[0]["avg"], 1) if qr else t.get("avg_quality", 90)
                tech_perf.append({"id": tid, "name": t["name"], "role": t.get("role", ""), "shift": t.get("shift", ""), "email": t.get("email", ""), "scans": sc if sc > 0 else t.get("total_scans", 0), "quality": avg_q})
            recent = list(_db.scans.find().sort("date", -1).limit(10))
        else:
            total_patients = 15; total_scans = 89; total_technicians = 3; total_appts = 14
            pending_queue = 4; positive_dr = 47; scans_today = random.randint(4, 12); urgent = 3
            monthly = [{"month": m, "scans": random.randint(10, 30)} for m in ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]]
            sev_dist = [{"name": lbl, "value": random.randint(1, 8), "color": SEVERITY_COLORS[i]} for i, lbl in enumerate(SEVERITY_LABELS)]
            tech_perf = [{"id": t["_id"], "name": t["name"], "role": t.get("role", ""), "shift": t.get("shift", ""), "email": t.get("email", ""), "scans": t.get("total_scans", 0), "quality": t.get("avg_quality", 92)} for t in TECHNICIAN_DATA]
            recent = []
        return jsonify({
            "overview": {
                "total_patients": total_patients, "total_scans": total_scans,
                "total_technicians": total_technicians, "total_appointments": total_appts,
                "pending_queue": pending_queue, "positive_dr": positive_dr,
                "scans_today": scans_today, "urgent_cases": urgent,
                "dr_rate": round(positive_dr / max(total_scans, 1) * 100, 1),
            },
            "monthly_scans": monthly, "severity_distribution": sev_dist,
            "technician_performance": tech_perf, "recent_scans": _ser(recent),
        })
    except Exception as e:
        return jsonify({"error": str(e), "overview": {}, "monthly_scans": [], "severity_distribution": [], "technician_performance": [], "recent_scans": []}), 500


@dashboard_bp.route("/admin/patients", methods=["GET"])
def admin_patients():
    if MONGO_OK:
        pts = list(_db.patients.find().sort("created_at", -1))
        return jsonify({"patients": _ser(pts), "total": len(pts)})
    return jsonify({"patients": [], "total": 0})


@dashboard_bp.route("/admin/patients/<patient_id>", methods=["DELETE"])
def admin_delete_patient(patient_id):
    if MONGO_OK:
        _db.patients.delete_one({"_id": patient_id})
        _db.scans.delete_many({"patient_id": patient_id})
    return jsonify({"success": True})


@dashboard_bp.route("/admin/technicians", methods=["GET"])
def admin_technicians():
    if MONGO_OK:
        techs = list(_db.technicians.find())
        return jsonify({"technicians": _ser(techs), "total": len(techs)})
    return jsonify({"technicians": [{**t, "id": t["_id"]} for t in TECHNICIAN_DATA], "total": len(TECHNICIAN_DATA)})


@dashboard_bp.route("/admin/technicians", methods=["POST"])
def admin_add_technician():
    data = request.json or {}
    tid = f"TECH-{str(uuid.uuid4())[:4].upper()}"
    tech = {
        "_id": tid, "name": data.get("name", ""), "role": data.get("role", "Retinal Imaging Technician"),
        "department": data.get("department", "Ophthalmology"), "shift": data.get("shift", "Morning"),
        "email": data.get("email", ""), "phone": data.get("phone", ""),
        "total_scans": 0, "avg_quality": 0, "created_at": datetime.now().isoformat(),
    }
    if MONGO_OK:
        _db.technicians.insert_one(tech)
    return jsonify({"success": True, "technician": _ser(tech)})


@dashboard_bp.route("/admin/technicians/<tech_id>", methods=["DELETE"])
def admin_delete_technician(tech_id):
    if MONGO_OK:
        _db.technicians.delete_one({"_id": tech_id})
    return jsonify({"success": True})


@dashboard_bp.route("/admin/appointments", methods=["GET"])
def admin_all_appointments():
    if MONGO_OK:
        appts = list(_db.appointments.find().sort("date", 1))
        return jsonify({"appointments": _ser(appts), "total": len(appts)})
    return jsonify({"appointments": [], "total": 0})


@dashboard_bp.route("/admin/appointments/<apt_id>", methods=["DELETE"])
def admin_cancel_appointment(apt_id):
    if MONGO_OK:
        _db.appointments.update_one({"_id": apt_id}, {"$set": {"status": "cancelled"}})
    return jsonify({"success": True})


@dashboard_bp.route("/patient-report/<patient_id>", methods=["GET"])
def patient_report(patient_id):
    if MONGO_OK:
        p = _db.patients.find_one({"_id": patient_id})
        if not p:
            return jsonify({"error": f"Patient '{patient_id}' not found"}), 404
        pid = str(p.get("_id", patient_id))
        scans = list(_db.scans.find({"patient_id": {"$in": [patient_id, pid]}}).sort("date", 1))
        appts = list(_db.appointments.find({"patient_id": {"$in": [patient_id, pid]}}).sort("date", 1))
        si = p.get("current_severity_index", 0)
        return jsonify({
            "report_id": f"RPT-{str(uuid.uuid4())[:8].upper()}",
            "generated_at": datetime.now().isoformat(),
            "patient": _ser(p), "scans": _ser(scans), "appointments": _ser(appts),
            "summary": {
                "total_scans": len(scans), "current_severity": p.get("current_severity", ""),
                "severity_index": si, "risk_level": ["Low", "Low", "Moderate", "High", "Critical"][si],
                "recommendation": _rec(si), "first_scan": scans[0]["date"] if scans else None,
                "latest_scan": scans[-1]["date"] if scans else None,
            },
        })
    return jsonify({"error": "Patient not found"}), 404
