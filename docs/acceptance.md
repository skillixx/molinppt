# Acceptance Criteria

## First-Stage Acceptance

The architecture phase is accepted when:

- `docs/` contains the required core documents.
- Requirements, project overview, architecture, technology, database, API, workflow, user flow, Moling integration, billing, file management, permission, logging, error handling, deployment, modules, development plan, testing, and acceptance designs are documented.
- Root `README.md` explains the project and current phase limits.
- Root `.env.example` lists required configuration variables without real values.
- `ppt-ai-app/` is initialized but contains no business logic.
- No committed file contains real Moling internal tokens, test passwords, or production platform URLs.
- Work stops after documentation and project initialization.

## Future Production Acceptance

Later implementation phases must prove:

- Moling users can enter with SSO.
- users can generate a PPT from topic/template/source input.
- credit reserve, settle, and release are correct and idempotent.
- failed generation does not consume credits.
- exported PPTX/PDF files are downloadable by the owner only.
- logs, metrics, and reconciliation alerts are available.
- access control prevents cross-user data access.
