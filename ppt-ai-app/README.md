# PPT AI App

This directory contains the AI PPT business application for the Moling AI PPT tool.

## Commands

```bash
npm test
npm run migrate
npm start
npm run acceptance
```

## Environment

Copy `.env.example` locally and provide real values through environment variables or a secret manager. Do not commit real secrets.

Required for runtime:

- `MOLING_API_BASE_URL`
- `INTERNAL_API_TOKEN`

Moling launch and billing configuration:

- `MOLING_APP_ID` or compatibility alias `PPT_APP_ID`
- `MOLING_PRODUCT_ID` or compatibility alias `PPT_PRODUCT_ID`
- `MOLING_DEFAULT_ENTITLEMENT_ID` or compatibility alias `PPT_DEFAULT_ENTITLEMENT_ID`
- `APP_PORT` or compatibility alias `PORT`

Local acceptance can run with `LOCAL_MOLING_MOCK=true`, `LOCAL_MOLING_USER_ID`, and `LOCAL_MOLING_ENTITLEMENT_ID`.

## Foundation Modules

- configuration management
- structured logging
- JSON-file database initialization
- session authentication foundation
- Moling API wrapper
- billing wrapper
- owner permission checks
- local file upload/download
- in-memory task center
- AI provider abstraction
- template manager
- HTTP API foundation
- prompt manager
- PPT generation service
- PPTX/PDF exporter
- call log persistence

## Workspace Capabilities

- topic and document-to-outline generation
- editable outline JSON before deck generation
- deck generation with task status and balance refresh
- single-slide regeneration
- retry entry for failed generation tasks
- PPTX/PDF export and owner-checked download

## API Routes

- `GET /api/health`
- `GET /enter?ticket=...`
- `GET /api/me`
- `GET /api/templates`
- `GET /api/billing/balance`
- `POST /api/files`
- `GET /api/files/{file_id}`
- `POST /api/tasks`
- `GET /api/tasks/{task_id}`
- `POST /api/ppt/outlines`
- `PATCH /api/ppt/outlines/{outline_id}`
- `POST /api/ppt/decks`
- `GET /api/ppt/decks/{deck_id}/preview`
- `POST /api/ppt/decks/{deck_id}/exports`
- `POST /api/ppt/decks/{deck_id}/slides/{slide_id}/regenerate`
- `POST /api/ppt/tasks/{task_id}/retry`
- `GET /api/logs`
