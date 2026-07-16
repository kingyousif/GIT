# Endo Backend

Fastify-based REST API for the Endoscopy Management System.

## Quick Start

```bash
cd backend
pnpm install
pnpm seed       # Creates default admin user (admin / admin123)
pnpm dev        # Starts dev server with hot reload on port 4000
```

## API Endpoints

### Auth
- `POST /api/auth/login` — `{ username, password }` → sets session cookie
- `GET /api/auth/me` — returns current user from cookie
- `POST /api/auth/logout` — clears session cookie
- `POST /api/auth/register` — create user `{ username, password, displayName, role }`
- `GET /api/auth/users` — list all users
- `PATCH /api/auth/users/:id` — update user
- `DELETE /api/auth/users/:id` — delete user

### Patients
- `GET /api/patients` — list all
- `GET /api/patients/:id` — single patient
- `POST /api/patients` — create patient + first session
- `PATCH /api/patients/:id` — update patient
- `DELETE /api/patients/:id` — delete patient + sessions
- `GET /api/patients/:id/sessions` — sessions for patient
- `POST /api/patients/:id/sessions` — new session for existing patient

### Sessions
- `GET /api/sessions` — list (filter: `?status=`, `?date=`, `?patientId=`)
- `GET /api/sessions/:id` — single session with patient + report joined
- `PATCH /api/sessions/:id` — update session
- `DELETE /api/sessions/:id` — delete session + report

### Reports
- `GET /api/reports` — list (filter: `?sessionId=`, `?status=`)
- `GET /api/reports/:id` — single report
- `POST /api/reports` — create/update (upsert by sessionId)
- `DELETE /api/reports/:id` — delete report

### Settings & Templates
- `GET /api/settings` — get settings
- `PUT /api/settings` — replace settings
- `PATCH /api/settings` — partial update
- `GET /api/templates` — list templates
- `POST /api/templates` — create/update template
- `DELETE /api/templates/:id` — delete template

### Media
- `GET /api/media?sessionId=xxx` — list media metadata for session
- `GET /api/media/check?sessionId=xxx` — quick check if server has data
- `GET /api/media/download-info?sessionId=xxx` — total size + item list (for progress)
- `GET /api/media/blob/:sessionId/:mediaId` — stream binary file (with Content-Length)
- `POST /api/media/upload` — upload single file (multipart: file + sessionId + metadata fields)
- `POST /api/media/upload-batch` — upload multiple files
- `PATCH /api/media/:sessionId/:mediaId` — update label/annotations
- `DELETE /api/media/:sessionId/:mediaId` — delete single item
- `DELETE /api/media/:sessionId` — delete all media for session

## Media Storage Structure

```
data/media/
  PatientName__PT-001__2026-05-24__upper-endoscopy/
    images/
      abc123.png
      def456.jpg
    videos/
      ghi789.webm
    documents/
      jkl012.html
    _meta.json
  _session_map.json
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | Server port |
| HOST | 0.0.0.0 | Bind address |
| COOKIE_SECRET | (dev default) | Secret for cookie signing |
| CORS_ORIGINS | http://localhost:3000 | Comma-separated allowed origins |
| DATA_DIR | ./data | Where JSON + media files are stored |

## Connecting the Frontend

Set the backend URL in your Next.js frontend by adding to `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Then update your client-side fetch calls to use this base URL.
