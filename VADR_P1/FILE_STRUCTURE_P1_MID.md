# VADR P1-Mid File Structure

Only the first two modules are organized here:

1. User Authentication & Security
2. Patient & User Management

## Backend (`vadr-backend`)

```text
vadr-backend/
├── app.py                                # Legacy single-file entry (kept for compatibility)
└── vadr_backend/
    ├── __init__.py                       # App factory + blueprint registration
    ├── config.py
    ├── db.py
    ├── routes/
    │   ├── auth.py                       # Module 1
    │   ├── patients.py                   # Module 2
    │   ├── users.py                      # Module 2
    │   └── system.py                     # health + seed
    ├── services/
    │   ├── auth_service.py
    │   └── mail_service.py
    └── utils/
        └── common.py
```

## Frontend (`vadr-frontend`)

```text
vadr-frontend/
└── src/
    ├── App.js
    ├── api.js                            # Existing shared API client (kept)
    ├── LoginPage.jsx                     # Existing file (kept)
    ├── RegisterPage.jsx                  # Existing file (kept)
    ├── vadr-module2.jsx                  # Existing Patient/User management UI (kept)
    └── modules/
        └── p1-mid/
            ├── auth/
            │   └── pages/
            │       ├── LoginPage.jsx
            │       └── RegisterPage.jsx
            ├── patient-user-management/
            │   └── pages/
            │       └── PatientUserManagementPage.jsx
            └── shared/
                └── api.js
```

## Notes

- Existing files were not removed to avoid breaking any current work.
- `App.js` now imports P1-mid pages from the module-based structure.
- This keeps your current implementation safe while giving you a cleaner structure to continue development.
