# Auth Module

The auth foundation verifies Moling launch tickets through the Moling client, creates an application session cookie, and exposes current-user identity through `/api/me`.

Current implementation:

- `src/app.js`
- session cookie name from environment configuration
- in-memory session map for foundation stage
- Moling `app_id` and `product_id` validation through `MOLING_APP_ID` and `MOLING_PRODUCT_ID`

Future work:

- persistent sessions
- session expiry
- CSRF protection
- production user profile persistence
