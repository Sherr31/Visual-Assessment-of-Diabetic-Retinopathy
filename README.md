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
- Fundus image upload and AI-based grading (planned phases)
- Doctor review and reporting workflows (planned phases)

### Current Implemented Scope (P1 Mid)

- User Authentication & Security
- Patient & User Management

## Repository Structure

```text
.
├── README.md
└── VADR_P1
    ├── FILE_STRUCTURE_P1_MID.md
    ├── vadr-backend
    │   ├── app.py
    │   ├── requirements.txt
    │   └── vadr_backend
    │       ├── __init__.py
    │       ├── config.py
    │       ├── db.py
    │       ├── routes
    │       │   ├── auth.py
    │       │   ├── patients.py
    │       │   ├── users.py
    │       │   └── system.py
    │       ├── services
    │       └── utils
    └── vadr-frontend
        ├── package.json
        ├── public
        └── src
            ├── App.js
            └── modules/p1-mid
```

## Tech Stack

- Backend: Flask, Flask-CORS, PyMongo, itsdangerous
- Database: MongoDB Atlas
- Frontend: React (Create React App), React Router

## Prerequisites

- Python 3.10+ (recommended)
- Node.js 18+ and npm
- MongoDB connection string (optional if default works in your local setup)

## Backend Setup and Run

```bash
cd "/home/sherry/Visual-Assessment-of-Diabetic-Retinopathy/VADR_P1/vadr-backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create env file (if not already present):

```bash
cp .env.example .env
```

Run backend:

```bash
python3 app.py
```

Backend runs on: `http://localhost:5000`

## Frontend Setup and Run

```bash
cd "/home/sherry/Visual-Assessment-of-Diabetic-Retinopathy/VADR_P1/vadr-frontend"
npm install
npm start
```

Frontend runs on: `http://localhost:3000`

## Seed Demo Data

After backend starts, call:

- `GET http://localhost:5000/api/seed`

Demo login:

- Email: `admin@vadr.pk`
- Password: `admin123`

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

## Implemented API Endpoints (P1 Mid)

### System

- `GET /api/health`
- `GET /api/seed`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/verify-registration`
- `POST /api/auth/resend-registration-code`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Patients

- `GET /api/patients`
- `GET /api/patients/<patient_id>`
- `POST /api/patients`
- `PUT /api/patients/<patient_id>`
- `PATCH /api/patients/<patient_id>/status`
- `PATCH /api/patients/<patient_id>/send-credentials`
- `DELETE /api/patients/<patient_id>`

### Users

- `GET /api/users`
- `GET /api/users/<user_id>`
- `POST /api/users`
- `PUT /api/users/<user_id>`
- `PATCH /api/users/<user_id>/status`
- `DELETE /api/users/<user_id>`

## Troubleshooting

- Backend starts but frontend fails to connect:
  - Ensure backend is running on `5000`
  - Ensure frontend is running on `3000`
- OTP email not sending:
  - Set `VADR_LOG_EMAIL_CODE=1` for local testing, or configure SMTP values
- Node dependency issues:
  - Remove `node_modules` and rerun `npm install`
- Python dependency issues:
  - Activate `.venv` before running `python3 app.py`

## Notes

- The repository currently focuses on P1-mid modules.
- Upcoming phases (P1-final, P2-mid, P2-final) include image processing, AI prediction, reporting, alerts, analytics, and patient portal.
