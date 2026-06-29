# Auth Module

The auth foundation verifies Moling launch tickets through the Moling client, creates an application session cookie, and exposes current-user identity through `/api/me`.

Current implementation:

- `src/app.js`
- session cookie name from environment configuration
- session records are persisted in the `sessions` collection and cached in memory per process
- service restarts can restore a valid cookie by loading the session from the database
- sessions include `createdAt` and `expiresAt`; expired sessions are rejected
- `SESSION_TTL_SECONDS` controls the persisted session lifetime and defaults to 604800 seconds
- Moling `app_id` and `product_id` validation through `MOLING_APP_ID` and `MOLING_PRODUCT_ID`

Future work:

- CSRF protection
- production user profile persistence
