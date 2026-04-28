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


def gen_temp_password():
    digits = "".join(random.choices(string.digits, k=4))
    return f"VADR@{digits}"
