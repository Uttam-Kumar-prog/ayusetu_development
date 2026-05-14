# AyuSetu Agent Guide

## Project Layout

- `backend`: Express + MongoDB API (auth, symptoms, doctors, appointments, chats, therapy, pharmacy, admin, analytics).
- `frontend`: React + Vite SPA.

## Primary Docs

- Backend API overview and endpoint map: [backend/README.md](backend/README.md)
- Frontend setup baseline: [frontend/README.md](frontend/README.md)

## Run Commands

- Backend install: `cd backend && npm install`
- Backend dev server: `cd backend && npm run dev`
- Backend prod-mode start: `cd backend && npm run start:prod`
- Frontend install: `cd frontend && npm install`
- Frontend dev server: `cd frontend && npm run dev`
- Frontend production build: `cd frontend && npm run build`

## Backend Conventions

- Keep route-level validation at the route boundary using `express-validator` and `backend/middleware/validate.js`.
- Use auth middleware in this order when needed: `protect` then `authorize(...)`.
- For operational errors in controllers, throw `ApiError` from `backend/utils/ApiError.js`.
- Keep public self-registration roles restricted to: `patient`, `doctor`, `pharmacy`.
- Keep scripts Windows-compatible when setting env vars (already uses `cross-env`).

## Frontend Conventions

- API calls should be centralized via `frontend/src/utils/api.js`.
- Bearer token is injected by Axios interceptor from `localStorage` key `token`.
- Auth user profile in context is persisted separately under `localStorage` key `ayur_user`.
- API base URL can be overridden with `VITE_API_URL` (default: `http://localhost:5000/api`).

## Current Integration Status

- Auth is live-wired: `Login` and registration flows call backend auth endpoints and persist JWT token.
- Patient symptom flow is live-wired: `SymptomInput` posts to `/api/symptoms/submit` and routes to `Results`.
- Patient dashboard is live-wired: loads `/api/symptoms/history` and `/api/appointments/mine`.
- Doctor discovery/profile are live-wired: list/details/availability from `/api/doctors` endpoints.
- Booking is live-wired: doctor profile books through `/api/appointments`.
- Doctor dashboard is live-wired: loads `/api/appointments/mine`, updates statuses via `/api/appointments/:id/status`.

## Practical Pitfalls

- If login appears successful but protected API calls fail with `401`, verify `token` is written to `localStorage` (not only `ayur_user`).
- Keep backend response shape predictable (`{ success, message?, ...payload }`) to reduce frontend branching.
- Prefer backend API as source of truth; keep localStorage as a temporary fallback only.
- When adding a backend endpoint, update all three together:
  1. Route validator + middleware chain
  2. Controller behavior and `ApiError` handling
  3. Frontend API wrapper usage

## Change Scope Rules

- Prefer small, focused edits; avoid broad refactors in unrelated modules.
- After edits, run diagnostics and at least one smoke path for changed endpoints/pages.
