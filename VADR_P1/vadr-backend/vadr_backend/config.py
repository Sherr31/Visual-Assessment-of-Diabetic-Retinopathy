import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

VALID_ROLES = frozenset({"admin", "doctor", "screener", "patient"})
PUBLIC_REGISTRATION_ROLES = frozenset({"doctor", "screener", "patient"})
USER_STATUSES = frozenset({"active", "pending_approval", "suspended", "unverified"})


@dataclass(frozen=True)
class Settings:
    secret_key: str
    jwt_secret_key: str
    mongo_uri: str
    access_token_expires_min: int
    refresh_token_expires_days: int
    reg_code_expires_min: int
    reg_resend_max_per_hour: int
    reg_max_verify_fails: int
    rejection_reapply_days: int
    refresh_cookie_name: str
    refresh_cookie_secure: bool
    refresh_cookie_samesite: str
    cors_origins: tuple[str, ...]
    redis_url: str | None
    demo_password: str
    demo_staff_emails: tuple[str, ...]


def _env_root() -> Path:
    env_dir = Path(__file__).resolve().parent.parent
    if env_dir.name == "venv":
        return env_dir.parent
    return env_dir


def load_environment() -> None:
    load_dotenv(_env_root() / ".env")


def _parse_cors_origins(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ("http://localhost:3000", "http://127.0.0.1:3000")
    return tuple(o.strip() for o in raw.split(",") if o.strip())


settings = Settings(
    secret_key=os.environ.get("SECRET_KEY", "dev-vadr-secret-change-in-production"),
    jwt_secret_key=os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY", "dev-vadr-jwt-change-in-production"),
    mongo_uri=os.environ.get(
        "MONGO_URI",
        "mongodb+srv://taha757:Taharao123@vadr.elfsv9q.mongodb.net/vadr_db?retryWrites=true&w=majority",
    ),
    access_token_expires_min=int(os.environ.get("VADR_ACCESS_TOKEN_EXPIRES_MIN", "15")),
    refresh_token_expires_days=int(os.environ.get("VADR_REFRESH_TOKEN_EXPIRES_DAYS", "7")),
    reg_code_expires_min=int(os.environ.get("VADR_REG_CODE_EXPIRES_MIN", "10")),
    reg_resend_max_per_hour=int(os.environ.get("VADR_REG_RESEND_MAX_PER_HOUR", "3")),
    reg_max_verify_fails=int(os.environ.get("VADR_REG_MAX_VERIFY_FAILS", "8")),
    rejection_reapply_days=int(os.environ.get("VADR_REJECTION_REAPPLY_DAYS", "30")),
    refresh_cookie_name=os.environ.get("VADR_REFRESH_COOKIE_NAME", "vadr_refresh_token"),
    refresh_cookie_secure=os.environ.get("VADR_REFRESH_COOKIE_SECURE", "false").lower() in ("1", "true", "yes"),
    refresh_cookie_samesite=os.environ.get("VADR_REFRESH_COOKIE_SAMESITE", "Lax"),
    cors_origins=_parse_cors_origins(os.environ.get("CORS_ORIGINS")),
    redis_url=os.environ.get("REDIS_URL") or None,
    demo_password=os.environ.get("VADR_DEMO_PASSWORD", "admin123"),
    demo_staff_emails=(
        "admin@vadr.pk",
        "ayesha@vadr.pk",
        "bilal@vadr.pk",
        "sara@vadr.pk",
    ),
)
