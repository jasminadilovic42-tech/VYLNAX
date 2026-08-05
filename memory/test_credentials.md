# VYLNAX PRO — Test Credentials & Identities

## Authentication
- Method: **Emergent-managed Google Auth** (OAuth). No app-managed passwords.
- Login: tap "Mit Google anmelden" on the login screen → complete Google flow.
- Session token stored in `expo-secure-store` (key: `vylnax_session_token`), 7-day expiry.

## Test Flow (Testing Agent)
- Google OAuth cannot be automated headless. For API testing, obtain a valid `session_token` by completing the Google flow once, then call `POST /api/auth/session` with `{ "session_token": "<id>" }` to get a bearer token.
- All authenticated endpoints require header: `Authorization: Bearer <session_token>`.

## Roles (RBAC — user-selectable in Profile)
- `patient` (default on signup)
- `relative` (Angehörige:r)
- `caregiver` (Pflegekraft)
- Roles change dashboard framing only; data access is per-owner (each user manages their own patients).

## Auto-created data
- On first login, a self-patient ("Ich") is auto-created for the user.

## Key API Endpoints
- POST /api/auth/session, GET /api/auth/me, POST /api/auth/logout, PUT /api/auth/role
- GET/POST /api/patients, DELETE /api/patients/{id}
- GET/POST /api/patients/{id}/medications, DELETE /api/medications/{id}
- GET /api/patients/{id}/schedule?date_str=YYYY-MM-DD
- POST /api/intake  (status: taken|missed)
- GET /api/patients/{id}/reports?period=day|week|month
- GET /api/patients/{id}/device
- POST /api/sos
