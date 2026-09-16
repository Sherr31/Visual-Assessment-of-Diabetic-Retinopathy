# CODEBASE AUDIT & TECHNICAL HANDOFF REPORT
**Project:** Visual Assessment of Diabetic Retinopathy (VADR)  
**Audit Scope:** Full codebase inspection (Frontend, Backend, MongoDB Database, AI/ML Pipeline, RBAC/Auth, System Administration, Git Repository Status)  
**Execution Mode:** Read-Only Audit Documentation

---

## 1. PROJECT OVERVIEW

### 1.1 What the VADR System Currently Does
VADR is a web-based clinical and screening platform for AI-assisted detection and grading of Diabetic Retinopathy (DR). The system currently provides:
- User authentication, session management, multi-step email OTP registration verification, password reset flows, and JWT access/refresh token handling.
- Patient record management (creation, listing, updating, deactivation, and permanent deletion) with assigned clinician tracking.
- Medical history tracking (longitudinal visits, medications, comorbidities, manual scan records, and printable reports).
- Retinal fundus image upload and AI-driven grading via an EfficientNetB3 deep learning model (`.keras`), returning 5-class DR classification, softmax confidence scores, class probabilities, and an input-gradient/Grad-CAM visual heatmap overlay.
- Complete System Administration capabilities:
  - Role-based doctor registration approvals and rejections.
  - Role permission matrix editor (dynamic RBAC stored in MongoDB with hard-coded safety guardrails for admin privileges).
  - Searchable, paginated audit logging across auth and administrative events with date/type filters.
  - Full system database backup and restore engine with Gzip compression and SHA-256 checksum verification.

### 1.2 Main Purpose of the Application
To provide ophthalmologists, clinical screeners, administrators, and patients with a unified platform for registering diabetic patients, capturing and analyzing retinal fundus photographs using deep learning, tracking DR progression over time, and maintaining secure, auditable clinical records.

### 1.3 Current Technology Stack
- **Backend:** Python 3.10+, Flask 3.0.0, Flask-CORS 4.0+, PyMongo 4.6+, PyJWT 2.8+, bcrypt 4.0+, Werkzeug 3.0.0, itsdangerous 2.0+, Gzip, Python standard `smtplib`/`ssl`.
- **AI / Deep Learning:** TensorFlow CPU 2.16.1, Keras 3.8.0, NumPy 1.26.4, Pillow 10.0.1, Matplotlib 3.8+ (Agg headless backend), OpenCV-Python 4.9+.
- **Database:** MongoDB (MongoDB Atlas replica set `vadr_db` configured with `dnspython` DNS resolution fallback).
- **Frontend:** React 19.2.5 (Create React App `react-scripts` 5.0.1), React Router DOM 7.6.1, Lucide React 0.383.0 (icons), Recharts 2.12.7 (data visualization), Vanilla CSS with custom CSS variables and light/dark theme system (`vadr-theme.css`, `vadr-dashboard.css`, `vadr-auth.css`, `vadr-fundus.css`).

### 1.4 Frontend Architecture
- Single Page Application (SPA) driven by React Router v7 (`BrowserRouter`, `Routes`, `Route`, `Navigate`).
- Route guards: `RequireAuth` (validates JWT existence in `localStorage`) and `RequireStaff` (restricts access to `admin`, `doctor`, and `screener`, redirecting `patient` to `/my-records` and pending doctors to `/pending-approval`).
- Centralized API layer in `src/api.js` using native `fetch` with automatic JSON parsing, Bearer token injection, httpOnly cookie credentials, error unwrapping via custom `ApiError`, and automated session clearance on HTTP 401.
- Theme architecture: `ThemeProvider` in `src/lib/ThemeContext.jsx` setting `data-theme="dark|light"` on the root document with system preference detection (`prefers-color-scheme`) and `localStorage` persistence.

### 1.5 Backend Architecture
- Flask Application Factory pattern (`create_app()` in `vadr_backend/__init__.py`).
- Modular Blueprint architecture:
  - `auth_bp` mounted at `/api/auth`
  - `admin_bp` mounted at `/api/admin`
  - `patients_bp` mounted at `/api/patients`
  - `users_bp` mounted at `/api/users`
  - `system_bp` mounted at `/api`
  - `predict_bp` mounted at `/api`
- CORS configured via `flask_cors.CORS` supporting credentials, custom headers, and origins from `.env` or defaults.
- Standardized response formatting helpers `api_success()` and `api_error()` returning uniform `{ data, error, message, code? }` JSON envelopes.

### 1.6 Database Architecture
- MongoDB database named `vadr_db` managed via `PyMongo.MongoClient`.
- Single database connection initialized globally in `vadr_backend/db.py` exposing collection handles.
- Automated compound and single-field index initialization on startup for `refresh_tokens`, `sessions`, `audit_logs`, `approval_requests`, `verification_codes`, and `system_backups`.

### 1.7 AI/ML Architecture
- Model file: `diabetic_retinopathy_model.keras` (~45.3 MB) loaded via Keras 3.x in `vadr_backend/services/ai/model_loader.py`.
- Preprocessing: PIL image resize to `(224, 224)`, RGB conversion, float32 scaling `/ 255.0`, and batch dimension expansion (`vadr_backend/services/ai/preprocess.py`).
- Inference: EfficientNetB3 classifier evaluating 5 severity classes (`No DR`, `Mild`, `Moderate`, `Severe`, `Proliferative DR`) with softmax probability distribution.
- Explainability / Heatmap: `vadr_backend/services/ai/gradcam.py` generates input-gradient heatmaps normalized with jet colormap and overlaid on fundus photographs, saved to `uploads/gradcam/<uuid>.png` and served via `/api/gradcam-image?path=...`.
- Fallback resilience: predictor gracefully falls back to mock responses if TensorFlow or the model file is not present.

### 1.8 Authentication/Authorization Architecture
- Dual-token model: short-lived JWT Access Tokens (15 min default) passed via `Authorization: Bearer <token>` + long-lived secure HttpOnly Refresh Tokens (7 days default) stored in the `refresh_tokens` collection as SHA-256 hashes.
- Server-side Session tracking: active records in `sessions` collection with IP address, user agent, device fingerprint hash, and explicit session revocation capability.
- Access control: `@require_auth(roles=[...])` decorator in `vadr_backend/decorators.py` validating JWT signature, expiration, database user existence, suspension status, email verification status, pending doctor status, and role membership.
- Dynamic permission matrix stored in MongoDB `rbac_settings` with 12 permission keys mapped across 4 roles, administered via `/api/admin/permissions`.

### 1.9 Module Implementation Status Breakdown
- **Fully Implemented Modules:**
  - `Module 1: User Authentication & Security` (registration, email OTP verification, password reset OTP, login, JWT refresh, logout, session lists & revocation).
  - `Module 2: Patient & User Management` (patient CRUD, staff CRUD, doctor assignment dropdowns, status toggling, temp credential generation).
  - `Module 5: Medical History Management` (longitudinal visit history, HbA1c tracking, comorbidities, medications, manual scan list, chart visualization, printable clinical summary).
  - `System Administration Sub-module A: Audit Logs & Monitoring` (audit log collection, backend query/filter API, admin UI with pagination and date/type filters).
  - `System Administration Sub-module B: System Backup Management` (Gzip backup creation across 6 key collections, disk persistence in `vadr-backend/backups/`, SHA-256 verification, restore endpoint with safety logout, admin UI).
  - `AI Screening Sub-module: Fundus Image Analysis & Grad-CAM` (image upload, preprocessing, model inference, Grad-CAM generation, image brightness/contrast/zoom adjustments, canvas annotation tools, eye slot selector).
- **Partially Implemented Modules:**
  - `AI Clinical Integration`: AI predictions run and render in the UI, but results are not yet persisted to a patient's medical history or linked to a database scan record automatically.
  - `Patient Portal`: `/my-records` route exists and loads patient data by matching user email, but provides minimal self-service features.
  - `Doctor Dashboard / Clinical Review`: `DrDashboard.jsx` exists as an extensive UI prototype with mock data, KPI widgets, and Recharts charts, but is not yet wired to live backend statistics or database records.
- **Planned / Not-Yet-Implemented Modules:**
  - `System Dashboard` (Global KPI metrics, live incoming screenings feed, real-time pending review counter, high-severity clinical alert banner, quick actions).
  - `Automated PDF Diagnostic Report Generation`.
  - `AI Model Version Control / Model Registry`.

---

## 2. PROJECT STRUCTURE

```text
Visual-Assessment-of-Diabetic-Retinopathy/
├── .git/                                         # Git version control directory
├── .vscode/                                      # Shared workspace editor settings
│   └── settings.json                             # Python interpreter & analysis settings
├── README.md                                     # Root project documentation and setup guide
├── pyrightconfig.json                            # Python type checking configuration
├── VADR_P1/                                      # Main active project directory (Phase 1)
│   ├── FILE_STRUCTURE_P1_MID.md                  # Documentation on P1 mid modular organization
│   ├── vadr-backend/                             # Flask Backend Application
│   │   ├── .env                                  # Active environment variables (secrets, DB URI, SMTP)
│   │   ├── .env.example                          # Sample template for environment configuration
│   │   ├── .gitignore                            # Backend git ignore rules (backups, uploads, env)
│   │   ├── .venv/                                # Active Python virtual environment
│   │   ├── app.py                                # WSGI backend entry point (invokes create_app().run())
│   │   ├── backups/                              # Local storage directory for .json.gz system backups
│   │   ├── requirements.txt                      # Python package dependencies
│   │   ├── uploads/                              # Temporary and persistent fundus uploads
│   │   │   └── gradcam/                          # Generated Grad-CAM heatmap overlay PNG images
│   │   └── vadr_backend/                         # Core Python package
│   │       ├── __init__.py                       # App factory create_app(), CORS, Blueprint registration
│   │       ├── config.py                         # Settings dataclass, env loading, role/status constants
│   │       ├── db.py                             # PyMongo client initialization, collections, index creation
│   │       ├── decorators.py                     # @require_auth RBAC & token validation decorator
│   │       ├── responses.py                      # Standardized api_success() & api_error() JSON formatters
│   │       ├── routes/                           # API Route Blueprints
│   │       │   ├── admin.py                      # Approvals, audit logs, RBAC matrix, system backups
│   │       │   ├── auth.py                       # Register, verify OTP, reset password, login, refresh, logout, sessions
│   │       │   ├── patients.py                   # Patient CRUD, medical history CRUD, history export
│   │       │   ├── predict.py                    # AI inference POST /predict and GET /gradcam-image
│   │       │   ├── system.py                     # Health check GET /health and demo data seed GET/POST /seed
│   │       │   └── users.py                      # Staff user CRUD, doctor listing, status toggles
│   │       ├── services/                         # Business Logic & External Services
│   │       │   ├── ai/                           # AI / ML inference subsystem
│   │       │   │   ├── __init__.py               # AI package init
│   │       │   │   ├── diabetic_retinopathy_model.keras # Trained EfficientNetB3 Keras model file
│   │       │   │   ├── gradcam.py                # Input-gradient/Grad-CAM heatmap generator
│   │       │   │   ├── model_loader.py           # Model loading singleton with missing-file fallback
│   │       │   │   ├── predictor.py              # Prediction orchestrator and class probability mapping
│   │       │   │   └── preprocess.py             # PIL image resizing, RGB conversion, float normalization
│   │       │   ├── audit_service.py              # Audit logging write (log_event) and query (query_logs)
│   │       │   ├── auth_service.py               # Token hashing, session creation/revocation, cookie helpers
│   │       │   ├── backup_service.py             # Mongo collection dump, Gzip compression, SHA-256, restore
│   │       │   ├── mail_service.py               # SMTP client for registration OTP, reset OTP, approval notices
│   │       │   ├── permissions_service.py        # RBAC matrix persistence, validation, default normalization
│   │       │   └── token_service.py              # PyJWT access token encoding and verification
│   │       └── utils/                            # Shared Utilities
│   │           ├── common.py                     # ID generators, naive UTC datetime, bcrypt password helpers
│   │           └── request_context.py            # Client IP, User-Agent, and device fingerprint extraction
│   │
│   └── vadr-frontend/                            # React Frontend Application
│       ├── .env.example                          # Template for React environment variables
│       ├── .gitignore                            # Frontend git ignore rules (build, node_modules)
│       ├── .npmrc                                # npm configuration
│       ├── package.json                          # Frontend dependencies and npm scripts
│       ├── package-lock.json                     # Locked dependency tree
│       ├── public/                               # Public web assets (index.html, icons, manifest)
│       └── src/                                  # React source code
│           ├── App.css                           # App container styles
│           ├── App.js                            # App component with React Router route table & auth guards
│           ├── api.js                            # Unified Fetch API client with ApiError, authAPI, patientAPI, adminAPI, predictAPI
│           ├── DrDashboard.jsx                   # Doctor Dashboard UI prototype with Recharts & KPI cards (Mock data)
│           ├── ForgotPasswordPage.jsx            # Multi-step password reset page (Email -> OTP -> New password)
│           ├── index.css                         # Global base styles and reset
│           ├── index.js                          # React 19 DOM root mount and ThemeProvider wrapper
│           ├── LoginPage.jsx                     # Login page with demo credentials helper and toggleable password
│           ├── RegisterPage.jsx                  # Multi-step self-registration page with role selection & OTP verify
│           ├── vadr-auth.css                     # Auth pages styling (glassmorphism, gradient blobs)
│           ├── vadr-dashboard.css                # Dashboard and table layout stylesheet
│           ├── vadr-fundus.css                   # Fundus image module stylesheet (darkroom canvas, annotations)
│           ├── vadr-module2.jsx                  # Comprehensive Staff, Patient, Approvals, RBAC, Audit, & Backup UI
│           ├── vadr-theme.css                    # CSS theme variables for Light and Dark modes
│           ├── components/
│           │   └── ThemeToggle.jsx               # Light/Dark mode switcher button
│           ├── lib/
│           │   ├── ThemeContext.jsx              # React context managing theme state and HTML data-theme attribute
│           │   └── session.js                    # Role helpers (canAccessStaffPortal, isAdmin, getHomeRoute)
│           ├── modules/
│           │   └── p1-mid/
│           │       ├── auth/pages/               # Module 1 auth page re-exports
│           │       │   ├── ForgotPasswordPage.jsx
│           │       │   ├── LoginPage.jsx
│           │       │   └── RegisterPage.jsx
│           │       ├── fundus-image/             # Module 4 Fundus Analysis
│           │       │   ├── FundusImageModule.jsx # Image upload, canvas annotation, zoom/contrast, AI prediction UI
│           │       │   ├── vadr-fundus.css
│           │       │   └── pages/
│           │       │       └── FundusImagePage.jsx # Page wrapper with header navigation and theme toggle
│           │       ├── medical-history-management/pages/ # Module 5 Medical History
│           │       │   └── MedicalHistoryManagementPage.jsx # Longitudinal history, HbA1c chart, visit CRUD, print view
│           │       ├── patient-user-management/pages/ # Module 2 Patient & Staff Management
│           │       │   └── PatientUserManagementPage.jsx # Re-export wrapper for vadr-module2.jsx
│           │       └── shared/
│           │           └── api.js                # Re-export of root src/api.js
│           └── pages/
│               ├── PatientRecordsPage.jsx        # Patient self-service records view
│               └── PendingApprovalPage.jsx       # Doctor account pending admin approval waiting screen
```

---

## 3. FRONTEND ANALYSIS

### 3.1 Entry Point, Routing, & Layouts
- **Entry Point:** `src/index.js` initializes the theme via `applyTheme(getInitialTheme())` and renders `<ThemeProvider><App /></ThemeProvider>` into `document.getElementById('root')`.
- **Router Configuration:** `src/App.js` defines the full React Router route hierarchy.
- **Layouts & Shell:** The staff application shell (`vadr-module2.jsx` and `FundusImagePage.jsx`) features a top header with branding, active section pills, user profile chips, theme toggle, and logout action.

### 3.2 Authentication & Route Protection
- **`RequireAuth`:** Checks `getToken()` in `localStorage`. If absent, redirects to `/login`.
- **`RequireStaff`:** Checks `getStoredUser()`.
  - Redirects unauthenticated users to `/login`.
  - Redirects doctors with `status === "pending_approval"` to `/pending-approval`.
  - Redirects users with `role === "patient"` to `/my-records`.
  - Restricts non-staff roles via `canAccessStaffPortal()`.

### 3.3 State Management & UI Libraries
- **State Management:** React local hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`) and Context API (`ThemeContext`). No external state manager (Redux/Zustand) is installed.
- **Styling:** Vanilla CSS coupled with CSS Custom Properties (`--vadr-bg`, `--vadr-surface`, `--vadr-border`, `--vadr-text`, `--vadr-primary`) defined in `vadr-theme.css`. **Tailwind CSS is NOT installed or configured.**
- **Icons:** `lucide-react` (0.383.0) and inline SVG icon dictionaries (`I` in `vadr-module2.jsx` and `MedicalHistoryManagementPage.jsx`).
- **Data Visualization:** `recharts` (2.12.7) utilized in `DrDashboard.jsx` (`AreaChart`, `BarChart`) and `MedicalHistoryManagementPage.jsx` (`LineChart`).
- **Framer Motion:** **Not installed in `package.json`.** Custom transitions and smooth ease-out animations are handled via CSS transitions and `requestAnimationFrame` hooks (`useAnimatedNumber`).

### 3.4 Major Frontend Pages and Modules

| Module Name | Route | Purpose | Key Components | Backend APIs Used | Allowed Roles | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication: Login** | `/login` | Staff & patient sign-in | `LoginPage.jsx`, `ThemeToggle` | `POST /api/auth/login` | Public | **Implemented** |
| **Authentication: Register** | `/register` | User self-registration with OTP | `RegisterPage.jsx`, `ThemeToggle` | `POST /api/auth/register`, `POST /api/auth/verify-registration`, `POST /api/auth/resend-registration-code` | Public | **Implemented** |
| **Authentication: Forgot Password** | `/forgot-password` | Password recovery with OTP | `ForgotPasswordPage.jsx`, `ThemeToggle` | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/resend-password-reset-code` | Public | **Implemented** |
| **Pending Approval Notice** | `/pending-approval` | Informs newly registered doctors their account is under review | `PendingApprovalPage.jsx`, `ThemeToggle` | `POST /api/auth/logout` | `doctor` (pending) | **Implemented** |
| **Patient & Staff Management** | `/` | Clinical portal: Patient registry, staff management, doctor approvals, RBAC matrix, audit logs, system backups | `PatientUserManagementPage.jsx` (`vadr-module2.jsx`), `AuditLogsTab`, `BackupsTab`, `RbacTab`, `ApprovalsTab`, `PatientsTab`, `UsersTab` | `GET/POST /api/patients`, `GET/POST/PUT /api/users`, `GET /api/users/doctors`, `GET /api/admin/pending-doctors`, `PATCH /api/admin/users/:id/approve`, `PATCH /api/admin/users/:id/reject`, `GET/PUT/POST /api/admin/permissions`, `GET /api/admin/audit-logs`, `GET/POST /api/admin/backups`, `POST /api/admin/backups/:id/restore` | `admin`, `doctor`, `screener` | **Implemented** |
| **Medical History & Visits** | `/medical-history/:patientId` | Longitudinal record of visits, medications, comorbidities, HbA1c trend chart, scan records, printable export | `MedicalHistoryManagementPage.jsx`, `LineChart`, `StatCard`, printable modal | `GET/PUT /api/patients/:id/medical-history`, `GET /api/patients/:id`, `GET /api/patients/:id/medical-history/export` | `admin`, `doctor`, `patient` | **Implemented** |
| **Fundus Image Analysis** | `/fundus-analysis` | Retinal image upload, darkroom canvas tools, zoom/contrast controls, AI prediction execution, Grad-CAM visualization | `FundusImagePage.jsx`, `FundusImageModule.jsx`, Canvas annotation tool | `POST /api/predict`, `GET /api/gradcam-image` | `admin`, `doctor`, `screener` | **Implemented** |
| **Patient Self-Service** | `/my-records` | Patient portal landing page linking to own medical history | `PatientRecordsPage.jsx` | `GET /api/patients` (matches email) | `patient` | **Partial** |
| **Doctor Clinical Dashboard** | `/doctor` | Clinical metrics overview, retina SVG viewer, severity distributions, recent scan queue | `DrDashboard.jsx`, `AreaChart`, `BarChart`, `RetinaSVG` | None (currently relies on static mock constants `PATIENTS`, `SCANS`, `TREND_DATA`) | `admin`, `doctor`, `screener` | **Placeholder / Prototype** |

---

## 4. BACKEND ANALYSIS

### 4.1 Application Initialization & Configuration
- **Entry File:** `app.py` creates the Flask app via `create_app()` and runs on port 5000 in debug mode.
- **Factory:** `vadr_backend/__init__.py` initializes environment variables, configures CORS, connects to MongoDB via `init_db()`, executes demo hash migration via `migrate_demo_password_hashes()`, and registers all Blueprints.
- **Configuration:** `vadr_backend/config.py` encapsulates `Settings` dataclass reading `.env` variables with sensible fallbacks (token expiration, cookie security, MongoDB URI, SMTP configurations).

### 4.2 Complete API Endpoint Catalog

#### System & Health Routes (`system_bp` - prefix `/api`)
- `GET /api/health`
  - **Purpose:** Service liveness check.
  - **Auth Required:** No.
  - **Allowed Roles:** Public.
  - **Database Collection:** None.
  - **Frontend Usage:** `checkHealth()` in `src/api.js`.
  - **Status:** Implemented.
- `GET/POST /api/seed`
  - **Purpose:** Seeds initial demo staff accounts (`u1` admin, `u2` active doctor, `u3` pending doctor, `u4` screener) if the database is empty.
  - **Auth Required:** No.
  - **Allowed Roles:** Public / Dev.
  - **Database Collections:** `users`, `approval_requests`.
  - **Frontend Usage:** Initial setup / testing.
  - **Status:** Implemented.

#### Authentication Routes (`auth_bp` - prefix `/api/auth`)
- `POST /api/auth/register`
  - **Purpose:** Validates registration payload, hashes password, stores pending registration, and sends 6-digit email OTP. (Can be bypassed via `SKIP_EMAIL_VERIFICATION = False`).
  - **Auth Required:** No.
  - **Allowed Roles:** `doctor`, `screener`, `patient`.
  - **Request:** `{ name, email, password, role, department?, phone? }`.
  - **Response:** `{ data: { verificationRequired: true, email, emailSent, expiresInMinutes }, message }`.
  - **Database Collections:** `users`, `verification_codes`, `registration_pending`, `audit_logs`.
  - **Frontend Usage:** `authAPI.register()` in `RegisterPage.jsx`.
  - **Status:** Implemented.
- `POST /api/auth/verify-registration`
  - **Purpose:** Verifies 6-digit OTP, creates the user account in `users` (doctors set to `pending_approval`, others `active`), creates approval request for doctors, establishes session, issues JWT and refresh cookie.
  - **Auth Required:** No.
  - **Request:** `{ email, code }`.
  - **Response:** `{ data: { access_token, token, expires_in, role, status, user }, message }`.
  - **Database Collections:** `verification_codes`, `users`, `registration_pending`, `approval_requests`, `sessions`, `refresh_tokens`, `audit_logs`.
  - **Frontend Usage:** `authAPI.verifyRegistration()` in `RegisterPage.jsx`.
  - **Status:** Implemented.
- `POST /api/auth/resend-registration-code`
  - **Purpose:** Generates a new OTP for pending registration and sends via email.
  - **Auth Required:** No.
  - **Request:** `{ email }`.
  - **Database Collections:** `verification_codes`, `registration_pending`.
  - **Frontend Usage:** `authAPI.resendCode()` in `RegisterPage.jsx`.
  - **Status:** Implemented.
- `POST /api/auth/forgot-password`
  - **Purpose:** Issues a 6-digit password reset OTP to registered email.
  - **Auth Required:** No.
  - **Request:** `{ email }`.
  - **Database Collections:** `users`, `verification_codes`, `audit_logs`.
  - **Frontend Usage:** `authAPI.forgotPassword()` in `ForgotPasswordPage.jsx`.
  - **Status:** Implemented.
- `POST /api/auth/resend-password-reset-code`
  - **Purpose:** Resends password reset OTP for an active reset request.
  - **Auth Required:** No.
  - **Request:** `{ email }`.
  - **Database Collections:** `verification_codes`, `users`.
  - **Frontend Usage:** `authAPI.resendPasswordResetCode()` in `ForgotPasswordPage.jsx`.
  - **Status:** Implemented.
- `POST /api/auth/reset-password`
  - **Purpose:** Verifies reset OTP and updates user's bcrypt `password_hash`.
  - **Auth Required:** No.
  - **Request:** `{ email, code, password }`.
  - **Database Collections:** `verification_codes`, `users`, `audit_logs`.
  - **Frontend Usage:** `authAPI.resetPassword()` in `ForgotPasswordPage.jsx`.
  - **Status:** Implemented.
- `POST /api/auth/login`
  - **Purpose:** Validates credentials via bcrypt, checks account status (suspension/verification), updates `lastLogin`, creates session in `sessions`, issues access JWT in JSON response and refresh token in HttpOnly cookie.
  - **Auth Required:** No.
  - **Request:** `{ email, password }`.
  - **Response:** `{ data: { access_token, token, expires_in, role, status, user }, message }` + `Set-Cookie`.
  - **Database Collections:** `users`, `sessions`, `refresh_tokens`, `audit_logs`.
  - **Frontend Usage:** `authAPI.login()` in `LoginPage.jsx`.
  - **Status:** Implemented.
- `POST /api/auth/refresh`
  - **Purpose:** Validates HttpOnly cookie refresh token hash, updates session `last_seen`, issues new access JWT.
  - **Auth Required:** No (Token in Cookie).
  - **Database Collections:** `refresh_tokens`, `users`, `sessions`.
  - **Frontend Usage:** `authAPI.refresh()` in `src/api.js`.
  - **Status:** Implemented.
- `POST /api/auth/logout`
  - **Purpose:** Revokes session, marks refresh token revoked, clears HttpOnly cookie.
  - **Auth Required:** Optional (Reads cookie / user context).
  - **Database Collections:** `refresh_tokens`, `sessions`, `audit_logs`.
  - **Frontend Usage:** `authAPI.logout()` across all pages.
  - **Status:** Implemented.
- `GET /api/auth/me`
  - **Purpose:** Returns current user profile document.
  - **Auth Required:** Yes (`@require_auth(allow_pending=True)`).
  - **Allowed Roles:** Any authenticated user.
  - **Database Collections:** `users`.
  - **Frontend Usage:** `authAPI.me()`.
  - **Status:** Implemented.
- `GET /api/auth/sessions`
  - **Purpose:** Lists active sessions for current user.
  - **Auth Required:** Yes (`@require_auth(allow_pending=True)`).
  - **Database Collections:** `sessions`.
  - **Status:** Implemented.
- `DELETE /api/auth/sessions/<session_id>`
  - **Purpose:** Revokes a specific session belonging to current user.
  - **Auth Required:** Yes (`@require_auth(allow_pending=True)`).
  - **Database Collections:** `sessions`, `refresh_tokens`, `audit_logs`.
  - **Status:** Implemented.

#### Patient Routes (`patients_bp` - prefix `/api/patients`)
- `GET /api/patients/`
  - **Purpose:** Lists patients. If the requester is a `doctor`, automatically filters by `assignedDoctor == g.current_user.name`.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`, `screener`.
  - **Database Collections:** `patients`.
  - **Frontend Usage:** `patientAPI.getAll()` in `vadr-module2.jsx` and `PatientRecordsPage.jsx`.
  - **Status:** Implemented.
- `GET /api/patients/<patient_id>`
  - **Purpose:** Fetches single patient record with ownership validation (doctor assigned check / patient email check).
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`, `screener`, `patient`.
  - **Database Collections:** `patients`.
  - **Frontend Usage:** `patientAPI.getOne()` in `MedicalHistoryManagementPage.jsx`.
  - **Status:** Implemented.
- `POST /api/patients/`
  - **Purpose:** Registers a new patient record with auto-generated ID `VADR-XXXX` and temporary portal password.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`, `screener`.
  - **Request:** `{ name, email, phone, assignedDoctor, age?, gender?, diabetesType?, hba1c?, diagnosedYear?, address?, referral? }`.
  - **Database Collections:** `patients`.
  - **Frontend Usage:** `patientAPI.register()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `PUT /api/patients/<patient_id>`
  - **Purpose:** Updates demographics and doctor assignment for a patient.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`.
  - **Database Collections:** `patients`.
  - **Frontend Usage:** `patientAPI.update()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `PATCH /api/patients/<patient_id>/status`
  - **Purpose:** Toggles patient status between `active` and `inactive`.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`.
  - **Database Collections:** `patients`.
  - **Frontend Usage:** `patientAPI.toggleStatus()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `PATCH /api/patients/<patient_id>/send-credentials`
  - **Purpose:** Marks credentials as sent with timestamp `credentialsSentOn`.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`.
  - **Database Collections:** `patients`.
  - **Frontend Usage:** `patientAPI.sendCredentials()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `DELETE /api/patients/<patient_id>`
  - **Purpose:** Permanently deletes a patient and cascades deletion to `medical_history`.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `patients`, `medical_history`.
  - **Frontend Usage:** `patientAPI.delete()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `GET /api/patients/<patient_id>/medical-history`
  - **Purpose:** Retrieves medical history document (creates empty default record if none exists).
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`, `patient`.
  - **Database Collections:** `patients`, `medical_history`.
  - **Frontend Usage:** `medicalHistoryAPI.get()` in `MedicalHistoryManagementPage.jsx`.
  - **Status:** Implemented.
- `PUT /api/patients/<patient_id>/medical-history`
  - **Purpose:** Upserts medical history arrays (`visits`, `medications`, `comorbidities`, `scans`) and recalculates `scans` count and `lastScan` date in `patients` collection.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`.
  - **Request:** `{ visits: [...], medications: [...], comorbidities: [...], scans: [...] }`.
  - **Database Collections:** `patients`, `medical_history`.
  - **Frontend Usage:** `medicalHistoryAPI.update()` in `MedicalHistoryManagementPage.jsx`.
  - **Status:** Implemented.
- `GET /api/patients/<patient_id>/medical-history/export`
  - **Purpose:** Returns comprehensive export payload with patient profile, full medical history, and calculated `drTrend` array.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`, `patient`.
  - **Database Collections:** `patients`, `medical_history`.
  - **Frontend Usage:** `medicalHistoryAPI.export()` in `MedicalHistoryManagementPage.jsx`.
  - **Status:** Implemented.

#### User Management Routes (`users_bp` - prefix `/api/users`)
- `GET /api/users/doctors`
  - **Purpose:** Lists active doctors for patient assignment dropdowns.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`, `doctor`, `screener`.
  - **Database Collections:** `users`.
  - **Frontend Usage:** `userAPI.getDoctors()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `GET /api/users/`
  - **Purpose:** Lists all staff accounts.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`.
  - **Frontend Usage:** `userAPI.getAll()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `GET /api/users/<user_id>`
  - **Purpose:** Retrieves single staff user by ID.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`.
  - **Status:** Implemented.
- `POST /api/users/`
  - **Purpose:** Admin creates staff user (`doctor`, `screener`, `admin`).
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`, `audit_logs`.
  - **Frontend Usage:** `userAPI.create()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `PUT /api/users/<user_id>`
  - **Purpose:** Updates staff user details and/or password hash.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`, `audit_logs`.
  - **Frontend Usage:** `userAPI.update()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `PATCH /api/users/<user_id>/status`
  - **Purpose:** Toggles staff status (`active` <-> `suspended`). Prevents deactivating main admin `u1`.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`, `audit_logs`.
  - **Frontend Usage:** `userAPI.toggleStatus()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `DELETE /api/users/<user_id>`
  - **Purpose:** Permanently deletes a staff user. Prevents deleting `u1`.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`, `audit_logs`.
  - **Frontend Usage:** `userAPI.delete()` in `vadr-module2.jsx`.
  - **Status:** Implemented.

#### System Administration Routes (`admin_bp` - prefix `/api/admin`)
- `GET /api/admin/pending-doctors`
  - **Purpose:** Lists doctor accounts in `pending_approval` state with approval request metadata.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`, `approval_requests`.
  - **Frontend Usage:** `adminAPI.pendingDoctors()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `PATCH /api/admin/users/<user_id>/approve`
  - **Purpose:** Approves pending doctor, updates status to `active`, updates approval record, and sends approval confirmation email.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`, `approval_requests`, `audit_logs`.
  - **Frontend Usage:** `adminAPI.approveDoctor()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `PATCH /api/admin/users/<user_id>/reject`
  - **Purpose:** Rejects doctor application, sets status to `suspended`, calculates `reapply_after` (30 days), revokes tokens, and sends rejection email with reason.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Request:** `{ reason }`.
  - **Database Collections:** `users`, `approval_requests`, `refresh_tokens`, `sessions`, `audit_logs`.
  - **Frontend Usage:** `adminAPI.rejectDoctor()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `GET /api/admin/audit-logs`
  - **Purpose:** Paginated audit logs with optional filters (`user_id`, `event_type`, `start_date`, `end_date`, `page`, `per_page`).
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `audit_logs`.
  - **Frontend Usage:** `adminAPI.auditLogs()` in `vadr-module2.jsx` (`AuditLogsTab`).
  - **Status:** Implemented.
- `DELETE /api/admin/users/<user_id>/sessions`
  - **Purpose:** Force logouts a user by revoking all their sessions and refresh tokens.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`, `refresh_tokens`, `sessions`, `audit_logs`.
  - **Frontend Usage:** `adminAPI.revokeUserSessions()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `GET /api/admin/permissions`
  - **Purpose:** Retrieves the role x permission matrix.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `rbac_settings`.
  - **Frontend Usage:** `adminAPI.getPermissions()` in `vadr-module2.jsx` (`RbacTab`).
  - **Status:** Implemented.
- `PUT /api/admin/permissions`
  - **Purpose:** Updates role permissions with validation (enforces admin locked permissions).
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Request:** `{ matrix }`.
  - **Database Collections:** `rbac_settings`, `audit_logs`.
  - **Frontend Usage:** `adminAPI.updatePermissions()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `POST /api/admin/permissions/reset`
  - **Purpose:** Resets RBAC matrix to default values.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `rbac_settings`, `audit_logs`.
  - **Frontend Usage:** `adminAPI.resetPermissions()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `GET /api/admin/backups`
  - **Purpose:** Lists all completed system backups.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `system_backups`.
  - **Frontend Usage:** `adminAPI.getBackups()` in `vadr-module2.jsx` (`BackupsTab`).
  - **Status:** Implemented.
- `POST /api/admin/backups`
  - **Purpose:** Creates manual backup of 6 core collections (`users`, `patients`, `medical_history`, `audit_logs`, `approval_requests`, `rbac_settings`), compresses with Gzip, computes SHA-256, saves to disk and records metadata in MongoDB.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Database Collections:** `users`, `patients`, `medical_history`, `audit_logs`, `approval_requests`, `rbac_settings`, `system_backups`.
  - **Frontend Usage:** `adminAPI.createBackup()` in `vadr-module2.jsx`.
  - **Status:** Implemented.
- `POST /api/admin/backups/<backup_id>/restore`
  - **Purpose:** Validates confirmation string (`"RESTORE"`), verifies file integrity via SHA-256 checksum, wipes existing records in target collections, restores backup documents, and invalidates all active user sessions for safety.
  - **Auth Required:** Yes.
  - **Allowed Roles:** `admin`.
  - **Request:** `{ confirmation: "RESTORE" }`.
  - **Database Collections:** `system_backups`, `refresh_tokens`, `sessions`, `audit_logs` + restored collections.
  - **Frontend Usage:** `adminAPI.restoreBackup()` in `vadr-module2.jsx`.
  - **Status:** Implemented.

#### AI Prediction Routes (`predict_bp` - prefix `/api`)
- `POST /api/predict`
  - **Purpose:** Accepts multipart `image` file, saves to `uploads/<uuid>.<ext>`, executes `predict_retinopathy()`, generates Grad-CAM overlay, and returns classification, confidence, class probabilities, and Grad-CAM relative path.
  - **Auth Required:** No (Currently unprotected at route decorator level).
  - **Allowed Roles:** Public / Staff.
  - **Request:** `multipart/form-data` with `image` field.
  - **Response:** `{ class_id: int, prediction: str, confidence: float, probabilities: { "No DR": float, ... }, gradcam: str }`.
  - **Database Collections:** None (Does not write to DB).
  - **Frontend Usage:** `predictAPI.analyze()` in `FundusImageModule.jsx`.
  - **Status:** Implemented.
- `GET /api/gradcam-image`
  - **Purpose:** Serves generated Grad-CAM PNG heatmap with directory traversal safeguards (`safe_rel.startswith("uploads")`).
  - **Auth Required:** No.
  - **Query Params:** `?path=uploads/gradcam/<uuid>.png`.
  - **Response:** `image/png` binary stream.
  - **Database Collections:** None.
  - **Frontend Usage:** Displayed in `FundusImageModule.jsx`.
  - **Status:** Implemented.

---

## 5. DATABASE ANALYSIS

The application connects to MongoDB database `vadr_db`. The actual collections referenced and manipulated in the codebase are documented below:

### 1. Collection: `users`
- **Purpose:** Stores staff accounts (admins, screeners, doctors) and registered patients.
- **Key Fields:**
  - `id` (string, e.g., `"u1"`, `"uabc12"`): Unique user identifier.
  - `name` (string): Full display name.
  - `email` (string): Unique email address (normalized lowercase).
  - `password_hash` (string): Bcrypt hash of account password.
  - `role` (string): `"admin"`, `"doctor"`, `"screener"`, `"patient"`.
  - `department` (string): Department or clinical unit.
  - `phone` (string): Contact telephone number.
  - `status` (string): `"active"`, `"pending_approval"`, `"suspended"`, `"unverified"`.
  - `email_verified` (boolean): Whether email OTP has been verified.
  - `joined` (string `YYYY-MM-DD`): Registration date.
  - `created_at` (UTC naive datetime): Document creation timestamp.
  - `updated_at` (UTC naive datetime): Last update timestamp.
  - `lastLogin` (string / datetime): Timestamp or date string of most recent login.
  - `approval` (object): Subdocument containing `approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`.
- **References:** `approval_requests.user_id`, `sessions.user_id`, `refresh_tokens.user_id`, `audit_logs.user_id`.
- **Created / Updated by:** `auth_service.migrate_demo_password_hashes()`, `auth.py` (`/register`, `/verify-registration`, `/login`, `/reset-password`), `users.py` (`/`, `/<user_id>`, `/<user_id>/status`), `admin.py` (`/approve`, `/reject`), `system.py` (`/seed`).

### 2. Collection: `patients`
- **Purpose:** Clinical registry of diabetic retinopathy screening patients.
- **Key Fields:**
  - `patientId` (string, e.g., `"VADR-0001"`): Unique sequential human-readable identifier.
  - `name` (string): Patient full name.
  - `age` (number/string): Patient age in years.
  - `gender` (string): `"Male"`, `"Female"`, `"Other"`.
  - `email` (string): Patient email address.
  - `phone` (string): Patient contact phone.
  - `diabetesType` (string): `"Type 1"`, `"Type 2"`, `"Gestational"`.
  - `hba1c` (string/number): Glycated hemoglobin percentage.
  - `diagnosedYear` (string/number): Year diagnosed with diabetes.
  - `address` (string): Residential address.
  - `assignedDoctor` (string): Name of the doctor assigned to the patient.
  - `referral` (string): Referral source (`"Self"`, `"GP"`, `"Internal Clinic"`, etc.).
  - `status` (string): `"active"`, `"inactive"`.
  - `scans` (number): Aggregate count of fundus scans recorded.
  - `lastScan` (string): Date string (`YYYY-MM-DD`) of the latest scan.
  - `joined` (string `YYYY-MM-DD`): Registration date.
  - `credentialsSent` (boolean): Flag indicating if portal login info was sent.
  - `credentialsSentOn` (string `YYYY-MM-DD`): Timestamp of credentials dispatch.
  - `tempPassword` (string, e.g., `"VADR@4821"`): Generated temporary portal password.
- **References:** `medical_history.patientId`.
- **Created / Updated by:** `patients.py` (`POST /api/patients/`, `PUT /api/patients/<id>`, `PATCH /api/patients/<id>/status`, `PATCH /api/patients/<id>/send-credentials`, `PUT /api/patients/<id>/medical-history`).

### 3. Collection: `medical_history`
- **Purpose:** Longitudinal clinical history, medical visits, prescription records, and scan records for each patient.
- **Key Fields:**
  - `patientId` (string, e.g., `"VADR-0001"`): Foreign key matching `patients.patientId`.
  - `visits` (array of objects):
    - `visitDate` (string `YYYY-MM-DD`)
    - `drGrade` (string: `"No DR"`, `"Mild DR"`, `"Moderate DR"`, `"Severe DR"`, `"Proliferative DR"`)
    - `hba1c` (string)
    - `notes` (string)
  - `medications` (array of objects):
    - `name` (string)
    - `dosage` (string)
    - `frequency` (string)
  - `comorbidities` (array of objects):
    - `condition` (string)
    - `diagnosedYear` (string)
    - `status` (string)
  - `scans` (array of objects):
    - `scanDate` (string `YYYY-MM-DD`)
    - `leftEye` (string / grade / notes)
    - `rightEye` (string / grade / notes)
    - `comments` (string)
  - `updatedAt` (string `YYYY-MM-DD`): Date of latest revision.
- **References:** Matches `patients.patientId`.
- **Created / Updated by:** `patients.py` (`GET /api/patients/<id>/medical-history`, `PUT /api/patients/<id>/medical-history`, `DELETE /api/patients/<id>`).

### 4. Collection: `audit_logs`
- **Purpose:** Immutable trail of security, authentication, and administrative actions.
- **Key Fields:**
  - `_id` (ObjectId): Document ID.
  - `user_id` (string | null): ID of the initiating user (or null for public events).
  - `role` (string | null): Role of initiating user.
  - `event_type` (string): e.g., `"login"`, `"logout"`, `"failed_login"`, `"register"`, `"password_reset_requested"`, `"password_reset_completed"`, `"user_created"`, `"user_updated"`, `"user_status_changed"`, `"user_deleted"`, `"approve"`, `"reject"`, `"permission_matrix_update"`, `"permission_matrix_reset"`, `"backup_created"`, `"backup_restored"`, `"backup_restore_failed"`.
  - `ip_address` (string): Client IP address (from `X-Forwarded-For` or `remote_addr`).
  - `user_agent` (string): Client browser User-Agent string.
  - `timestamp` (UTC naive datetime): Event timestamp.
  - `metadata` (object): Event-specific dictionary (target IDs, changed fields, email delivery results, error details).
- **Indexes:** `timestamp ASC`, compound `user_id ASC, event_type ASC`.
- **Created / Updated by:** `vadr_backend/services/audit_service.py` invoked across `auth.py`, `users.py`, `admin.py`.

### 5. Collection: `approval_requests`
- **Purpose:** Tracks doctor account approval workflow by system administrators.
- **Key Fields:**
  - `user_id` (string): ID of doctor in `users`.
  - `email` (string): Doctor's email address.
  - `name` (string): Doctor's full name.
  - `status` (string): `"pending"`, `"approved"`, `"rejected"`.
  - `requested_at` (UTC naive datetime): Registration timestamp.
  - `reviewed_by` (string | null): Admin `user_id` who reviewed the request.
  - `reviewed_at` (UTC naive datetime | null): Review timestamp.
  - `reason` (string | null): Rejection reason notes.
  - `reapply_after` (UTC naive datetime | null): Timestamp until which re-registration is locked (30 days default).
- **Indexes:** `user_id ASC`.
- **Created / Updated by:** `auth.py` (`_finalize_registration`), `admin.py` (`approve_doctor`, `reject_doctor`), `system.py` (`seed`).

### 6. Collection: `rbac_settings`
- **Purpose:** Custom dynamic role-permission access matrix.
- **Key Fields:**
  - `_id` (string): `"permission_matrix"`.
  - `matrix` (object): Map of 12 permission strings to role boolean dictionaries `{ admin: bool, doctor: bool, screener: bool, patient: bool }`.
  - `updated_at` (UTC naive datetime): Timestamp of last matrix change.
  - `updated_by` (string): Admin `user_id` who performed the update.
- **Created / Updated by:** `vadr_backend/services/permissions_service.py` (`update_permission_matrix`, `reset_permission_matrix`).

### 7. Collection: `refresh_tokens`
- **Purpose:** Persists hashed JWT refresh tokens for secure session continuity.
- **Key Fields:**
  - `token_hash` (string): SHA-256 hash of the 64-byte random URL-safe refresh token.
  - `user_id` (string): Foreign key matching `users.id`.
  - `session_id` (string): Foreign key matching `sessions.session_id`.
  - `device_fingerprint` (string): SHA-256 hash slice of User-Agent.
  - `expires_at` (UTC naive datetime): Expiration date (7 days default).
  - `revoked` (boolean): Revocation flag.
  - `revoked_at` (UTC naive datetime | null): Revocation timestamp.
  - `created_at` (UTC naive datetime): Creation timestamp.
- **Indexes:** `token_hash ASC`, compound `user_id ASC, revoked ASC`.
- **Created / Updated by:** `vadr_backend/services/auth_service.py` (`create_refresh_token`, `validate_refresh_token`, `revoke_refresh_token`, `revoke_all_user_tokens`, `revoke_session`).

### 8. Collection: `sessions`
- **Purpose:** Server-side active login session tracking for multi-device management.
- **Key Fields:**
  - `session_id` (string, e.g., `"sess_abc123..."`): Random 16-char identifier.
  - `user_id` (string): User identifier matching `users.id`.
  - `device_fingerprint` (string): Device fingerprint hash.
  - `ip` (string): Client IP address.
  - `user_agent` (string | null): User agent string.
  - `created_at` (UTC naive datetime): Login timestamp.
  - `last_seen` (UTC naive datetime): Most recent activity timestamp.
  - `revoked` (boolean): Whether session was terminated.
  - `revoked_at` (UTC naive datetime | null): Revocation timestamp.
- **Indexes:** compound `user_id ASC, revoked ASC`.
- **Created / Updated by:** `auth_service.py` (`create_session`, `touch_session`, `revoke_session`, `list_user_sessions`).

### 9. Collection: `verification_codes`
- **Purpose:** Stores 6-digit OTP codes for email registration verification and password resets.
- **Key Fields:**
  - `email` (string): Target email address.
  - `user_id` (string | null): Matching user ID (for password resets).
  - `code_hash` (string): Bcrypt hash of the 6-digit OTP code.
  - `type` (string): `"registration"` or `"password_reset"`.
  - `expires_at` (UTC naive datetime): Expiration timestamp (10 min default).
  - `used` (boolean): Whether code has been successfully consumed.
  - `verify_failures` (number): Count of incorrect code attempts (max 8 before invalidation).
  - `resend_timestamps` (array of datetimes): Track resend rate limits.
  - `payload` (object): User details cached during registration prior to account creation.
  - `created_at` (UTC naive datetime): Code issuance timestamp.
- **Indexes:** compound `email ASC, type ASC, used ASC`.
- **Created / Updated by:** `auth.py` (`/register`, `/verify-registration`, `/resend-registration-code`, `/forgot-password`, `/reset-password`).

### 10. Collection: `registration_pending`
- **Purpose:** Temporary secondary index holding unverified registration payloads.
- **Key Fields:** `email`, `code_hash`, `expires_at`, `last_sent_at`, `verify_failures`, `payload`.
- **Created / Updated by:** `auth.py` during registration.

### 11. Collection: `system_backups`
- **Purpose:** Metadata index for database backups created on disk.
- **Key Fields:**
  - `backup_id` (string UUID): Unique backup identifier.
  - `filename` (string, e.g., `"backup_20260916_120000_3a8f1b2c.json.gz"`): File path relative to `vadr-backend/backups/`.
  - `created_by` (string): Admin `user_id` who triggered the backup.
  - `created_at` (UTC naive datetime): Backup timestamp.
  - `type` (string): `"manual"`.
  - `status` (string): `"completed"`.
  - `size_bytes` (number): Size of compressed backup file on disk.
  - `collections_included` (array of strings): `["users", "patients", "medical_history", "audit_logs", "approval_requests", "rbac_settings"]`.
  - `checksum_sha256` (string): SHA-256 checksum of raw uncompressed JSON data.
- **Indexes:** `backup_id ASC`, `created_at ASC`.
- **Created / Updated by:** `vadr_backend/services/backup_service.py`.

---

## 6. AUTHENTICATION + RBAC

### 6.1 Authentication Flow Architecture
```text
1. Login Request
   POST /api/auth/login { email, password }
   │
   ▼
2. Validation & Security Checks
   - Bcrypt verify password against users_col.password_hash
   - Validate status != "unverified" (403 FORBIDDEN)
   - Validate status != "suspended" (403 FORBIDDEN)
   - Update lastLogin = today()
   │
   ▼
3. Session & Token Creation
   - Insert session into sessions_col (client IP, device fingerprint)
   - Encode JWT access token (HS256, 15 min exp, payload: { user_id, role, email, status, session_id })
   - Generate 64-byte random URL-safe refresh token
   - Save SHA-256(refresh_token) in refresh_tokens_col (7 days exp)
   │
   ▼
4. Response Delivery
   - Set HttpOnly Cookie: vadr_refresh_token (path: /api/auth, SameSite: Lax)
   - JSON Body: { access_token, expires_in: 900, role, status, user: {...} }
   │
   ▼
5. Frontend Storage & Authenticated Requests
   - Frontend stores access_token in localStorage("vadr_token")
   - Frontend stores user object in localStorage("vadr_user")
   - Subsequent fetch requests attach header: "Authorization: Bearer <access_token>"
   │
   ▼
6. Backend Request Resolution (@require_auth)
   - Extract Bearer token from Authorization header
   - Decode & verify JWT signature and expiration (HS256)
   - Query users_col by payload.user_id
   - Enforce account status (reject suspended, unverified, or pending approval unless allowed)
   - Check role membership against allowed roles
   - Inject g.current_user and g.token_payload for route handler
   │
   ▼
7. Refresh & Logout
   - Refresh: POST /api/auth/refresh passes cookie, validates hash & expiry, touches session, issues new JWT.
   - Logout: POST /api/auth/logout revokes session & refresh token in DB, deletes refresh cookie, frontend clears localStorage.
```

### 6.2 Roles & Permissions Matrix
The codebase defines 4 roles:
- `admin`: Full system control (approvals, staff management, RBAC matrix, audit logs, system backups, patient management).
- `doctor`: Clinical workflows (view assigned patients, manage patient medical history, review predictions, export reports). When self-registered, account is set to `pending_approval` until an admin approves it.
- `screener`: Clinical screening staff (register patients, view patient records, upload fundus images).
- `patient`: Patient self-service (view own patient records and medical history linked to their email).

### 6.3 Route Decorators & Guards
- **`@require_auth(roles=None, allow_pending=False, allow_unverified=False)`**:
  - Found in `vadr_backend/decorators.py`.
  - Implements account status guardrails and role checking.
- **Dynamic RBAC Service**:
  - Implemented in `vadr_backend/services/permissions_service.py`.
  - Validates permissions via `role_has_permission(matrix, role, permission)`.
  - Admin cannot be stripped of `"System Administration"` or `"Manage Users"` (hard-coded safety check).

---

## 7. AI / PREDICTION PIPELINE

### 7.1 Architecture & Flow
```text
Retinal Image File (Browser)
   │
   ▼ (POST /api/predict multipart/form-data)
Saved to vadr-backend/uploads/<uuid>.<ext>
   │
   ▼
preprocess_image(image_path)
   - PIL resize to (224, 224)
   - Convert RGB
   - Float32 / 255.0 normalization
   - Expand dims: shape (1, 224, 224, 3)
   │
   ▼
Model Inference (model.predict(image))
   - EfficientNetB3 Keras model (diabetic_retinopathy_model.keras)
   - Softmax logits over 5 classes
   │
   ▼
Classification Output
   - class_id: np.argmax(predictions) (0 to 4)
   - prediction: CLASS_NAMES[class_id]
   - confidence: float(predictions[class_id]) * 100
   - probabilities: map of class names to percentage scores
   │
   ▼
Grad-CAM Heatmap Generation (generate_gradcam)
   - Compute input gradients via tf.GradientTape()
   - Channel-mean activation heatmap normalized [0, 1]
   - Jet colormap overlay rendered via Matplotlib Agg
   - Saved to vadr-backend/uploads/gradcam/<uuid>.png
   │
   ▼
API JSON Response
   { class_id, prediction, confidence, probabilities, gradcam }
   │
   ▼
Frontend Display in FundusImageModule.jsx
   - Displays prediction badge & confidence
   - Renders probability breakdown bars
   - Fetches Grad-CAM overlay from /api/gradcam-image?path=...
```

### 7.2 DR Severity Classes
1. `0` -> `No DR` (No signs of diabetic retinopathy detected)
2. `1` -> `Mild` (Microaneurysms present)
3. `2` -> `Moderate` (More than mild NPDR, exudates/hemorrhages)
4. `3` -> `Severe` (Severe NPDR, significant retinal damage)
5. `4` -> `Proliferative DR` (Neovascularization, advanced stage)

### 7.3 Discrepancy & Missing Link in the Current Code
- **Image Upload & Prediction Isolation:** The prediction endpoint `/api/predict` is currently a standalone processing endpoint. It does **not** take a `patientId` parameter and does **not** persist the resulting classification, confidence, or fundus image to the MongoDB `scans` collection or the patient's `medical_history.scans` array.
- In `FundusImageModule.jsx`, the analysis executes in isolation on the uploaded file and displays the results in UI state without triggering a database write.

---

## 8. SYSTEM ADMINISTRATION WORK

### 8.1 Audit Logs & Monitoring
- **Backend Routes:** `GET /api/admin/audit-logs` (paginated, queryable by `user_id`, `event_type`, `start_date`, `end_date`, `page`, `per_page`).
- **Collection:** `audit_logs` in MongoDB with compound indexes.
- **Logged Events:**
  - `register` (new registration attempts, OTP dispatches, and completions).
  - `login` / `failed_login` (credential attempts with IP, user agent, and session ID).
  - `logout` (manual logout, self session revocation, and admin forced session revocation).
  - `password_reset_requested` / `password_reset_completed`.
  - `user_created` / `user_updated` / `user_status_changed` / `user_deleted`.
  - `approve` / `reject` (doctor application reviews with email status and reasons).
  - `permission_matrix_update` / `permission_matrix_reset`.
  - `backup_created` / `backup_restored` / `backup_restore_failed`.
- **Frontend UI:** Fully implemented inside `AuditLogsTab` in `vadr-module2.jsx` (lines 1620-1825). Includes live filter controls for Event Type, User ID, Date Range, pagination controls, and status pills.

### 8.2 System Backup Management
- **Service:** `vadr_backend/services/backup_service.py`.
- **Collections Included:** `users`, `patients`, `medical_history`, `audit_logs`, `approval_requests`, `rbac_settings`.
- **Storage Location:** Local disk directory `VADR_P1/vadr-backend/backups/`.
- **File Format:** Gzip-compressed BSON JSON (`backup_YYYYMMDD_HHMMSS_<shortid>.json.gz`) preserving MongoDB BSON datatypes and ObjectIds.
- **Integrity & Security:** Computes SHA-256 checksum upon creation and strictly verifies checksum before restoration. File path traversal validation prevents reading outside `backups/`.
- **Destructive Restore Engine:** `POST /api/admin/backups/<backup_id>/restore` requires exact string payload `{"confirmation": "RESTORE"}`. Wipes target collections, restores snapshot records, and invalidates all user tokens in `refresh_tokens` and `sessions` to force global re-authentication.
- **Frontend UI:** Fully implemented inside `BackupsTab` in `vadr-module2.jsx` (lines 1831-2036). Features snapshot creation trigger, backup table with size and collection badges, and safety modal requiring the user to type `"RESTORE"`.

---

## 9. GIT / CURRENT DEVELOPMENT STATE

- **Current Branch:** `Arham-System-Administration`
- **Working Tree Status:** Dirty (modified files present in working tree).
- **Recent Commits:**
  - `e6c85e2` *Implement audit logs and system backup management* (Author: Muhammad Arham)
  - `db8403b` *Pushed Some GradCams* (Author: Taha Rehman)
  - `b9eae58` *Initial commit for AI Module* (Author: Taha Rehman)
  - `f66e550` *Updated medical History UI* (Author: Taha Rehman)
  - `07da19a` *Added forgot password button* (Author: Taha Rehman)
- **Relevant Branches in Repository:**
  - Local: `Arham-System-Administration` (active), `ai_module`, `main`.
  - Remote: `origin/Arham-Modules`, `origin/Arham-System-Administration`, `origin/ai_module`, `origin/latest_enhancements`, `origin/main`, `origin/master`, `origin/sherry`, `origin/tahas-work`.
- **Modified Uncommitted Files:**
  - `.vscode/settings.json`
  - `VADR_P1/vadr-backend/.vscode/settings.json`
  - `VADR_P1/vadr-backend/vadr_backend/services/ai/gradcam.py`
  - `VADR_P1/vadr-backend/vadr_backend/services/ai/model_loader.py`
  - `VADR_P1/vadr-backend/vadr_backend/services/ai/predictor.py`
- **Untracked Directory:**
  - `Visual-Assessment-of-Diabetic-Retinopathy/` (nested clone artifact).

---

## 10. CURRENT PROBLEMS / WARNINGS

### CRITICAL
1. **Missing `import numpy as np` in `gradcam.py`:**
   - In `vadr_backend/services/ai/gradcam.py` (lines 40, 42, 44, 48), `np.newaxis`, `np.argmax`, and `np.max` are called, but `import numpy as np` was accidentally omitted when adding try-except blocks. When TensorFlow is enabled and an image is processed, `NameError: name 'np' is not defined` will trigger.

### HIGH
2. **AI Inference Endpoint is Unauthenticated and Unlinked to Database:**
   - `POST /api/predict` in `vadr_backend/routes/predict.py` does not have the `@require_auth` decorator. Anyone can upload images and execute predictions.
   - Predictions return directly to the caller without creating a scan record in the database or attributing the scan to a `patientId`.
3. **Hard-Coded MongoDB Atlas Credentials in Fallback Config:**
   - In `vadr_backend/config.py` (line 54), a default MongoDB Atlas connection string with embedded credentials (`taha757:Taharao123`) is hard-coded as fallback when `MONGO_URI` is not supplied.

### MEDIUM
4. **`DrDashboard.jsx` is Purely Mock Data / Disconnected from APIs:**
   - `DrDashboard.jsx` (the doctor clinical dashboard) renders hard-coded arrays (`PATIENTS`, `SCANS`, `TREND_DATA`, `DIST_DATA`). It does not invoke `patientAPI` or query any live backend endpoints.
5. **Duplicate / Nested Git Directory Artifact:**
   - The root workspace contains an untracked directory `Visual-Assessment-of-Diabetic-Retinopathy/` which is a redundant copy of the workspace files.
6. **Patient Portal `/my-records` Inefficient Email Matching:**
   - `PatientRecordsPage.jsx` fetches all patients via `patientAPI.getAll()` and performs a client-side filter by email. When the database grows, this exposes unnecessary patient lists to the client and degrades performance.

### LOW
7. **Dead / Unused Files in `p1-mid` Subfolders:**
   - Files like `src/modules/p1-mid/patient-user-management/pages/PatientUserManagementPage.jsx` and `src/modules/p1-mid/shared/api.js` are single-line forwarders to root files.
8. **Inconsistent Port Numbers in README vs App Defaults:**
   - Documentation references port 3000 for frontend and 5000 for backend; while consistent with `app.py`, some deployment scripts in the history use different configurations.

---

## 11. SYSTEM DASHBOARD READINESS

The requirements for the upcoming System Dashboard are evaluated against the existing codebase:

### 1. KPI Cards and Charts (Daily upload statistics, total patients, total scans, active clinicians)
- **Existing Backend Support:** `patients.py` maintains `patients_col` with `scans` counter and `joined` date; `users.py` maintains `users_col` with active roles; `audit_logs.py` records timestamps for events. No dedicated aggregate statistics endpoint (`/api/dashboard/stats` or `/api/system/kpi`) exists yet.
- **Existing Database Support:** `patients` collection contains `joined`, `scans`, `lastScan`, `status`; `users` contains `role`, `status`, `lastLogin`; `audit_logs` contains `event_type`, `timestamp`.
- **Existing Frontend Support:** Recharts (`AreaChart`, `BarChart`, `ResponsiveContainer`) is installed and styled in `DrDashboard.jsx`. `useAnimatedNumber` hook in `vadr-module2.jsx` provides smooth number easing.
- **Reusable Components:** `StatCard` in `vadr-module2.jsx` and `DrDashboard.jsx`.
- **Missing Pieces:** Dedicated backend aggregation endpoint returning grouped counts (today's uploads, active patients, pending reviews, severity distribution).
- **Recommended Files to Modify Later:** `vadr_backend/routes/system.py` (or new `routes/dashboard.py`), `vadr-frontend/src/api.js`, `vadr-frontend/src/DrDashboard.jsx`.

### 2. Recent Scans Feed (Live incoming screenings with severity badges)
- **Existing Backend Support:** `patients.py` has `medical_history_col` containing `scans` and `visits` with `drGrade`, `scanDate`, `visitDate`.
- **Existing Database Support:** `medical_history.scans` and `medical_history.visits`.
- **Existing Frontend Support:** Severity configuration badge mapping (`SEV` in `DrDashboard.jsx` and `DR_GRADES` in `FundusImageModule.jsx`).
- **Reusable Components:** Severity pills, table rows, and retina visualizer in `DrDashboard.jsx`.
- **Missing Pieces:** A query endpoint to list recent scans across all patients sorted by date descending (e.g. `GET /api/scans/recent` or `GET /api/patients/recent-scans`).
- **Recommended Files to Modify Later:** `vadr_backend/routes/patients.py`, `vadr_backend/routes/predict.py`.

### 3. Pending Reviews (Real-time counter and unverified classifications)
- **Existing Backend Support:** `admin.py` has `/admin/pending-doctors` for doctor approvals. However, for scan classifications, scan verification status (e.g., `verified_by_doctor: bool`) is not yet formalized in the scan schema.
- **Existing Database Support:** `approval_requests` for user approvals; scan verification flag needs to be stored on scan objects in `medical_history` or a new `scans` collection.
- **Existing Frontend Support:** `ApprovalsTab` in `vadr-module2.jsx` has the badge counter and review modal pattern.
- **Missing Pieces:** Backend scan review workflow endpoint (`PATCH /api/scans/:id/verify`) and unverified scan counter query.

### 4. High-Severity Notifications (Instant modal/banner for severe/high-risk classifications)
- **Existing Backend Support:** `predict_retinopathy()` outputs class IDs `3` (Severe) and `4` (Proliferative DR).
- **Existing Database Support:** `drGrade` values `"Severe DR"`, `"Proliferative DR"` in `medical_history`.
- **Existing Frontend Support:** Alert banners, toast systems (`showToast` in `vadr-module2.jsx`), and danger modal wrappers in `vadr-module2.jsx` and `DrDashboard.jsx`.
- **Missing Pieces:** Notification polling hook or WebSocket/event stream to push immediate high-severity screening alerts to the dashboard.

### 5. Quick Actions ("Register Case", "Run Upload")
- **Existing Backend Support:** `POST /api/patients/` for registering cases; `POST /api/predict` for running uploads.
- **Existing Database Support:** Ready and functional.
- **Existing Frontend Support:** Quick action buttons and modal forms already exist in `vadr-module2.jsx` (Patient Register Modal) and `FundusImagePage.jsx` (Upload analysis).
- **Reusable Components:** `Btn` component, modal triggers, and form input controls from `vadr-module2.jsx`.

---

## 12. SYSTEM DASHBOARD DATA FLOW

Based strictly on existing database schemas and route architectures, the proposed data flow for the System Dashboard is:

```text
                          MongoDB (vadr_db)
    ┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
    │  patients collection    │  users collection       │  medical_history        │
    │  - scans (count)        │  - role, status         │  - scans (array)        │
    │  - lastScan (date)      │  - lastLogin            │  - visits (drGrade)     │
    │  - joined (date)        │  - approval_requests    │                         │
    └───────────┬─────────────┴───────────┬─────────────┴───────────┬─────────────┘
                │                         │                         │
                └─────────────────────────┼─────────────────────────┘
                                          ▼
                                Flask API Backend
                  ┌───────────────────────────────────────────────┐
                  │ GET /api/patients (Aggregated stats & lists)  │
                  │ GET /api/users/doctors (Active clinicians)    │
                  │ GET /api/admin/pending-doctors (Approvals)    │
                  │ GET /api/admin/audit-logs (Recent activity)   │
                  └───────────────────────┬───────────────────────┘
                                          ▼
                         React Unified API Client (src/api.js)
                  ┌───────────────────────────────────────────────┐
                  │ patientAPI.getAll()                           │
                  │ userAPI.getDoctors()                          │
                  │ adminAPI.pendingDoctors()                     │
                  │ adminAPI.auditLogs({ per_page: 5 })           │
                  └───────────────────────┬───────────────────────┘
                                          ▼
                             React System Dashboard
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │ 1. KPI Cards:                                                               │
    │    - Total Patients: patients.length                                        │
    │    - Today's Uploads: scans where scanDate === today()                      │
    │    - Pending Reviews: approval_requests count + unverified scans count      │
    │    - Active Doctors: users where role === "doctor" && status === "active"   │
    │                                                                             │
    │ 2. Severity Distribution Chart (Recharts BarChart):                         │
    │    - Computed from visits.drGrade across medical_history records            │
    │                                                                             │
    │ 3. Recent Scans Feed:                                                       │
    │    - Flattened list of latest scans with severity badges                    │
    │                                                                             │
    │ 4. High-Severity Alert Banner:                                              │
    │    - Triggers if latest scan grade in ("Severe DR", "Proliferative DR")     │
    │                                                                             │
    │ 5. Quick Actions:                                                           │
    │    - "Register Case" -> Opens Register Patient modal                        │
    │    - "Run Upload" -> Navigates to /fundus-analysis                          │
    └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. REUSABLE CODE

When developing the System Dashboard and subsequent clinical modules, the following existing assets must be reused:

- **API & Authentication Client:**
  - `src/api.js`: `request()`, `authAPI`, `patientAPI`, `userAPI`, `adminAPI`, `predictAPI`, `getToken()`, `getStoredUser()`.
- **Session & Role Utilities:**
  - `src/lib/session.js`: `canAccessStaffPortal()`, `isAdmin()`, `getHomeRoute()`, `STAFF_ROLES`.
- **Theme System & Controls:**
  - `src/lib/ThemeContext.jsx`: `useTheme()`, `applyTheme()`.
  - `src/components/ThemeToggle.jsx`: Theme toggle component.
- **UI Components & Styles:**
  - `src/vadr-module2.jsx`: `StatCard`, `Btn`, `Icon` dictionary, `EmptyState`, `useAnimatedNumber`, CSV export helper (`exportCSV`), modal container styles.
  - `src/DrDashboard.jsx`: Recharts chart configurations, severity palette (`SEV`), `RetinaSVG` component.
  - `src/vadr-dashboard.css` & `src/vadr-theme.css`: Color tokens, responsive card layouts, tables, and buttons.
- **Backend Services & Decorators:**
  - `vadr_backend/decorators.py`: `@require_auth(roles=[...])`.
  - `vadr_backend/responses.py`: `api_success()`, `api_error()`.
  - `vadr_backend/services/audit_service.py`: `log_event()`.
  - `vadr_backend/utils/common.py`: `serialize()`, `utcnow_naive()`, `today()`.

---

## 14. DO NOT DUPLICATE

To maintain architectural integrity, the following existing functionalities must **NOT** be re-created:

1. **Do NOT re-implement Authentication or JWT handling:**
   - Use `src/api.js` (`authAPI.login`, `authAPI.refresh`, `authAPI.logout`) and backend `vadr_backend/decorators.py`.
2. **Do NOT re-implement Patient Registration or Validation:**
   - Patient creation logic is standardized in `patients_bp` (`POST /api/patients/`) with automatic ID generation (`VADR-XXXX`) and medical history record initialization.
3. **Do NOT re-implement the AI Prediction Model or Grad-CAM generator:**
   - The EfficientNetB3 model loading (`model_loader.py`), preprocessing (`preprocess.py`), prediction (`predictor.py`), and Grad-CAM generation (`gradcam.py`) are fully built.
4. **Do NOT re-implement Audit Logging or Backup Management:**
   - Audit event capture and system backup/restore are fully functional in `audit_service.py` and `backup_service.py`. The dashboard should simply display these metrics or link to the existing tabs.
5. **Do NOT introduce secondary CSS frameworks (such as Tailwind CSS or Bootstrap):**
   - The entire application uses a cohesive, custom CSS variable design system (`vadr-theme.css`, `vadr-dashboard.css`, `vadr-auth.css`, `vadr-fundus.css`).

---

## 15. FINAL HANDOFF SUMMARY

### A. Current Architecture
- **Backend:** Flask REST API with Blueprint modularization, PyMongo for MongoDB interactions, and PyJWT/bcrypt for stateless authentication with server-side session auditing.
- **Frontend:** React SPA utilizing React Router DOM v7, CSS theme variables (Dark/Light mode), and Recharts for clinical analytics.
- **Database:** MongoDB Atlas (`vadr_db`) with 11 specialized collections.
- **AI / ML:** Headless Keras/TensorFlow EfficientNetB3 classifier serving 5-class DR inference and Grad-CAM visual heatmaps.

### B. Implemented Modules
- User Authentication & Security (Registration, OTP verification, password resets, login, session list & revocation).
- Patient & User Management (Patient registry, staff accounts, doctor assignment, status toggling).
- Medical History Management (Longitudinal visit records, HbA1c charts, medications, comorbidities, printable reports).
- System Administration: Audit Logs & Monitoring (Searchable, paginated audit logging across 17 event types).
- System Administration: System Backup Management (Gzip compression, SHA-256 integrity verification, destructive restore).
- Fundus Image Analysis & AI Inference (Image upload, darkroom canvas annotations, brightness/contrast filters, EfficientNetB3 inference, Grad-CAM overlay).

### C. Partial / Prototype Modules
- Doctor Clinical Dashboard (`DrDashboard.jsx`): Comprehensive UI layout with mock data.
- Patient Portal (`PatientRecordsPage.jsx`): Basic records viewer matching patient email.

### D. Important APIs
- Auth: `/api/auth/login`, `/api/auth/register`, `/api/auth/verify-registration`, `/api/auth/refresh`, `/api/auth/logout`.
- Patients: `/api/patients/`, `/api/patients/<id>`, `/api/patients/<id>/medical-history`.
- Admin: `/api/admin/pending-doctors`, `/api/admin/audit-logs`, `/api/admin/permissions`, `/api/admin/backups`, `/api/admin/backups/<id>/restore`.
- AI: `/api/predict`, `/api/gradcam-image`.

### E. Important MongoDB Collections
- `users`, `patients`, `medical_history`, `audit_logs`, `approval_requests`, `rbac_settings`, `refresh_tokens`, `sessions`, `verification_codes`, `system_backups`.

### F. Authentication / RBAC Summary
- Roles: `admin`, `doctor`, `screener`, `patient`.
- Route protection: `@require_auth(roles=[...])` with dynamic RBAC matrix in `rbac_settings`.

### G. AI Pipeline Summary
- Input: Retinal fundus image -> Preprocessed to (224, 224, 3) -> EfficientNetB3 -> Class (0-4), Confidence, Probabilities, Grad-CAM PNG.

### H. System Administration Status
- Fully operational for Audit Logs and System Backups. AI Model Version Control was intentionally excluded from current scope.

### I. Current Git State
- Branch: `Arham-System-Administration`. Working tree dirty with uncommitted changes in `.vscode/settings.json` and AI service error handlers (`model_loader.py`, `predictor.py`, `gradcam.py`).

### J. System Dashboard Readiness
- Database and backend hold all underlying clinical data. Requires a unified dashboard aggregation endpoint and wiring `DrDashboard.jsx` to live API calls.

### K. Exact Files Likely Involved in System Dashboard Implementation
1. `VADR_P1/vadr-backend/vadr_backend/routes/patients.py` (or new `routes/dashboard.py`): Aggregate KPI query endpoint.
2. `VADR_P1/vadr-frontend/src/api.js`: Dashboard API client methods.
3. `VADR_P1/vadr-frontend/src/DrDashboard.jsx`: Connecting UI components and charts to live API responses.
4. `VADR_P1/vadr-frontend/src/App.js`: Updating navigation and routing to link the clinical dashboard.

### L. Known Blockers
- Bug in `vadr_backend/services/ai/gradcam.py`: Missing `import numpy as np` causing crashes when generating heatmaps with active TensorFlow.

---

CODEBASE AUDIT COMPLETE — NO FILES WERE MODIFIED.
