import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

from ..config import settings


def smtp_port_fallbacks(primary_port: int):
    ports = [primary_port]
    allow_fallback = os.environ.get("MAIL_SMTP_TRY_FALLBACK", "true").lower() in ("1", "true", "yes")
    if not allow_fallback:
        return ports
    if primary_port == 587 and 2525 not in ports:
        ports.append(2525)
    elif primary_port == 2525 and 587 not in ports:
        ports.append(587)
    return ports


def smtp_settings():
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


def smtp_send_message(msg: EmailMessage, cfg: dict) -> tuple[bool, str | None]:
    host = cfg["host"]
    port0 = cfg["port"]
    user = cfg["user"]
    password = cfg["password"]
    use_tls = cfg["use_tls"]
    timeout = int(os.environ.get("MAIL_SMTP_TIMEOUT", "45"))
    last_err = None

    for port in smtp_port_fallbacks(port0):
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
                    "SMTP send succeeded on port %s (primary %s failed)", port, port0
                )
            return True, None
        except Exception as exc:
            last_err = exc
            logging.getLogger("vadr.mail").warning("SMTP attempt %s:%s — %s", host, port, exc)

    return False, str(last_err) if last_err else "SMTP connection failed"


def _send_email(to_email: str, subject: str, body: str) -> tuple[bool, str | None]:
    cfg = smtp_settings()
    if not cfg["host"] or not cfg["sender"]:
        return False, "SMTP is not configured (set MAIL_SERVER and MAIL_DEFAULT_SENDER)."
    if not cfg["user"]:
        return False, "SMTP username not set (MAIL_USERNAME)."

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = cfg["sender"]
    msg["To"] = to_email
    msg.set_content(body)

    ok, err = smtp_send_message(msg, cfg)
    if not ok:
        logging.getLogger("vadr.mail").error("SMTP send failed: %s", err)
    return ok, err


def send_registration_verification_email(to_email: str, code: str, display_name: str):
    log_code = os.environ.get("VADR_LOG_EMAIL_CODE", "").lower() in ("1", "true", "yes")
    if log_code:
        logging.getLogger("vadr.mail").warning("VADR registration code for %s: %s", to_email, code)

    body = (
        f"Hi {display_name},\n\n"
        f"Your VADR verification code is: {code}\n\n"
        f"This code expires in {settings.reg_code_expires_min} minutes.\n"
        "If you did not request this, you can ignore this email.\n"
    )
    return _send_email(to_email, "Verify your VADR registration", body)


def send_doctor_approval_email(to_email: str, display_name: str):
    body = (
        f"Hi {display_name},\n\n"
        "Your VADR doctor account has been approved. You may now sign in and access assigned patients.\n\n"
        "Thank you,\nVADR Team\n"
    )
    return _send_email(to_email, "Your VADR doctor account has been approved", body)


def send_password_reset_email(to_email: str, code: str, display_name: str):
    log_code = os.environ.get("VADR_LOG_EMAIL_CODE", "").lower() in ("1", "true", "yes")
    if log_code:
        logging.getLogger("vadr.mail").warning("VADR password reset code for %s: %s", to_email, code)

    body = (
        f"Hi {display_name},\n\n"
        f"Your VADR password reset code is: {code}\n\n"
        f"This code expires in {settings.reg_code_expires_min} minutes.\n"
        "If you did not request a password reset, you can ignore this email.\n"
    )
    return _send_email(to_email, "Reset your VADR password", body)


def send_doctor_rejection_email(to_email: str, display_name: str, reason: str, reapply_days: int):
    body = (
        f"Hi {display_name},\n\n"
        "Your VADR doctor registration was not approved at this time.\n\n"
        f"Reason: {reason or 'No reason provided.'}\n\n"
        f"You may submit a new application after {reapply_days} days.\n\n"
        "Thank you,\nVADR Team\n"
    )
    return _send_email(to_email, "Update on your VADR doctor application", body)


def _send_email_with_attachment(
    to_email: str,
    subject: str,
    body: str,
    attachment_path: str,
    attachment_filename: str,
) -> tuple[bool, str | None]:
    """Send an email with a file attachment via SMTP."""
    cfg = smtp_settings()
    if not cfg["host"] or not cfg["sender"]:
        return False, "SMTP is not configured (set MAIL_SERVER and MAIL_DEFAULT_SENDER)."
    if not cfg["user"]:
        return False, "SMTP username not set (MAIL_USERNAME)."

    if not os.path.isfile(attachment_path):
        return False, f"Attachment file not found: {attachment_path}"

    try:
        with open(attachment_path, "rb") as f:
            pdf_bytes = f.read()
    except Exception as exc:
        return False, f"Failed to read attachment file: {exc}"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = cfg["sender"]
    msg["To"] = to_email
    msg.set_content(body)

    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=attachment_filename,
    )

    ok, err = smtp_send_message(msg, cfg)
    if not ok:
        logging.getLogger("vadr.mail").error("SMTP report send failed: %s", err)
    return ok, err


def send_report_email(
    to_email: str,
    patient_name: str,
    pdf_path: str,
    report_id: str,
    doctor_name: str | None = None,
) -> tuple[bool, str | None]:
    """Format and send the finalized clinical report to the patient's registered email."""
    subject = f"VADR — Your Diabetic Retinopathy Assessment Report ({report_id})"
    clinician_str = f" by {doctor_name}" if doctor_name else ""
    body = (
        f"Hello {patient_name or 'Valued Patient'},\n\n"
        f"Your finalized VADR diabetic retinopathy assessment report ({report_id}) has been "
        f"reviewed and electronically confirmed{clinician_str}.\n\n"
        "Your official signed clinical report is attached to this email as a PDF document.\n\n"
        "Please retain this document for your clinical records and consult your attending "
        "ophthalmologist or healthcare provider to discuss any follow-up evaluations.\n\n"
        "Regards,\n"
        "VADR Clinical Screening Team\n"
        "Visual Assessment of Diabetic Retinopathy\n"
    )
    attachment_filename = f"{report_id}.pdf"
    return _send_email_with_attachment(to_email, subject, body, pdf_path, attachment_filename)


# Background thread pool executor for non-blocking asynchronous email delivery
import concurrent.futures
_email_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3, thread_name_prefix="vadr_mailer")


def _bg_worker_report_email(
    report_id: str,
    to_email: str,
    patient_name: str,
    abs_pdf_path: str,
    doctor_name: str | None,
    user_id: str | None,
    user_role: str | None,
):
    """Background worker function executed on thread pool."""
    from .. import db
    from ..services.audit_service import log_event
    from ..utils.common import utcnow_naive

    try:
        ok, err = send_report_email(to_email, patient_name, abs_pdf_path, report_id, doctor_name)
        now = utcnow_naive()
        if ok:
            db.reports_col.update_one(
                {"report_id": report_id},
                {
                    "$set": {
                        "email.status": "sent",
                        "email.sent_at": now,
                        "email.error": None,
                        "updated_at": now,
                    }
                },
            )
            log_event(
                "REPORT_EMAIL_SENT",
                user_id=user_id,
                role=user_role,
                metadata={
                    "report_id": report_id,
                    "recipient_email": to_email,
                },
            )
            logging.getLogger("vadr.mail").info("Successfully emailed report %s to %s", report_id, to_email)
        else:
            db.reports_col.update_one(
                {"report_id": report_id},
                {
                    "$set": {
                        "email.status": "failed",
                        "email.error": err or "SMTP transmission failed",
                        "updated_at": now,
                    }
                },
            )
            log_event(
                "REPORT_EMAIL_FAILED",
                user_id=user_id,
                role=user_role,
                metadata={
                    "report_id": report_id,
                    "recipient_email": to_email,
                    "error": err,
                },
            )
            logging.getLogger("vadr.mail").warning("Failed emailing report %s: %s", report_id, err)
    except Exception as exc:
        now = utcnow_naive()
        db.reports_col.update_one(
            {"report_id": report_id},
            {
                "$set": {
                    "email.status": "failed",
                    "email.error": str(exc),
                    "updated_at": now,
                }
            },
        )
        log_event(
            "REPORT_EMAIL_FAILED",
            user_id=user_id,
            role=user_role,
            metadata={
                "report_id": report_id,
                "recipient_email": to_email,
                "error": str(exc),
            },
        )
        logging.getLogger("vadr.mail").error("Exception in report email worker for %s: %s", report_id, exc)


def send_report_email_background(
    report_id: str,
    to_email: str,
    patient_name: str,
    abs_pdf_path: str,
    doctor_name: str | None = None,
    user_id: str | None = None,
    user_role: str | None = None,
):
    """Queue and trigger asynchronous background email dispatch."""
    from .. import db
    from ..services.audit_service import log_event
    from ..utils.common import utcnow_naive

    now = utcnow_naive()
    # Mark as queued in DB
    db.reports_col.update_one(
        {"report_id": report_id},
        {
            "$set": {
                "email.status": "queued",
                "email.recipient": to_email,
                "email.queued_at": now,
                "updated_at": now,
            }
        },
    )

    log_event(
        "REPORT_EMAIL_QUEUED",
        user_id=user_id,
        role=user_role,
        metadata={
            "report_id": report_id,
            "recipient_email": to_email,
        },
    )

    # Submit to thread executor
    _email_executor.submit(
        _bg_worker_report_email,
        report_id,
        to_email,
        patient_name,
        abs_pdf_path,
        doctor_name,
        user_id,
        user_role,
    )

