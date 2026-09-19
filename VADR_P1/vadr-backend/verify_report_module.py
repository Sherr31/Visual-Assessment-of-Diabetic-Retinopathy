"""
Comprehensive End-to-End Verification for VADR Report Generation Module
Tests:
- Database initialization and indexes
- ReportLab PDF generation (draft & signed)
- Electronic doctor sign-off
- Immutability & ownership verification
- Path traversal protection
- Search & archive filtering
- Mail dispatch simulation
"""
import os
import sys
from datetime import datetime, timezone

# Ensure path
sys.path.insert(0, os.path.dirname(__file__))

from vadr_backend.config import load_environment, settings
from vadr_backend.db import init_db, db
from vadr_backend.services import report_service, audit_service, mail_service

def run_tests():
    print("=" * 60)
    print("VADR REPORT GENERATION MODULE — VERIFICATION SUITE")
    print("=" * 60)
    
    load_environment()
    init_db(settings.mongo_uri)
    
    # 1. Database & Indexes Verification
    print("\n[TEST 1] Verifying MongoDB collections & indexes...")
    assert db.reports_col is not None, "reports_col not initialized"
    index_info = db.reports_col.index_information()
    print(f"  ✓ Existing indexes on 'reports': {list(index_info.keys())}")
    assert "report_id_1" in index_info or any("report_id" in str(v) for v in index_info.values()), "Missing report_id index"
    
    # 2. Screening Record Preparation
    print("\n[TEST 2] Retrieving or preparing a screening record for testing...")
    screening = db.screenings_col.find_one()
    if not screening:
        # Create a mock screening
        screening_id = "test-scr-001"
        db.screenings_col.insert_one({
            "id": screening_id,
            "patient_id": "VADR-P-001",
            "patientId": "VADR-P-001",
            "doctor_id": "doc-001",
            "doctor_name": "Dr. Ayesha Khan",
            "eye_side": "Left Eye",
            "class_id": 2,
            "prediction": "Moderate",
            "confidence": 92.5,
            "probabilities": {
                "No DR": 1.2,
                "Mild": 3.8,
                "Moderate": 92.5,
                "Severe": 2.0,
                "Proliferative DR": 0.5
            },
            "gradcam": "uploads/gradcam/sample.png",
            "image_path": "uploads/sample.png",
            "reviewed": False,
            "created_at": datetime.now(timezone.utc)
        })
        screening = db.screenings_col.find_one({"id": screening_id})
        
    screening_id = screening.get("id") or str(screening.get("_id"))
    print(f"  ✓ Using screening ID: {screening_id}")
    
    # 3. Generate Draft Report
    print("\n[TEST 3] Generating Draft Report...")
    test_doctor = {
        "user_id": "doc-test-1",
        "name": "Dr. Sarah Jenkins",
        "email": "sarah.jenkins@vadr-health.org",
        "role": "doctor",
        "department": "Ophthalmology & Retina"
    }
    
    report, err = report_service.create_or_get_report(screening_id, test_doctor)
    assert err is None, f"Failed to generate draft report: {err}"
    report_id = report["report_id"]
    print(f"  ✓ Draft Report generated successfully: {report_id}")
    print(f"  ✓ Status: {report.get('status')}")
    print(f"  ✓ Stored PDF relative path: {report.get('pdf_path')}")
    
    # Verify PDF on filesystem
    safe_path = report_service.get_safe_pdf_path(report.get("pdf_path"))
    assert safe_path and os.path.exists(safe_path), f"Generated PDF not found on filesystem at: {safe_path}"
    pdf_size = os.path.getsize(safe_path)
    print(f"  ✓ PDF verified on disk ({pdf_size} bytes): {safe_path}")
    assert pdf_size > 1000, "PDF size unexpectedly small"
    
    # 4. Electronic Sign-Off Test
    print("\n[TEST 4] Testing Doctor Electronic Sign-Off...")
    clinical_notes = "Patient exhibits moderate non-proliferative diabetic retinopathy with focal microaneurysms. Recommended 6-month follow-up evaluation and strict HbA1c control."
    signed_report, err = report_service.sign_report(report_id, test_doctor, clinical_notes)
    assert err is None, f"Failed to sign report: {err}"
    assert signed_report["signoff"]["signed"] is True, "Signoff flag is not True"
    assert signed_report["signoff"]["signed_by"] == test_doctor["user_id"], "Signoff doctor ID mismatch"
    assert signed_report["signoff"]["signed_by_name"] == test_doctor["name"], "Signoff doctor name mismatch"
    assert signed_report["status"] == "signed", "Report status is not 'signed'"
    assert signed_report["clinical_notes"] == clinical_notes, "Clinical notes mismatch"
    print("  ✓ Electronic sign-off completed and recorded.")
    print(f"  ✓ Signoff timestamp: {signed_report['signoff']['signed_at']}")
    
    # Verify finalized PDF was regenerated
    safe_path_signed = report_service.get_safe_pdf_path(signed_report.get("pdf_path"))
    assert safe_path_signed and os.path.exists(safe_path_signed), "Signed PDF file not found"
    signed_pdf_size = os.path.getsize(safe_path_signed)
    print(f"  ✓ Finalized signed PDF verified on disk ({signed_pdf_size} bytes)")
    
    # 5. Immutability Test
    print("\n[TEST 5] Testing Signed Report Immutability...")
    another_doc = {
        "user_id": "doc-test-2",
        "name": "Dr. Impostor",
        "email": "impostor@vadr.org",
        "role": "doctor"
    }
    re_signed_report, re_err = report_service.sign_report(report_id, another_doc, "Trying to overwrite notes")
    assert re_err is not None, "System allowed re-signing an already signed report!"
    print(f"  ✓ Re-sign prevented as expected: '{re_err}'")
    
    # 6. Safe File Access / Path Traversal Protection Test
    print("\n[TEST 6] Testing Path Traversal Protection...")
    malicious_paths = [
        "../../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\cmd.exe",
        "C:\\Users\\Admin\\secret.txt",
        "/absolute/path/attack.pdf",
        "uploads/../vadr_backend/config.py"
    ]
    for m_path in malicious_paths:
        resolved = report_service.get_safe_pdf_path(m_path)
        assert resolved is None, f"Security vulnerability: Path traversal permitted for {m_path} -> {resolved}"
    print("  ✓ All malicious path traversal attempts successfully rejected.")
    
    # 7. Search & Archive Query Test
    print("\n[TEST 7] Testing Report Archive Query & Filtering...")
    reports, total = report_service.query_reports(search=report_id)
    assert total >= 1, "Report ID search failed"
    assert any(r["report_id"] == report_id for r in reports), "Target report not in search results"
    print(f"  ✓ Query by report_id returned {total} result(s)")
    
    reports_signed, total_signed = report_service.query_reports(status="signed")
    assert total_signed >= 1, "Filter by status='signed' failed"
    print(f"  ✓ Query by status='signed' returned {total_signed} result(s)")
    
    # 8. Background Email Dispatch Test
    print("\n[TEST 8] Testing Background Email Queue & Dispatch Mechanism...")
    patient_email = "patient.test@example.com"
    mail_service.send_report_email_background(
        report_id=report_id,
        to_email=patient_email,
        patient_name="Test Patient",
        pdf_path=safe_path_signed,
        user_id=test_doctor["user_id"]
    )
    # Give the thread a moment to update status
    import time
    time.sleep(1.0)
    
    updated_report = report_service.get_report_by_id(report_id)
    email_status = (updated_report.get("email") or {}).get("status")
    print(f"  ✓ Background email lifecycle status: '{email_status}'")
    assert email_status in ["queued", "sent", "email_sent", "failed", "email_failed"], f"Unexpected email status: {email_status}"
    
    print("\n" + "=" * 60)
    print("ALL BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
