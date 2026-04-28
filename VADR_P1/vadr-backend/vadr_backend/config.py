import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    secret_key: str
    mongo_uri: str
    reg_code_expires_min: int
    reg_resend_cooldown_sec: int
    reg_max_verify_fails: int
    demo_password: str
    demo_staff_emails: tuple[str, ...]


def _env_root() -> Path:
    env_dir = Path(__file__).resolve().parent.parent
    if env_dir.name == "venv":
        return env_dir.parent
    return env_dir


def load_environment() -> None:
    load_dotenv(_env_root() / ".env")


settings = Settings(
    secret_key=os.environ.get("SECRET_KEY", "dev-vadr-secret-change-in-production"),
    mongo_uri=os.environ.get(
        "MONGO_URI",
        "mongodb+srv://taha757:Taharao123@vadr.elfsv9q.mongodb.net/vadr_db?retryWrites=true&w=majority",
    ),
    reg_code_expires_min=int(os.environ.get("VADR_REG_CODE_EXPIRES_MIN", "30")),
    reg_resend_cooldown_sec=int(os.environ.get("VADR_REG_RESEND_COOLDOWN_SEC", "60")),
    reg_max_verify_fails=int(os.environ.get("VADR_REG_MAX_VERIFY_FAILS", "8")),
    demo_password="admin123",
    demo_staff_emails=(
        "admin@vadr.pk",
        "ayesha@vadr.pk",
        "bilal@vadr.pk",
        "sara@vadr.pk",
    ),
)
