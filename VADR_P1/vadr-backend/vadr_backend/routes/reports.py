"""
Report API Blueprint for VADR
Handles generating, retrieving, signing, downloading, searching, and emailing clinical reports.
"""
from flask import Blueprint, request, g, send_file
from ..decorators import require_auth
from ..responses import api_success, api_error
from ..services import report_service, audit_service, mail_service

reports_bp = Blueprint("reports", __name__)

@reports_bp.route("/generate", methods=["POST"])
@require_auth(roles=["admin", "doctor", "screener"])
def generate_report():
    """
    POST /api/reports/generate
    Generates or retrieves draft report for a screening.
    Allowed for: admin, doctor, screener
    """
    user = getattr(g, "current_user", {})
    role = user.get("role", "")
    
    data = request.get_json() or {}
    screening_id = data.get("screening_id")
    if not screening_id:
        return api_error("screening_id is required", status=400)
    
    try:
        report, is_created = report_service.create_or_get_report(screening_id, user)
    except ValueError as e:
        return api_error(str(e), status=400)
    except Exception as e:
        return api_error(f"Failed to generate report: {str(e)}", status=500)
    
    # Audit log
    audit_service.log_event(
        event_type="REPORT_CREATED",
        user_id=user.get("user_id") or user.get("id") or "system",
        role=role,
        metadata={
            "report_id": report.get("report_id"),
            "screening_id": screening_id,
            "patient_id": report.get("patient_id"),
            "status": report.get("status")
        }
    )
    
    return api_success(
        data=report_service.sanitize_report(report),
        message="Report generated successfully",
        status=201 if is_created else 200
    )

@reports_bp.route("", methods=["GET"])
@require_auth(roles=["admin", "doctor", "screener", "patient"])
def list_reports():
    """
    GET /api/reports
    Search and filter report archive.
    Admins & doctors can search all or filter by patient_id/doctor_id/status/prediction/date.
    Screeners can search reports.
    Patients can only see their own signed/ready reports.
    """
    user = getattr(g, "current_user", {})
    role = user.get("role", "")
    user_id = user.get("user_id") or user.get("id") or ""
    
    # Query parameters
    search = request.args.get("search")
    status = request.args.get("status")
    prediction = request.args.get("prediction") or request.args.get("severity")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    doctor_id = request.args.get("doctor_id")
    patient_id = request.args.get("patient_id")
    
    try:
        page = int(request.args.get("page", 1))
        limit = min(int(request.args.get("limit", 20)), 100)
    except ValueError:
        page = 1
        limit = 20
        
    # Enforce patient restriction
    if role == "patient":
        user_patient_id = user.get("patient_id")
        if not user_patient_id:
            patient_rec = report_service.db.patients_col.find_one({"user_id": user_id}) or \
                          report_service.db.patients_col.find_one({"email": user.get("email")})
            if patient_rec:
                user_patient_id = patient_rec.get("patientId") or patient_rec.get("id") or str(patient_rec.get("_id"))
        
        patient_id = user_patient_id or "UNMATCHED_PATIENT"
        # Patients can only see signed/ready reports
        if not status or status == "draft":
            status = "signed"

    reports, total = report_service.query_reports(
        search=search,
        patient_id=patient_id,
        doctor_id=doctor_id,
        status=status,
        prediction=prediction,
        date_from=date_from,
        date_to=date_to,
        page=page,
        limit=limit
    )
    
    return api_success(
        data={
            "reports": [report_service.sanitize_report(r) for r in reports],
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if limit > 0 else 1
        },
        message="Reports retrieved successfully"
    )

@reports_bp.route("/<report_id>", methods=["GET"])
@require_auth(roles=["admin", "doctor", "screener", "patient"])
def get_report(report_id):
    """
    GET /api/reports/<report_id>
    Retrieve metadata for a specific report.
    Enforces authorization: Patients can only retrieve their own signed reports.
    """
    user = getattr(g, "current_user", {})
    role = user.get("role", "")
    
    report = report_service.get_report_by_id(report_id)
    if not report:
        return api_error("Report not found", status=404)
    
    # Ownership and access control
    if role == "patient":
        user_patient_id = user.get("patient_id")
        if not user_patient_id:
            patient_rec = report_service.db.patients_col.find_one({"user_id": user.get("id") or user.get("user_id")}) or \
                          report_service.db.patients_col.find_one({"email": user.get("email")})
            if patient_rec:
                user_patient_id = patient_rec.get("patientId") or patient_rec.get("id") or str(patient_rec.get("_id"))
        
        rpt_patient_id = report.get("patient_id")
        rpt_patient_sub_id = (report.get("patient") or {}).get("patientId")
        if user_patient_id not in [rpt_patient_id, rpt_patient_sub_id]:
            return api_error("Unauthorized to access this report", code="FORBIDDEN", status=403)
        
        if report.get("status") == "draft":
            return api_error("Draft reports are not accessible to patients", code="FORBIDDEN", status=403)
            
    return api_success(
        data=report_service.sanitize_report(report),
        message="Report retrieved successfully"
    )

@reports_bp.route("/<report_id>/sign", methods=["POST"])
@require_auth(roles=["doctor"])
def sign_report_endpoint(report_id):
    """
    POST /api/reports/<report_id>/sign
    Doctor electronic sign-off.
    Requires authenticated doctor role.
    """
    user = getattr(g, "current_user", {})
    role = user.get("role", "doctor")
    
    data = request.get_json() or {}
    clinical_notes = data.get("clinical_notes", "")
    
    try:
        updated_report = report_service.sign_report(
            report_id=report_id,
            doctor_user=user,
            clinical_notes=clinical_notes
        )
    except ValueError as e:
        return api_error(str(e), status=400)
    except Exception as e:
        return api_error(f"Failed to sign report: {str(e)}", status=500)
    
    return api_success(
        data=report_service.sanitize_report(updated_report),
        message="Report electronically signed and finalized successfully"
    )

@reports_bp.route("/<report_id>/download", methods=["GET"])
@require_auth(roles=["admin", "doctor", "screener", "patient"])
def download_report(report_id):
    """
    GET /api/reports/<report_id>/download
    Safely streams finalized/draft PDF report file.
    Enforces authorization and prevents path traversal.
    """
    user = getattr(g, "current_user", {})
    role = user.get("role", "")
    
    report = report_service.get_report_by_id(report_id)
    if not report:
        return api_error("Report not found", status=404)
        
    # Authorization checks
    if role == "patient":
        user_patient_id = user.get("patient_id")
        if not user_patient_id:
            patient_rec = report_service.db.patients_col.find_one({"user_id": user.get("id") or user.get("user_id")}) or \
                          report_service.db.patients_col.find_one({"email": user.get("email")})
            if patient_rec:
                user_patient_id = patient_rec.get("patientId") or patient_rec.get("id") or str(patient_rec.get("_id"))
        
        rpt_patient_id = report.get("patient_id")
        rpt_patient_sub_id = (report.get("patient") or {}).get("patientId")
        if user_patient_id not in [rpt_patient_id, rpt_patient_sub_id]:
            return api_error("Unauthorized to download this report", code="FORBIDDEN", status=403)
            
        if report.get("status") == "draft":
            return api_error("Draft reports cannot be downloaded by patients", code="FORBIDDEN", status=403)
            
    # Resolve safe PDF path
    safe_path = report_service.get_safe_pdf_path(report.get("pdf_path"))
    if not safe_path:
        # Attempt generation if missing
        safe_path = report_service.generate_pdf(report)
        if not safe_path:
            return api_error("PDF report file is unavailable", status=404)

    # Audit log
    audit_service.log_event(
        event_type="REPORT_DOWNLOADED",
        user_id=user.get("id") or user.get("user_id") or "user",
        role=role,
        metadata={
            "report_id": report_id,
            "patient_id": report.get("patient_id"),
            "role": role
        }
    )

    download_name = f"VADR_Report_{report_id}.pdf"
    return send_file(
        safe_path,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=download_name
    )

@reports_bp.route("/<report_id>/send-email", methods=["POST"])
@require_auth(roles=["admin", "doctor"])
def send_email_endpoint(report_id):
    """
    POST /api/reports/<report_id>/send-email
    Dispatches finalized report PDF to patient email in the background.
    """
    user = getattr(g, "current_user", {})
    role = user.get("role", "doctor")
    
    report = report_service.get_report_by_id(report_id)
    if not report:
        return api_error("Report not found", status=404)
        
    if report.get("status") not in ["signed", "email_failed", "email_sent", "email_queued"]:
        return api_error("Only signed reports can be emailed to patients", status=400)
        
    patient_info = report.get("patient") or {}
    recipient_email = patient_info.get("email")
    if not recipient_email or "@" not in recipient_email:
        # Fallback to patient doc lookup
        patient_rec = report_service.db.patients_col.find_one({"patientId": report.get("patient_id")}) or \
                      report_service.db.patients_col.find_one({"id": report.get("patient_id")})
        if patient_rec:
            recipient_email = patient_rec.get("email")
            
    if not recipient_email or "@" not in recipient_email:
        return api_error("Patient does not have a valid registered email address", status=400)
        
    safe_path = report_service.get_safe_pdf_path(report.get("pdf_path"))
    if not safe_path:
        return api_error("Finalized PDF file is missing or unreadable", status=404)
        
    # Queue email in background
    patient_name = patient_info.get("name") or "Patient"
    doctor_name = (report.get("doctor") or {}).get("name")
    
    mail_service.send_report_email_background(
        report_id=report_id,
        to_email=recipient_email,
        patient_name=patient_name,
        abs_pdf_path=safe_path,
        doctor_name=doctor_name,
        user_id=user.get("id") or user.get("user_id") or "doctor",
        user_role=role
    )
    
    return api_success(
        data={"report_id": report_id, "recipient": recipient_email, "email_status": "queued"},
        message=f"Report email queued for delivery to {recipient_email}"
    )
