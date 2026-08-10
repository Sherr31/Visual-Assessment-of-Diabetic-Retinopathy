import random
import string
from datetime import datetime, timezone


def utcnow_naive():
    """Naive UTC for MongoDB comparisons."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def today():
    return datetime.today().strftime("%Y-%m-%d")


def serialize(doc):
    if not doc:
        return doc
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    out.pop("password_hash", None)
    return out


def gen_user_id():
    return "u" + "".join(random.choices(string.ascii_lowercase + string.digits, k=5))


def gen_registration_code():
    return "".join(random.choices(string.digits, k=6))


def hash_password(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password_hash: str, password: str) -> bool:
    import bcrypt

    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        from werkzeug.security import check_password_hash

        return check_password_hash(password_hash, password)


def gen_temp_password():
    digits = "".join(random.choices(string.digits, k=4))
    return f"VADR@{digits}"


def gen_session_id():
    return "sess_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=16))


def isoformat_dt(dt):
    if not dt:
        return None
    return dt.isoformat() + "Z" if dt.tzinfo is None else dt.isoformat()
