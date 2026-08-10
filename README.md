# VADR Merged Platform

Visual Assessment of Diabetic Retinopathy — full-stack merged project combining VADR P1 and dr-dashboard-v8.

---

## Architecture

```
VADR_P1/
├── vadr-backend/          Flask structured backend (JWT auth + dashboard routes)
│   └── vadr_backend/
│       └── routes/
│           ├── auth.py        JWT login, register, OTP verify, refresh, logout
│           ├── admin.py       Doctor approvals, audit logs, RBAC
│           ├── patients.py    Patient CRUD, medical history
│           ├── users.py       Staff user management
│           ├── system.py      Health check, seed
│           └── dashboard.py   ★ NEW: All v8 dashboard endpoints (/api/dashboard/*)
└── vadr-frontend/         React 18 + Tailwind CSS frontend
    └── src/
        ├── App.js             Unified router (VADR JWT + dashboard session)
        ├── api.js             VADR JWT API client (Bearer auth, refresh cookies)
        ├── utils/api.js       Dashboard axios client (/api/dashboard/*)
        ├── pages/
        │   ├── dash/          ★ NEW: All v8 dashboard pages (role-based)
        │   │   ├── Login.jsx          Role selector login (demo creds)
        │   │   ├── Overview.jsx       Doctor stats dashboard
        │   │   ├── UploadScan.jsx     Retina image upload + AI predict
        │   │   ├── AssessmentResults.jsx  ★ MERGED: v8 layout + VADR RetinaSVG viewer
        │   │   ├── AIAnalytics.jsx    Model metrics & trend charts
        │   │   ├── Reports.jsx        Scan history reports
        │   │   ├── Settings.jsx       User settings
        │   │   ├── PatientDashboard.jsx   Patient health portal
        │   │   ├── TechnicianDashboard.jsx Imaging console
        │   │   └── AdminDashboard.jsx     Platform management
        │   ├── PatientRecordsPage.jsx  VADR patient self-service
        │   └── PendingApprovalPage.jsx VADR doctor approval waiting
        ├── components/
        │   ├── Layout/        ★ NEW: Sidebar + Header + Layout (Tailwind)
        │   └── Dashboard/     ★ NEW: StatCard, Charts, RecentTable, SeverityBadge
        └── modules/p1-mid/    VADR staff portal (patients, users, RBAC, approvals)
```

---

## Login Entry Points

| URL | Auth System | Users |
|-----|-------------|-------|
| `/login` | VADR JWT (real backend) | admin@vadr.pk / admin123 (after seed) |
| `/dash/login` | Demo role selector (session) | See demo credentials on page |

From `/login`, click **"Open Dashboard →"** to reach the role-based dashboard.  
From `/dash/login`, click **"← Staff / JWT login"** to return to VADR login.

---

## Backend Setup

```bash
cd VADR_P1/vadr-backend

# Create .env from template
cp .env.example .env
# Edit .env — set MONGO_URI, SECRET_KEY, JWT_SECRET_KEY

# Install dependencies
pip install -r requirements.txt

# Run
python app.py
# → http://localhost:5000

# Seed demo users (first time only)
curl http://localhost:5000/api/seed
```

**Backend API namespaces:**
- `/api/auth/*` — JWT authentication
- `/api/admin/*` — Admin RBAC & approvals  
- `/api/patients/*` — Patient management
- `/api/users/*` — Staff users
- `/api/health` — Health check
- `/api/dashboard/*` — ★ Dashboard data (overview, predict, history, analytics, normalize, technicians, appointments, admin stats)

---

## Frontend Setup

```bash
cd VADR_P1/vadr-frontend

npm install        # installs React 18, Tailwind CSS, framer-motion, axios, etc.
npm start          # → http://localhost:3000
```

**Environment variable** (optional, defaults to localhost:5000):
```
REACT_APP_API_URL=http://localhost:5000/api
```

---

## Dashboard Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Doctor | dr.rahman | doctor123 |
| Patient | patient | patient123 |
| Technician | tech.ali | tech123 |
| Admin | admin | admin@vadr |

---

## Key Features Merged

- ✅ VADR JWT auth with email/password, OTP verification, refresh tokens
- ✅ Role-based routing: doctor, patient, technician, admin, screener
- ✅ Patient management, medical history CRUD
- ✅ Doctor approval workflow
- ✅ **RetinaSVG anatomical viewer** (VADR) merged into AssessmentResults
- ✅ **Detected findings panel** with confidence scores (VADR → AssessmentResults)
- ✅ **Image normalization** 7-step pipeline (v8) at `/api/dashboard/normalize`
- ✅ **PatientDashboard** — HbA1c trend, scan history, appointments
- ✅ **TechnicianDashboard** — scan queue, weekly performance
- ✅ **AdminDashboard** — full platform stats, manage patients/technicians/appointments
- ✅ MongoDB with seed data for both `vadr_db` (auth) and `dr_dashboard` (scans)
- ✅ Tailwind CSS + framer-motion + recharts throughout
