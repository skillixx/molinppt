# AI PPT Tool for Moling

This repository contains the AI PPT tool business implementation for a Moling platform application.

Implemented:

- project initialization
- configuration management
- JSON-file database initialization for local development
- session authentication foundation
- Moling platform API wrapper
- billing API wrapper
- structured logging
- file upload and download foundation
- task center
- AI provider abstraction
- template manager
- API foundation routes
- permission checks
- application error handling
- unit tests
- Docker and CI configuration
- topic-to-PPT generation
- uploaded-document-to-PPT outline generation
- AI outline generation and editing
- deck generation with template, theme, and page-count control
- single-slide regeneration
- online preview
- PPTX and PDF exports
- task status, progress, failed-task retry
- prompt management
- Moling balance, permission, billing, file, and call-log integration boundaries

## Documentation

Core design and implementation documents live in `docs/`:

- `requirements.md`
- `project-overview.md`
- `architecture.md`
- `technology.md`
- `directory.md`
- `database.md`
- `api.md`
- `workflow.md`
- `billing.md`
- `deployment.md`
- `user-flow.md`
- `moling-integration.md`
- `development-plan.md`
- `modules.md`
- `file-management.md`
- `permissions.md`
- `logging.md`
- `error-handling.md`
- `testing.md`
- `acceptance.md`
- `modules/`

Change history lives in `changelog.md`.

## Configuration

All runtime configuration must come from environment variables. Copy `.env.example` locally and never commit real secrets.

Required runtime variables:

- `MOLING_API_BASE_URL`
- `INTERNAL_API_TOKEN`
- `MOLING_APP_ID`
- `MOLING_PRODUCT_ID`

Optional AI provider variables:

- `LLM_PROVIDER=mock` for local deterministic generation
- `LLM_PROVIDER=http` with `LLM_API_URL` and `LLM_API_KEY` for an external provider adapter

For local end-to-end acceptance without real Moling credentials, set:

- `LOCAL_MOLING_MOCK=true`
- `LOCAL_MOLING_USER_ID`
- `LOCAL_MOLING_ENTITLEMENT_ID`
- `LOCAL_MOLING_INITIAL_CREDITS`

## Commands

```bash
cd ppt-ai-app
npm test
npm run migrate
npm start
npm run acceptance
npm run acceptance:moling
```

## Docker

```bash
docker compose up --build

# Production deploy (recommended)
docker compose -f docker-compose.prod.yml up -d --build
```

Production compose uses `APP_ENV=production`, `SESSION_COOKIE_SECURE=true`, and a persistent `/data` volume.
