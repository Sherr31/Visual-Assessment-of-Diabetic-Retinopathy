from flask import Flask
from flask_cors import CORS

from .config import load_environment, settings
from .db import init_db
from .routes.auth import auth_bp
from .routes.patients import patients_bp
from .routes.system import system_bp
from .routes.users import users_bp
from .services.auth_service import migrate_demo_password_hashes


def create_app() -> Flask:
    load_environment()

    app = Flask(__name__)
    app.config["SECRET_KEY"] = settings.secret_key
    CORS(app)

    init_db(settings.mongo_uri)
    migrate_demo_password_hashes()

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(patients_bp, url_prefix="/api/patients")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(system_bp, url_prefix="/api")

    return app
