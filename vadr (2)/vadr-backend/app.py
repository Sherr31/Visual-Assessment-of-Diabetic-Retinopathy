"""
VADR API — patients, staff, and JSON auth compatible with werkzeug password
hashing (same approach as flask-base User model).
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import random
import string
import os
import smtplib
import ssl
import logging
from pathlib import Path

from dotenv import load_dotenv

# Load `vadr-backend/.env` once (works even if you run `python venv/app.py`)
_env_dir = Path(__file__).resolve().parent
if _env_dir.name == "venv":
    _env_dir = _env_dir.parent
load_dotenv(_env_dir / ".env")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-vadr-secret-change-in-production")
CORS(app)

MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://taha757:Taharao123@vadr.elfsv9q.mongodb.net/vadr_db?retryWrites=true&w=majority",
)
client = MongoClient(MONGO_URI)
db = client["vadr_db"]

patients_col = db["patients"]
users_col = db["users"]
pending_reg_col = db["registration_pending"]

DEMO_STAFF_EMAILS = (
    "admin@vadr.pk",
    "ayesha@vadr.pk",
    "bilal@vadr.pk",
    "sara@vadr.pk",
)
DEMO_PASSWORD = "admin123"

REG_CODE_EXPIRES_MIN = int(os.environ.get("VADR_REG_CODE_EXPIRES_MIN", "30"))
REG_RESEND_COOLDOWN_SEC = int(os.environ.get("VADR_REG_RESEND_COOLDOWN_SEC", "60"))
REG_MAX_VERIFY_FAILS = int(os.environ.get("VADR_REG_MAX_VERIFY_FAILS", "8"))


def _utcnow():
    """Naive UTC for MongoDB comparisons (avoids deprecated datetime.utcnow())."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _smtp_port_fallbacks(primary_port: int):
    """Brevo: port 587 is often blocked on networks; 2525 uses STARTTLS too."""
    ports = [primary_port]
    if os.environ.get("MAIL_SMTP_TRY_FALLBACK", "true").lower() not in ("1", "true", "yes"):
        return ports
    if primary_port == 587 and 2525 not in ports:
        ports.append(2525)
    elif primary_port == 2525 and 587 not in ports:
        ports.append(587)
    return ports


def _smtp_send_message(msg: EmailMessage, cfg: dict) -> tuple[bool, str | None]:
    host = cfg["host"]
    port0 = cfg["port"]
    user = cfg["user"]
    password = cfg["password"]
    use_tls = cfg["use_tls"]
    timeout = int(os.environ.get("MAIL_SMTP_TIMEOUT", "45"))
    last_err: Exception | None = None

    for port in _smtp_port_fallbacks(port0):
        try:
            if port == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(host, port, timeout=timeout, context=context) as smtp:
                    smtp.login(user, password)
                    smtp.send_message(msg)
            elif use_tls:
                context = ssl.create_default_context()
                with smtplib.SMTP(host, port, timeout=timeout) as smtp:
                    smtp.ehlo()
                    smtp.starttls(context=context)
                    smtp.ehlo()
                    smtp.login(user, password)
                    smtp.send_message(msg)
            else:
                with smtplib.SMTP(host, port, timeout=timeout) as smtp:
                    smtp.login(user, password)
                    smtp.send_message(msg)
            if port != port0:
                logging.getLogger("vadr.mail").info(
                    "SMTP send succeeded on port %s (primary %s was unreachable or failed)", port, port0
                )
            return True, None
        except Exception as exc:
            last_err = exc
            logging.getLogger("vadr.mail").warning("SMTP attempt %s:%s — %s", host, port, exc)

    return False, str(last_err) if last_err else "SMTP connection failed"


def _smtp_settings():
    return {
        "host": (os.environ.get("MAIL_SERVER") or os.environ.get("SMTP_HOST") or "").strip(),
        "port": int(os.environ.get("MAIL_PORT") or os.environ.get("SMTP_PORT") or "587"),
        "user": (os.environ.get("MAIL_USERNAME") or os.environ.get("SMTP_USER") or "").strip(),
        "password": (os.environ.get("MAIL_PASSWORD") or os.environ.get("SMTP_PASSWORD") or "").strip(),
        "use_tls": os.environ.get("MAIL_USE_TLS", "true").lower() in ("1", "true", "yes"),
        "sender": (
            os.environ.get("MAIL_DEFAULT_SENDER")
            or os.environ.get("MAIL_FROM")
            or os.environ.get("SMTP_FROM")
            or ""
        ).strip(),
    }


def _gen_registration_code():
    return "".join(random.choices(string.digits, k=6))


def send_registration_verification_email(to_email: str, code: str, display_name: str):
    """
    Send 6-digit code via SMTP. Configure MAIL_SERVER, MAIL_PORT, MAIL_USE_TLS,
    MAIL_USERNAME, MAIL_PASSWORD, MAIL_DEFAULT_SENDER (or SMTP_* equivalents).

    If SMTP is not configured, logs a warning. Set VADR_LOG_EMAIL_CODE=1 to log
    the code to the server log for local development.
    """
    cfg = _smtp_settings()
    log_code = os.environ.get("VADR_LOG_EMAIL_CODE", "").lower() in ("1", "true", "yes")
    if log_code:
        logging.getLogger("vadr.mail").warning("VADR registration code for %s: %s", to_email, code)

    if not cfg["host"] or not cfg["sender"]:
        return False, "SMTP is not configured (set MAIL_SERVER and MAIL_DEFAULT_SENDER)."
    if not cfg["user"]:
        return False, "SMTP username not set (MAIL_USERNAME)."

    body = (
        f"Hi {display_name},\n\n"
        f"Your VADR verification code is: {code}\n\n"
        f"This code expires in {REG_CODE_EXPIRES_MIN} minutes.\n"
        f"If you did not request this, you can ignore this email.\n"
    )
    msg = EmailMessage()
    msg["Subject"] = "Verify your VADR registration"
    msg["From"] = cfg["sender"]
    msg["To"] = to_email
    msg.set_content(body)

    ok, err = _smtp_send_message(msg, cfg)
    if not ok:
        logging.getLogger("vadr.mail").error("SMTP send failed after fallbacks: %s", err)
    return ok, err


def _token_serializer():
    return URLSafeTimedSerializer(app.config["SECRET_KEY"])


def issue_token(user_doc):
    s = _token_serializer()
    return s.dumps(
        {"id": user_doc["id"], "email": user_doc.get("email", ""), "role": user_doc.get("role", "")}
    )


def verify_token(token, max_age=60 * 60 * 24 * 7):
    s = _token_serializer()
    return s.loads(token, max_age=max_age)


def migrate_demo_password_hashes():
    """Give legacy seeded demo accounts a login password (dev / first-run)."""
    ph = generate_password_hash(DEMO_PASSWORD)
    for email in DEMO_STAFF_EMAILS:
        users_col.update_one(
            {"email": email, "password_hash": {"$exists": False}},
            {"$set": {"password_hash": ph}},
        )


migrate_demo_password_hashes()


def serialize(doc):
    if not doc:
        return doc
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    out.pop("password_hash", None)
    return out


def gen_patient_id():
    count = patients_col.count_documents({})
    return f"VADR-{str(count + 1).zfill(4)}"


def gen_password():
    digits = "".join(random.choices(string.digits, k=4))
    return f"VADR@{digits}"


def today():
    return datetime.today().strftime("%Y-%m-%d")


# ══════════════════════════════════════════════════════════════════════════════
# AUTH (JSON API — same password hashing as flask-base User model)
# ══════════════════════════════════════════════════════════════════════════════


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    """Start registration: validate input, store pending record, email 6-digit code."""
    data = request.get_json() or {}
    required = ["name", "email", "password", "role"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    email = data["email"].strip().lower()
    role = data["role"]
    if role not in ("admin", "doctor", "technician"):
        return jsonify({"error": "role must be admin, doctor, or technician"}), 400

    if users_col.find_one({"email": email}):
        return jsonify({"error": "A user with this email already exists"}), 409

    pending_reg_col.delete_many({"email": email})
    pending_reg_col.delete_many({"expires_at": {"$lt": _utcnow()}})

    code = _gen_registration_code()
    code_hash = generate_password_hash(code)
    expires_at = _utcnow() + timedelta(minutes=REG_CODE_EXPIRES_MIN)
    now = _utcnow()

    payload = {
        "name": (data.get("name") or "").strip(),
        "password_hash": generate_password_hash(data["password"]),
        "role": role,
        "department": (data.get("department") or "").strip(),
        "phone": (data.get("phone") or "").strip(),
        "status": data.get("status", "active"),
    }

    pending_reg_col.insert_one(
        {
            "email": email,
            "code_hash": code_hash,
            "expires_at": expires_at,
            "last_sent_at": now,
            "verify_failures": 0,
            "payload": payload,
        }
    )

    ok, err = send_registration_verification_email(email, code, payload["name"])
    resp = {
        "verificationRequired": True,
        "email": email,
        "emailSent": ok,
        "expiresInMinutes": REG_CODE_EXPIRES_MIN,
        "message": "We emailed a 6-digit verification code to your address."
        if ok
        else "We could not send email. Check SMTP settings or server logs (VADR_LOG_EMAIL_CODE=1 for dev).",
    }
    if err and not ok:
        resp["emailError"] = err
    return jsonify(resp), 200


@app.route("/api/auth/verify-registration", methods=["POST"])
def auth_verify_registration():
    """Complete registration with email + 6-digit code; returns token like login."""
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip().replace(" ", "")
    if not email or not code:
        return jsonify({"error": "email and code are required"}), 400
    if not code.isdigit() or len(code) != 6:
        return jsonify({"error": "code must be a 6-digit number"}), 400

    doc = pending_reg_col.find_one({"email": email})
    if not doc:
        return jsonify({"error": "No pending registration for this email. Register again."}), 404

    if doc["expires_at"] < _utcnow():
        pending_reg_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "Verification code expired. Register again."}), 410

    fails = doc.get("verify_failures") or 0
    if fails >= REG_MAX_VERIFY_FAILS:
        pending_reg_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "Too many failed attempts. Please register again."}), 429

    if not check_password_hash(doc["code_hash"], code):
        pending_reg_col.update_one({"_id": doc["_id"]}, {"$inc": {"verify_failures": 1}})
        return jsonify({"error": "Invalid verification code"}), 400

    pl = doc["payload"]
    if users_col.find_one({"email": email}):
        pending_reg_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "A user with this email already exists"}), 409

    new_user = {
        "id": "u" + "".join(random.choices(string.ascii_lowercase + string.digits, k=5)),
        "name": pl["name"],
        "email": email,
        "password_hash": pl["password_hash"],
        "phone": pl.get("phone", ""),
        "role": pl["role"],
        "department": pl.get("department", ""),
        "status": pl.get("status", "active"),
        "joined": today(),
        "lastLogin": "Never",
        "email_verified": True,
    }
    result = users_col.insert_one(new_user)
    pending_reg_col.delete_one({"_id": doc["_id"]})
    new_user["_id"] = str(result.inserted_id)
    token = issue_token(new_user)
    return jsonify({"token": token, "user": serialize(new_user)}), 201


@app.route("/api/auth/resend-registration-code", methods=["POST"])
def auth_resend_registration_code():
    """Resend verification code if still within pending window (rate limited)."""
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email is required"}), 400

    doc = pending_reg_col.find_one({"email": email})
    if not doc:
        return jsonify({"error": "No pending registration for this email."}), 404

    if doc["expires_at"] < _utcnow():
        pending_reg_col.delete_one({"_id": doc["_id"]})
        return jsonify({"error": "Registration expired. Please register again."}), 410

    last = doc.get("last_sent_at") or _utcnow()
    if (_utcnow() - last).total_seconds() < REG_RESEND_COOLDOWN_SEC:
        wait = int(REG_RESEND_COOLDOWN_SEC - (_utcnow() - last).total_seconds())
        return jsonify({"error": f"Please wait {wait} seconds before resending."}), 429

    code = _gen_registration_code()
    code_hash = generate_password_hash(code)
    expires_at = _utcnow() + timedelta(minutes=REG_CODE_EXPIRES_MIN)
    pending_reg_col.update_one(
        {"_id": doc["_id"]},
        {"$set": {"code_hash": code_hash, "expires_at": expires_at, "last_sent_at": _utcnow(), "verify_failures": 0}},
    )

    ok, err = send_registration_verification_email(email, code, doc["payload"].get("name", ""))
    return jsonify(
        {
            "emailSent": ok,
            "message": "A new code has been sent." if ok else "Could not send email.",
            **({"emailError": err} if err and not ok else {}),
        }
    ), 200


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = users_col.find_one({"email": email})
    if not user or not user.get("password_hash"):
        return jsonify({"error": "Invalid email or password"}), 401
    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401
    if user.get("status") == "inactive":
        return jsonify({"error": "Account is inactive"}), 403

    users_col.update_one({"id": user["id"]}, {"$set": {"lastLogin": today()}})
    user = users_col.find_one({"id": user["id"]})
    token = issue_token(user)
    return jsonify({"token": token, "user": serialize(user)}), 200


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    raw = auth[7:].strip()
    try:
        payload = verify_token(raw)
    except SignatureExpired:
        return jsonify({"error": "Token expired"}), 401
    except BadSignature:
        return jsonify({"error": "Invalid token"}), 401

    user = users_col.find_one({"id": payload.get("id")})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(serialize(user)), 200


# ══════════════════════════════════════════════════════════════════════════════
# PATIENT ROUTES
# ══════════════════════════════════════════════════════════════════════════════


@app.route("/api/patients", methods=["GET"])
def get_patients():
    patients = list(patients_col.find())
    return jsonify([serialize(p) for p in patients]), 200


@app.route("/api/patients/<patient_id>", methods=["GET"])
def get_patient(patient_id):
    patient = patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(serialize(patient)), 200


@app.route("/api/patients", methods=["POST"])
def register_patient():
    data = request.get_json()

    required = ["name", "email", "phone", "assignedDoctor"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    if patients_col.find_one({"email": data["email"]}):
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
        "tempPassword": gen_password(),
    }

    result = patients_col.insert_one(new_patient)
    new_patient["_id"] = str(result.inserted_id)
    return jsonify(new_patient), 201


@app.route("/api/patients/<patient_id>", methods=["PUT"])
def update_patient(patient_id):
    data = request.get_json()
    data.pop("_id", None)
    data.pop("patientId", None)

    result = patients_col.update_one({"patientId": patient_id}, {"$set": data})
    if result.matched_count == 0:
        return jsonify({"error": "Patient not found"}), 404

    updated = patients_col.find_one({"patientId": patient_id})
    return jsonify(serialize(updated)), 200


@app.route("/api/patients/<patient_id>/status", methods=["PATCH"])
def toggle_patient_status(patient_id):
    patient = patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    new_status = "inactive" if patient["status"] == "active" else "active"
    patients_col.update_one({"patientId": patient_id}, {"$set": {"status": new_status}})
    return jsonify({"status": new_status}), 200


@app.route("/api/patients/<patient_id>/send-credentials", methods=["PATCH"])
def send_credentials(patient_id):
    patient = patients_col.find_one({"patientId": patient_id})
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    patients_col.update_one(
        {"patientId": patient_id},
        {"$set": {"credentialsSent": True, "credentialsSentOn": today()}},
    )
    return jsonify({"message": "Credentials marked as sent", "email": patient["email"]}), 200


@app.route("/api/patients/<patient_id>", methods=["DELETE"])
def delete_patient(patient_id):
    """Permanently remove a patient by business id (e.g. VADR-0001)."""
    result = patients_col.delete_one({"patientId": patient_id})
    if result.deleted_count == 0:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify({"message": "Patient deleted", "patientId": patient_id}), 200


# ══════════════════════════════════════════════════════════════════════════════
# USER / STAFF ROUTES
# ══════════════════════════════════════════════════════════════════════════════


@app.route("/api/users", methods=["GET"])
def get_users():
    users = list(users_col.find())
    return jsonify([serialize(u) for u in users]), 200


@app.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = users_col.find_one({"id": user_id})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(serialize(user)), 200


@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.get_json()

    required = ["name", "email", "role"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    email = data["email"].strip().lower()
    if users_col.find_one({"email": email}):
        return jsonify({"error": "A user with this email already exists"}), 409

    new_user = {
        "id": "u" + "".join(random.choices(string.ascii_lowercase + string.digits, k=5)),
        "name": data.get("name"),
        "email": email,
        "phone": data.get("phone", ""),
        "role": data.get("role"),
        "department": data.get("department", ""),
        "status": data.get("status", "active"),
        "joined": today(),
        "lastLogin": "Never",
    }
    if data.get("password"):
        new_user["password_hash"] = generate_password_hash(data["password"])

    result = users_col.insert_one(new_user)
    new_user["_id"] = str(result.inserted_id)
    return jsonify(serialize(new_user)), 201


@app.route("/api/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.get_json()
    data.pop("_id", None)
    data.pop("id", None)
    if "password" in data and data["password"]:
        data["password_hash"] = generate_password_hash(data.pop("password"))
    elif "password" in data:
        data.pop("password", None)

    result = users_col.update_one({"id": user_id}, {"$set": data})
    if result.matched_count == 0:
        return jsonify({"error": "User not found"}), 404

    updated = users_col.find_one({"id": user_id})
    return jsonify(serialize(updated)), 200


@app.route("/api/users/<user_id>/status", methods=["PATCH"])
def toggle_user_status(user_id):
    if user_id == "u1":
        return jsonify({"error": "Cannot deactivate main admin"}), 403

    user = users_col.find_one({"id": user_id})
    if not user:
        return jsonify({"error": "User not found"}), 404

    new_status = "inactive" if user["status"] == "active" else "active"
    users_col.update_one({"id": user_id}, {"$set": {"status": new_status}})
    return jsonify({"status": new_status}), 200


@app.route("/api/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    if user_id == "u1":
        return jsonify({"error": "Cannot delete main admin"}), 403

    result = users_col.delete_one({"id": user_id})
    if result.deleted_count == 0:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"message": "User deleted"}), 200


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "VADR Backend Running", "db": "connected"}), 200


@app.route("/api/seed", methods=["GET", "POST"])
def seed():
    if users_col.count_documents({}) > 0:
        return jsonify({"message": "Already seeded"}), 200

    ph = generate_password_hash(DEMO_PASSWORD)
    seed_users = [
        {
            "id": "u1",
            "role": "admin",
            "name": "Dr. Admin Khan",
            "email": "admin@vadr.pk",
            "password_hash": ph,
            "phone": "0300-1234567",
            "status": "active",
            "joined": "2025-01-10",
            "department": "Administration",
            "lastLogin": "2026-04-22",
        },
        {
            "id": "u2",
            "role": "doctor",
            "name": "Dr. Ayesha Noor",
            "email": "ayesha@vadr.pk",
            "password_hash": ph,
            "phone": "0301-9876543",
            "status": "active",
            "joined": "2025-03-15",
            "department": "Ophthalmology",
            "lastLogin": "2026-04-23",
        },
        {
            "id": "u3",
            "role": "doctor",
            "name": "Dr. Bilal Raza",
            "email": "bilal@vadr.pk",
            "password_hash": ph,
            "phone": "0312-5556677",
            "status": "inactive",
            "joined": "2025-06-01",
            "department": "Ophthalmology",
            "lastLogin": "2026-03-10",
        },
        {
            "id": "u4",
            "role": "technician",
            "name": "Sara Malik",
            "email": "sara@vadr.pk",
            "password_hash": ph,
            "phone": "0333-1122334",
            "status": "active",
            "joined": "2025-07-20",
            "department": "Imaging",
            "lastLogin": "2026-04-24",
        },
    ]
    users_col.insert_many(seed_users)
    return jsonify({"message": "Seeded successfully", "demo_password": DEMO_PASSWORD}), 201


if __name__ == "__main__":
    app.run(debug=True, port=5000)
