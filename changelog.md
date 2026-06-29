# Changelog

## Unreleased

- Added third-stage AI PPT business workflow.
- Added topic and uploaded-document outline generation.
- Added editable outline persistence and deck generation.
- Added template, theme, and slide-count controls.
- Added single-slide regeneration.
- Added online HTML preview.
- Added PPTX and PDF export file generation.
- Added generation task status, progress, failure state, and retry.
- Added prompt manager and PPT orchestration service.
- Added Moling balance, reserve, settle, release, and consume integration in business workflow.
- Added call log persistence and API access.
- Added end-to-end business tests for login -> outline -> edit -> deck -> preview -> PPTX/PDF -> billing -> logs.
- Added local Moling mock mode and `npm run acceptance` for full HTTP acceptance without external credentials.
- Replaced placeholder export payloads with minimal PPTX ZIP and PDF document generation.
- Added the second-stage foundation framework for the Moling AI PPT application.
- Added environment-based configuration management.
- Added JSON-file database initialization for local development and tests.
- Added Moling internal API wrapper and prepaid billing wrapper.
- Added session-based authentication foundation and owner permission checks.
- Added structured logging, application errors, task center, template manager, local file upload/download, and mock AI provider abstraction.
- Added HTTP API foundation routes for health, entry, current user, templates, files, and tasks.
- Added Dockerfile, docker-compose, and GitHub Actions CI configuration.
- Updated architecture, database, API, deployment, module, README, and environment documentation.
