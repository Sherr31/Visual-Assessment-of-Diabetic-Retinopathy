import sys, os
from datetime import datetime, timezone

# Let's import our app and test the auth matrix and endpoints
from vadr_backend import create_app, db
from vadr_backend.services import report_service, auth_service

app = create_app()
client = app.test_client()

print("=== 1. PREPARING TEST USERS AND TOKENS ===")
# Doctor
doc_user = db.users_col.find_one({"role": "doctor"})
if not doc_user:
    doc_id = "test-doc-1"
    db.users_col.insert_one({"id": doc_id, "email": "testdoctor@vadr.pk", "name": "Dr. Test Ayesha", "role": "doctor", "department": "Retina Specialist"})
    doc_user = db.users_col.find_one({"id": doc_id})

# Admin
admin_user = db.users_col.find_one({"role": "admin"})
if not admin_user:
    admin_id = "test-admin-1"
    db.users_col.insert_one({"id": admin_id, "email": "testadmin@vadr.pk", "name": "System Admin", "role": "admin"})
    admin_user = db.users_col.find_one({"id": admin_id})

# Screener
screener_user = db.users_col.find_one({"role": "screener"})
if not screener_user:
    screener_id = "test-screener-1"
    db.users_col.insert_one({"id": screener_id, "email": "testscreener@vadr.pk", "name": "Screening Tech", "role": "screener"})
    screener_user = db.users_col.find_one({"id": screener_id})

# Patient A
db.users_col.update_one(
    {"email": "patient_a@vadr.pk"},
    {"$set": {"id": "usr-pat-a", "email": "patient_a@vadr.pk", "name": "Patient Alpha", "role": "patient", "patient_id": "PAT-ALPHA-01"}},
    upsert=True
)
pat_a_user = db.users_col.find_one({"email": "patient_a@vadr.pk"})
db.patients_col.update_one({"patientId": "PAT-ALPHA-01"}, {"$set": {"patientId": "PAT-ALPHA-01", "name": "Patient Alpha", "email": "patient_a@vadr.pk", "age": 54, "gender": "Male", "diabetesType": "Type 2", "hba1c": "7.2"}}, upsert=True)

# Patient B
db.users_col.update_one(
    {"email": "patient_b@vadr.pk"},
    {"$set": {"id": "usr-pat-b", "email": "patient_b@vadr.pk", "name": "Patient Beta", "role": "patient", "patient_id": "PAT-BETA-02"}},
    upsert=True
)
pat_b_user = db.users_col.find_one({"email": "patient_b@vadr.pk"})
db.patients_col.update_one({"patientId": "PAT-BETA-02"}, {"$set": {"patientId": "PAT-BETA-02", "name": "Patient Beta", "email": "patient_b@vadr.pk", "age": 48, "gender": "Female", "diabetesType": "Type 1", "hba1c": "8.1"}}, upsert=True)

from vadr_backend.services.token_service import issue_access_token
doc_token, _ = issue_access_token(doc_user)
admin_token, _ = issue_access_token(admin_user)
screener_token, _ = issue_access_token(screener_user)
pat_a_token, _ = issue_access_token(pat_a_user)
pat_b_token, _ = issue_access_token(pat_b_user)

print("=== 2. CREATING TEST SCREENINGS ===")
# Screening for Patient A
scr_a_id = "SCR-TEST-AUTH-A"
db.screenings_col.update_one(
    {"id": scr_a_id},
    {"$set": {
        "id": scr_a_id,
        "patient_id": "PAT-ALPHA-01",
        "patientId": "PAT-ALPHA-01",
        "doctor_id": doc_user.get("id"),
        "eye_side": "Right Eye (OD)",
        "prediction": "Moderate",
        "class_id": 2,
        "confidence": 88.75,
        "probabilities": {"No DR": 2.1, "Mild": 5.4, "Moderate": 88.75, "Severe": 3.1, "Proliferative DR": 0.65},
        "image_path": "uploads/test_fundus.jpg",
        "gradcam_path": "uploads/gradcam/test_gradcam.png",
        "created_at": datetime.now(timezone.utc)
    }},
    upsert=True
)

# Remove any old report for clean test
db.reports_col.delete_many({"screening_id": scr_a_id})

# Generate Draft Report for Screening A
res = client.post("/api/reports/generate", json={"screening_id": scr_a_id}, headers={"Authorization": f"Bearer {doc_token}"})
assert res.status_code in (200, 201), f"Generate report failed: {res.get_json()}"
rpt_a = res.get_json()["data"]
rpt_a_id = rpt_a["report_id"]
print(f"Draft Report Created: {rpt_a_id}, Status: {rpt_a['status']}")

print("=== 3. RUNNING TARGETED AUTHORIZATION AUDIT TESTS ===")

# Test 1: Unauthenticated report access -> 401
r1 = client.get(f"/api/reports/{rpt_a_id}")
print(f"Test 1: Unauthenticated GET report -> Status {r1.status_code} (Expected 401)")
assert r1.status_code == 401

# Test 2: Patient accessing draft report -> 403 Forbidden
r2 = client.get(f"/api/reports/{rpt_a_id}", headers={"Authorization": f"Bearer {pat_a_token}"})
print(f"Test 2: Patient A accessing own DRAFT report -> Status {r2.status_code} (Expected 403)")
assert r2.status_code == 403

# Test 3: Screener attempting sign-off -> 403 Forbidden
r3 = client.post(f"/api/reports/{rpt_a_id}/sign", json={"clinical_notes": "Screener trying to sign"}, headers={"Authorization": f"Bearer {screener_token}"})
print(f"Test 3: Screener attempting sign-off -> Status {r3.status_code} (Expected 403)")
assert r3.status_code == 403

# Test 4: Patient attempting sign-off -> 403 Forbidden
r4 = client.post(f"/api/reports/{rpt_a_id}/sign", json={"clinical_notes": "Patient trying to sign"}, headers={"Authorization": f"Bearer {pat_a_token}"})
print(f"Test 4: Patient attempting sign-off -> Status {r4.status_code} (Expected 403)")
assert r4.status_code == 403

# Test 5: Admin attempting sign-off -> 403 Forbidden (Only authenticated doctors can sign)
r5 = client.post(f"/api/reports/{rpt_a_id}/sign", json={"clinical_notes": "Admin trying to sign"}, headers={"Authorization": f"Bearer {admin_token}"})
print(f"Test 5: Admin attempting sign-off -> Status {r5.status_code} (Expected 403)")
assert r5.status_code == 403

# Test 6: Doctor signing report -> 200 OK
r6 = client.post(f"/api/reports/{rpt_a_id}/sign", json={"clinical_notes": "Confirmed moderate non-proliferative diabetic retinopathy. Retinal specialist referral indicated."}, headers={"Authorization": f"Bearer {doc_token}"})
print(f"Test 6: Doctor signing report -> Status {r6.status_code} (Expected 200)")
assert r6.status_code == 200
signed_rpt = r6.get_json()["data"]
assert signed_rpt["signoff"]["signed"] == True
assert signed_rpt["status"] == "signed"

# Test 7: Already signed report cannot be signed again -> 400 Bad Request
r7 = client.post(f"/api/reports/{rpt_a_id}/sign", json={"clinical_notes": "Trying to re-sign"}, headers={"Authorization": f"Bearer {doc_token}"})
print(f"Test 7: Re-signing already signed report -> Status {r7.status_code} (Expected 400)")
assert r7.status_code == 400

# Test 8: Patient A accessing own signed report -> 200 OK
r8 = client.get(f"/api/reports/{rpt_a_id}", headers={"Authorization": f"Bearer {pat_a_token}"})
print(f"Test 8: Patient A accessing own SIGNED report -> Status {r8.status_code} (Expected 200)")
assert r8.status_code == 200

# Test 9: Patient A downloading own signed report PDF -> 200 OK
r9 = client.get(f"/api/reports/{rpt_a_id}/download", headers={"Authorization": f"Bearer {pat_a_token}"})
print(f"Test 9: Patient A downloading own signed report PDF -> Status {r9.status_code}, Length {len(r9.data)} bytes (Expected 200)")
assert r9.status_code == 200
assert r9.mimetype == "application/pdf"
assert r9.data.startswith(b"%PDF"), "Response is not a valid PDF file"
assert len(r9.data) > 1000

# Test 10: Patient B accessing Patient A report -> 403 Forbidden
r10 = client.get(f"/api/reports/{rpt_a_id}", headers={"Authorization": f"Bearer {pat_b_token}"})
print(f"Test 10: Patient B accessing Patient A report -> Status {r10.status_code} (Expected 403)")
assert r10.status_code == 403

# Test 11: Patient B downloading Patient A report -> 403 Forbidden
r11 = client.get(f"/api/reports/{rpt_a_id}/download", headers={"Authorization": f"Bearer {pat_b_token}"})
print(f"Test 11: Patient B downloading Patient A report -> Status {r11.status_code} (Expected 403)")
assert r11.status_code == 403

# Test 12: Directory traversal test in report_service
jail_check = report_service.get_safe_pdf_path("../../app.py")
print(f"Test 12: Jail path traversal check on ../../app.py -> {jail_check} (Expected None)")
assert jail_check is None

print("\n=== 4. VERIFYING PDF METRICS AND REPORT INTEGRITY ===")
pdf_bytes = r9.data
print(f"Downloaded PDF Byte Count: {len(pdf_bytes)}")
assert pdf_bytes.startswith(b"%PDF"), "Response is not a valid PDF file"
assert len(pdf_bytes) > 1000, "PDF file is too small"

# Verify that the generated and signed report in DB contains all clinical fields
rpt_db = db.reports_col.find_one({"report_id": rpt_a_id})
assert rpt_db is not None, "Report not found in database"
assert rpt_db.get("status") == "signed", "Report status should be signed"
assert rpt_db.get("signoff", {}).get("signed") is True, "Signoff block should be marked signed"
assert rpt_db.get("signoff", {}).get("signed_by_name") is not None, "Signoff doctor name missing"
assert rpt_db.get("signoff", {}).get("signed_at") is not None, "Signoff timestamp missing"
assert rpt_db.get("patient", {}).get("patientId") == "PAT-ALPHA-01", "Patient ID missing from snapshot"
assert rpt_db.get("assessment", {}).get("prediction") == "Moderate", "Prediction missing from assessment"
assert "No DR" in rpt_db.get("assessment", {}).get("probabilities", {}), "5-class probabilities missing"
assert rpt_db.get("clinical_notes") != "", "Clinical notes missing from signoff"
print("  [Integrity Check] ReportLab PDF validated with %PDF magic bytes and size > 1000 bytes.")
print("  [Integrity Check] All clinical fields, 5-class probabilities, and doctor sign-off verified in DB.")

print("\n=== 5. CHECKING AUDIT LOG EMISSION & BACKGROUND EMAIL ===")
events_found = set()
for l in db.audit_logs_col.find({"metadata.report_id": rpt_a_id}):
    events_found.add(l.get("event_type"))
    print(f"  Audit Event Logged: {l.get('event_type')} (User: {l.get('user_id')}, Role: {l.get('role')})")

assert "REPORT_CREATED" in events_found, "REPORT_CREATED was not logged"
assert "REPORT_SIGNED" in events_found, "REPORT_SIGNED was not logged"
assert "REPORT_DOWNLOADED" in events_found, "REPORT_DOWNLOADED was not logged"

# Test Email Dispatch API
r_mail = client.post(f"/api/reports/{rpt_a_id}/send-email", headers={"Authorization": f"Bearer {doc_token}"})
print(f"Test Email Dispatch API -> Status {r_mail.status_code} (Expected 200)")
assert r_mail.status_code == 200

import time
time.sleep(1.0)

# Check DB report email status
post_email_rpt = db.reports_col.find_one({"report_id": rpt_a_id})
print(f"Report status after email dispatch: {post_email_rpt.get('status')}")
print(f"Report email block: {post_email_rpt.get('email')}")
assert post_email_rpt.get("status") == "signed", "Email attempt should not invalidate signed status!"
assert post_email_rpt.get("email", {}).get("status") in ("sent", "failed", "queued"), "Email status invalid"

# Check email audit events
mail_events = [l.get("event_type") for l in db.audit_logs_col.find({"metadata.report_id": rpt_a_id})]
print(f"All Audit Events for report: {mail_events}")
assert "REPORT_EMAIL_QUEUED" in mail_events, "REPORT_EMAIL_QUEUED was not logged"
assert ("REPORT_EMAIL_SENT" in mail_events or "REPORT_EMAIL_FAILED" in mail_events), "Expected SENT or FAILED audit log"

print("\nALL AUDIT, SECURITY, LIFECYCLE, AND VERIFICATION TESTS COMPLETED AND PASSED WITH ZERO ERRORS!")
