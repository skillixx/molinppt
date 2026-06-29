# Testing Strategy

## Test Levels

- unit tests for pure domain services
- adapter tests for Moling, storage, database, queue, and AI provider boundaries
- integration tests for generation task lifecycle
- billing tests for reserve, settle, release, consume, and idempotency
- end-to-end tests for Moling entry, generation, preview, export, and insufficient credit flows

## Required Scenarios

- valid Moling launch creates an application session
- invalid or expired launch ticket is rejected
- user cannot access another user's deck, file, or task
- generation reserves credits before AI work
- successful generation settles credits
- failed generation releases credits
- settle failure creates reconciliation state
- insufficient credits prevent AI provider calls
- export creates a downloadable file for the owner only

## Non-Functional Tests

- concurrent generation requests do not double-charge
- queue retry does not duplicate billing
- large uploads are rejected by configured limits
- logs redact tokens and passwords
- worker restart resumes or reconciles incomplete tasks

## First-Stage Verification

During the architecture-only phase, verification is limited to:

- required documents exist
- no business source code is present in the application workspace
- `.env.example` contains placeholders only
- README states the current phase constraints
