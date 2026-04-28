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


def send_registration_verification_email(to_email: str, code: str, display_name: str):
    cfg = smtp_settings()
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
        f"This code expires in {settings.reg_code_expires_min} minutes.\n"
        "If you did not request this, you can ignore this email.\n"
    )
    msg = EmailMessage()
    msg["Subject"] = "Verify your VADR registration"
    msg["From"] = cfg["sender"]
    msg["To"] = to_email
    msg.set_content(body)

    ok, err = smtp_send_message(msg, cfg)
    if not ok:
        logging.getLogger("vadr.mail").error("SMTP send failed after fallbacks: %s", err)
    return ok, err
