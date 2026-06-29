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
- users can see the active entitlement balance after entering AI PPT.
- users can generate a PPT from topic/template/source input.
- users can edit outline JSON before generation.
- users can regenerate one generated slide.
- retryable failures return a task ID that the workspace can retry.
- each user uses the entitlement returned by Moling launch verification before falling back to configured defaults.
- credit reserve, settle, and release are correct and idempotent.
- failed generation does not consume credits.
- exported PPTX/PDF files are downloadable by the owner only.
- logs, metrics, and reconciliation alerts are available.
- access control prevents cross-user data access.

## Third-Stage Acceptance Commands

Local deterministic acceptance uses the in-process Moling mock:

```bash
npm run acceptance
```

Real Moling acceptance requires a one-time launch ticket from the platform:

```bash
ACCEPTANCE_BASE_URL=http://127.0.0.1:5177 \
ACCEPTANCE_LAUNCH_TICKET=<real_launch_ticket> \
ACCEPTANCE_ENTITLEMENT_ID=<optional_entitlement_id> \
npm run acceptance:moling
```

The real command is the acceptance evidence for platform login, entitlement resolution, balance lookup, reserve/settle billing, slide regeneration consumption, generated file ownership, and call-log persistence. Local mock success is necessary for regression coverage but is not sufficient to claim full Moling联调完成.
