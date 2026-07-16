# Endoscopy & Colonoscopy Management System

A complete Next.js 14 App Router project for a hospital GI endoscopy unit.

## Stack

- Next.js 14+
- TypeScript (strict)
- Tailwind CSS
- React Hook Form + Zod
- Shadcn-style UI components
- LocalStorage persistence
- date-fns
- Recharts
- Sonner

## Features

- Role selector with `secretary`, `doctor`, and `admin`
- Patient registration and scheduling
- Daily dashboard
- Searchable patient/session archive
- Media capture with MediaDevices API
- Screenshot, video recording, file upload, annotations
- Report builder with templates and auto-save
- Print-ready report preview
- Reports archive
- Statistics dashboard
- Settings, doctors, template CRUD, data import/export/reset
- Initial seeded demo data

## LocalStorage keys

- `endo_patients`
- `endo_sessions`
- `endo_reports`
- `endo_templates`
- `endo_settings`
- `endo_role`
- `endo_media_{sessionId}`

## Run

```bash
npm install
npm run dev
```
