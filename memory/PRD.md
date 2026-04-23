# AAN Services - Employee Onboarding App

## Problem Statement
Build a mobile app for AAN Services (aanservices.in) to:
1. Display the company website inside the app (WebView)
2. Onboard employees with Aadhaar card photo
3. Tag each employee with the industry where they are placed

## Solution Overview
React Native Expo app with multi-role JWT auth (Super Admin + Manager). FastAPI + MongoDB.

## Roles
- **Super Admin** — full access (manage users, industries CRUD, delete employees, PDF/CSV export, stats)
- **Manager** — onboard/update employees, view industries, PDF/CSV export; cannot delete or manage users

## Features
- Admin Login (JWT Bearer, bcrypt, brute-force lockout 5→429 with X-Forwarded-For aware)
- Home Dashboard (stats + recent onboardings + Onboard CTA)
- Website tab (embedded aanservices.in WebView)
- Employees tab (list, search, industry filter chips, CSV export, detail view)
- Industries tab (admin: CRUD; manager: read-only)
- Employee Detail (full profile, Aadhaar photo, "Share Onboarding PDF" — native share sheet / web print)
- Onboard Employee form (all fields, Aadhaar via camera or gallery, base64 to MongoDB)
- Profile tab (user info, logout, website link, "Manage Users" for admin)
- User Management screen (admin creates managers/admins, delete non-self users)

## Admin Credentials
- Email: `admin@aanservices.in`
- Password: `Admin@123`

## Seeded Industries
Manufacturing, IT & Software, Retail, Hospitality, Construction, Healthcare, Logistics & Warehousing, Security Services

## API Endpoints (all `/api`)
- `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `GET/POST /industries`, `PUT/DELETE /industries/{id}` (admin for writes)
- `GET/POST /employees`, `GET/PUT /employees/{id}`, `DELETE /employees/{id}` (admin), `GET /employees/export.csv`
- `GET/POST /users`, `DELETE /users/{id}` (admin only)
- `GET /stats`

## Tech
Backend: FastAPI, motor, PyJWT, bcrypt  
Frontend: Expo SDK 54, expo-router, react-native-webview, expo-image-picker (17.0.10), AsyncStorage (2.2.0), expo-print, expo-sharing, expo-file-system

## Testing
47/47 backend pytest passing; frontend regression 7/7 passing.

## Future Enhancements
- PDF batch export (per-industry)
- Audit log of onboardings by actor
- Photo compression/verification before base64 upload
- Toast notifications (replace blocking Alert on save)
