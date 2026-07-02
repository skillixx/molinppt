# CLAUDE.md

This file provides guidance when working in this repository.

## Repository Layout

This repo is a workspace for building an AI PPT generator application that plugs into the Moling (魔灵) platform.

- `ppt-ai-app/` — active second-stage foundation framework.
- `docs/` — architecture, API, database, deployment, and module design documents.
- `docs/modules/` — module-level implementation notes.
- `app/` — Moling platform billing, product, and integration reference documents.
- `presenton/` — vendored upstream reference project. Use it only for product-experience analysis unless a task explicitly targets Presenton.
- `presenton-analysis.md` — local analysis of Presenton behavior and product patterns.

## Current Phase

Current phase: second-stage foundation framework.

Implemented boundaries:

- configuration management
- JSON-file database initialization
- session authentication foundation
- Moling internal API wrapper
- billing wrapper
- structured logging
- file upload/download foundation
- task center
- AI provider abstraction
- template manager
- API foundation routes
- permission checks
- application error handling
- Docker and CI configuration

## Commands

Run from `ppt-ai-app/`:

```bash
npm test
npm run migrate
npm start
```

## Configuration

All runtime configuration must come from environment variables. Never commit real values for:

- `MOLING_API_BASE_URL`
- `INTERNAL_API_TOKEN`
- `TEST_ACCOUNT`
- `TEST_PASSWORD`

Use `.env.example` and `ppt-ai-app/.env.example` as placeholder-only references.

## Integration Rules

- Only backend code may call Moling internal APIs.
- Only the billing module may reserve, settle, release, or consume credits.
- Browser code must never receive internal tokens, provider keys, or storage credentials.
- Expensive operations use reserve -> settle/release with stable idempotency keys.
- Cheap known-cost operations may use consume.
- All exported classes and methods should have JSDoc comments.
