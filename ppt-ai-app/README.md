# PPT AI App

This directory contains the AI PPT business application for the Moling AI PPT tool.

## Commands

```bash
npm test
npm run migrate
npm start
npm run acceptance
npm run acceptance:moling
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
- `SESSION_TTL_SECONDS` optionally controls application session lifetime and defaults to 604800 seconds.
- `SESSION_COOKIE_SECURE` optionally controls the cookie `Secure` attribute; it defaults to true when `APP_ENV=production`.
- `LLM_TIMEOUT_MS` optionally controls HTTP AI provider request timeout and defaults to 30000 ms.
- `LLM_MAX_RETRIES` optionally controls HTTP AI provider transient-failure retries and defaults to 0.
- `LLM_MODEL` is the model name sent to the provider (for example `deepseek-v4-flash`).

Deepseek/OpenAI-style providers should set:

- `LLM_PROVIDER=http`
- `LLM_API_URL=https://api.deepseek.com/chat/completions`
- `LLM_API_KEY=<your token>`
- `LLM_MODEL=deepseek-v4-flash`

For legacy self-hosted adapters, keep `LLM_API_URL` in legacy format and return the legacy payload fields directly.

Local acceptance can run with `LOCAL_MOLING_MOCK=true`, `LOCAL_MOLING_USER_ID`, and `LOCAL_MOLING_ENTITLEMENT_ID`.

Local acceptance exports PPTX/PDF, downloads both files through `GET /api/files/{file_id}/download-url`, checks filename headers, and verifies download call logs.

Real Moling acceptance requires `ACCEPTANCE_LAUNCH_TICKET` from the platform entry flow and can optionally pass `ACCEPTANCE_ENTITLEMENT_ID`.

## Foundation Modules

- configuration management
- structured logging
- JSON-file database initialization
- persisted session authentication foundation
- Moling API wrapper
- billing wrapper
- owner permission checks
- local file upload/download
- in-memory task center
- AI provider abstraction
- template manager with default `business`, `education`, and `pitch` catalog
- HTTP API foundation
- prompt manager
- PPT generation service
- PPTX/PDF exporter
- call log persistence

## Workspace Capabilities

- topic and document-to-outline generation
- dynamic template and theme selection from `/api/templates`
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
- `GET /api/files/{file_id}/download-url`
- `POST /api/tasks`
- `GET /api/tasks/{task_id}`
- `POST /api/ppt/outlines`
- `PATCH /api/ppt/outlines/{outline_id}`
- `POST /api/ppt/decks`
- `GET /api/ppt/decks/{deck_id}/preview`
- `POST /api/ppt/decks/{deck_id}/exports`
- `POST /api/ppt/decks/{deck_id}/slides/{slide_id}/regenerate`
- `GET /api/ppt/tasks/{task_id}`
- `POST /api/ppt/tasks/{task_id}/retry`
- `GET /api/logs`
- `POST /internal/reconcile`

`POST /api/files` accepts canonical base64 content only. Files must be non-empty, no larger than 2 MiB, and use one of these MIME types: `text/plain`, `text/markdown`, `application/json`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, or `application/vnd.openxmlformats-officedocument.presentationml.presentation`.

`GET /api/files/{file_id}/download-url` returns a five-minute signed URL for owner-scoped downloads. `GET /api/files/{file_id}` remains owner-checked for direct compatibility. Both signed and direct downloads return `Content-Disposition` with a sanitized filename and record a `file_downloaded` call log.

`POST /api/ppt/decks/{deck_id}/exports` accepts only `pptx` and `pdf` formats.

`POST /internal/reconcile` is for operations only. It requires `X-Internal-Token: <INTERNAL_API_TOKEN>` and retries pending Moling settlement events.
