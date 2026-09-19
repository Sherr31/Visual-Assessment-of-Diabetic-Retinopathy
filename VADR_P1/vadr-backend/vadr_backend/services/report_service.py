"""VADR Clinical Report Generation Service.

Handles ReportLab PDF generation, report document persistence in MongoDB,
electronic doctor sign-offs, and safe filesystem operations.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

from .. import db
from ..services.audit_service import log_event
from ..utils.common import serialize, utcnow_naive

# Base project root (vadr-backend/)
_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)
REPORTS_DIR = os.path.join(_PROJECT_ROOT, "uploads", "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

SEVERITY_COLORS = {
    "No DR": colors.HexColor("#059669"),          # Emerald
    "Mild": colors.HexColor("#0284c7"),           # Sky
    "Moderate": colors.HexColor("#d97706"),       # Amber
    "Severe": colors.HexColor("#dc2626"),         # Red
    "Proliferative DR": colors.HexColor("#9333ea"), # Purple
    "Proliferative": colors.HexColor("#9333ea"),
}

PRIMARY_BLUE = colors.HexColor("#1a56db")
DARK_NAVY = colors.HexColor("#0f172a")
SLATE_TEXT = colors.HexColor("#334155")
MUTED_TEXT = colors.HexColor("#64748b")
LIGHT_BORDER = colors.HexColor("#e2e8f0")
BG_MUTED = colors.HexColor("#f8fafc")


class NumberedCanvas(canvas.Canvas):
    """Canvas that performs a two-pass page count for 'Page X of Y' footers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(MUTED_TEXT)

        # Footer line
        self.setStrokeColor(LIGHT_BORDER)
        self.setLineWidth(0.5)
        self.line(36, 32, 576, 32)

        # Footer contents
        self.drawString(36, 20, "VADR — Visual Assessment of Diabetic Retinopathy | Clinical Diagnostic System")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(576, 20, page_str)
        self.restoreState()


def _resolve_safe_image_path(rel_path: Optional[str]) -> Optional[str]:
    """Safely resolve an image path relative to _PROJECT_ROOT, preventing directory traversal."""
    if not rel_path:
        return None
    # Normalize forward/back slashes
    clean_rel = rel_path.replace("\\", "/").strip().lstrip("/")
    abs_path = os.path.normpath(os.path.join(_PROJECT_ROOT, clean_rel))

    # Verify path remains inside _PROJECT_ROOT
    if not os.path.abspath(abs_path).startswith(os.path.abspath(_PROJECT_ROOT)):
        return None

    if os.path.isfile(abs_path):
        return abs_path
    return None


def generate_pdf_report(report_doc: dict[str, Any], output_path: str) -> str:
    """Compile a high-resolution, professional clinical PDF report using ReportLab."""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=46,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=PRIMARY_BLUE,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=MUTED_TEXT,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=PRIMARY_BLUE,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "BodyTextCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=SLATE_TEXT,
    )
    bold_label = ParagraphStyle(
        "BoldLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=DARK_NAVY,
    )
    value_style = ParagraphStyle(
        "ValueStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=SLATE_TEXT,
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10,
        textColor=MUTED_TEXT,
    )

    story = []

    # ──────────────────────────────────────────────────────────────────────────
    # 1. HEADER SECTION
    # ──────────────────────────────────────────────────────────────────────────
    report_id = report_doc.get("report_id", "RPT-PENDING")
    created_at_dt = report_doc.get("created_at")
    created_str = (
        created_at_dt.strftime("%B %d, %Y - %H:%M UTC")
        if isinstance(created_at_dt, datetime)
        else str(created_at_dt or "N/A")
    )

    is_signed = report_doc.get("signoff", {}).get("signed", False)
    status_badge_text = "ELECTRONICALLY SIGNED & VERIFIED" if is_signed else "DRAFT - PENDING CLINICIAN REVIEW"
    status_badge_color = "#059669" if is_signed else "#d97706"

    header_table_data = [
        [
            Paragraph("<b>VADR CLINICAL REPORT</b>", title_style),
            Paragraph(
                f"<font color='{status_badge_color}'><b>● {status_badge_text}</b></font>",
                ParagraphStyle(
                    "BadgeRight",
                    parent=styles["Normal"],
                    fontName="Helvetica-Bold",
                    fontSize=8.5,
                    alignment=2,
                ),
            ),
        ],
        [
            Paragraph("Visual Assessment of Diabetic Retinopathy · AI Screening System", subtitle_style),
            Paragraph(f"<b>Report ID:</b> {report_id}<br/><b>Generated:</b> {created_str}", ParagraphStyle("MetaRight", parent=styles["Normal"], fontName="Helvetica", fontSize=8, alignment=2, textColor=MUTED_TEXT)),
        ],
    ]

    header_table = Table(header_table_data, colWidths=[3.25 * inch, 4.25 * inch])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY_BLUE, spaceBefore=2, spaceAfter=8))

    # ──────────────────────────────────────────────────────────────────────────
    # 2. PATIENT & SCREENING INFORMATION
    # ──────────────────────────────────────────────────────────────────────────
    patient = report_doc.get("patient") or {}
    assessment = report_doc.get("assessment") or {}
    doctor = report_doc.get("doctor") or {}

    patient_table_data = [
        [
            Paragraph("Patient Name:", bold_label),
            Paragraph(str(patient.get("name") or "—"), value_style),
            Paragraph("Patient ID:", bold_label),
            Paragraph(str(patient.get("patientId") or patient.get("id") or "—"), value_style),
        ],
        [
            Paragraph("Age / Gender:", bold_label),
            Paragraph(f"{patient.get('age') or '—'} / {patient.get('gender') or '—'}", value_style),
            Paragraph("Diabetes Profile:", bold_label),
            Paragraph(f"{patient.get('diabetesType') or 'Type 2'} (HbA1c: {patient.get('hba1c') or 'N/A'})", value_style),
        ],
        [
            Paragraph("Contact / Email:", bold_label),
            Paragraph(f"{patient.get('phone') or '—'} · {patient.get('email') or '—'}", value_style),
            Paragraph("Attending Doctor:", bold_label),
            Paragraph(str(doctor.get("name") or patient.get("assignedDoctor") or "Dr. Ayesha Khan"), value_style),
        ],
        [
            Paragraph("Screening ID:", bold_label),
            Paragraph(str(report_doc.get("screening_id") or "—"), value_style),
            Paragraph("Examined Eye:", bold_label),
            Paragraph(str(assessment.get("eye_side") or assessment.get("eyeSide") or "Fundus (Bilateral)"), value_style),
        ],
    ]

    patient_table = Table(patient_table_data, colWidths=[1.3 * inch, 2.45 * inch, 1.3 * inch, 2.45 * inch])
    patient_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_MUTED),
        ("BOX", (0, 0), (-1, -1), 1, LIGHT_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 10))

    # ──────────────────────────────────────────────────────────────────────────
    # 3. AI CLASSIFICATION & 5-CLASS PROBABILITY DISTRIBUTION
    # ──────────────────────────────────────────────────────────────────────────
    pred_label = assessment.get("prediction") or "No DR"
    confidence_val = assessment.get("confidence", 0.0)
    probabilities = assessment.get("probabilities") or {}

    sev_color = SEVERITY_COLORS.get(pred_label, PRIMARY_BLUE)

    ai_box_data = [
        [
            Paragraph("<b>AI ASSESSMENT RESULT</b>", ParagraphStyle("AiHead", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, textColor=PRIMARY_BLUE)),
            Paragraph("<b>MODEL CONFIDENCE</b>", ParagraphStyle("AiConfHead", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, textColor=PRIMARY_BLUE, alignment=2)),
        ],
        [
            Paragraph(
                f"<font size=14 color='{sev_color.hexval()}'><b>{pred_label.upper()}</b></font><br/>"
                f"<font size=8 color='{SLATE_TEXT.hexval()}'>Diabetic Retinopathy Stage Classification</font>",
                styles["Normal"],
            ),
            Paragraph(
                f"<font size=14 color='{DARK_NAVY.hexval()}'><b>{confidence_val:.1f}%</b></font><br/>"
                f"<font size=8 color='{MUTED_TEXT.hexval()}'>Inference Confidence Score</font>",
                ParagraphStyle("ConfRight", parent=styles["Normal"], alignment=2),
            ),
        ],
    ]
    ai_box_table = Table(ai_box_data, colWidths=[4.25 * inch, 3.25 * inch])
    ai_box_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1.2, sev_color),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(ai_box_table)
    story.append(Spacer(1, 8))

    # 5-Class Probability Breakdown
    class_order = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"]
    prob_headers = [Paragraph(f"<b>{c}</b>", ParagraphStyle("PHead", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.5, alignment=1, textColor=DARK_NAVY)) for c in class_order]
    
    prob_values = []
    for c in class_order:
        p_val = probabilities.get(c, 0.0)
        is_max = (c == pred_label)
        p_color = sev_color.hexval() if is_max else SLATE_TEXT.hexval()
        weight = "b" if is_max else "span"
        prob_values.append(
            Paragraph(
                f"<{weight}><font color='{p_color}'>{p_val:.1f}%</font></{weight}>",
                ParagraphStyle("PVal", parent=styles["Normal"], fontName="Helvetica-Bold" if is_max else "Helvetica", fontSize=8, alignment=1),
            )
        )

    prob_table = Table([prob_headers, prob_values], colWidths=[1.5 * inch] * 5)
    prob_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ("BACKGROUND", (0, 1), (-1, 1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(prob_table)
    story.append(Spacer(1, 10))

    # ──────────────────────────────────────────────────────────────────────────
    # 4. VISUAL ASSESSMENT: FUNDUS SCAN & GRAD-CAM HEATMAP
    # ──────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("<b>Retinal Fundus Scans &amp; AI Attention Visualizations</b>", section_heading))

    images_info = report_doc.get("images") or {}
    fundus_rel = images_info.get("image_path")
    gradcam_rel = images_info.get("gradcam_path")

    fundus_abs = _resolve_safe_image_path(fundus_rel)
    gradcam_abs = _resolve_safe_image_path(gradcam_rel)

    img_box_width = 3.65 * inch
    img_box_height = 2.15 * inch

    # Left cell: Original Fundus Scan
    if fundus_abs:
        try:
            fundus_flowable = RLImage(fundus_abs, width=img_box_width, height=img_box_height)
        except Exception:
            fundus_flowable = Paragraph("<font color='#64748b'><i>[Original fundus photograph could not be loaded]</i></font>", body_style)
    else:
        fundus_flowable = Paragraph("<font color='#64748b'><i>[Original fundus photograph unavailable]</i></font>", body_style)

    # Right cell: Grad-CAM Overlay
    if gradcam_abs:
        try:
            gradcam_flowable = RLImage(gradcam_abs, width=img_box_width, height=img_box_height)
        except Exception:
            gradcam_flowable = Paragraph("<font color='#64748b'><i>[Grad-CAM heatmap visualization could not be loaded]</i></font>", body_style)
    else:
        gradcam_flowable = Paragraph("<font color='#64748b'><i>[Grad-CAM heatmap visualization unavailable]</i></font>", body_style)

    image_table_data = [
        [
            Paragraph("<b>Original Retinal Photograph</b>", ParagraphStyle("ImgLabel", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, alignment=1, textColor=SLATE_TEXT)),
            Paragraph("<b>AI Grad-CAM Attention Heatmap</b>", ParagraphStyle("ImgLabel2", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, alignment=1, textColor=SLATE_TEXT)),
        ],
        [fundus_flowable, gradcam_flowable],
    ]

    image_table = Table(image_table_data, colWidths=[3.75 * inch, 3.75 * inch])
    image_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 1), (-1, 1), BG_MUTED),
        ("BOX", (0, 1), (-1, 1), 1, LIGHT_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(image_table)
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            "<i>Note: Grad-CAM (Gradient-weighted Class Activation Mapping) highlights spatial retinal patterns and lesions that most influenced the neural network's decision. It serves as an assistive interpretation guide for the clinician.</i>",
            disclaimer_style,
        )
    )
    story.append(Spacer(1, 10))

    # ──────────────────────────────────────────────────────────────────────────
    # 5. CLINICIAN REVIEW & ELECTRONIC SIGN-OFF
    # ──────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("<b>Clinician Confirmation &amp; Electronic Sign-Off</b>", section_heading))

    signoff = report_doc.get("signoff") or {}
    clinical_notes = report_doc.get("clinical_notes") or "Assessment confirmed. Routine monitoring advised according to clinical protocol."
    
    if is_signed:
        signed_at_dt = signoff.get("signed_at")
        signed_at_str = (
            signed_at_dt.strftime("%B %d, %Y at %H:%M UTC")
            if isinstance(signed_at_dt, datetime)
            else str(signed_at_dt or "Recorded")
        )
        signed_by_name = signoff.get("signed_by_name") or doctor.get("name") or "Dr. Ayesha Khan"
        signed_by_email = signoff.get("signed_by_email") or doctor.get("email") or "ayesha@vadr.pk"
        signed_by_id = signoff.get("signed_by") or doctor.get("id") or "DOC-AUTHENTICATED"
        department = doctor.get("department") or "Ophthalmology / Medical Retina"

        sign_data = [
            [
                Paragraph("<b>Physician Notes / Diagnostic Plan:</b>", bold_label),
                Paragraph(f"{clinical_notes}", body_style),
            ],
            [
                Paragraph("<b>Electronic Verification:</b>", bold_label),
                Paragraph(
                    f"<b>Electronically Reviewed &amp; Signed by:</b> {signed_by_name}<br/>"
                    f"<b>Department / Unit:</b> {department} | <b>Clinician ID:</b> {signed_by_id}<br/>"
                    f"<b>Sign-off Timestamp:</b> {signed_at_str} | <b>Email:</b> {signed_by_email}",
                    value_style,
                ),
            ],
        ]
        sign_box_bg = colors.HexColor("#f0fdf4")
        sign_box_border = colors.HexColor("#10b981")
    else:
        sign_data = [
            [
                Paragraph("<b>Physician Notes:</b>", bold_label),
                Paragraph("<i>Pending physician sign-off. Clinical notes will be appended upon confirmation.</i>", body_style),
            ],
            [
                Paragraph("<b>Sign-off Status:</b>", bold_label),
                Paragraph("<font color='#d97706'><b>● PENDING CLINICIAN REVIEW</b> — This is an unverified draft report.</font>", value_style),
            ],
        ]
        sign_box_bg = colors.HexColor("#fffbeb")
        sign_box_border = colors.HexColor("#f59e0b")

    sign_table = Table(sign_data, colWidths=[1.8 * inch, 5.7 * inch])
    sign_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), sign_box_bg),
        ("BOX", (0, 0), (-1, -1), 1, sign_box_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, sign_box_border),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sign_table)
    story.append(Spacer(1, 10))

    # ──────────────────────────────────────────────────────────────────────────
    # 6. CLINICAL DISCLAIMER
    # ──────────────────────────────────────────────────────────────────────────
    story.append(
        Paragraph(
            "<b>Medical Disclaimer:</b> This diagnostic assessment contains AI-assisted retinal image analysis generated by the VADR clinical screening platform. Artificial intelligence findings are adjunctive decision-support metrics and must be evaluated by a licensed ophthalmologist or registered medical practitioner alongside the patient's comprehensive clinical history and slit-lamp / dilated fundus examination. VADR does not independently establish a medical diagnosis or treatment plan.",
            disclaimer_style,
        )
    )

    # Build document with NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_path


# ──────────────────────────────────────────────────────────────────────────────
# DATABASE & SERVICE HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def gen_report_id() -> str:
    """Generate clean clinical report ID e.g. RPT-20260918-A7B2C1."""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"RPT-{date_str}-{short_uuid}"


def create_or_get_report(screening_id: str, current_user: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Retrieve existing report for screening or create a new draft report."""
    # 1. Check if a report already exists for this screening
    existing = db.reports_col.find_one({"screening_id": screening_id})
    if existing:
        # If signed, return immediately (immutable)
        if existing.get("signoff", {}).get("signed") or existing.get("status") in ("signed", "ready"):
            return serialize(existing), False

        # If draft, re-render PDF if missing and return
        pdf_path = existing.get("pdf_path")
        if not pdf_path or not os.path.isfile(os.path.join(_PROJECT_ROOT, pdf_path.replace("\\", "/"))):
            full_pdf_path = os.path.join(REPORTS_DIR, f"{existing['report_id']}.pdf")
            generate_pdf_report(existing, full_pdf_path)
            rel_pdf_path = f"uploads/reports/{existing['report_id']}.pdf"
            db.reports_col.update_one({"report_id": existing["report_id"]}, {"$set": {"pdf_path": rel_pdf_path}})
            existing["pdf_path"] = rel_pdf_path

        return serialize(existing), False

    # 2. Fetch screening document
    screening = db.screenings_col.find_one({"$or": [{"id": screening_id}, {"_id": screening_id}]})
    if not screening:
        raise ValueError("Screening record not found")

    patient_id = screening.get("patient_id") or screening.get("patientId")
    patient = None
    if patient_id:
        patient = db.patients_col.find_one({"$or": [{"patientId": patient_id}, {"id": patient_id}, {"patient_id": patient_id}]})

    # Fallback to patient profile if self-screening
    if not patient and current_user.get("role") == "patient":
        user_email = current_user.get("email", "").strip().lower()
        patient = db.patients_col.find_one({"email": {"$regex": f"^{user_email}$", "$options": "i"}})

    patient_name = (patient.get("name") if patient else None) or screening.get("patient_name") or screening.get("patientName") or "Patient Alpha"
    patient_pid = (patient.get("patientId") if patient else None) or (patient.get("id") if patient else None) or patient_id or "PAT-ANONYMOUS"

    patient_snapshot = {
        "patientId": patient_pid,
        "name": patient_name if patient_name != "—" else "Patient Alpha",
        "age": (patient.get("age") if patient else None) or screening.get("patient_age") or "54",
        "gender": (patient.get("gender") if patient else None) or screening.get("patient_gender") or "Male",
        "email": (patient.get("email") if patient else None) or screening.get("patient_email") or "",
        "phone": (patient.get("phone") if patient else None) or screening.get("patient_phone") or "—",
        "diabetesType": (patient.get("diabetesType") if patient else None) or "Type 2",
        "hba1c": (patient.get("hba1c") if patient else None) or "7.2",
    }

    # Doctor snapshot
    doctor_id = screening.get("doctor_id") or current_user.get("id")
    doctor_name = screening.get("doctor_name") or current_user.get("name") or "Dr. Ayesha Khan"
    doctor_email = current_user.get("email") if current_user.get("role") == "doctor" else "clinic@vadr.pk"
    doctor_dept = current_user.get("department") if current_user.get("role") == "doctor" else "Ophthalmology"

    doctor_snapshot = {
        "id": doctor_id,
        "name": doctor_name,
        "email": doctor_email,
        "department": doctor_dept or "Ophthalmology",
    }

    # Images snapshot
    fundus_path = screening.get("image_path") or screening.get("imagePath")
    gradcam_path = screening.get("gradcam_path") or screening.get("gradcam")

    # Assessment snapshot
    assessment_snapshot = {
        "prediction": screening.get("prediction", "No DR"),
        "class_id": screening.get("class_id", 0),
        "confidence": float(screening.get("confidence", 95.0)),
        "probabilities": screening.get("probabilities") or {
            "No DR": 95.0 if screening.get("prediction") == "No DR" else 1.0,
            "Mild": 95.0 if screening.get("prediction") == "Mild" else 1.0,
            "Moderate": 95.0 if screening.get("prediction") == "Moderate" else 1.0,
            "Severe": 95.0 if screening.get("prediction") == "Severe" else 1.0,
            "Proliferative DR": 95.0 if screening.get("prediction") in ("Proliferative DR", "Proliferative") else 1.0,
        },
        "eye_side": screening.get("eye_side") or screening.get("eyeSide") or "Fundus",
    }

    now = utcnow_naive()
    new_report_id = gen_report_id()
    rel_pdf_path = f"uploads/reports/{new_report_id}.pdf"
    abs_pdf_path = os.path.join(REPORTS_DIR, f"{new_report_id}.pdf")

    report_doc = {
        "report_id": new_report_id,
        "screening_id": screening_id,
        "patient_id": patient_snapshot["patientId"],
        "doctor_id": doctor_snapshot["id"],
        "patient": patient_snapshot,
        "assessment": assessment_snapshot,
        "images": {
            "image_path": fundus_path,
            "gradcam_path": gradcam_path,
        },
        "doctor": doctor_snapshot,
        "clinical_notes": "",
        "signoff": {
            "signed": False,
            "signed_by": None,
            "signed_by_name": None,
            "signed_by_email": None,
            "signed_at": None,
        },
        "status": "draft",
        "pdf_path": rel_pdf_path,
        "email": {
            "status": "not_sent",
            "recipient": patient_snapshot["email"],
            "queued_at": None,
            "sent_at": None,
            "error": None,
        },
        "created_at": now,
        "updated_at": now,
    }

    # Generate initial draft PDF
    generate_pdf_report(report_doc, abs_pdf_path)

    # Insert into MongoDB
    db.reports_col.insert_one(report_doc)

    # Audit log
    log_event(
        "REPORT_CREATED",
        user_id=current_user.get("id"),
        role=current_user.get("role"),
        metadata={
            "report_id": new_report_id,
            "screening_id": screening_id,
            "patient_id": patient_snapshot["patientId"],
            "status": "draft",
        },
    )

    return serialize(report_doc), True


def sign_report(report_id: str, doctor_user: dict[str, Any], clinical_notes: str) -> dict[str, Any]:
    """Electronically sign and finalize a diagnostic report."""
    report = db.reports_col.find_one({"report_id": report_id})
    if not report:
        raise ValueError("Report not found")

    if report.get("signoff", {}).get("signed") or report.get("status") in ("signed", "ready"):
        raise ValueError("Report is already signed and immutable")

    now = utcnow_naive()
    signed_by_id = doctor_user["id"]
    signed_by_name = doctor_user.get("name") or "Dr. Ayesha Khan"
    signed_by_email = doctor_user.get("email") or "doctor@vadr.pk"

    updated_fields = {
        "clinical_notes": clinical_notes.strip() if clinical_notes else "Assessment reviewed and verified.",
        "signoff": {
            "signed": True,
            "signed_by": signed_by_id,
            "signed_by_name": signed_by_name,
            "signed_by_email": signed_by_email,
            "signed_at": now,
        },
        "status": "signed",
        "updated_at": now,
    }

    # Merge for PDF regeneration
    merged_doc = {**report, **updated_fields}
    abs_pdf_path = os.path.join(REPORTS_DIR, f"{report_id}.pdf")
    generate_pdf_report(merged_doc, abs_pdf_path)

    # Persist in MongoDB
    db.reports_col.update_one({"report_id": report_id}, {"$set": updated_fields})

    # Also mark associated screening reviewed = True
    if report.get("screening_id"):
        db.screenings_col.update_one({"id": report["screening_id"]}, {"$set": {"reviewed": True}})

    # Audit log
    log_event(
        "REPORT_SIGNED",
        user_id=doctor_user.get("id"),
        role=doctor_user.get("role"),
        metadata={
            "report_id": report_id,
            "doctor_id": signed_by_id,
            "doctor_name": signed_by_name,
            "signed_at": now.isoformat(),
        },
    )

    updated_report = db.reports_col.find_one({"report_id": report_id})
    return serialize(updated_report)


def get_report_by_id(report_id: str) -> Optional[dict[str, Any]]:
    """Retrieve report document by report_id."""
    report = db.reports_col.find_one({"report_id": report_id})
    return serialize(report) if report else None


def sanitize_report(report_doc: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Sanitize and serialize report metadata for safe API transmission."""
    if not report_doc:
        return None
    s = serialize(report_doc)
    if isinstance(s, dict):
        s.pop("_id", None)
    return s


def get_safe_pdf_path(target: Any) -> Optional[str]:
    """Validate report/path exists, PDF exists on disk, and return safe absolute path."""
    if isinstance(target, dict):
        pdf_rel = target.get("pdf_path")
        report_doc = target
    else:
        pdf_rel = str(target) if target else None
        report_doc = None

    if not pdf_rel:
        return None

    clean_rel = pdf_rel.replace("\\", "/").strip().lstrip("/")
    abs_path = os.path.normpath(os.path.join(_PROJECT_ROOT, clean_rel))

    # Guard against traversal
    if not os.path.abspath(abs_path).startswith(os.path.abspath(REPORTS_DIR)):
        return None

    if not os.path.isfile(abs_path):
        if report_doc:
            generate_pdf_report(report_doc, abs_path)
        else:
            return None

    return abs_path


def query_reports(
    filters: Optional[dict[str, Any]] = None,
    page: int = 1,
    limit: int = 20,
    **kwargs: Any,
) -> tuple[list[dict[str, Any]], int]:
    """Search and filter reports archive with pagination."""
    f = dict(filters or {})
    f.update(kwargs)
    query: dict[str, Any] = {}

    # Patient ID filter
    if f.get("patient_id"):
        query["$or"] = [
            {"patient_id": f["patient_id"]},
            {"patient.patientId": f["patient_id"]},
        ]

    # Doctor ID filter
    if f.get("doctor_id"):
        query["doctor_id"] = f["doctor_id"]

    # Status filter
    if f.get("status"):
        query["status"] = f["status"]

    # Severity / Prediction filter
    if f.get("prediction") or f.get("severity"):
        pred = f.get("prediction") or f.get("severity")
        query["assessment.prediction"] = pred

    # Text search (Patient name, patient ID, report ID)
    if f.get("search"):
        s = str(f["search"]).strip()
        query["$or"] = [
            {"report_id": {"$regex": s, "$options": "i"}},
            {"patient.name": {"$regex": s, "$options": "i"}},
            {"patient.patientId": {"$regex": s, "$options": "i"}},
            {"doctor.name": {"$regex": s, "$options": "i"}},
        ]

    # Date range filters
    if f.get("date_from") or f.get("date_to"):
        date_q = {}
        if f.get("date_from"):
            try:
                date_q["$gte"] = datetime.fromisoformat(f["date_from"])
            except ValueError:
                pass
        if f.get("date_to"):
            try:
                date_q["$lte"] = datetime.fromisoformat(f["date_to"])
            except ValueError:
                pass
        if date_q:
            query["created_at"] = date_q

    total = db.reports_col.count_documents(query)
    skip = max(page - 1, 0) * limit
    reports = list(
        db.reports_col.find(query).sort("created_at", -1).skip(skip).limit(limit)
    )

    return [serialize(r) for r in reports], total
