from flask import Flask
from flask_cors import CORS

from .config import load_environment, settings
from .db import init_db
from .routes.admin import admin_bp
from .routes.audit import audit_bp
from .routes.auth import auth_bp
from .routes.backups import backups_bp
from .routes.models import models_bp
from .routes.patients import patients_bp
from .routes.rbac import rbac_bp
from .routes.system import system_bp
from .routes.users import users_bp
from .services.auth_service import migrate_demo_password_hashes
from .services.model_version_service import seed_demo_models
from .services.rbac_service import seed_rbac_roles


def create_app() -> Flask:
    load_environment()

    app = Flask(__name__)
    app.config["SECRET_KEY"] = settings.secret_key
    app.url_map.strict_slashes = False

    CORS(
        app,
        origins=list(settings.cors_origins),
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    init_db(settings.mongo_uri)
    migrate_demo_password_hashes()
    seed_rbac_roles()
    seed_demo_models()

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(patients_bp, url_prefix="/api/patients")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(rbac_bp, url_prefix="/api/rbac")
    app.register_blueprint(audit_bp, url_prefix="/api/audit-logs")
    app.register_blueprint(models_bp, url_prefix="/api/model-versions")
    app.register_blueprint(backups_bp, url_prefix="/api/backups")
    app.register_blueprint(system_bp, url_prefix="/api")

    return app
