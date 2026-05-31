# Visual Assessment of Diabetic Retinopathy (VADR)

AI-assisted web platform for diabetic retinopathy screening and workflow management.

Final Year Project (Spring 2026), SZABIST University Islamabad

## Team

- Shehryar Rasheed (2212461)
- Taha Rehman (2212464)
- Muhammad Arham (2212441)

## Project Scope

VADR aims to provide:

- Secure authentication with role-based access
- Patient and user management workflows
- Admin panel: audit logs, model versioning, backups
- Fundus image upload and AI-based grading (planned phases)
- Doctor review and reporting workflows (planned phases)

### Current Implemented Scope (P1 Mid)

| Module | Status |
|--------|--------|
| User authentication & email verification | Done |
| Patient management (CRUD, medical history) | Done |
| User account management (CRUD, reset password, activate/deactivate) | Done |
| RBAC — roles & granular permissions | Done |
| Audit logs & monitoring | Done |
| AI model version control (register, promote, rollback, compare) | Done |
| System backup management (create, restore, delete) | Done |
| Fundus upload & live AI inference | Planned |

## Admin Panel Features

Staff with the **admin** role (or roles granted the right permissions) can use these tabs in the main dashboard (`/`):

1. **User Accounts** — Create/update/delete staff users, search and filter, reset passwords, toggle active status.
2. **Roles & Permissions** — Edit per-role permission flags (e.g. `can_manage_users`, `can_view_logs`) stored in MongoDB; enforced on the API.
3. **Audit Logs** — View timestamped CREATE/UPDATE/DELETE/LOGIN events with actor, table, old/new values, and IP.
4. **AI Models** — Register checkpoints, promote to production, rollback, compare metrics between versions.
5. **Backups** — On-demand gzip archives of database collections; one-click restore.

Protected routes require `Authorization: Bearer <token>` from login. Permissions are loaded via `GET /api/rbac/me/permissions`.

### Supported roles

`admin`, `manager`, `doctor`, `staff`, `technician`, `viewer` (defaults seeded on backend startup).

## Repository Structure

```text
.
├── README.md
└── VADR_P1
    ├── FILE_STRUCTURE_P1_MID.md
    ├── vadr-backend
    │   ├── app.py                 # Entry point → vadr_backend.create_app()
    │   ├── requirements.txt
    │   ├── backups/               # Gzip DB archives (gitignored)
    │   └── vadr_backend
    │       ├── __init__.py
    │       ├── config.py
    │       ├── db.py
    │       ├── routes
    │       │   ├── auth.py
    │       │   ├── patients.py
    │       │   ├── users.py
    │       │   ├── rbac.py
    │       │   ├── audit.py
    │       │   ├── models.py
    │       │   ├── backups.py
    │       │   └── system.py
    │       ├── services
    │       │   ├── auth_service.py
    │       │   ├── rbac_service.py
    │       │   ├── audit_service.py
    │       │   ├── model_version_service.py
    │       │   └── backup_service.py
    │       └── utils
    │           ├── common.py
    │           └── auth_decorators.py
    └── vadr-frontend
        ├── package.json
        ├── public
        └── src
            ├── App.js
            ├── vadr-module2.jsx    # Main staff dashboard
            ├── admin-panels.jsx    # Audit, RBAC editor, models, backups
            └── modules/p1-mid
```

## Tech Stack

- **Backend:** Flask, Flask-CORS, PyMongo, Werkzeug (password hashing), itsdangerous (signed tokens)
- **Database:** MongoDB Atlas (`vadr_db`)
- **Frontend:** React (Create React App), React Router

## Prerequisites

- Python 3.10+ (recommended)
- Node.js 18+ and npm
- MongoDB connection string (set in `.env` or use project default for development)

## Backend Setup and Run

```bash
cd VADR_P1/vadr-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create env file (if not already present):

```bash
cp .env.example .env
```

Optional backup directory (defaults to `vadr-backend/backups/`):

```env
VADR_BACKUP_DIR=/path/to/backups
```

Run backend:

```bash
python3 app.py
```

Backend runs on: `http://localhost:5000`

## Frontend Setup and Run

```bash
cd VADR_P1/vadr-frontend
npm install
npm start
```

Frontend runs on: `http://localhost:3000`

Optional API base URL:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Seed Demo Data

After backend starts, call:

```bash
curl http://localhost:5000/api/seed
```

Demo login:

- Email: `admin@vadr.pk`
- Password: `admin123`

On first startup the backend also seeds default **RBAC roles** and demo **AI model versions** (RetinaNet v4.0 / v4.2 / v4.3-beta).

## Authentication and Email Verification

Registration uses email verification codes.

If SMTP is not configured, you may see:

- `SMTP username not set (MAIL_USERNAME)`

For local testing, add this to `VADR_P1/vadr-backend/.env`:

```env
VADR_LOG_EMAIL_CODE=1
```

Then restart backend and use the OTP printed in terminal logs.

To send real emails, configure:

- `MAIL_SERVER`
- `MAIL_PORT`
- `MAIL_USE_TLS`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `MAIL_DEFAULT_SENDER`

## API Endpoints

Unless noted, endpoints require `Authorization: Bearer <token>` and the appropriate RBAC permission.

### System (public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET/POST | `/api/seed` | Seed demo users (if empty) |

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Start registration (sends OTP) |
| POST | `/api/auth/verify-registration` | No | Complete registration |
| POST | `/api/auth/resend-registration-code` | No | Resend OTP |
| POST | `/api/auth/login` | No | Login → token + user |
| GET | `/api/auth/me` | Bearer | Current user profile |

### Patients

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/patients` | `can_manage_patients` or `can_view_dashboard` |
| GET | `/api/patients/<id>` | Authenticated |
| POST | `/api/patients` | `can_manage_patients` |
| PUT | `/api/patients/<id>` | `can_manage_patients` |
| PATCH | `/api/patients/<id>/status` | `can_manage_patients` |
| PATCH | `/api/patients/<id>/send-credentials` | `can_manage_patients` |
| DELETE | `/api/patients/<id>` | `can_manage_patients` |
| GET/PUT | `/api/patients/<id>/medical-history` | GET: auth; PUT: `can_manage_patients` |
| GET | `/api/patients/<id>/medical-history/export` | `can_export_data` |

### Users

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/users` | `can_manage_users` (supports `?search=&role=&status=`) |
| GET | `/api/users/<id>` | `can_manage_users` |
| POST | `/api/users` | `can_manage_users` |
| PUT | `/api/users/<id>` | `can_manage_users` |
| PATCH | `/api/users/<id>/status` | `can_manage_users` |
| POST | `/api/users/<id>/reset-password` | `can_manage_users` |
| DELETE | `/api/users/<id>` | `can_manage_users` |

### RBAC

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/rbac/permissions` | `can_manage_rbac` |
| GET | `/api/rbac/roles` | `can_manage_rbac` |
| PUT | `/api/rbac/roles/<role_id>` | `can_manage_rbac` |
| GET | `/api/rbac/me/permissions` | Authenticated |

### Audit logs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/audit-logs` | `can_view_logs` (supports `?search=&action=&limit=&skip=`) |

### AI model versions

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/model-versions` | `can_edit_models` |
| POST | `/api/model-versions` | `can_edit_models` |
| POST | `/api/model-versions/<id>/promote` | `can_edit_models` |
| POST | `/api/model-versions/<id>/rollback` | `can_edit_models` |
| POST | `/api/model-versions/<id>/archive` | `can_edit_models` |
| GET | `/api/model-versions/compare?a=&b=` | `can_edit_models` |

### Backups

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/backups` | `can_manage_backups` |
| POST | `/api/backups` | `can_manage_backups` (body: `{ "include_audit": true }`) |
| POST | `/api/backups/<id>/restore` | `can_manage_backups` |
| DELETE | `/api/backups/<id>` | `can_manage_backups` |

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `users` | Staff accounts |
| `patients` | Patient records |
| `medical_history` | Visits, medications, scans per patient |
| `registration_pending` | OTP registration flow |
| `roles` | RBAC role → permission map |
| `audit_logs` | Security / compliance audit trail |
| `model_versions` | AI checkpoint registry |
| `backups` | Backup job metadata |

## Troubleshooting

- **Backend starts but frontend fails to connect**
  - Ensure backend is on port `5000` and frontend on `3000`.
- **401 / Forbidden on API calls**
  - Log in again; ensure the request sends `Authorization: Bearer <token>`.
  - Admin has all permissions; other roles need flags in **Roles & Permissions**.
- **OTP email not sending**
  - Set `VADR_LOG_EMAIL_CODE=1` for local testing, or configure SMTP in `.env`.
- **Restore backup overwrote data**
  - Restore replaces collection contents; use only with caution in production.
- **Node / Python dependency issues**
  - Reactivate `.venv` and rerun `pip install -r requirements.txt`, or `rm -rf node_modules && npm install`.

## Roadmap (upcoming phases)

- Fundus image upload and preprocessing
- TensorFlow inference pipeline linked to `model_versions`
- Doctor review UI and PDF reporting
- Alerts, analytics dashboard, patient self-service portal
