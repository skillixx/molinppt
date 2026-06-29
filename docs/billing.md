# Billing Design

## Billing Model

Use Moling prepaid credits. Users purchase credit packages on Moling. The application consumes those credits through Moling entitlement APIs.

## Chargeable Actions

Initial production candidates:

- full PPT generation: reserve, then settle or release
- slide regeneration: consume or reserve depending on cost
- AI image generation: consume per image
- export: initially free, can become chargeable later

Exact prices are product configuration, not hardcoded application constants.

## Reserve and Settle Flow

Expensive or failure-prone actions use reserve first:

1. Create application task with a stable idempotency key.
2. Reserve credits through Moling entitlement API.
3. Enqueue the task only after reserve succeeds.
4. Settle the hold when generation succeeds.
5. Release the hold when generation fails.

## Idempotency

Every billing operation has a deterministic idempotency key based on task ID and operation type.

Examples:

- `{task_id}:ppt_generate:reserve`
- `{task_id}:ppt_generate:settle`
- `{task_id}:ppt_generate:release`

## Reconciliation

The application records billing events locally so operations can be retried safely.

States: `reserve_pending`, `reserved`, `settle_pending`, `settled`, `release_pending`, `released`, `reconcile_failed`.

## Platform Boundary

- `INTERNAL_API_TOKEN` is read from environment variables only.
- Moling internal APIs are called only from the backend.
- Frontend receives balance and task status through application APIs.
- Logs must not include internal tokens, user passwords, or raw provider credentials.

## Second-Stage Wrapper

The current framework provides `src/billing.js` as the central billing adapter. It wraps:

- balance lookup
- reserve credits
- settle credits
- release credits
- consume credits

All Moling IDs are coerced to JSON numbers at the adapter boundary, while credit amounts remain decimal strings.

## User Experience

- If credits are insufficient, generation is blocked before AI work starts.
- Failed generation after reserve shows a refund or release status.
- Pending reconciliation is visible as a task state and monitored by operations.
