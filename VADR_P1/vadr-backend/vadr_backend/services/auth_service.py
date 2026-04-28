from itsdangerous import URLSafeTimedSerializer
from werkzeug.security import generate_password_hash

from ..config import settings
from ..db import users_col


def token_serializer():
    return URLSafeTimedSerializer(settings.secret_key)


def issue_token(user_doc):
    s = token_serializer()
    return s.dumps(
        {"id": user_doc["id"], "email": user_doc.get("email", ""), "role": user_doc.get("role", "")}
    )


def verify_token(token, max_age=60 * 60 * 24 * 7):
    s = token_serializer()
    return s.loads(token, max_age=max_age)


def migrate_demo_password_hashes():
    ph = generate_password_hash(settings.demo_password)
    for email in settings.demo_staff_emails:
        users_col.update_one(
            {"email": email, "password_hash": {"$exists": False}},
            {"$set": {"password_hash": ph}},
        )
