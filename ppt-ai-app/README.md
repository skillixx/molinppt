# PPT AI App Integration Shell

This is the first integration slice for the Moling PPT AI application.

It verifies:

- `/enter?ticket=...` SSO launch ticket exchange
- app/product identity checks
- entitlement balance lookup
- mock PPT generation with `reserve -> settle`
- mock failure with `reserve -> release`

## Run locally

Set environment variables without committing secrets:

```bash
export MOLING_API_BASE_URL="http://8.130.9.163:8080"
export INTERNAL_API_TOKEN="<secure token>"
export PPT_APP_ID="15"
export PPT_PRODUCT_ID="73"
export PPT_DEFAULT_ENTITLEMENT_ID="62"
export PORT="5177"
npm start
```

Open the app through Moling platform launch:

```text
http://your-app-host:5177/enter?ticket=lt_xxx
```

For current test data, entitlement `62` belongs to test user `479` and has `ppt_ai_credits`.

## Tests

```bash
npm test
```

## Current platform gap

The current Moling API exposes `GET /api/internal/entitlement-balance` only when
the app already knows `entitlement_id`. The SSO `verify` response provides
`user_id/app_id/product_id`, but not entitlement IDs.

For production, add one of these platform-side options:

- return active `ppt_ai_credits` entitlement in `app-launch/verify`
- add an internal endpoint to list entitlements by `user_id + product_id`
- pass an app-scoped user token that can call `/api/my/entitlements`
