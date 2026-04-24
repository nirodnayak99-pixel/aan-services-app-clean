# Test Credentials

## Super Admin (seeded, cannot be deleted via API while logged in)
- **Email**: `admin@aanservices.in`
- **Password**: `Admin@123`
- **Role**: `admin`

## Roles
- `admin` (Super Admin) — full access: manage users, industries (add/edit/delete), employees (add/edit/delete), PDF & CSV export, view stats.
- `manager` — can onboard/edit employees, view industries, PDF & CSV export; CANNOT delete employees, CANNOT edit/delete/add industries, CANNOT manage users.

## Auth & User Management Endpoints
- `POST /api/auth/login` → returns `{user, access_token}`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/users` (admin only)
- `POST /api/users` (admin only) — `{email, name, password (>=6), role}`
- `DELETE /api/users/{id}` (admin only; cannot delete self)

## CSV Export
- `GET /api/employees/export.csv?industry_id=<optional>` (any authenticated)

## Notes
- Mobile app stores JWT in AsyncStorage under `aan_auth_token`
- Token TTL: 24 hours
- Brute force: 5 failed logins from the same `X-Forwarded-For` IP + email → 429 for 15 min
